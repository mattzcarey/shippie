import { execFileSync } from 'node:child_process'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { RestackRequest, RestackLine } from '../../common/types'
import { logger } from '../../common/utils/logger'

/**
 * Applies a restack operation by creating new commits from selected lines.
 *
 * Strategy:
 * 1. Create a backup branch
 * 2. Reset to base commit
 * 3. For each new commit, apply the selected line changes
 * 4. Stage and commit
 *
 * Note: This is a simplified implementation that appends additions and removes deletions.
 * A production implementation would need proper hunk reconstruction with line number tracking.
 */
export async function applyRestack(gitRoot: string, request: RestackRequest): Promise<void> {
  logger.info(`Starting restack operation with ${request.newCommits.length} new commits`)

  // Validate input
  if (request.newCommits.length === 0) {
    throw new Error('No commits to create')
  }

  // Get current branch
  const currentBranch = execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
    cwd: gitRoot,
    encoding: 'utf-8',
  }).trim()

  logger.info(`Current branch: ${currentBranch}`)

  // Get the base commit hash
  const baseCommitHash = execFileSync('git', ['rev-parse', request.baseBranch], {
    cwd: gitRoot,
    encoding: 'utf-8',
  }).trim()

  logger.info(`Base commit: ${baseCommitHash}`)

  // Create a backup branch
  const backupBranch = `backup-${currentBranch}-${Date.now()}`
  execFileSync('git', ['branch', backupBranch], { cwd: gitRoot })
  logger.info(`Created backup branch: ${backupBranch}`)

  try {
    // Reset to base commit
    execFileSync('git', ['reset', '--hard', baseCommitHash], { cwd: gitRoot })
    logger.info('Reset to base commit')

    // Create each new commit
    for (let i = 0; i < request.newCommits.length; i++) {
      const commit = request.newCommits[i]
      logger.info(`Creating commit ${i + 1}/${request.newCommits.length}: ${commit.message}`)

      // Get the lines for this commit
      const commitLines = request.allLines.filter((line) => commit.lineIds.includes(line.id))

      if (commitLines.length === 0) {
        logger.warn(`Commit "${commit.message}" has no lines, skipping`)
        continue
      }

      // Group lines by file
      const linesByFile = new Map<string, RestackLine[]>()
      for (const line of commitLines) {
        const existing = linesByFile.get(line.fileName) || []
        existing.push(line)
        linesByFile.set(line.fileName, existing)
      }

      logger.info(`  Modifying ${linesByFile.size} files`)

      // For each file, apply the changes
      for (const [fileName, lines] of linesByFile.entries()) {
        applyLinesToFile(gitRoot, fileName, lines)
      }

      // Stage all changes
      execFileSync('git', ['add', '-A'], { cwd: gitRoot })

      // Create the commit
      execFileSync('git', ['commit', '-m', commit.message], {
        cwd: gitRoot,
      })

      logger.info(`  ✓ Commit created`)
    }

    logger.info('✓ Restack completed successfully')
    logger.info(`Backup branch created: ${backupBranch}`)
  } catch (error) {
    // Restore from backup
    logger.error('Restack failed, restoring from backup')
    execFileSync('git', ['reset', '--hard', backupBranch], { cwd: gitRoot })
    execFileSync('git', ['branch', '-D', backupBranch], { cwd: gitRoot })
    throw error
  }
}

/**
 * Apply selected lines to a file.
 *
 * Simplified strategy:
 * 1. Get current file content from HEAD
 * 2. Apply deletions (remove matching lines)
 * 3. Apply additions (append to file)
 * 4. Write the file
 *
 * Note: This is a naive implementation. A proper implementation would:
 * - Parse the original hunks to determine correct insertion points
 * - Track line number offsets as changes are applied
 * - Handle conflicts when lines can't be matched
 */
function applyLinesToFile(
  gitRoot: string,
  fileName: string,
  selectedLines: RestackLine[]
): void {
  logger.debug(`  Applying ${selectedLines.length} lines to ${fileName}`)

  // Get the current file content (from HEAD)
  let currentContent = ''
  try {
    currentContent = execFileSync('git', ['show', `HEAD:${fileName}`], {
      cwd: gitRoot,
      encoding: 'utf-8',
    })
  } catch {
    // File doesn't exist at HEAD, which is fine (it might be a new file)
    logger.debug(`  File ${fileName} doesn't exist at HEAD, starting with empty content`)
  }

  // Separate additions and deletions
  const additions = selectedLines.filter((l) => l.lineType === 'add')
  const deletions = selectedLines.filter((l) => l.lineType === 'delete')

  logger.debug(`  ${additions.length} additions, ${deletions.length} deletions`)

  // Apply deletions: remove matching lines
  let newContent = currentContent
  for (const deletion of deletions) {
    const lineContent = deletion.content.slice(1) // Remove the '-' prefix
    // Remove the first occurrence of this line
    newContent = newContent.replace(lineContent + '\n', '')
  }

  // Apply additions: append to file
  const addedLines = additions.map((line) => line.content.slice(1)) // Remove the '+' prefix
  if (addedLines.length > 0) {
    if (newContent && !newContent.endsWith('\n')) {
      newContent += '\n'
    }
    newContent += addedLines.join('\n')
    if (!newContent.endsWith('\n')) {
      newContent += '\n'
    }
  }

  // Write the file
  const filePath = join(gitRoot, fileName)
  writeFileSync(filePath, newContent, 'utf-8')

  logger.debug(`  ✓ File ${fileName} updated`)
}
