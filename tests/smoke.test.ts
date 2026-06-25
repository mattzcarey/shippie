import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createReporter } from '../src/github/reporter'
import type { ReviewConfig } from '../src/review/config'
import * as reviewWorkflow from '../src/workflows/review'

/**
 * Smoke / load-time crash tests.
 *
 * Modules are bundled and loaded by Flue when the server starts or a workflow
 * runs, so a top-level statement that throws when an env var is unset (a real
 * bug: the GitHub channel threw at import when GITHUB_WEBHOOK_SECRET was unset)
 * crashes everything before any handler runs. These tests import each module
 * with model/GitHub secrets removed from the environment and assert nothing
 * throws at load time. No flue/child processes are spawned, no network calls.
 */

// Env vars deleted before each import so we exercise the "no secrets" path.
const SECRET_KEYS = [
  'GITHUB_TOKEN',
  'GITHUB_WEBHOOK_SECRET',
  'GITHUB_ACTIONS',
  'GITHUB_REPOSITORY',
  'GITHUB_WORKSPACE',
  'GITHUB_SHA',
  'SHIPPIE_MODEL',
  'SHIPPIE_PR_NUMBER',
  'ANTHROPIC_API_KEY',
  'OPENAI_API_KEY',
  'BASE_SHA',
  'HEAD_SHA',
]

describe('smoke: modules load without crashing when secrets are absent', () => {
  const saved: Record<string, string | undefined> = {}

  beforeEach(() => {
    for (const key of SECRET_KEYS) {
      saved[key] = process.env[key]
      delete process.env[key]
    }
    // The webhook secret being unset is the exact regression we guard against.
    expect(process.env.GITHUB_WEBHOOK_SECRET).toBeUndefined()
  })

  afterEach(() => {
    for (const key of SECRET_KEYS) {
      if (saved[key] === undefined) {
        delete process.env[key]
      } else {
        process.env[key] = saved[key]
      }
    }
    vi.restoreAllMocks()
  })

  it('imports the reviewer agent without throwing', async () => {
    await expect(import('../src/agents/reviewer')).resolves.toBeDefined()
  })

  it('imports the review workflow without throwing', async () => {
    await expect(import('../src/workflows/review')).resolves.toBeDefined()
  })

  it('imports the github channel without throwing (webhook secret unset)', async () => {
    await expect(import('../src/channels/github')).resolves.toBeDefined()
  })

  it('imports the mention agent without throwing', async () => {
    await expect(import('../src/agents/mention')).resolves.toBeDefined()
  })

  it('imports app.ts without throwing (litellm key unset)', async () => {
    await expect(import('../src/app')).resolves.toBeDefined()
  })
})

describe('smoke: review workflow public surface', () => {
  it('exports a run function and a route', () => {
    expect(typeof reviewWorkflow.run).toBe('function')
    expect(reviewWorkflow.route).toBeDefined()
  })
})

describe('smoke: reporter falls back to local output', () => {
  it('createReporter does not throw on github platform without PR context', () => {
    // Suppress the expected "falling back to local output" warning.
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})

    const cfg: ReviewConfig = {
      platform: 'github',
      github: undefined,
      workspace: '/tmp',
      model: 'x',
      thinkingLevel: 'medium',
      reviewLanguage: 'English',
      telemetry: false,
      mcpServers: {},
    }

    expect(() => createReporter(cfg)).not.toThrow()
    const reporter = createReporter(cfg)
    expect(typeof reporter.postSummary).toBe('function')
    expect(typeof reporter.postReviewComment).toBe('function')
    // The fallback should have warned about missing PR context.
    expect(err).toHaveBeenCalled()

    err.mockRestore()
  })
})
