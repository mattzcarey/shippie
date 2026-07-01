import { defineTool } from '@flue/runtime'
import * as v from 'valibot'
import type { QaConfig } from '../qa/config'
import { openOrUpdatePr, writeLastPr } from '../qa/pr'

/**
 * `open_pull_request` — commit the files written this session and open (or UPDATE)
 * a tier-aware PR. Idempotent across re-runs; skips empty diffs.
 *
 * Three tiers:
 *   - missing-coverage → a new green spec. Commit the test + its spec. Iso-week
 *     branch; weekly re-runs accumulate onto the same PR.
 *   - broken-flow → a real bug. Commit the FIX (app-source files) TOGETHER with
 *     the failing→passing regression test (+ its spec). Keyed by `flowSlug` to a
 *     stable per-flow branch so re-running NEVER opens a 2nd PR for the same flow.
 *   - refactor-hint → only after `classify_finding` ACCEPTED it (very high bar:
 *     pressing need + blocker/high severity). Iso-week branch.
 */
export const createOpenPrTool = (cfg: QaConfig) =>
  defineTool({
    name: 'open_pull_request',
    description:
      'Commit the files written this session and open (or UPDATE) a tier-aware PR. Idempotent across ' +
      're-runs (pushes onto an existing open PR instead of opening a second one) and skips empty diffs. ' +
      'TIERS: (1) missing-coverage — a new green spec; commit the test + its e2e/specs/*.md. ' +
      '(2) broken-flow — a real bug; commit the FIX (the edited app-source files) TOGETHER WITH the ' +
      'failing→passing regression test + its spec, and pass flowSlug so re-runs dedupe onto the same ' +
      'per-flow PR (never a 2nd PR for the same broken flow). (3) refactor-hint — open ONLY after ' +
      'classify_finding accepted the finding (very high bar). Call once per finding, after run_spec is green.',
    input: v.object({
      tier: v.picklist(['broken-flow', 'missing-coverage', 'refactor-hint']),
      title: v.string(),
      body: v.pipe(
        v.string(),
        v.description('Markdown: flows covered, results, and trace/video links')
      ),
      paths: v.pipe(
        v.array(v.string()),
        v.description(
          'Repo-relative paths to commit. missing-coverage: the test (e2e/tests/<slug>.cdp.mjs) + its ' +
            'e2e/specs/*.md. broken-flow: ALSO the edited app-source fix files. The driver ' +
            'e2e/cdp-client.mjs is auto-included so the suite runs standalone.'
        )
      ),
      flowSlug: v.pipe(
        v.optional(v.string()),
        v.description(
          'The catalogued flow slug. REQUIRED for tier broken-flow: keys the per-flow dedupe so ' +
            're-running does not open a second PR for the same broken flow.'
        )
      ),
      branch: v.optional(v.string()),
    }),
    run: async ({ input: args }) => {
      const result = await openOrUpdatePr(cfg, args)
      await writeLastPr(cfg.workspace, result)
      return JSON.stringify(result)
    },
  })
