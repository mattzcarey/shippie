import { describe, expect, it } from 'vitest'
import { decideTier, isoWeekBranch } from '../../src/qa/pr-policy'

describe('decideTier', () => {
  it('broken-flow always opens', () => {
    expect(
      decideTier({ flowSlug: 'x', tier: 'broken-flow', severity: 'low', rationale: '' })
        .accepted
    ).toBe(true)
  })

  it('missing-coverage is a low bar (always accepted)', () => {
    expect(
      decideTier({
        flowSlug: 'x',
        tier: 'missing-coverage',
        severity: 'low',
        rationale: '',
      }).accepted
    ).toBe(true)
  })

  it('refactor-hint is rejected without BOTH pressing need and high/blocker severity', () => {
    expect(
      decideTier({
        flowSlug: 'x',
        tier: 'refactor-hint',
        severity: 'high',
        rationale: '',
      }).accepted
    ).toBe(false)
    expect(
      decideTier({
        flowSlug: 'x',
        tier: 'refactor-hint',
        severity: 'low',
        rationale: '',
        pressingNeed: true,
      }).accepted
    ).toBe(false)
  })

  it('refactor-hint accepted only with pressing need + blocker/high severity', () => {
    for (const severity of ['blocker', 'high'] as const) {
      expect(
        decideTier({
          flowSlug: 'x',
          tier: 'refactor-hint',
          severity,
          rationale: '',
          pressingNeed: true,
        }).accepted
      ).toBe(true)
    }
  })
})

describe('isoWeekBranch', () => {
  it('formats shippie-qa/<isoYear>-W<week>', () => {
    expect(isoWeekBranch(new Date('2026-06-24T00:00:00Z'))).toBe('shippie-qa/2026-W26')
  })
  it('zero-pads single-digit weeks', () => {
    expect(isoWeekBranch(new Date('2026-01-05T00:00:00Z'))).toBe('shippie-qa/2026-W02')
  })
})
