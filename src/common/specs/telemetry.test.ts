import { createHash } from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { type TelemetryInput, sendReviewStarted } from '../telemetry'

const TELEMETRY_URL = 'https://telemetry.shippie.dev/events'

const baseInput = (overrides: Partial<TelemetryInput> = {}): TelemetryInput => ({
  enabled: true,
  repoSeed: 'owner/repo',
  platform: 'github',
  model: 'anthropic/claude-sonnet-4-6',
  reviewed: 3,
  ...overrides,
})

const expectedId = (seed: string) =>
  createHash('sha256').update(seed).digest('hex').slice(0, 32)

// Let the fire-and-forget promise settle before asserting.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('sendReviewStarted', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn().mockResolvedValue(new Response('ok'))
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('does not call fetch when telemetry is disabled', async () => {
    sendReviewStarted(baseInput({ enabled: false }))
    await tick()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('POSTs a review_started event to the telemetry endpoint when enabled', async () => {
    sendReviewStarted(baseInput())
    await tick()

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, options] = fetchMock.mock.calls[0]
    expect(url).toBe(TELEMETRY_URL)
    expect(options.method).toBe('POST')

    const body = JSON.parse(options.body)
    expect(body.event_type).toBe('review_started')
    expect(body.platform).toBe('github')
    expect(body.model).toBe('anthropic/claude-sonnet-4-6')
    expect(body.reviewed).toBe(3)
  })

  it('anonymizes the repo seed (sha256 hex, never the raw seed)', async () => {
    const repoSeed = 'owner/secret-repo'
    sendReviewStarted(baseInput({ repoSeed }))
    await tick()

    const body = JSON.parse(fetchMock.mock.calls[0][1].body)
    expect(body.repo_id).toBe(expectedId(repoSeed))
    expect(body.repo_id).not.toBe(repoSeed)
    expect(body.repo_id).toMatch(/^[0-9a-f]{32}$/)
    // The raw seed must not leak anywhere in the payload.
    expect(fetchMock.mock.calls[0][1].body).not.toContain(repoSeed)
  })

  it('derives distinct ids for distinct seeds and a stable id for the same seed', async () => {
    sendReviewStarted(baseInput({ repoSeed: 'seed-a' }))
    sendReviewStarted(baseInput({ repoSeed: 'seed-b' }))
    sendReviewStarted(baseInput({ repoSeed: 'seed-a' }))
    await tick()

    expect(fetchMock).toHaveBeenCalledTimes(3)
    const ids = fetchMock.mock.calls.map((c) => JSON.parse(c[1].body).repo_id)
    expect(ids[0]).not.toBe(ids[1])
    expect(ids[0]).toBe(ids[2])
  })

  it('does not throw when fetch rejects (fire-and-forget)', async () => {
    fetchMock.mockRejectedValue(new Error('network down'))
    expect(() => sendReviewStarted(baseInput())).not.toThrow()
    // Allow the rejected promise + .catch handler to settle without unhandled rejection.
    await tick()
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
