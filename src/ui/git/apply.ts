import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import { logger } from '../../common/utils/logger'

const execAsync = promisify(exec)

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
