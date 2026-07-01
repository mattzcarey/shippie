import { describe, expect, it } from 'vitest'
import { resolveQaConfig } from '../../src/qa/config'

const env = (o: Record<string, string>): NodeJS.ProcessEnv => o as NodeJS.ProcessEnv

describe('resolveQaConfig', () => {
  it('defaults: opus model, high thinking, local platform, telemetry on, web kind', () => {
    const cfg = resolveQaConfig({}, env({}))
    expect(cfg.model).toBe('anthropic/claude-opus-4-8')
    expect(cfg.thinkingLevel).toBe('high')
    expect(cfg.platform).toBe('local')
    expect(cfg.telemetry).toBe(true)
    expect(cfg.chromeBin.length).toBeGreaterThan(0)
    expect(cfg.kind).toBe('web')
    expect(cfg.github).toBeUndefined()
  })

  it('resolves kind: payload > env, defaulting to web', () => {
    expect(resolveQaConfig({ kind: 'cli' }, env({})).kind).toBe('cli')
    expect(resolveQaConfig({}, env({ SHIPPIE_QA_KIND: 'cli' })).kind).toBe('cli')
    // payload wins over env
    expect(resolveQaConfig({ kind: 'web' }, env({ SHIPPIE_QA_KIND: 'cli' })).kind).toBe(
      'web'
    )
    // any non-'cli' env value falls back to web
    expect(resolveQaConfig({}, env({ SHIPPIE_QA_KIND: 'nonsense' })).kind).toBe('web')
  })

  it('payload overrides env', () => {
    const cfg = resolveQaConfig(
      {
        model: 'openai/gpt-5.5',
        target: 'http://x',
        scope: 'login',
        chromeBin: '/bin/chrome',
      },
      env({
        SHIPPIE_QA_TARGET: 'http://env',
        SHIPPIE_MODEL: 'anthropic/claude-sonnet-4-6',
      })
    )
    expect(cfg.model).toBe('openai/gpt-5.5')
    expect(cfg.target).toBe('http://x')
    expect(cfg.scope).toBe('login')
    expect(cfg.chromeBin).toBe('/bin/chrome')
  })

  it('reads QA-specific env fallbacks', () => {
    const cfg = resolveQaConfig(
      {},
      env({
        SHIPPIE_QA_MODEL: 'openrouter/foo',
        SHIPPIE_QA_TARGET: 'http://env',
        SHIPPIE_QA_SCOPE: 'checkout',
        SHIPPIE_QA_BRANCH: 'qa/x',
        CHROME_BIN: '/usr/bin/chromium',
      })
    )
    expect(cfg.model).toBe('openrouter/foo')
    expect(cfg.target).toBe('http://env')
    expect(cfg.scope).toBe('checkout')
    expect(cfg.branch).toBe('qa/x')
    expect(cfg.chromeBin).toBe('/usr/bin/chromium')
  })

  it('resolves the GitHub target WITHOUT a PR number (QA opens PRs)', () => {
    const cfg = resolveQaConfig(
      { platform: 'github' },
      env({ GITHUB_REPOSITORY: 'me/app', GITHUB_TOKEN: 'tok' })
    )
    expect(cfg.platform).toBe('github')
    expect(cfg.github).toEqual({ owner: 'me', repo: 'app', token: 'tok' })
  })

  it('no GitHub target when the token is missing', () => {
    const cfg = resolveQaConfig(
      { platform: 'github' },
      env({ GITHUB_REPOSITORY: 'me/app' })
    )
    expect(cfg.github).toBeUndefined()
  })
})
