import { exec, execSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from '../common/utils/logger'
import { getCommitHistory } from './git/commits'

const execAsync = promisify(exec)

// Helper to find the UI assets directory
const findUIAssetsPath = (): string => {
  const cwd = process.cwd()

  const pathsToTry = [
    // When running from source at project root
    join(cwd, 'src/ui/web/dist'),
    // When running from src/ui/web directory
    join(cwd, 'dist'),
    // When running from published npm package
    join(dirname(fileURLToPath(import.meta.url)), '../ui-assets'),
    // Fallback for different structures
    join(cwd, 'dist/ui-assets'),
  ]

  for (const absolutePath of pathsToTry) {
    if (existsSync(absolutePath)) {
      logger.debug(`Found UI assets at: ${absolutePath}`)
      return absolutePath
    }
  }

  logger.warn('Could not find UI assets in any known location')
  logger.warn(`Tried: ${pathsToTry.join(', ')}`)
  logger.warn(`Current working directory: ${cwd}`)
  return pathsToTry[0] // fallback to first option
}

export type ServerConfig = {
  port: number
  gitRoot: string
}

export const createStackServer = async (config: ServerConfig) => {
  const app = new Hono()

  // Enable CORS for local development
  app.use('/*', cors())

  // Health check
  app.get('/api/health', (c) => {
    return c.json({ status: 'ok', gitRoot: config.gitRoot })
  })

  // Get all branches
  app.get('/api/branches', (c) => {
    try {
      // Get all local branches
      const localBranches = execSync('git branch --format="%(refname:short)"', {
        cwd: config.gitRoot,
        encoding: 'utf-8',
      })
        .trim()
        .split('\n')
        .filter(Boolean)

      // Get all remote branches
      const remoteBranches = execSync('git branch -r --format="%(refname:short)"', {
        cwd: config.gitRoot,
        encoding: 'utf-8',
      })
        .trim()
        .split('\n')
        .filter(Boolean)
        .filter((b) => !b.includes('HEAD') && b.includes('/')) // Filter out HEAD and non-branch entries

      return c.json({
        local: localBranches,
        remote: remoteBranches,
        all: [...localBranches, ...remoteBranches],
      })
    } catch (error) {
      logger.error('Failed to get branches:', error)
      return c.json({ local: [], remote: [], all: [] }, 500)
    }
  })

  // Get branch info
  app.get('/api/branch', (c) => {
    try {
      const currentBranch = execSync('git rev-parse --abbrev-ref HEAD', {
        cwd: config.gitRoot,
        encoding: 'utf-8',
      }).trim()

      // Try to find base branch
      const branches = ['origin/main', 'origin/master', 'main', 'master']
      let baseBranch = 'main'
      for (const branch of branches) {
        try {
          execSync(`git rev-parse --verify ${branch}`, {
            cwd: config.gitRoot,
            stdio: 'ignore',
          })
          baseBranch = branch
          break
        } catch {
          // Branch doesn't exist
        }
      }

      return c.json({ currentBranch, baseBranch })
    } catch (error) {
      logger.error('Failed to get branch info:', error)
      return c.json({ currentBranch: 'unknown', baseBranch: 'main' })
    }
  })

  // Get commit history with diffs
  app.get('/api/commits', async (c) => {
    try {
      const baseBranch = c.req.query('base') // Optional base branch parameter
      const currentBranch = c.req.query('branch') // Optional current branch parameter
      logger.debug(
        `Fetching commit history: ${baseBranch || 'auto'} .. ${currentBranch || 'HEAD'}`
      )
      const commits = await getCommitHistory(config.gitRoot, baseBranch, currentBranch)
      logger.debug(`Fetched ${commits.length} commits`)
      return c.json(commits)
    } catch (error) {
      logger.error('Failed to get commits:', error)
      const message = error instanceof Error ? error.message : 'Failed to fetch commits'
      return c.json({ error: message }, 500)
    }
  })

  // Get full file content for a specific commit and file
  app.get('/api/file-content', async (c) => {
    try {
      const commitHash = c.req.query('commit')
      const filePath = c.req.query('file')

      if (!commitHash || !filePath) {
        return c.json({ error: 'Missing commit or file parameter' }, 400)
      }

      logger.debug(`Fetching file content: ${commitHash}:${filePath}`)

      // Try to fetch from the current commit first
      try {
        const { stdout: content } = await execAsync(
          `git show ${commitHash}:"${filePath}"`,
          { cwd: config.gitRoot, maxBuffer: 10 * 1024 * 1024 }
        )
        return c.json({ content })
      } catch (error) {
        // If the file doesn't exist at this commit, try the parent commit
        // This handles the case where the file was deleted in this commit
        logger.debug(
          `File not found at ${commitHash}, trying parent commit (${commitHash}^)`
        )
        try {
          const { stdout: content } = await execAsync(
            `git show ${commitHash}^:"${filePath}"`,
            { cwd: config.gitRoot, maxBuffer: 10 * 1024 * 1024 }
          )
          return c.json({ content, deletedInCommit: true })
        } catch (_parentError) {
          // If it still fails, throw the original error
          logger.error('Failed to get file content from both commit and parent:', error)
          throw error
        }
      }
    } catch (error) {
      logger.error('Failed to get file content:', error)
      const message =
        error instanceof Error ? error.message : 'Failed to fetch file content'
      return c.json({ error: message }, 500)
    }
  })

  // Serve React build
  const uiAssetsPath = findUIAssetsPath()
  logger.debug(`Serving UI assets from: ${uiAssetsPath}`)
  app.use('/*', serveStatic({ root: uiAssetsPath }))

  // Start server using Node.js HTTP (compatible with npx)
  const server = serve({
    fetch: app.fetch,
    port: config.port,
  })

  logger.info(`Server started on port ${config.port}`)
  return server
}
