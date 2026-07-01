import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock only the collaborators that touch git or GitHub. `filterFiles` and
// `resolveReviewConfig` are exercised for real (the latter reads process.env).
const getChangedFiles = vi.fn()
vi.mock('../../src/review/diff', async (orig) => ({
  ...(await orig<typeof import('../../src/review/diff')>()),
  getChangedFiles: (...args: unknown[]) => getChangedFiles(...args),
}))

const postSummary = vi.fn().mockResolvedValue('http://s')
const postReviewComment = vi.fn()
const createReporter = vi.fn(() => ({ postSummary, postReviewComment }))
vi.mock('../../src/github/reporter', () => ({
  createReporter: (...args: unknown[]) => createReporter(...args),
}))

import reviewWorkflow from '../../src/workflows/review'

// flue beta.9: the workflow is defineWorkflow({ agent, run }). Its run handler lives
// on `.action.run(context)` and receives { harness, log, input }. Config resolves from
// process.env (the agent self-configures the same way + self-connects any MCP tools),
// so the workflow no longer takes a payload or manages MCP lifecycle.
const makeHarness = (text: unknown = 'SUMMARY') => {
  const session = { prompt: vi.fn().mockResolvedValue({ text }) }
  const harness = { session: vi.fn().mockResolvedValue(session) }
  return { harness, session }
}

const runWorkflow = (harness: unknown) =>
  reviewWorkflow.action.run({ harness, log: {}, input: {} } as never)

const makeFile = (fileName: string) => ({
  fileName,
  fileContent: 'export const a = 1\n',
  changedLines: [{ start: 1, end: 1 }],
  diff: `diff --git a/${fileName} b/${fileName}\n@@ -0,0 +1 @@\n+export const a = 1`,
})

describe('review workflow run()', () => {
  beforeEach(() => {
    // Telemetry uses a real fetch; keep it offline and deterministic.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok')))
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('returns early without driving the agent when no files changed', async () => {
    getChangedFiles.mockResolvedValue({ files: [], rawDiff: '' })
    const { harness } = makeHarness()

    const result = await runWorkflow(harness)

    expect(result).toEqual({
      reviewed: 0,
      summaryPosted: false,
      message: 'No changed files to review.',
    })
    expect(harness.session).not.toHaveBeenCalled()
    expect(createReporter).not.toHaveBeenCalled()
  })

  it('drives the agent over the harness and posts the summary for a changed file', async () => {
    getChangedFiles.mockResolvedValue({
      files: [makeFile('src/changed.ts')],
      rawDiff: 'raw',
    })
    const { harness, session } = makeHarness()

    const result = await runWorkflow(harness)

    expect(harness.session).toHaveBeenCalledTimes(1)
    expect(session.prompt).toHaveBeenCalledTimes(1)
    expect(typeof session.prompt.mock.calls[0][0]).toBe('string')

    expect(createReporter).toHaveBeenCalledTimes(1)
    expect(postSummary).toHaveBeenCalledWith('SUMMARY')

    expect(result).toEqual({
      reviewed: 1,
      summaryPosted: true,
      summaryUrl: 'http://s',
      summary: 'SUMMARY',
    })
  })

  it('falls back to a default summary when the model returns empty text', async () => {
    getChangedFiles.mockResolvedValue({
      files: [makeFile('src/changed.ts')],
      rawDiff: 'raw',
    })
    const { harness } = makeHarness('   ')

    const result = (await runWorkflow(harness)) as {
      reviewed: number
      summaryPosted: boolean
    }

    expect(postSummary).toHaveBeenCalledWith(
      'Shippie completed the review; see the inline comments.'
    )
    expect(result.reviewed).toBe(1)
    expect(result.summaryPosted).toBe(true)
  })

  it('propagates the error when the session prompt throws', async () => {
    getChangedFiles.mockResolvedValue({
      files: [makeFile('src/changed.ts')],
      rawDiff: 'raw',
    })
    const session = { prompt: vi.fn().mockRejectedValue(new Error('boom')) }
    const harness = { session: vi.fn().mockResolvedValue(session) }

    await expect(runWorkflow(harness)).rejects.toThrow('boom')
  })

  it('skips ignored files via the real filterFiles (ignore from env)', async () => {
    vi.stubEnv('SHIPPIE_IGNORE', '**/keep.ts')
    getChangedFiles.mockResolvedValue({
      files: [makeFile('src/keep.ts')],
      rawDiff: 'raw',
    })
    const { harness } = makeHarness()

    const result = await runWorkflow(harness)

    expect(result).toEqual({
      reviewed: 0,
      summaryPosted: false,
      message: 'No changed files to review.',
    })
    expect(harness.session).not.toHaveBeenCalled()
  })
})
