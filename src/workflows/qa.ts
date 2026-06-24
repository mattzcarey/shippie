import type { FlueContext, WorkflowRouteHandler } from '@flue/runtime'
import qaLead from '../agents/qa-lead'
import { sendQaStarted } from '../common/telemetry'
import { connectMcpServers } from '../mcp/connect'
import { type QaPayload, resolveQaConfig } from '../qa/config'
import { buildQaKickoff } from '../qa/instructions'
import { ensurePlaywrightConfig } from '../qa/scaffold'
import { materializeSkill } from '../qa/skill'

/** Exposes `POST /workflows/qa` on the built server (`node dist/server.mjs`). */
export const route: WorkflowRouteHandler = async (_c, next) => next()

/** Parse the agent's final message as the result JSON; tolerate prose/fences. */
const parseResult = (text: string | undefined): Record<string, unknown> => {
  const raw = (text ?? '').trim()
  if (!raw) return { passed: false, summary: 'No final message from the agent.' }
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
  return { passed: false, summary: raw.slice(0, 500) }
}

/**
 * One-shot autonomous QA. Run with:
 *   flue run qa --target node --payload '{"platform":"local","target":"http://localhost:5173"}'
 *
 * Explores the repo, catalogs flows, drives the top flow in headless Chrome over
 * CDP, writes + self-verifies a Playwright spec, and returns a JSON result.
 */
export async function run({ init, payload, env }: FlueContext<QaPayload>) {
  const cfg = resolveQaConfig(payload, env as NodeJS.ProcessEnv)

  sendQaStarted({
    enabled: cfg.telemetry,
    repoSeed: cfg.github ? `${cfg.github.owner}/${cfg.github.repo}` : cfg.workspace,
    platform: cfg.platform,
    model: cfg.model,
  })

  // Make the CDP skill discoverable + ensure a Playwright config exists (never clobber one).
  await materializeSkill(cfg.workspace)
  await ensurePlaywrightConfig(cfg.workspace)

  const mcp = await connectMcpServers(cfg.mcpServers)
  try {
    const harness = await init(qaLead, { tools: mcp.tools })
    const session = await harness.session()
    const response = await session.prompt(buildQaKickoff(cfg))
    return parseResult(response.text)
  } finally {
    await mcp.close()
  }
}
