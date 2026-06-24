import { type AgentProfile, defineAgentProfile } from '@flue/runtime'
import { createRunSpecTool } from '../tools/run-spec'
import type { QaConfig } from './config'
import { buildDriverInstructions } from './instructions'

/** Cheap "hands" model for the per-flow drivers — judgment stays with the opus lead. */
const DRIVER_MODEL = 'anthropic/claude-sonnet-4-6'

/**
 * `browser-driver` — a subagent PROFILE the lead fans out to, ONE per catalogued
 * flow. Each driver launches its OWN headless Chrome over CDP (the `chrome-cdp`
 * skill auto-discovers from the inherited workspace cwd), drives its single flow,
 * writes a black-box `e2e/tests/<slug>.cdp.mjs` (importing ../cdp-client.mjs),
 * verifies it green with `run_spec`, and returns a JSON verdict to the lead.
 *
 * This lives in src/qa/ (NOT src/agents/): flue auto-discovers every src/agents/*.ts
 * as a top-level agent that must default-export createAgent(); a subagent profile is
 * not that — it is passed to the lead's `subagents: [...]`.
 *
 * Factory because it needs `cfg` for `createRunSpecTool` + model resolution.
 *
 * INHERITANCE NOTES (flue subagent semantics):
 * - The driver does NOT inherit the lead's instructions or custom tools — both are
 *   set here. `tools` is ONLY `run_spec`; built-ins (bash/read/write/edit/grep/glob)
 *   are always present. catalog_flows / open_pull_request stay LEAD-ONLY.
 * - No `skills[]`: the lead omits `cwd` on its `task` calls, so the child inherits
 *   `cfg.workspace`, where `.agents/skills/chrome-cdp` + `e2e/cdp-client.mjs` live,
 *   and discovers the skill automatically.
 * - No `durability`: it is rejected on subagent profiles (it stays on the lead).
 */
export const browserDriverProfile = (cfg: QaConfig): AgentProfile =>
  defineAgentProfile({
    name: 'browser-driver',
    description:
      'Drives ONE catalogued user flow in its own headless Chrome over CDP, writes a black-box ' +
      'e2e/tests/<slug>.cdp.mjs (importing ../cdp-client.mjs), verifies it green with run_spec, ' +
      'and returns a JSON verdict. Give it the flow slug, its spec, and a unique FLOW_INDEX.',
    model: DRIVER_MODEL,
    thinkingLevel: 'medium',
    instructions: buildDriverInstructions(cfg),
    tools: [createRunSpecTool(cfg)],
  })
