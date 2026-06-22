import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { FORMATTING } from '../../common/formatting/summary'
import type { ReviewConfig } from '../../review/config'

const mockClient = {
  rest: {
    issues: {
      createComment: vi
        .fn()
        .mockResolvedValue({ data: { html_url: 'https://gh/created', id: 1 } }),
      listComments: vi.fn().mockResolvedValue({ data: [] }),
      updateComment: vi
        .fn()
        .mockResolvedValue({ data: { html_url: 'https://gh/updated' } }),
    },
    pulls: {
      createReviewComment: vi
        .fn()
        .mockResolvedValue({ data: { html_url: 'https://gh/review' } }),
      get: vi.fn().mockResolvedValue({ data: { head: { sha: 'resolved-sha' } } }),
    },
  },
}

vi.mock('octokit', () => ({ Octokit: vi.fn(() => mockClient) }))

import { createReporter } from '../reporter'

const baseGithubConfig = (workspace: string): ReviewConfig => ({
  platform: 'github',
  workspace,
  model: 'anthropic/claude-sonnet-4-6',
  thinkingLevel: 'medium',
  reviewLanguage: 'English',
  telemetry: false,
  headSha: 'head-sha',
  github: { owner: 'acme', repo: 'widgets', prNumber: 42, token: 'tok' },
  mcpServers: {},
})

beforeEach(() => {
  vi.clearAllMocks()
  // Re-apply default resolved values after clearAllMocks resets implementations.
  mockClient.rest.issues.createComment.mockResolvedValue({
    data: { html_url: 'https://gh/created', id: 1 },
  })
  mockClient.rest.issues.listComments.mockResolvedValue({ data: [] })
  mockClient.rest.issues.updateComment.mockResolvedValue({
    data: { html_url: 'https://gh/updated' },
  })
  mockClient.rest.pulls.createReviewComment.mockResolvedValue({
    data: { html_url: 'https://gh/review' },
  })
  mockClient.rest.pulls.get.mockResolvedValue({ data: { head: { sha: 'resolved-sha' } } })
})

describe('github reporter', () => {
  it('postReviewComment posts a single-line review comment', async () => {
    const cfg = baseGithubConfig('/repo/root')
    const reporter = createReporter(cfg)

    const url = await reporter.postReviewComment({
      filePath: 'src/index.ts',
      comment: 'looks off',
      startLine: 10,
      endLine: 10,
    })

    expect(url).toBe('https://gh/review')
    expect(mockClient.rest.pulls.createReviewComment).toHaveBeenCalledTimes(1)
    const arg = mockClient.rest.pulls.createReviewComment.mock.calls[0][0]
    expect(arg.owner).toBe('acme')
    expect(arg.repo).toBe('widgets')
    expect(arg.pull_number).toBe(42)
    expect(arg.path).toBe('src/index.ts')
    expect(arg.line).toBe(10)
    expect(arg.commit_id).toBe('head-sha')
    expect(arg.start_line).toBeUndefined()
  })

  it('postReviewComment sets start_line for multi-line comments', async () => {
    const cfg = baseGithubConfig('/repo/root')
    const reporter = createReporter(cfg)

    await reporter.postReviewComment({
      filePath: 'src/index.ts',
      comment: 'block issue',
      startLine: 5,
      endLine: 9,
    })

    const arg = mockClient.rest.pulls.createReviewComment.mock.calls[0][0]
    expect(arg.line).toBe(9)
    expect(arg.start_line).toBe(5)
    expect(arg.start_side).toBe('RIGHT')
    expect(arg.side).toBe('RIGHT')
  })

  it('toRepoPath makes absolute paths relative to the workspace', async () => {
    const cfg = baseGithubConfig('/repo/root')
    const reporter = createReporter(cfg)

    await reporter.postReviewComment({
      filePath: '/repo/root/src/nested/file.ts',
      comment: 'absolute path',
      startLine: 1,
      endLine: 1,
    })

    const arg = mockClient.rest.pulls.createReviewComment.mock.calls[0][0]
    expect(arg.path).toBe('src/nested/file.ts')
  })

  it('postSummary creates a new issue comment when none exists', async () => {
    mockClient.rest.issues.listComments.mockResolvedValue({ data: [] })
    const cfg = baseGithubConfig('/repo/root')
    const reporter = createReporter(cfg)

    const url = await reporter.postSummary('all good')

    expect(url).toBe('https://gh/created')
    expect(mockClient.rest.issues.createComment).toHaveBeenCalledTimes(1)
    expect(mockClient.rest.issues.updateComment).not.toHaveBeenCalled()
    const arg = mockClient.rest.issues.createComment.mock.calls[0][0]
    expect(arg.owner).toBe('acme')
    expect(arg.repo).toBe('widgets')
    expect(arg.issue_number).toBe(42)
    expect(arg.body).toContain('all good')
    expect(arg.body).toContain(FORMATTING.SIGN_OFF)
  })

  it('postSummary updates an existing comment containing the sign-off', async () => {
    mockClient.rest.issues.listComments.mockResolvedValue({
      data: [
        { id: 7, body: `old\n${FORMATTING.SIGN_OFF}\nmore` },
        { id: 8, body: 'unrelated chatter' },
      ],
    })
    const cfg = baseGithubConfig('/repo/root')
    const reporter = createReporter(cfg)

    const url = await reporter.postSummary('updated content')

    expect(url).toBe('https://gh/updated')
    expect(mockClient.rest.issues.updateComment).toHaveBeenCalledTimes(1)
    expect(mockClient.rest.issues.createComment).not.toHaveBeenCalled()
    const arg = mockClient.rest.issues.updateComment.mock.calls[0][0]
    expect(arg.comment_id).toBe(7)
    expect(arg.body).toContain('updated content')
  })
})

