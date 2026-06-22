import { describe, expect, test } from 'vitest'
import type { ReviewConfig } from '../config'
import { buildDiffArgs, parseDiff } from '../diff'

const WS = '/repo'

const cfg = (over: Partial<ReviewConfig>): ReviewConfig =>
  ({
    platform: 'local',
    workspace: '/repo',
    model: 'm',
    thinkingLevel: 'medium',
    reviewLanguage: 'English',
    telemetry: false,
    mcpServers: {},
    ...over,
  }) as ReviewConfig

describe('parseDiff', () => {
  test('single added range', () => {
    const raw = [
      'diff --git a/src/a.ts b/src/a.ts',
      'index 0000000..1111111 100644',
      '--- a/src/a.ts',
      '+++ b/src/a.ts',
      '@@ -0,0 +1,3 @@',
      '+line1',
      '+line2',
      '+line3',
    ].join('\n')
    const files = parseDiff(raw, WS)
    expect(files).toHaveLength(1)
    expect(files[0].fileName).toBe('/repo/src/a.ts')
    expect(files[0].changedLines).toEqual([{ start: 1, end: 3 }])
    expect(files[0].diff).toContain('@@ -0,0 +1,3 @@')
  })

  test('single-line modification (no count in hunk header)', () => {
    const raw = ['diff --git a/x.ts b/x.ts', '@@ -5 +5 @@', '-old', '+new'].join('\n')
    expect(parseDiff(raw, WS)[0].changedLines).toEqual([{ start: 5, end: 5 }])
  })

  test('pure deletion is flagged', () => {
    const raw = ['diff --git a/y.ts b/y.ts', '@@ -10,3 +9,0 @@', '-a', '-b', '-c'].join(
      '\n'
    )
    expect(parseDiff(raw, WS)[0].changedLines).toEqual([
      { start: 9, end: 9, isPureDeletion: true },
    ])
  })

  test('multiple files and hunks, with per-file diff isolation', () => {
    const raw = [
      'diff --git a/one.ts b/one.ts',
      '@@ -1,0 +2,2 @@',
      '+a',
      '+b',
      '@@ -10 +12 @@',
      '-x',
      '+y',
      'diff --git a/two.ts b/two.ts',
      '@@ -0,0 +1 @@',
      '+only',
    ].join('\n')
    const files = parseDiff(raw, WS)
    expect(files.map((f) => f.fileName)).toEqual(['/repo/one.ts', '/repo/two.ts'])
    expect(files[0].changedLines).toEqual([
      { start: 2, end: 3 },
      { start: 12, end: 12 },
    ])
    expect(files[1].changedLines).toEqual([{ start: 1, end: 1 }])
    expect(files[1].diff).toContain('+only')
    expect(files[0].diff).not.toContain('+only')
  })

  test('empty diff yields no files', () => {
    expect(parseDiff('', WS)).toEqual([])
  })
})

describe('buildDiffArgs', () => {
  test('passes base/head as a three-dot range (no shell string)', () => {
    expect(buildDiffArgs(cfg({ baseSha: 'base123', headSha: 'head456' }))).toEqual([
      '-C',
      '/repo',
      'diff',
      '--diff-filter=AMRT',
      '-U0',
      'base123...head456',
    ])
  })

  test('falls back to --cached without base/head', () => {
    expect(buildDiffArgs(cfg({}))).toEqual([
      '-C',
      '/repo',
      'diff',
      '--diff-filter=AMRT',
      '-U0',
      '--cached',
    ])
  })

  test('allows real refs (branch names, HEAD~1)', () => {
    expect(() =>
      buildDiffArgs(cfg({ baseSha: 'feat/foo-bar', headSha: 'HEAD~1' }))
    ).not.toThrow()
  })

  test('rejects shell-injection / flag-injection refs', () => {
    for (const bad of ['$(touch x)', 'a;b', '`id`', 'a b', '--upload-pack=evil', '-x']) {
      expect(() => buildDiffArgs(cfg({ baseSha: bad, headSha: 'HEAD' }))).toThrow()
    }
  })
})
