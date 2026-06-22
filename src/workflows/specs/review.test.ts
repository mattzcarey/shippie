import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock only the collaborators that touch git, GitHub, or MCP transports.
// `filterFiles` and `resolveReviewConfig` are exercised for real.
const getChangedFiles = vi.fn()
vi.mock('../../review/diff', async (orig) => ({
  ...(await orig<typeof import('../../review/diff')>()),
  getChangedFiles: (...args: unknown[]) => getChangedFiles(...args),
}))

const postSummary = vi.fn().mockResolvedValue('http://s')
const postReviewComment = vi.fn()
const createReporter = vi.fn(() => ({ postSummary, postReviewComment }))
vi.mock('../../github/reporter', () => ({
  createReporter: (...args: unknown[]) => createReporter(...args),
}))

const mcpClose = vi.fn().mockResolvedValue(undefined)
const connectMcpServers = vi.fn().mockResolvedValue({ tools: [], close: mcpClose })
vi.mock('../../mcp/connect', () => ({
  connectMcpServers: (...args: unknown[]) => connectMcpServers(...args),
}))

import { run } from '../review'

const PAYLOAD = { platform: 'local' as const, workspace: process.cwd(), ignore: [] }

const makeFile = (fileName: string) => ({
  fileName,
  fileContent: 'export const a = 1\n',
  changedLines: [{ start: 1, end: 1 }],
  diff: `diff --git a/${fileName} b/${fileName}\n@@ -0,0 +1 @@\n+export const a = 1`,
})

const makeInit = () => {
  const session = {
    prompt: vi.fn().mockResolvedValue({ text: 'SUMMARY', usage: {}, model: {} }),
  }
  const harness = { session: vi.fn().mockResolvedValue(session) }
  const init = vi.fn().mockResolvedValue(harness)
  return { init, harness, session }
}

describe('review workflow run()', () => {
  beforeEach(() => {
    // Telemetry uses a real fetch; keep it offline and deterministic.
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('ok')))
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
  })

  it('returns early without initializing the agent when no files changed', async () => {
    getChangedFiles.mockResolvedValue({ files: [], rawDiff: '' })
    const { init } = makeInit()

    const result = await run({ init, payload: PAYLOAD, env: {} } as never)

    expect(result).toEqual({
      reviewed: 0,
      summaryPosted: false,
      message: 'No changed files to review.',
    })
    expect(init).not.toHaveBeenCalled()
    expect(connectMcpServers).not.toHaveBeenCalled()
    expect(createReporter).not.toHaveBeenCalled()
  })

  it('runs the agent, posts the summary, and closes MCP for a changed file', async () => {
    getChangedFiles.mockResolvedValue({
      files: [makeFile('src/changed.ts')],
      rawDiff: 'raw',
    })
    const { init, harness, session } = makeInit()

    const result = await run({ init, payload: PAYLOAD, env: {} } as never)

    expect(init).toHaveBeenCalledTimes(1)
    expect(init.mock.calls[0][1]).toEqual({ tools: [] })
    expect(harness.session).toHaveBeenCalledTimes(1)
    expect(session.prompt).toHaveBeenCalledTimes(1)
    expect(typeof session.prompt.mock.calls[0][0]).toBe('string')

    expect(connectMcpServers).toHaveBeenCalledTimes(1)
    expect(mcpClose).toHaveBeenCalledTimes(1)

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
    // The model returns blank text; run() should substitute a default summary.
    const session = { prompt: vi.fn().mockResolvedValue({ text: '   ' }) }
    const init = vi.fn().mockResolvedValue({
      session: vi.fn().mockResolvedValue(session),
    })

    const result = await run({ init, payload: PAYLOAD, env: {} } as never)

    expect(postSummary).toHaveBeenCalledWith(
      'Shippie completed the review; see the inline comments.'
    )
    expect(result.reviewed).toBe(1)
    expect(result.summaryPosted).toBe(true)
  })

  it('still closes MCP when the session prompt throws', async () => {
    getChangedFiles.mockResolvedValue({
      files: [makeFile('src/changed.ts')],
      rawDiff: 'raw',
    })
    const session = { prompt: vi.fn().mockRejectedValue(new Error('boom')) }
    const init = vi.fn().mockResolvedValue({
      session: vi.fn().mockResolvedValue(session),
    })

    await expect(run({ init, payload: PAYLOAD, env: {} } as never)).rejects.toThrow(
      'boom'
    )
    expect(mcpClose).toHaveBeenCalledTimes(1)
  })

  it('skips ignored files via the real filterFiles', async () => {
    getChangedFiles.mockResolvedValue({
      files: [makeFile('src/keep.ts')],
      rawDiff: 'raw',
    })
    const { init } = makeInit()

    const result = await run({
      init,
      payload: { ...PAYLOAD, ignore: ['**/keep.ts'] },
      env: {},
    } as never)

    expect(result).toEqual({
      reviewed: 0,
      summaryPosted: false,
      message: 'No changed files to review.',
    })
    expect(init).not.toHaveBeenCalled()
  })
})