describe('local reporter', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'shippie-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  const localConfig = (workspace: string): ReviewConfig => ({
    platform: 'local',
    workspace,
    model: 'anthropic/claude-sonnet-4-6',
    thinkingLevel: 'medium',
    reviewLanguage: 'English',
    telemetry: false,
    mcpServers: {},
  })

  const readReviewFile = async (): Promise<string> => {
    const reviewDir = join(dir, '.shippie', 'review')
    const files = (await readdir(reviewDir)).filter((f) => f.endsWith('.md'))
    expect(files.length).toBeGreaterThanOrEqual(1)
    return readFile(join(reviewDir, files[0]), 'utf8')
  }

  it('writes review comments to a .shippie/review/*.md file', async () => {
    const reporter = createReporter(localConfig(dir))

    const result = await reporter.postReviewComment({
      filePath: 'src/local.ts',
      comment: 'local finding',
      startLine: 3,
      endLine: 6,
    })

    expect(result).toContain('.shippie')
    const content = await readReviewFile()
    expect(content).toContain('src/local.ts:3-6')
    expect(content).toContain('local finding')
  })

  it('writes the summary to the same review file', async () => {
    const reporter = createReporter(localConfig(dir))

    await reporter.postSummary('local summary text')

    const content = await readReviewFile()
    expect(content).toContain('local summary text')
    expect(content).toContain(FORMATTING.SIGN_OFF)
  })

  it('shares one report file across separately-created reporters', async () => {
    // The agent's reporter (inline comments) and the workflow's reporter
    // (summary) are created by two separate createReporter() calls; they must
    // still write to the same local_*.md file.
    const agentReporter = createReporter(localConfig(dir))
    await agentReporter.postReviewComment({
      filePath: 'src/x.ts',
      comment: 'inline note',
      startLine: 1,
      endLine: 1,
    })
    const workflowReporter = createReporter(localConfig(dir))
    await workflowReporter.postSummary('the summary')

    const reviewDir = join(dir, '.shippie', 'review')
    const files = (await readdir(reviewDir)).filter((f) => f.endsWith('.md'))
    expect(files.length).toBe(1)
    const content = await readFile(join(reviewDir, files[0]), 'utf8')
    expect(content).toContain('inline note')
    expect(content).toContain('the summary')
  })
})

describe('createReporter fallback', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'shippie-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('falls back to the local reporter when platform=github but github is undefined', async () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const cfg: ReviewConfig = {
      platform: 'github',
      workspace: dir,
      model: 'anthropic/claude-sonnet-4-6',
      thinkingLevel: 'medium',
      reviewLanguage: 'English',
      telemetry: false,
      github: undefined,
      mcpServers: {},
    }

    let reporter: ReturnType<typeof createReporter> | undefined
    expect(() => {
      reporter = createReporter(cfg)
    }).not.toThrow()

    const result = await reporter?.postSummary('fallback summary')
    expect(result).toContain('.shippie')
    expect(mockClient.rest.issues.createComment).not.toHaveBeenCalled()
    expect(errSpy).toHaveBeenCalled()

    const reviewDir = join(dir, '.shippie', 'review')
    const files = (await readdir(reviewDir)).filter((f) => f.endsWith('.md'))
    expect(files.length).toBeGreaterThanOrEqual(1)

    errSpy.mockRestore()
  })
})
