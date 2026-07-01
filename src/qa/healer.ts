import { type AgentProfile, defineAgentProfile } from '@flue/runtime'
import { createRunSpecTool } from '../tools/run-spec'
import type { QaConfig } from './config'
import { buildHealerInstructions } from './instructions'

/**
 * `healer` — a subagent PROFILE the lead delegates to for ONE broken catalogued
 * flow. Given the flow's spec, its failing repro, and the driver's fixHint, it
 * investigates the app/repo (white-box to FIX, black-box to TEST), attempts a
 * MINIMAL source fix, and writes/repairs `e2e/tests/<slug>.cdp.mjs` so it goes
 * failing→passing, verified green with `run_spec`. If it cannot fix the app it
 * leaves the source untouched, captures the broken behavior in a repro spec, and
 * returns a precise diagnosis for a human.
 *
 * Like browser-driver, this lives in src/qa/ (NOT src/agents/): flue auto-discovers
 * every src/agents/*.ts as a top-level agent that must default-export createAgent();
 * a subagent profile is not that — it is passed to the lead's `subagents: [...]`.
 *
 * Factory because it needs `cfg` for `createRunSpecTool` + instruction building.
 *
 * INHERITANCE NOTES (flue subagent semantics):
 * - The healer does NOT inherit the lead's instructions or custom tools — both are
 *   set here. `tools` is ONLY `run_spec`; built-ins (bash/read/write/edit/grep/glob)
 *   are always present and are how it both fixes app source AND authors the
 *   regression test. catalog_flows / classify_finding / open_pull_request stay
 *   LEAD-ONLY — the healer returns a verdict, the lead opens the PR.
 * - No `skills[]`: the lead omits `cwd` on its `task` calls, so the child inherits
 *   `cfg.workspace`, where `.agents/skills/chrome-cdp` + `e2e/cdp-client.mjs` live,
 *   and discovers the chrome-cdp skill automatically to reproduce the break.
 * - No `durability`: it is rejected on subagent profiles (it stays on the lead).
 */
export const healerProfile = (cfg: QaConfig): AgentProfile =>
  defineAgentProfile({
    name: 'healer',
    description:
      'Repairs ONE broken catalogued flow. Investigates the app + repo, attempts a MINIMAL source fix, ' +
      'and writes/repairs the regression test e2e/tests/<slug>.cdp.mjs so it goes failing→passing ' +
      '(verified green with run_spec). If it cannot fix the app, it leaves the source untouched, writes ' +
      'a repro spec capturing the broken behavior, and returns a precise diagnosis for a human. Give it ' +
      'the flow slug, its spec, the driver fixHint/summary, and the base URL. Returns a JSON heal verdict.',
    // Judgment tier: repairing a real bug means reading source, root-causing, and a
    // minimal correct fix — the headline win — so the healer runs on the LEAD model
    // (cfg.model), not the cheap driver tier. Resolved centrally (src/common/models.ts).
    model: cfg.model,
    thinkingLevel: 'high',
    instructions: buildHealerInstructions(cfg),
    tools: [createRunSpecTool(cfg)],
  })
