import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import type { QaConfig } from '../../src/qa/config'
import {
  buildCliDriverInstructions,
  buildDriverInstructions,
  buildHealerInstructions,
  buildQaInstructions,
  buildQaKickoff,
} from '../../src/qa/instructions'

/**
 * These snapshots pin the EXACT prompt strings the lead, drivers, and healer exchange.
 * The web and cli builders share a byte-identical HEAL→CLASSIFY→OPEN-PRs→FINISH-JSON
 * contract (steps 5-8) that must never silently drift between the two kinds — that is
 * what these snapshots guard. `process.platform` is stubbed so the embedded runtime
 * note is deterministic + portable (the QA agent's real environment is the Linux
 * GitHub Action runner).
 */

const realPlatform = process.platform
beforeAll(() => {
  Object.defineProperty(process, 'platform', { value: 'linux', configurable: true })
})
afterAll(() => {
  Object.defineProperty(process, 'platform', { value: realPlatform, configurable: true })
})

// A workspace path with no AGENTS.md/CLAUDE.md so readProjectContext resolves to ''.
const WS = '/nonexistent-qa-snapshot-workspace'

const cfg = (overrides: Partial<QaConfig> = {}): QaConfig => ({
  platform: 'github',
  kind: 'web',
  workspace: WS,
  model: 'anthropic/claude-opus-4-8',
  thinkingLevel: 'high',
  telemetry: false,
  chromeBin: 'google-chrome',
  mcpServers: {},
  ...overrides,
})

describe('buildQaKickoff (the shared steps 5-8 contract)', () => {
  it('web — no target/scope', () => {
    expect(buildQaKickoff(cfg({ kind: 'web' }))).toMatchSnapshot()
  })
  it('web — with target + scope', () => {
    expect(
      buildQaKickoff(
        cfg({ kind: 'web', target: 'https://app.example.com', scope: 'login, checkout' })
      )
    ).toMatchSnapshot()
  })
  it('cli — no target/scope', () => {
    expect(buildQaKickoff(cfg({ kind: 'cli' }))).toMatchSnapshot()
  })
  it('cli — with target + scope', () => {
    expect(
      buildQaKickoff(
        cfg({ kind: 'cli', target: './bin/tool', scope: 'help, error paths' })
      )
    ).toMatchSnapshot()
  })
})

describe('lead system instructions', () => {
  it('web', async () => {
    expect(await buildQaInstructions(cfg({ kind: 'web' }))).toMatchSnapshot()
  })
  it('cli', async () => {
    expect(await buildQaInstructions(cfg({ kind: 'cli' }))).toMatchSnapshot()
  })
})

describe('subagent instructions', () => {
  it('browser-driver', () => {
    expect(buildDriverInstructions(cfg({ kind: 'web' }))).toMatchSnapshot()
  })
  it('cli-driver', () => {
    expect(buildCliDriverInstructions(cfg({ kind: 'cli' }))).toMatchSnapshot()
  })
  it('healer — web', () => {
    expect(buildHealerInstructions(cfg({ kind: 'web' }))).toMatchSnapshot()
  })
  it('healer — cli', () => {
    expect(buildHealerInstructions(cfg({ kind: 'cli' }))).toMatchSnapshot()
  })
})
