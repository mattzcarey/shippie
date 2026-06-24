import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { QaConfig } from '../../src/qa/config'

const rest = {
  repos: { get: vi.fn() },
  git: {
    getRef: vi.fn(),
    getCommit: vi.fn(),
    createBlob: vi.fn(),
    createTree: vi.fn(),
    createCommit: vi.fn(),
    createRef: vi.fn(),
    updateRef: vi.fn(),
  },
  pulls: { list: vi.fn(), create: vi.fn(), update: vi.fn() },
}

vi.mock('octokit', () => ({ Octokit: vi.fn(() => ({ rest })) }))

import { openOrUpdatePr } from '../../src/qa/pr'

let ws: string
const cfg = (): QaConfig => ({
  platform: 'github',
  workspace: ws,
  model: 'm',
  thinkingLevel: 'high',
  telemetry: false,
  chromeBin: 'chrome',
  github: { owner: 'acme', repo: 'app', token: 'tok' },
  mcpServers: {},
})

beforeEach(async () => {
  vi.clearAllMocks()
  ws = await mkdtemp(join(tmpdir(), 'qa-pr-'))
  await mkdir(join(ws, 'e2e', 'tests'), { recursive: true })
  await writeFile(join(ws, 'e2e', 'tests', 'login.spec.ts'), 'test stub')

  rest.repos.get.mockResolvedValue({ data: { default_branch: 'main' } })
  rest.git.getRef.mockImplementation(async ({ ref }: { ref: string }) => {
    if (ref === 'heads/main') return { data: { object: { sha: 'base-sha' } } }
    throw new Error('Not Found') // branch absent by default
  })
  rest.git.getCommit.mockResolvedValue({ data: { tree: { sha: 'base-tree' } } })
  rest.git.createBlob.mockResolvedValue({ data: { sha: 'blob' } })
  rest.git.createTree.mockResolvedValue({ data: { sha: 'new-tree' } })
  rest.git.createCommit.mockResolvedValue({ data: { sha: 'commit' } })
  rest.git.createRef.mockResolvedValue({})
  rest.git.updateRef.mockResolvedValue({})
  rest.pulls.list.mockResolvedValue({ data: [] })
  rest.pulls.create.mockResolvedValue({ data: { html_url: 'https://gh/pr/1' } })
  rest.pulls.update.mockResolvedValue({ data: { html_url: 'https://gh/pr/exist' } })
})

afterEach(async () => {
  await rm(ws, { recursive: true, force: true })
})

const args = {
  tier: 'missing-coverage' as const,
  title: 't',
  body: 'b',
  paths: ['e2e/tests/login.spec.ts'],
}

describe('openOrUpdatePr', () => {
  it('opens a new PR on a fresh week branch when the tree changed', async () => {
    const r = await openOrUpdatePr(cfg(), { ...args, branch: 'shippie-qa/2026-W26' })
    expect(r.changed).toBe(true)
    expect(r.reason).toBe('opened')
    expect(r.prUrl).toBe('https://gh/pr/1')
    expect(rest.git.createRef).toHaveBeenCalled()
    expect(rest.pulls.create).toHaveBeenCalled()
  })

  it('skips an empty diff (tree identical to base)', async () => {
    rest.git.createTree.mockResolvedValue({ data: { sha: 'base-tree' } })
    const r = await openOrUpdatePr(cfg(), args)
    expect(r.changed).toBe(false)
    expect(r.reason).toBe('empty diff')
    expect(rest.git.createCommit).not.toHaveBeenCalled()
    expect(rest.pulls.create).not.toHaveBeenCalled()
  })

  it('updates an existing open PR instead of opening a second', async () => {
    rest.git.getRef.mockImplementation(async ({ ref }: { ref: string }) => {
      if (ref === 'heads/main' || ref.startsWith('heads/shippie-qa/')) {
        return { data: { object: { sha: 'base-sha' } } }
      }
      throw new Error('Not Found')
    })
    rest.pulls.list.mockResolvedValue({
      data: [{ number: 7, html_url: 'https://gh/pr/7' }],
    })
    const r = await openOrUpdatePr(cfg(), { ...args, branch: 'shippie-qa/2026-W26' })
    expect(r.reason).toBe('updated existing')
    expect(r.prUrl).toBe('https://gh/pr/7')
    expect(rest.git.updateRef).toHaveBeenCalled()
    expect(rest.pulls.update).toHaveBeenCalled()
    expect(rest.pulls.create).not.toHaveBeenCalled()
  })

  it('no-ops on a local run (no github target)', async () => {
    const r = await openOrUpdatePr(
      { ...cfg(), platform: 'local', github: undefined },
      {
        ...args,
        paths: [],
      }
    )
    expect(r.changed).toBe(false)
    expect(r.prUrl).toBeNull()
  })
})
