export type Tier = 'broken-flow' | 'missing-coverage' | 'refactor-hint'
export type Severity = 'blocker' | 'high' | 'medium' | 'low'

export interface Finding {
  flowSlug: string
  tier: Tier
  severity: Severity
  rationale: string
  pressingNeed?: boolean
}

export interface TierDecision {
  accepted: boolean
  tier: Tier
  reason: string
}

/**
 * The mechanical PR bar (NOT vibes):
 *   - broken-flow      → always open
 *   - missing-coverage → LOW bar (always accept a new green spec)
 *   - refactor-hint    → VERY HIGH bar: rejected unless there is a pressing need
 *     AND the severity is blocker/high (refactor PRs go stale fast).
 */
export const decideTier = (f: Finding): TierDecision => {
  if (f.tier === 'broken-flow')
    return { accepted: true, tier: f.tier, reason: 'always open' }
  if (f.tier === 'missing-coverage')
    return { accepted: true, tier: f.tier, reason: 'low bar' }
  const ok =
    f.pressingNeed === true && (f.severity === 'blocker' || f.severity === 'high')
  return {
    accepted: ok,
    tier: f.tier,
    reason: ok ? 'pressing need + high severity' : 'rejected: soft refactor',
  }
}

/** ISO week-numbering year + week (UTC), matching `date -u +%G-W%V`. */
const isoYearWeek = (d: Date): { year: number; week: number } => {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
  const dayNum = (date.getUTCDay() + 6) % 7 // Mon=0 … Sun=6
  date.setUTCDate(date.getUTCDate() - dayNum + 3) // Thursday of this week
  const firstThursday = new Date(Date.UTC(date.getUTCFullYear(), 0, 4))
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3)
  const week =
    1 + Math.round((date.getTime() - firstThursday.getTime()) / (7 * 86_400_000))
  return { year: date.getUTCFullYear(), week }
}

/**
 * Deterministic week-stamped branch (e.g. `shippie-qa/2026-W26`). Keyed to the
 * week, not the run id, so a weekly re-run targets the same branch (dedupe) while
 * successive weeks accumulate distinct reviewable PRs.
 */
export const isoWeekBranch = (now: Date = new Date()): string => {
  const { year, week } = isoYearWeek(now)
  return `shippie-qa/${year}-W${String(week).padStart(2, '0')}`
}
