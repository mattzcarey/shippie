import open from 'open'
import type { StackArgs } from '../common/types'
import { logger } from '../common/utils/logger'
import { getGitRoot } from '../common/git/getChangedFilesNames'
import { createStackServer } from './server'

export const stack = async (argv: StackArgs): Promise<void> => {
  try {
    logger.info('Starting stack command...')
    logger.debug(`Port: ${argv.port}`)
    logger.debug(`Number of commits: ${argv.commits}`)
    logger.debug(`Auto-open browser: ${argv.open}`)

    // Verify we're in a git repository
    const gitRoot = await getGitRoot()
    logger.debug(`Git root: ${gitRoot}`)

    // Start the server
    await createStackServer({
      port: argv.port,
      gitRoot,
      numCommits: argv.commits,
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
    logger.error('Failed to start stack command:', error)
    throw error
  }
}
