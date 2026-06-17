import { type GitHubChannel, createGitHubChannel } from '@flue/github'
import { defineTool, dispatch } from '@flue/runtime'
import { Octokit } from 'octokit'
import * as v from 'valibot'
import mention from '../agents/mention'

/**
 * GitHub channel — the webhook (server) deployment mode. Lets people summon
 * Shippie by commenting `/shippie ...` on an issue or pull request. Verified
 * deliveries are dispatched to the `mention` agent, which replies via Octokit.
 *
 * Served at `POST /channels/github/webhook` on the built server. Requires
 * GITHUB_WEBHOOK_SECRET (verify inbound) and GITHUB_TOKEN (outbound comments).
 * This is separate from the one-shot CI review (action.yml / `flue run review`).
 */

const MENTION = '/shippie'

export interface IssueRef {
  owner: string
  repo: string
  issueNumber: number
}

export const client = new Octokit({ auth: process.env.GITHUB_TOKEN })

export const channel: GitHubChannel = createGitHubChannel({
  webhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? '',

  async webhook({ delivery }) {
    if (delivery.name === 'issue_comment' && delivery.payload.action === 'created') {
      const { repository, issue, comment, sender } = delivery.payload
      if (sender?.type === 'Bot') return undefined
      if (!comment.body?.toLowerCase().includes(MENTION)) return undefined

      const ref: IssueRef = {
        owner: repository.owner.login,
        repo: repository.name,
        issueNumber: issue.number,
      }
      await dispatch(mention, {
        id: channel.conversationKey(ref),
        input: {
          type: 'github.mention',
          isPullRequest: Boolean(issue.pull_request),
          title: issue.title,
          author: sender?.login,
          request: comment.body,
        },
      })
      return undefined
    }

    if (
      delivery.name === 'pull_request_review_comment' &&
      delivery.payload.action === 'created'
    ) {
      const { repository, pull_request, comment, sender } = delivery.payload
      if (sender?.type === 'Bot') return undefined
      if (!comment.body?.toLowerCase().includes(MENTION)) return undefined

      const ref: IssueRef = {
        owner: repository.owner.login,
        repo: repository.name,
        issueNumber: pull_request.number,
      }
      await dispatch(mention, {
        id: channel.conversationKey(ref),
        input: {
          type: 'github.mention',
          isPullRequest: true,
          title: pull_request.title,
          author: sender?.login,
          request: comment.body,
          path: comment.path,
          line: comment.line ?? null,
        },
      })
      return undefined
    }

    return undefined
  },
})

/** Tool: post a reply comment on the issue/PR that summoned Shippie. */
export const commentOnIssue = (ref: IssueRef) =>
  defineTool({
    name: 'comment_on_github_issue',
    description:
      'Post your reply as a comment on the GitHub issue or pull request that mentioned you.',
    parameters: v.object({
      body: v.pipe(
        v.string(),
        v.minLength(1),
        v.description('The markdown comment to post.')
      ),
    }),
    async execute({ body }) {
      const res = await client.rest.issues.createComment({
        owner: ref.owner,
        repo: ref.repo,
        issue_number: ref.issueNumber,
        body,
      })
      return `Comment posted: ${res.data.html_url}`
    },
  })

/** Tool: fetch the unified diff of the pull request that summoned Shippie. */
export const getPullRequestDiff = (ref: IssueRef) =>
  defineTool({
    name: 'get_pull_request_diff',
    description:
      'Fetch the unified diff of the pull request that mentioned you. Call this before reviewing a PR.',
    parameters: v.object({}),
    async execute() {
      const res = await client.rest.pulls.get({
        owner: ref.owner,
        repo: ref.repo,
        pull_number: ref.issueNumber,
        mediaType: { format: 'diff' },
      })
      // With the `diff` media type, GitHub returns the raw diff as a string.
      return typeof res.data === 'string' ? res.data : JSON.stringify(res.data)
    },
  })
