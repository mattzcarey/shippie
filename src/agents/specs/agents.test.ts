import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

// The github channel (imported transitively by the mention agent) reads
// GITHUB_WEBHOOK_SECRET and constructs an Octokit client at module load. The
// vi.hoisted block runs before the static imports below, so the env var is set
// before the channel module is evaluated, and the Octokit mock is in place.
const { mockClient } = vi.hoisted(() => {
  process.env.GITHUB_WEBHOOK_SECRET = 'test-webhook-secret'
  return {
    mockClient: {
      rest: {
        issues: {
          createComment: vi.fn().mockResolvedValue({ data: { html_url: 'u', id: 1 } }),
          listComments: vi.fn().mockResolvedValue({ data: [] }),
          updateComment: vi.fn().mockResolvedValue({ data: { html_url: 'u' } }),
        },
        pulls: {
          createReviewComment: vi.fn().mockResolvedValue({ data: { html_url: 'u' } }),
          get: vi.fn().mockResolvedValue({ data: 'diff text' }),
        },
      },
    },
  }
})

// Never touch the real GitHub API.
vi.mock('octokit', () => ({ Octokit: vi.fn(() => mockClient) }))

import { channel } from '../../channels/github'
import mention from '../mention'
import reviewer from '../reviewer'

const toolNames = (tools: unknown): string[] =>
  Array.isArray(tools)
    ? tools
        .map((t) => (t as { name?: string }).name)
        .filter((n): n is string => Boolean(n))
    : []

describe('reviewer agent', () => {
  let workspace: string
  const agentsMd =
    '# Project rules\nAlways write tests for new behaviour. SHIPPIE_MARKER_42'

  beforeAll(async () => {
    workspace = await mkdtemp(join(tmpdir(), 'shippie-reviewer-'))
    await writeFile(join(workspace, 'AGENTS.md'), agentsMd, 'utf8')
  })

  afterAll(async () => {
    await rm(workspace, { recursive: true, force: true })
  })

  it('initializes to a config with model, suggest_change tool, and injected AGENTS.md', async () => {
    const cfg = await reviewer.initialize({
      payload: { platform: 'local', workspace },
      env: {},
    })

    expect(typeof cfg.model).toBe('string')
    expect((cfg.model as string).length).toBeGreaterThan(0)

    const names = toolNames(cfg.tools)
    expect(names).toContain('suggest_change')

    expect(typeof cfg.instructions).toBe('string')
    expect((cfg.instructions as string).length).toBeGreaterThan(0)
    // The root-level AGENTS.md must be injected into the system prompt.
    expect(cfg.instructions as string).toContain('SHIPPIE_MARKER_42')
    expect(cfg.instructions as string).toContain('AGENTS.md')
  })
})

describe('mention agent', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('initializes to a config exposing the github tools and referencing the repo', async () => {
    const id = channel.conversationKey({ owner: 'o', repo: 'r', issueNumber: 5 })
    const cfg = await mention.initialize({ id })

    expect(typeof cfg.model).toBe('string')
    expect((cfg.model as string).length).toBeGreaterThan(0)

    const names = toolNames(cfg.tools)
    expect(names).toContain('comment_on_github_issue')
    expect(names).toContain('get_pull_request_diff')

    expect(typeof cfg.instructions).toBe('string')
    // The instructions name the owner/repo/issue the mention was raised on.
    expect(cfg.instructions as string).toContain('o/r')
    expect(cfg.instructions as string).toContain('5')
  })
})
