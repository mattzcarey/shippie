import { type JsonValue, type WorkflowRouteHandler, defineWorkflow } from '@flue/runtime'
import * as v from 'valibot'
import reviewer from '../agents/reviewer'
import { sendReviewStarted } from '../common/telemetry'
import { createReporter } from '../github/reporter'
import { resolveReviewConfig } from '../review/config'
import { buildReviewPrompt } from '../review/context'
import { type ReviewFileWithDiff, getChangedFiles } from '../review/diff'
import { filterFiles } from '../review/utils/filterFiles'

/**
 * One-shot code review, exposed as `POST /workflows/review` on the built server
 * (`node dist/server.mjs`) and runnable via `flue run review`.
 *
 * flue beta.9 shape: a workflow is `defineWorkflow({ agent, run })`. The run
 * handler computes the PR diff, drives the reviewer agent over the shared harness
 * (it posts inline comments via `suggest_change`), then posts the summary. Config
 * resolves from the environment (the reviewer agent resolves the same way), so the
 * agent and workflow stay in lockstep. The `input` schema exists only to accept the
 * CLI's `{platform, workspace}` POST body without a WorkflowInputUnexpectedError.
 */

/**
 * Opt the workflow into HTTP transport — `POST /workflows/review` on the built server.
 * beta.9 only exposes a discovered workflow over HTTP when it exports a `route`
 * middleware (otherwise it is dispatch-only); this pass-through is enough.
 */
export const route: WorkflowRouteHandler = async (_c, next) => next()

export default defineWorkflow({
  agent: reviewer,
  // Permissive top-level object schema — accepts the CLI's {platform, workspace} POST
  // body (valibot's object() ignores unknown keys) without a WorkflowInputUnexpectedError.
  // defineWorkflow requires a top-level OBJECT schema here (not record/union).
  input: v.object({}),
  async run({ harness }): Promise<JsonValue> {
    const cfg = resolveReviewConfig(undefined, process.env)

    const { files } = await getChangedFiles(cfg)
    const filtered = filterFiles(files, cfg.ignore, cfg.workspace) as ReviewFileWithDiff[]

    if (filtered.length === 0) {
      return { reviewed: 0, summaryPosted: false, message: 'No changed files to review.' }
    }

    sendReviewStarted(
      {
        enabled: cfg.telemetry,
        repoSeed: cfg.github ? `${cfg.github.owner}/${cfg.github.repo}` : cfg.workspace,
        platform: cfg.platform,
        model: cfg.model,
      },
      filtered.length
    )

    const session = await harness.session()

    const prompt = buildReviewPrompt(filtered, cfg.workspace)
    // Use the agent's final message as the summary rather than a structured
    // `result` schema: response_format/json_schema is not supported by every
    // provider (e.g. Cloudflare Workers AI returns 400), and a free-text final
    // message keeps the workflow model-agnostic.
    const response = await session.prompt(prompt)
    const summary =
      response.text?.trim() || 'Shippie completed the review; see the inline comments.'

    const reporter = createReporter(cfg)
    const summaryUrl = await reporter.postSummary(summary)

    return {
      reviewed: filtered.length,
      summaryPosted: Boolean(summaryUrl),
      summaryUrl: summaryUrl ?? null,
      summary,
    }
  },
})
