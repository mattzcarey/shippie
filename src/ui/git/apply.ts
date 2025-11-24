import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { RestackOperation } from '../../common/types'
import { logger } from '../../common/utils/logger'

const execAsync = promisify(exec)

/**
 * Applies restack operations to restructure commits
 *
 * This function:
 * 1. Resets commits while keeping changes
 * 2. Groups operations by target commit
 * 3. Applies changes in order
 * 4. Creates new commits
 */
export const applyRestack = async (
  gitRoot: string,
  operations: RestackOperation[]
): Promise<void> => {
  if (operations.length === 0) {
    throw new Error('No operations provided')
  }

  try {
    logger.info('Starting restack operation...')
    logger.debug(`Operations: ${JSON.stringify(operations, null, 2)}`)

    // Calculate how many commits we need to reset
    const numCommitsToReset =
      Math.max(...operations.map((op) => op.targetCommitIndex)) + 1
    logger.debug(`Will reset ${numCommitsToReset} commits`)

    // Store original HEAD for rollback
    const { stdout: originalHead } = await execAsync('git rev-parse HEAD', {
      cwd: gitRoot,
    })
    const originalHeadHash = originalHead.trim()
    logger.debug(`Original HEAD: ${originalHeadHash}`)

    try {
      // 1. Reset commits but keep changes staged
      await execAsync(`git reset --soft HEAD~${numCommitsToReset}`, {
        cwd: gitRoot,
      })
      logger.debug('Reset commits (kept changes staged)')

      // 2. Unstage everything
      await execAsync('git reset', { cwd: gitRoot })
      logger.debug('Unstaged all changes')

      // 3. Group operations by target commit
      const commitGroups = new Map<number, RestackOperation[]>()
      for (const op of operations) {
        if (!commitGroups.has(op.targetCommitIndex)) {
          commitGroups.set(op.targetCommitIndex, [])
        }
        commitGroups.get(op.targetCommitIndex)!.push(op)
      }

      // 4. Apply each commit in order
      const sortedCommits = Array.from(commitGroups.keys()).sort(
        (a, b) => a - b
      )
      logger.debug(`Processing ${sortedCommits.length} commits`)

      for (const commitIndex of sortedCommits) {
        logger.debug(`Processing commit ${commitIndex}`)

        // For Phase 2, we'll do a simplified approach:
        // Stage all changes and create a commit
        // In Phase 3, we'll implement selective hunk staging based on operations

        // Get the original commit message
        const refSpec = `${originalHeadHash}~${numCommitsToReset - commitIndex - 1}`

        const { stdout: originalMessage } = await execAsync(
          `git log -1 --pretty=%B ${refSpec}`,
          { cwd: gitRoot }
        )

        // For now, stage all changes (will be refined in Phase 3)
        await execAsync('git add -A', { cwd: gitRoot })

        // Create commit with original message
        const commitMessage = originalMessage.trim()
        await execAsync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
          cwd: gitRoot,
        })

        logger.debug(`Created commit ${commitIndex}: ${commitMessage}`)
      }

      logger.info('✓ Restack completed successfully!')
    } catch (error) {
      // Rollback on error
      logger.error('Restack failed, attempting rollback...')
      try {
        await execAsync(`git reset --hard ${originalHeadHash}`, {
          cwd: gitRoot,
        })
        logger.info('Successfully rolled back to original state')
      } catch (rollbackError) {
        logger.error('Failed to rollback:', rollbackError)
        throw new Error(
          'Restack failed and rollback also failed. Check your repository state.'
        )
      }
      throw error
    }
  } catch (error) {
    logger.error('Restack operation failed:', error)
    throw new Error(
      `Failed to apply restack: ${error instanceof Error ? error.message : 'Unknown error'}`
    )
  }
}

/**
 * Validates that the Git repository is in a clean state
 */
export const validateCleanState = async (gitRoot: string): Promise<boolean> => {
  try {
    const { stdout } = await execAsync('git status --porcelain', {
      cwd: gitRoot,
    })
    return stdout.trim().length === 0
  } catch (error) {
    logger.error('Failed to check git status:', error)
    return false
  }
}

/**
 * Gets the current branch name
 */
export const getCurrentBranch = async (gitRoot: string): Promise<string> => {
  try {
    const { stdout } = await execAsync('git branch --show-current', {
      cwd: gitRoot,
    })
    return stdout.trim()
  } catch (error) {
    logger.error('Failed to get current branch:', error)
    throw error
  }
}
