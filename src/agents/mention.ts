import { createAgent } from '@flue/runtime'
import { channel, commentOnIssue, getPullRequestDiff } from '../channels/github'

/**
 * The `@shippie` mention agent (webhook/channel mode). Dispatched by the GitHub
 * channel when someone comments `@shippie ...` on an issue or PR. It reads the
 * request, optionally fetches the PR diff, and replies with a single comment.
 *
 * Runs on a deployed Flue server (not a repo checkout), so it works through the
 * GitHub API tools rather than a `local()` sandbox.
 */
export default createAgent(({ id }) => {
  const ref = channel.parseConversationKey(id)

  return {
    model: process.env.SHIPPIE_MODEL ?? 'anthropic/claude-sonnet-4-6',
    instructions: `You are Shippie, an automated code-review agent summoned by an "@shippie" mention on ${ref.owner}/${ref.repo} #${ref.issueNumber}.

The incoming message describes the user's request. Decide what they want:
- If it is a pull request and they ask you to review it (e.g. "@shippie review"), call get_pull_request_diff, review the changed code for bugs, exposed secrets, missing tests, and risky changes, then write a concise review.
- For any other question, answer it helpfully and concisely based on the request and what you can fetch.

Rules:
- Be brief and specific. Do not restate the whole diff back to the user.
- Only raise issues you are confident about.
- ALWAYS finish by calling comment_on_github_issue exactly once with your reply (markdown).`,
    tools: [commentOnIssue(ref), getPullRequestDiff(ref)],
  }
})
