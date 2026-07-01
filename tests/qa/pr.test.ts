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
  kind: 'web',
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

  describe('broken-flow per-flow dedupe', () => {
    const brokenArgs = {
      tier: 'broken-flow' as const,
      title: 'fix broken flow: login',
      body: 'b',
      paths: ['e2e/tests/login.spec.ts'],
      flowSlug: 'login',
    }

    it('opens a NEW broken-flow PR on the stable per-flow branch with a title marker', async () => {
      const r = await openOrUpdatePr(cfg(), brokenArgs)
      expect(r.changed).toBe(true)
      expect(r.reason).toBe('opened')
      expect(r.branch).toBe('shippie-qa/fix/login')
      // committed onto the per-flow branch (branch absent → createRef)
      expect(rest.git.createRef).toHaveBeenCalledWith(
        expect.objectContaining({ ref: 'refs/heads/shippie-qa/fix/login' })
      )
      // title carries the flow marker so the next run can find it
      expect(rest.pulls.create).toHaveBeenCalledWith(
        expect.objectContaining({
          head: 'shippie-qa/fix/login',
          title: expect.stringContaining('[flow:login]'),
        })
      )
    })

    it('UPDATES the same flow PR (matched by title marker) instead of opening a second', async () => {
      // An open broken-flow PR for this flow already exists (title marker present).
      rest.pulls.list.mockResolvedValue({
        data: [
          {
            number: 11,
            html_url: 'https://gh/pr/11',
            title: 'fix broken flow: login [flow:login]',
            head: { ref: 'shippie-qa/fix/login' },
          },
        ],
      })
      // Its branch exists, so commitFiles updates the ref rather than creating it.
      rest.git.getRef.mockImplementation(async ({ ref }: { ref: string }) => {
        if (ref === 'heads/main' || ref === 'heads/shippie-qa/fix/login') {
          return { data: { object: { sha: 'base-sha' } } }
        }
        throw new Error('Not Found')
      })

      const r = await openOrUpdatePr(cfg(), brokenArgs)
      expect(r.reason).toBe('updated existing')
      expect(r.prUrl).toBe('https://gh/pr/11')
      expect(r.branch).toBe('shippie-qa/fix/login')
      expect(rest.git.updateRef).toHaveBeenCalled()
      expect(rest.pulls.update).toHaveBeenCalledWith(
        expect.objectContaining({ pull_number: 11 })
      )
      expect(rest.pulls.create).not.toHaveBeenCalled()
    })

    it('does NOT match a different flow (title marker is flow-specific)', async () => {
      const otherPr = {
        number: 11,
        html_url: 'https://gh/pr/11',
        title: 'fix broken flow: checkout [flow:checkout]',
        head: { ref: 'shippie-qa/fix/checkout' },
      }
      // Honor the `head` filter like the real API: the unfiltered title-search
      // sees the checkout PR, but the per-branch head guard for login does not.
      rest.pulls.list.mockImplementation(async ({ head }: { head?: string }) =>
        head ? { data: [] } : { data: [otherPr] }
      )
      const r = await openOrUpdatePr(cfg(), brokenArgs)
      expect(r.reason).toBe('opened')
      expect(r.branch).toBe('shippie-qa/fix/login')
      expect(rest.pulls.create).toHaveBeenCalled()
    })

    it('skips an empty diff for a broken flow (no spurious PR)', async () => {
      rest.git.createTree.mockResolvedValue({ data: { sha: 'base-tree' } })
      const r = await openOrUpdatePr(cfg(), brokenArgs)
      expect(r.changed).toBe(false)
      expect(r.reason).toBe('empty diff')
      expect(rest.pulls.create).not.toHaveBeenCalled()
    })
  })

  it('missing-coverage still uses the iso-week branch (regression)', async () => {
    const r = await openOrUpdatePr(cfg(), { ...args, branch: 'shippie-qa/2026-W26' })
    expect(r.branch).toBe('shippie-qa/2026-W26')
    expect(rest.pulls.create).toHaveBeenCalledWith(
      expect.objectContaining({ head: 'shippie-qa/2026-W26' })
    )
  })
})
