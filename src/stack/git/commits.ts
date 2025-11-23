import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { StackCommit, FileChange, Hunk } from '../../common/types'
import { logger } from '../../common/utils/logger'

const execAsync = promisify(exec)

/**
 * Gets the current branch name
 */
const getCurrentBranch = async (gitRoot: string): Promise<string> => {
  try {
    const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
      cwd: gitRoot,
    })
    return stdout.trim()
  } catch (error) {
    logger.error('Failed to get current branch:', error)
    return 'HEAD'
  }
}

/**
 * Determines the base branch to compare against
 */
const getBaseBranch = async (gitRoot: string): Promise<string> => {
  // Try origin/main first, then origin/master, then main, then master
  const branches = ['origin/main', 'origin/master', 'main', 'master']

  for (const branch of branches) {
    try {
      await execAsync(`git rev-parse --verify ${branch}`, { cwd: gitRoot })
      return branch
    } catch {
      // Branch doesn't exist, try next
    }
  }

  return 'main' // fallback
}

/**
 * Fetches the commit history with full diff information
 * Only returns commits that are ahead of the base branch (like a PR)
 */
export const getCommitHistory = async (
  gitRoot: string,
  numCommits: number,
  customBaseBranch?: string,
  customCurrentBranch?: string
): Promise<StackCommit[]> => {
  try {
    // Get current branch and base branch
    const currentBranch = customCurrentBranch || (await getCurrentBranch(gitRoot))
    const baseBranch = customBaseBranch || (await getBaseBranch(gitRoot))

    logger.info(`Branch comparison - custom current: ${customCurrentBranch}, custom base: ${customBaseBranch}`)
    logger.info(`Branch comparison - resolved current: ${currentBranch}, resolved base: ${baseBranch}`)

    // Get commits between base and current (commits ahead of base)
    // Use the range syntax: base..branch to get commits in branch but not in base
    const logCommand = `git log ${baseBranch}..${currentBranch} --pretty=format:"%H|%an|%ad|%s" --date=short`
    const { stdout: logOutput } = await execAsync(logCommand, { cwd: gitRoot })

    if (!logOutput.trim()) {
      logger.warn('No commits ahead of base branch')
      return []
    }

    const commitLines = logOutput.trim().split('\n')
    const commits: StackCommit[] = []

    for (const line of commitLines) {
      const [hash, author, date, message] = line.split('|')
      const shortHash = hash.substring(0, 7)

      // Get files changed in this commit
      const { stdout: filesOutput } = await execAsync(
        `git diff-tree --no-commit-id --name-only -r ${hash}`,
        { cwd: gitRoot }
      )
      const filesChanged = filesOutput
        .trim()
        .split('\n')
        .filter((f) => f.length > 0)

      // Get detailed diff for this commit
      const changes = await getCommitDiff(gitRoot, hash)

      commits.push({
        commit: {
          hash,
          shortHash,
          author,
          date,
          message,
          filesChanged,
        },
        changes,
        selected: false,
      })
    }

    logger.debug(`Successfully parsed ${commits.length} commits`)
    return commits
  } catch (error) {
    logger.error('Failed to get commit history:', error)
    throw new Error(
      `Failed to fetch commits: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Gets the detailed diff for a specific commit
 */
const getCommitDiff = async (
  gitRoot: string,
  commitHash: string
): Promise<FileChange[]> => {
  try {
    // Get unified diff with 3 lines of context
    const { stdout: diffOutput } = await execAsync(
      `git show ${commitHash} --unified=3 --format=`,
      { cwd: gitRoot, maxBuffer: 10 * 1024 * 1024 } // 10MB buffer
    )

    return parseDiff(diffOutput)
  } catch (error) {
    logger.error(`Failed to get diff for ${commitHash}:`, error)
    return []
  }
}

/**
 * Parses a unified diff into structured FileChange objects
 */
const parseDiff = (diffOutput: string): FileChange[] => {
  const files: FileChange[] = []
  const lines = diffOutput.split('\n')

  let currentFile: FileChange | null = null
  let currentHunk: Hunk | null = null
  let hunkContent: string[] = []
  let hunkCounter = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // File header: diff --git a/path b/path
    if (line.startsWith('diff --git')) {
      // Save previous hunk and file
      if (currentFile && currentHunk) {
        currentHunk.content = hunkContent.join('\n')
        currentFile.hunks.push(currentHunk)
      }
      if (currentFile) {
        files.push(currentFile)
      }

      // Parse new file
      const match = line.match(/diff --git a\/(.+) b\/(.+)/)
      if (match) {
        const fileName = match[2]
        currentFile = {
          id: `file-${files.length}`,
          fileName,
          changeType: 'modified',
          hunks: [],
        }
        hunkCounter = 0
      }
      currentHunk = null
      hunkContent = []
      continue
    }

    if (!currentFile) continue

    // Detect file status
    if (line.startsWith('new file mode')) {
      currentFile.changeType = 'added'
    } else if (line.startsWith('deleted file mode')) {
      currentFile.changeType = 'deleted'
    } else if (line.startsWith('rename from')) {
      currentFile.changeType = 'renamed'
      currentFile.oldPath = line.replace('rename from ', '')
    }

    // Hunk header: @@ -oldStart,oldLines +newStart,newLines @@
    if (line.startsWith('@@')) {
      // Save previous hunk
      if (currentHunk) {
        currentHunk.content = hunkContent.join('\n')
        currentFile.hunks.push(currentHunk)
      }

      // Parse hunk header
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/)
      if (match) {
        currentHunk = {
          id: `${currentFile.id}-hunk-${hunkCounter++}`,
          fileId: currentFile.id,
          oldStart: Number.parseInt(match[1], 10),
          oldLines: match[2] ? Number.parseInt(match[2], 10) : 1,
          newStart: Number.parseInt(match[3], 10),
          newLines: match[4] ? Number.parseInt(match[4], 10) : 1,
          content: '',
          header: line,
        }
        hunkContent = [line]
      }
      continue
    }

    // Hunk content (context, additions, deletions)
    if (
      currentHunk &&
      (line.startsWith(' ') ||
        line.startsWith('+') ||
        line.startsWith('-') ||
        line.startsWith('\\'))
    ) {
      hunkContent.push(line)
    }
  }

  // Save last hunk and file
  if (currentFile && currentHunk) {
    currentHunk.content = hunkContent.join('\n')
    currentFile.hunks.push(currentHunk)
  }
  if (currentFile) {
    files.push(currentFile)
  }

  return files
}
