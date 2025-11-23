import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { StackCommit, FileChange, Hunk } from '../../common/types'
import { logger } from '../../common/utils/logger'

const execAsync = promisify(exec)

/**
 * Fetches the commit history with full diff information
 */
export const getCommitHistory = async (
  gitRoot: string,
  numCommits: number
): Promise<StackCommit[]> => {
  try {
    // Get commit list with format: hash|author|date|message
    const logCommand = `git log -n ${numCommits} --pretty=format:"%H|%an|%ad|%s" --date=short`
    const { stdout: logOutput } = await execAsync(logCommand, { cwd: gitRoot })

    if (!logOutput.trim()) {
      logger.warn('No commits found')
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
