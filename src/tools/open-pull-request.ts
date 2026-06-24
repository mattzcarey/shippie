import { defineTool } from '@flue/runtime'
import * as v from 'valibot'
import type { QaConfig } from '../qa/config'
import { openOrUpdatePr, writeLastPr } from '../qa/pr'

/**
 * `open_pull_request` — commit the spec/fix files written this session onto a
 * deterministic iso-week branch and open (or UPDATE) a PR. Idempotent across
 * weekly re-runs; skips empty diffs. v0 uses the missing-coverage tier (only
 * green specs are committed); broken-flow/refactor tiers arrive with the healer.
 */
export const createOpenPrTool = (cfg: QaConfig) =>
  defineTool({
    name: 'open_pull_request',
    description:
      'Commit the spec/fix files written this session onto a deterministic iso-week branch and open ' +
      '(or UPDATE) a PR. Idempotent across weekly re-runs: pushes onto an existing open PR for the ' +
      'branch instead of opening a second one, and skips an empty diff. Call once, after the spec is green.',
    parameters: v.object({
      tier: v.picklist(['broken-flow', 'missing-coverage', 'refactor-hint']),
      title: v.string(),
      body: v.pipe(
        v.string(),
        v.description('Markdown: flows covered, results, and trace/video links')
      ),
      paths: v.pipe(
        v.array(v.string()),
        v.description(
          'Repo-relative paths to commit: the test (e2e/tests/<slug>.cdp.mjs) + its e2e/specs/*.md. ' +
            'The driver e2e/cdp-client.mjs is auto-included so the suite runs standalone.'
        )
      ),
      branch: v.optional(v.string()),
    }),
    execute: async (args) => {
      const result = await openOrUpdatePr(cfg, args)
      await writeLastPr(cfg.workspace, result)
      return JSON.stringify(result)
    },
  })
