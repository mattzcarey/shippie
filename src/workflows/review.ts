import type { FlueContext, WorkflowRouteHandler } from '@flue/runtime'
import reviewer from '../agents/reviewer'
import { sendReviewStarted } from '../common/telemetry'
import { createReporter } from '../github/reporter'
import { connectMcpServers } from '../mcp/connect'
import { type ReviewPayload, resolveReviewConfig } from '../review/config'
import { buildReviewPrompt } from '../review/context'
import { type ReviewFileWithDiff, getChangedFiles } from '../review/diff'
import { filterFiles } from '../review/utils/filterFiles'

/**
 * Exposes `POST /workflows/review` on the built server (`node dist/server.mjs`),
 * so the self-built package can run locally over HTTP as well as via `flue run`.
 */
export const route: WorkflowRouteHandler = async (_c, next) => next()

/**
 * One-shot code review. Run with:
 *   flue run review --target node --payload '{"platform":"github", ...}'
 *
 * Computes the PR diff, runs the reviewer agent (which posts inline comments via
 * `suggest_change`), then posts the summary. Returns a JSON result on stdout.
 */
export async function run({ init, payload, env }: FlueContext<ReviewPayload>) {
  const cfg = resolveReviewConfig(payload, env as NodeJS.ProcessEnv)

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

  const mcp = await connectMcpServers(cfg.mcpServers)
  try {
    const harness = await init(reviewer, { tools: mcp.tools })
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
      summaryUrl,
      summary,
    }
  } finally {
    await mcp.close()
  }
}
