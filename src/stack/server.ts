import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { serveStatic } from 'hono/bun'
import { logger } from '../common/utils/logger'
import { getCommitHistory } from './git/commits'
import { applyRestack } from './git/apply'
import type { RestackOperation } from '../common/types'

export type ServerConfig = {
  port: number
  gitRoot: string
  numCommits: number
}

export const createStackServer = async (config: ServerConfig) => {
  const app = new Hono()

  // Enable CORS for local development
  app.use('/*', cors())

  // Health check
  app.get('/api/health', (c) => {
    return c.json({ status: 'ok', gitRoot: config.gitRoot })
  })

  // Get commit history with diffs
  app.get('/api/commits', async (c) => {
    try {
      logger.debug('Fetching commit history...')
      const commits = await getCommitHistory(config.gitRoot, config.numCommits)
      logger.debug(`Fetched ${commits.length} commits`)
      return c.json(commits)
    } catch (error) {
      logger.error('Failed to get commits:', error)
      const message =
        error instanceof Error ? error.message : 'Failed to fetch commits'
      return c.json({ error: message }, 500)
    }
  })

  // Apply restack operations
  app.post('/api/restack', async (c) => {
    try {
      logger.info('Applying restack operations...')
      const operations: RestackOperation[] = await c.req.json()
      logger.debug(`Received ${operations.length} operations`)

      await applyRestack(config.gitRoot, operations)

      logger.info('Restack completed successfully!')
      return c.json({ success: true, message: 'Restack completed' })
    } catch (error) {
      logger.error('Failed to apply restack:', error)
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to apply restack operations'
      return c.json({ error: message }, 500)
    }
  })

  // Serve React build
  app.use('/*', serveStatic({ root: './src/stack/ui/dist' }))

  // Start server using Bun's native HTTP
  const server = Bun.serve({
    port: config.port,
    fetch: app.fetch,
  })

  logger.info(`Server started on port ${config.port}`)
  return server
}
