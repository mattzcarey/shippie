import { type JsonValue, type WorkflowRouteHandler, defineWorkflow } from '@flue/runtime'
import * as v from 'valibot'
import qaLead from '../agents/qa-lead'
import { sendQaStarted } from '../common/telemetry'
import { resolveQaConfig } from '../qa/config'
import { buildQaKickoff } from '../qa/instructions'
import { readLastPr } from '../qa/pr'
import { materializeCliClient, materializeClient, materializeSkill } from '../qa/skill'

/** Parse the agent's final message as the result JSON; tolerate prose/fences. */
const parseResult = (text: string | undefined): Record<string, JsonValue> => {
  const raw = (text ?? '').trim()
  if (!raw)
    return { passed: false, results: [], summary: 'No final message from the agent.' }
  const candidates = [raw]
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fenced) candidates.unshift(fenced[1].trim())
  const braced = raw.match(/\{[\s\S]*\}/)
  if (braced) candidates.push(braced[0])
  for (const c of candidates) {
    try {
      return JSON.parse(c) as Record<string, JsonValue>
    } catch {
      // try the next candidate
    }
  }
  return { passed: false, results: [], summary: raw.slice(0, 500) }
}

/**
 * One-shot autonomous QA. Run with:
 *   flue run qa --target node --payload '{"platform":"local","target":"http://localhost:5173"}'
 *
 * The lead explores the repo, catalogs flows, then fans out one browser-driver
 * subagent per flow (in parallel) to drive each flow in headless Chrome over CDP and
 * self-verify its CDP test (../cdp-client.mjs). The lead collects the verdicts, opens
 * one missing-coverage PR with the green specs, and returns a JSON result.
 *
 * flue beta.9 shape: `defineWorkflow({ agent, run })`. Config resolves from the
 * environment (the qa-lead agent resolves the same way and self-connects any MCP
 * tools); the run handler materializes the per-kind test client, then drives the lead
 * over the shared harness with the kickoff prompt. The `input` schema exists only to
 * accept the CLI's `{platform, workspace}` POST body.
 */

/**
 * Opt the workflow into HTTP transport — `POST /workflows/qa` on the built server.
 * beta.9 only exposes a discovered workflow over HTTP when it exports a `route`
 * middleware (otherwise it is dispatch-only); this pass-through is enough.
 */
export const route: WorkflowRouteHandler = async (_c, next) => next()

export default defineWorkflow({
  agent: qaLead,
  // Permissive top-level object schema — accepts the CLI's {platform, workspace} POST
  // body (valibot's object() ignores unknown keys). defineWorkflow requires a top-level
  // OBJECT schema here (not record/union).
  input: v.object({}),
  async run({ harness }): Promise<JsonValue> {
    const cfg = resolveQaConfig(undefined, process.env)

    sendQaStarted({
      enabled: cfg.telemetry,
      repoSeed: cfg.github ? `${cfg.github.owner}/${cfg.github.repo}` : cfg.workspace,
      platform: cfg.platform,
      model: cfg.model,
    })

    // Materialize the per-kind committed test driver into the workspace:
    //   web → the CDP skill (agent's interactive CLI) + cdp-client (e2e/cdp-client.mjs)
    //   cli → only cli-client (e2e/cli-client.mjs); the agent's tool is the built-in
    //         `bash`, so there is NO Chrome skill and NO cdp-client.
    if (cfg.kind === 'cli') {
      await materializeCliClient(cfg.workspace)
    } else {
      await materializeSkill(cfg.workspace)
      await materializeClient(cfg.workspace)
    }

    const session = await harness.session()
    const response = await session.prompt(buildQaKickoff(cfg))

    const agentResult = parseResult(response.text)
    // The open_pull_request tool persists its result; prefer it over the model's
    // self-report so the Action output seam (branch/changed/prUrl) is robust.
    const pr = await readLastPr(cfg.workspace)
    return {
      ...agentResult,
      branch: pr?.branch ?? agentResult.branch ?? null,
      changed: pr?.changed ?? false,
      prUrl: pr?.prUrl ?? agentResult.prUrl ?? null,
    }
  },
})
