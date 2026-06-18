import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, test } from 'vitest'
import type { ReviewConfig } from '../config'
import { buildInstructions } from '../instructions'

const makeConfig = (
  workspace: string,
  overrides: Partial<ReviewConfig> = {}
): ReviewConfig => ({
  platform: 'local',
  workspace,
  model: 'x',
  thinkingLevel: 'medium',
  reviewLanguage: 'English',
  telemetry: false,
  mcpServers: {},
  ...overrides,
})

describe('buildInstructions', () => {
  let dir: string

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'shippie-'))
  })

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  test('injects AGENTS.md and CLAUDE.md context with the base prompt and language', async () => {
    await writeFile(join(dir, 'AGENTS.md'), 'Agents rule: prefer absolute paths.')
    await writeFile(join(dir, 'CLAUDE.md'), 'Claude rule: always run the tests.')

    const result = await buildInstructions(makeConfig(dir))

    expect(result).toContain('You are an expert software engineer acting as a meticulous')
    expect(result).toContain('write all comments and the summary in English')
    expect(result).toContain('// Project context')
    expect(result).toContain('## AGENTS.md')
    expect(result).toContain('Agents rule: prefer absolute paths.')
    expect(result).toContain('## CLAUDE.md')
    expect(result).toContain('Claude rule: always run the tests.')
  })

  test('uses the configured review language in the prompt', async () => {
    const result = await buildInstructions(makeConfig(dir, { reviewLanguage: 'French' }))

    expect(result).toContain('write all comments and the summary in French')
  })

  test('includes customInstructions when set', async () => {
    const result = await buildInstructions(
      makeConfig(dir, { customInstructions: 'Focus on error handling.' })
    )

    expect(result).toContain('// Custom instructions')
    expect(result).toContain('Focus on error handling.')
  })

  test('omits the custom instructions section when not set', async () => {
    const result = await buildInstructions(makeConfig(dir))

    expect(result).not.toContain('// Custom instructions')
  })

  test('returns the base prompt without throwing when no context files are present', async () => {
    const result = await buildInstructions(makeConfig(dir))

    expect(result).toContain('You are an expert software engineer acting as a meticulous')
    expect(result).not.toContain('// Project context')
    expect(result).not.toContain('## AGENTS.md')
    expect(result).not.toContain('## CLAUDE.md')
  })
})
