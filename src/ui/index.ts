import open from 'open'
import type { StackArgs } from '../common/types'
import { logger } from '../common/utils/logger'
import { getGitRoot } from '../common/git/getChangedFilesNames'
import { createStackServer } from './server'

export const ui = async (argv: StackArgs): Promise<void> => {
  try {
    logger.info('Starting UI command...')
    logger.debug(`Port: ${argv.port}`)
    logger.debug(`Auto-open browser: ${argv.open}`)

    // Verify we're in a git repository
    const gitRoot = await getGitRoot()
    logger.debug(`Git root: ${gitRoot}`)

    // Start the server
    await createStackServer({
      port: argv.port,
      gitRoot,
    })

    const url = `http://localhost:${argv.port}`
    logger.info(`✓ Stack UI running at ${url}`)

    // Open browser if requested
    if (argv.open) {
      logger.debug('Opening browser...')
      await open(url)
    }

    logger.info('Press Ctrl+C to stop the server')

    // Keep the process alive
    await new Promise(() => {})
  } catch (error) {
    logger.error('Failed to start UI command:', error)
    throw error
  }
}
