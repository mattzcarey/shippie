import { appendFile, mkdir, writeFile } from 'node:fs/promises'
import { isAbsolute, join, relative } from 'node:path'
import { Octokit } from 'octokit'
import { FORMATTING, formatSummary } from '../common/formatting/summary'
import type { ReviewConfig } from '../review/config'

export interface ReviewCommentInput {
  filePath: string
  comment: string
  startLine?: number
  endLine?: number
}

/** Posts review output to GitHub (CI) or to a local file (dev). */
export interface Reporter {
  postReviewComment: (input: ReviewCommentInput) => Promise<string | undefined>
  postSummary: (comment: string) => Promise<string | undefined>
}

/** Make a workspace-absolute path relative to the repo root for the GitHub API. */
const toRepoPath = (workspace: string, filePath: string): string =>
  isAbsolute(filePath) ? relative(workspace, filePath) : filePath

const createGithubReporter = (cfg: ReviewConfig): Reporter => {
  const target = cfg.github
  if (!target) {
    throw new Error(
      'GitHub reporter requires owner/repo/prNumber. Is this running on a PR?'
    )
  }
  const octokit = new Octokit({ auth: target.token })
  const { owner, repo, prNumber } = target

  const resolveCommitId = async (): Promise<string> => {
    if (cfg.headSha) return cfg.headSha
    const pr = await octokit.rest.pulls.get({ owner, repo, pull_number: prNumber })
    return pr.data.head.sha
  }

  return {
    postReviewComment: async ({ filePath, comment, startLine, endLine }) => {
      const path = toRepoPath(cfg.workspace, filePath)
      const commit_id = await resolveCommitId()
      const line = endLine ?? startLine
      try {
        const multiLine = startLine && endLine && startLine !== endLine
        const { data } = await octokit.rest.pulls.createReviewComment({
          owner,
          repo,
          pull_number: prNumber,
          commit_id,
          body: comment,
          path,
          line,
          ...(multiLine
            ? { start_line: startLine, start_side: 'RIGHT', side: 'RIGHT' }
            : {}),
        })
        return data.html_url
      } catch (error) {
        // Surface the error to the model so it can adjust the line/path.
        throw new Error(
          `Failed to post review comment on ${path}: ${error instanceof Error ? error.message : String(error)}`
        )
      }
    },

    postSummary: async (comment) => {
      const body = formatSummary(comment)
      const { data: existing } = await octokit.rest.issues.listComments({
        owner,
        repo,
        issue_number: prNumber,
      })
      const prior = existing.find((c) => c.body?.includes(FORMATTING.SIGN_OFF))
      if (prior) {
        const { data } = await octokit.rest.issues.updateComment({
          owner,
          repo,
          comment_id: prior.id,
          body,
        })
        return data.html_url
      }
      const { data } = await octokit.rest.issues.createComment({
        owner,
        repo,
        issue_number: prNumber,
        body,
      })
      return data.html_url
    },
  }
}

const createLocalReporter = (cfg: ReviewConfig): Reporter => {
  const reviewDir = join(cfg.workspace, '.shippie', 'review')
  const timestamp = new Date().toISOString().replace(/:/g, '-')
  const reviewFile = join(reviewDir, `local_${timestamp}.md`)

  const ensureDir = async (): Promise<void> => {
    await mkdir(reviewDir, { recursive: true })
    await writeFile(join(reviewDir, '.gitignore'), '*').catch(() => {})
  }

  return {
    postReviewComment: async ({ filePath, comment, startLine, endLine }) => {
      await ensureDir()
      const path = toRepoPath(cfg.workspace, filePath)
      const loc = startLine
        ? `:${startLine}${endLine && endLine !== startLine ? `-${endLine}` : ''}`
        : ''
      await appendFile(reviewFile, `### ${path}${loc}\n\n${comment}\n\n`)
      return `Comment written to ${reviewFile}`
    },
    postSummary: async (comment) => {
      await ensureDir()
      await appendFile(reviewFile, `${formatSummary(comment)}\n`)
      return `Summary written to ${reviewFile}`
    },
  }
}

export const createReporter = (cfg: ReviewConfig): Reporter =>
  cfg.platform === 'github' ? createGithubReporter(cfg) : createLocalReporter(cfg)
