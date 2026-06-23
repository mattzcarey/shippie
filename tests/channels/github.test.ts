import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { channel, commentOnIssue, getPullRequestDiff } from '../../src/channels/github'

// `vi.hoisted` runs before the (hoisted) static imports, so the webhook secret
// is set before the channel module loads as a live channel rather than the
// inert placeholder fallback, and the Octokit mock client exists before
// the module constructs its client at import time.
const mockClient = vi.hoisted(() => {
  process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret'
  return {
    rest: {
      issues: {
        createComment: vi.fn(),
      },
      pulls: {
        get: vi.fn(),
      },
    },
  }
})

vi.mock('octokit', () => ({ Octokit: vi.fn(() => mockClient) }))

const ref = { owner: 'acme', repo: 'rocket', issueNumber: 7 }

describe('github channel', () => {
  beforeEach(() => {
    mockClient.rest.issues.createComment.mockResolvedValue({
      data: { html_url: 'https://github.com/o/r/issues/7#comment-1', id: 1 },
    })
    mockClient.rest.pulls.get.mockResolvedValue({
      data: 'diff --git a/x b/x\n+added line\n',
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('conversation keys', () => {
    it('roundtrips a ref through conversationKey/parseConversationKey', () => {
      const key = channel.conversationKey(ref)
      expect(typeof key).toBe('string')

      const parsed = channel.parseConversationKey(key)
      expect(parsed).toEqual(ref)
    })

    it('encodes the ref fields into the key', () => {
      const key = channel.conversationKey(ref)
      expect(key).toContain('acme')
      expect(key).toContain('rocket')
      expect(key).toContain('7')
    })
  })

  describe('commentOnIssue', () => {
    it('has the expected tool name', () => {
      expect(commentOnIssue(ref).name).toBe('comment_on_github_issue')
    })

    it('calls issues.createComment with the ref + body and returns a string', async () => {
      const tool = commentOnIssue(ref)
      const result = await tool.execute({ body: 'looks good to me' }, {} as never)

      expect(mockClient.rest.issues.createComment).toHaveBeenCalledTimes(1)
      expect(mockClient.rest.issues.createComment).toHaveBeenCalledWith({
        owner: 'acme',
        repo: 'rocket',
        issue_number: 7,
        body: 'looks good to me',
      })
      expect(typeof result).toBe('string')
      expect(result).toContain('https://github.com/o/r/issues/7#comment-1')
    })
  })

  describe('getPullRequestDiff', () => {
    it('has the expected tool name', () => {
      expect(getPullRequestDiff(ref).name).toBe('get_pull_request_diff')
    })

    it('calls pulls.get with the diff media type and returns the diff string', async () => {
      const tool = getPullRequestDiff(ref)
      const result = await tool.execute({}, {} as never)

      expect(mockClient.rest.pulls.get).toHaveBeenCalledTimes(1)
      expect(mockClient.rest.pulls.get).toHaveBeenCalledWith({
        owner: 'acme',
        repo: 'rocket',
        pull_number: 7,
        mediaType: { format: 'diff' },
      })
      expect(typeof result).toBe('string')
      expect(result).toBe('diff --git a/x b/x\n+added line\n')
    })
  })
})
