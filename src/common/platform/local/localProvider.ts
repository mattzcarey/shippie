import { createHash } from 'node:crypto'
import { access, appendFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { EOL, homedir } from 'node:os'
import { join } from 'node:path'
import type { TokenUsage, ToolCall } from '../../../review/types'
import { formatSummary } from '../../formatting/summary'
import { formatUsage } from '../../formatting/usage'
import { getGitRoot } from '../../git/getChangedFilesNames'
import { PlatformOptions } from '../../types'
import { logger } from '../../utils/logger'
import type { PlatformProvider, ReviewComment, ThreadComment } from '../provider'

const SHIPPIE_DIR_NAME = '.shippie'
const SHIPPIE_CONFIG_DIR = join(homedir(), SHIPPIE_DIR_NAME)
const REPO_IDS_FILE = join(SHIPPIE_CONFIG_DIR, 'repo_ids.json')

export const localProvider = async (): Promise<PlatformProvider> => {
  const workspaceRoot = await getGitRoot()

  const timestamp = new Date().toISOString().replace(/:/g, '-')
  const reviewFileName = `local_${timestamp}.md`
  const shippieDirPath = join(workspaceRoot, SHIPPIE_DIR_NAME)
  const reviewDirPath = join(shippieDirPath, 'review')
  const reviewFilePath = join(reviewDirPath, reviewFileName)
  const gitignorePath = join(reviewDirPath, '.gitignore')

  const ensureShippieDirExists = async (): Promise<void> => {
    try {
      await mkdir(reviewDirPath, { recursive: true })

      try {
        await access(gitignorePath)
      } catch {
        await writeFile(gitignorePath, '*')
        logger.debug(`Created .gitignore file at ${gitignorePath}`)
      }
    } catch (error: unknown) {
      const nodeError = error as NodeJS.ErrnoException
      if (nodeError?.code !== 'EEXIST') {
        logger.error(`Failed to create review directory at ${reviewDirPath}: ${error}`)
        throw error
      }

      try {
        await access(gitignorePath)
      } catch {
        await writeFile(gitignorePath, '*')
        logger.debug(`Created .gitignore file at ${gitignorePath}`)
      }
    }
  }

  const appendToFile = async (content: string): Promise<void> => {
    await ensureShippieDirExists()

    try {
      await appendFile(reviewFilePath, content + EOL)
    } catch (error) {
      logger.error(`Failed to append to local review file ${reviewFilePath}: ${error}`)
      throw error
    }
  }

  const updateRepoIdMapping = async (
    repoPath: string,
    repoHash: string
  ): Promise<void> => {
    try {
      await mkdir(SHIPPIE_CONFIG_DIR, { recursive: true })

      try {
        const content = await readFile(REPO_IDS_FILE, 'utf-8')
        const repoIds = JSON.parse(content)

        if (repoIds[repoPath] === repoHash) return

        repoIds[repoPath] = repoHash
        await writeFile(REPO_IDS_FILE, JSON.stringify(repoIds, null, 2))
      } catch (_err) {
        const repoIds = { [repoPath]: repoHash }
        await writeFile(REPO_IDS_FILE, JSON.stringify(repoIds, null, 2))
      }
    } catch (err) {
      logger.error(`Failed to update repo ID mapping: ${err}`)
    }
  }

  return {
    postReviewComment: async (commentDetails: ReviewComment): Promise<string> => {
      await appendToFile(`${commentDetails.comment}\n`)
      return `Suggestion added to local review file: ${reviewFilePath}`
    },

    postThreadComment: async (commentDetails: ThreadComment): Promise<string> => {
      const formattedComment = formatSummary(commentDetails.comment)
      await appendToFile(`${formattedComment}\n`)
      return `General comment added to local review file: ${reviewFilePath}`
    },

    getPlatformOption: (): PlatformOptions => PlatformOptions.LOCAL,

    submitUsage: async (tokenUsage: TokenUsage, toolUsage: ToolCall[]): Promise<void> => {
      try {
        const usageSection = `${formatUsage(tokenUsage, toolUsage)}\n`
        await appendToFile(usageSection)
        logger.info(`Usage data added to local review file: ${reviewFilePath}`)
      } catch (error) {
        logger.error(`Failed to add usage data to local review file: ${error}`)
      }
    },

    getRepoId: (): string => {
      try {
        const repoPath = workspaceRoot
        const repoHash = createHash('sha256')
          .update(repoPath)
          .digest('hex')
          .substring(0, 32)

        updateRepoIdMapping(repoPath, repoHash).catch((err) =>
          logger.error(`Failed to update repo ID mapping: ${err}`)
        )

        return repoHash
      } catch (error) {
        logger.error(`Failed to get repo ID: ${error}`)
        return 'local_repo_anonymous'
      }
    },
  }
}
