import { defineTool } from '@flue/runtime'
import * as v from 'valibot'
import type { QaConfig } from '../qa/config'
import { decideTier } from '../qa/pr-policy'

/**
 * `classify_finding` — the LEAD's mechanical PR gate. A thin wrapper over
 * `decideTier` (the policy + its test live in src/qa/pr-policy.ts), exposing the
 * `Finding` shape as tool parameters so the lead must classify EVERY finding
 * before opening a PR for it. The bar per tier:
 *   - broken-flow      → always accepted
 *   - missing-coverage → LOW bar (any new green spec is accepted)
 *   - refactor-hint    → VERY HIGH bar: rejected unless pressingNeed=true AND
 *     severity is blocker/high (refactor PRs go stale fast).
 * Returns the TierDecision JSON ({accepted, tier, reason}); only open a PR for an
 * accepted finding.
 *
 * Takes `cfg` for signature symmetry with the other create*Tool factories even
 * though the classification is stateless and ignores it.
 */
export const createClassifyFindingTool = (_cfg: QaConfig) =>
  defineTool({
    name: 'classify_finding',
    description:
      'Classify a QA finding into a PR tier and its mechanical bar. broken-flow = always open; ' +
      'missing-coverage = LOW bar (any green spec); refactor-hint = VERY HIGH bar — rejected unless ' +
      'pressingNeed=true AND severity is blocker/high. Returns {accepted, tier, reason}. Call this ' +
      'before open_pull_request for every finding; only open a PR for an accepted finding.',
    parameters: v.object({
      flowSlug: v.pipe(
        v.string(),
        v.description('The flow this finding concerns (kebab-case slug)')
      ),
      tier: v.picklist(['broken-flow', 'missing-coverage', 'refactor-hint']),
      severity: v.picklist(['blocker', 'high', 'medium', 'low']),
      rationale: v.pipe(v.string(), v.description('Why this finding warrants a PR')),
      pressingNeed: v.optional(
        v.pipe(
          v.boolean(),
          v.description('Only meaningful for refactor-hint: is there a pressing need?')
        )
      ),
    }),
    execute: async (finding) => JSON.stringify(decideTier(finding)),
  })
