import type { FlueContext, WorkflowRouteHandler } from '@flue/runtime'
import qaLead from '../agents/qa-lead'
import { sendQaStarted } from '../common/telemetry'
import { connectMcpServers } from '../mcp/connect'
import { type QaPayload, resolveQaConfig } from '../qa/config'
import { buildQaKickoff } from '../qa/instructions'
import { readLastPr } from '../qa/pr'
import { materializeClient, materializeSkill } from '../qa/skill'

/** Exposes `POST /workflows/qa` on the built server (`node dist/server.mjs`). */
export const route: WorkflowRouteHandler = async (_c, next) => next()

/** Parse the agent's final message as the result JSON; tolerate prose/fences. */
const parseResult = (text: string | undefined): Record<string, unknown> => {
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
      return JSON.parse(c) as Record<string, unknown>
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
 */
export async function run({ init, payload, env }: FlueContext<QaPayload>) {
  const cfg = resolveQaConfig(payload, env as NodeJS.ProcessEnv)

  sendQaStarted({
    enabled: cfg.telemetry,
    repoSeed: cfg.github ? `${cfg.github.owner}/${cfg.github.repo}` : cfg.workspace,
    platform: cfg.platform,
    model: cfg.model,
  })

  // Make the CDP skill discoverable (agent's interactive CLI) + drop the cdp-client
  // the committed tests import (e2e/cdp-client.mjs).
  await materializeSkill(cfg.workspace)
  await materializeClient(cfg.workspace)

  const mcp = await connectMcpServers(cfg.mcpServers)
  try {
    const harness = await init(qaLead, { tools: mcp.tools })
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
  } finally {
    await mcp.close()
  }
}
