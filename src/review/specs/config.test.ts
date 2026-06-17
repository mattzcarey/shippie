import { describe, expect, test } from 'vitest'
import { resolveReviewConfig } from '../config'

const env = (e: Record<string, string>) => e as unknown as NodeJS.ProcessEnv

describe('resolveReviewConfig', () => {
  test('defaults with empty env', () => {
    const cfg = resolveReviewConfig(undefined, env({}))
    expect(cfg.platform).toBe('local')
    expect(cfg.model).toBe('anthropic/claude-sonnet-4-6')
    expect(cfg.thinkingLevel).toBe('medium')
    expect(cfg.reviewLanguage).toBe('English')
    expect(cfg.mcpServers).toEqual({})
    expect(cfg.github).toBeUndefined()
  })

  test('payload overrides env', () => {
    const cfg = resolveReviewConfig(
      { model: 'openai/gpt-4.1-mini', reviewLanguage: 'French' },
      env({ SHIPPIE_MODEL: 'anthropic/other' })
    )
    expect(cfg.model).toBe('openai/gpt-4.1-mini')
    expect(cfg.reviewLanguage).toBe('French')
  })

  test('github platform resolves target + shas from env', () => {
    const cfg = resolveReviewConfig(
      undefined,
      env({
        GITHUB_ACTIONS: 'true',
        GITHUB_REPOSITORY: 'owner/repo',
        SHIPPIE_PR_NUMBER: '42',
        GITHUB_TOKEN: 'tok',
        BASE_SHA: 'base',
        HEAD_SHA: 'head',
      })
    )
    expect(cfg.platform).toBe('github')
    expect(cfg.github).toEqual({
      owner: 'owner',
      repo: 'repo',
      prNumber: 42,
      token: 'tok',
    })
    expect(cfg.baseSha).toBe('base')
    expect(cfg.headSha).toBe('head')
  })

  test('github platform without a PR number has no target', () => {
    const cfg = resolveReviewConfig(
      undefined,
      env({ GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: 'o/r' })
    )
    expect(cfg.platform).toBe('github')
    expect(cfg.github).toBeUndefined()
  })

  test('SHIPPIE_IGNORE is split and trimmed', () => {
    const cfg = resolveReviewConfig(
      undefined,
      env({ SHIPPIE_IGNORE: '**/*.test.ts, dist/** ,*.md' })
    )
    expect(cfg.ignore).toEqual(['**/*.test.ts', 'dist/**', '*.md'])
  })

  test('MCP servers from env: bare map', () => {
    const cfg = resolveReviewConfig(
      undefined,
      env({ SHIPPIE_MCP_SERVERS: JSON.stringify({ ctx7: { url: 'https://x' } }) })
    )
    expect(cfg.mcpServers).toEqual({ ctx7: { url: 'https://x' } })
  })

  test('MCP servers from env: { mcpServers } wrapper', () => {
    const cfg = resolveReviewConfig(
      undefined,
      env({ SHIPPIE_MCP_SERVERS: JSON.stringify({ mcpServers: { a: { url: 'u' } } }) })
    )
    expect(cfg.mcpServers).toEqual({ a: { url: 'u' } })
  })

  test('invalid MCP JSON falls back to empty', () => {
    const cfg = resolveReviewConfig(undefined, env({ SHIPPIE_MCP_SERVERS: 'not json' }))
    expect(cfg.mcpServers).toEqual({})
  })

  test('payload mcpServers wins over env', () => {
    const cfg = resolveReviewConfig(
      { mcpServers: { p: { url: 'payload' } } },
      env({ SHIPPIE_MCP_SERVERS: JSON.stringify({ e: { url: 'env' } }) })
    )
    expect(cfg.mcpServers).toEqual({ p: { url: 'payload' } })
  })
})
