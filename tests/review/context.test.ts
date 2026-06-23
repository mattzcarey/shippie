import { describe, expect, it } from 'vitest'
import { buildReviewPrompt } from '../../src/review/context'
import type { ReviewFileWithDiff } from '../../src/review/diff'

const WS = '/repo'

const fileA: ReviewFileWithDiff = {
  fileName: '/repo/src/a.ts',
  fileContent: 'export const a = 1\n',
  changedLines: [{ start: 1, end: 1 }],
  diff: ['diff --git a/src/a.ts b/src/a.ts', '@@ -0,0 +1 @@', '+export const a = 1'].join(
    '\n'
  ),
}

const fileB: ReviewFileWithDiff = {
  fileName: '/repo/lib/nested/b.ts',
  fileContent: 'export const b = 2\n',
  changedLines: [{ start: 5, end: 7 }],
  diff: [
    'diff --git a/lib/nested/b.ts b/lib/nested/b.ts',
    '@@ -5,3 +5,3 @@',
    '+const b = 2',
  ].join('\n'),
}

describe('buildReviewPrompt', () => {
  it('includes each file path relative to the workspace', () => {
    const prompt = buildReviewPrompt([fileA, fileB], WS)
    expect(prompt).toContain('### src/a.ts')
    expect(prompt).toContain('### lib/nested/b.ts')
    // Absolute paths should not leak into the diff headings.
    expect(prompt).not.toContain('### /repo/src/a.ts')
  })

  it('includes each file diff text fenced as a diff block', () => {
    const prompt = buildReviewPrompt([fileA, fileB], WS)
    expect(prompt).toContain('+export const a = 1')
    expect(prompt).toContain('+const b = 2')
    expect(prompt).toContain('```diff')
    // The diff for each file should sit under its own heading.
    expect(prompt.indexOf('### src/a.ts')).toBeLessThan(
      prompt.indexOf('+export const a = 1')
    )
  })

  it('includes the file tree section with relative paths and line ranges', () => {
    const prompt = buildReviewPrompt([fileA, fileB], WS)
    expect(prompt).toContain('Files changed for this review')
    // Tree renders file nodes (leaf names) with their changed line ranges.
    expect(prompt).toContain('a.ts: 1')
    expect(prompt).toContain('b.ts: 5-7')
    // The tree section precedes the diffs.
    expect(prompt.indexOf('Files changed for this review')).toBeLessThan(
      prompt.indexOf('### src/a.ts')
    )
  })

  it('handles a single file', () => {
    const prompt = buildReviewPrompt([fileA], WS)
    expect(prompt).toContain('### src/a.ts')
    expect(prompt).toContain('+export const a = 1')
    expect(prompt).not.toContain('### lib/nested/b.ts')
  })

  it('handles an empty file list without throwing', () => {
    const prompt = buildReviewPrompt([], WS)
    expect(typeof prompt).toBe('string')
    expect(prompt).toContain('Files changed for this review')
    expect(prompt).not.toContain('### ')
  })
})
