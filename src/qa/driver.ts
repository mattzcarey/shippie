import { type AgentProfile, defineAgentProfile } from '@flue/runtime'
import { createRunSpecTool } from '../tools/run-spec'
import type { QaConfig } from './config'
import { buildCliDriverInstructions, buildDriverInstructions } from './instructions'

/** Cheap "hands" model for the per-flow drivers — judgment stays with the opus lead. */
const DRIVER_MODEL = 'anthropic/claude-sonnet-4-6'

/**
 * `driverProfile` — the SINGLE subagent PROFILE the lead fans out to, ONE per
 * catalogued flow/scenario. Its identity is chosen by `cfg.kind` (the lead delegates
 * to it by the kind-matched name, since the kickoff + instructions branch on the same
 * `cfg.kind`, so exactly the right driver is declared per run — no dead second profile):
 * - 'web' → a `browser-driver` that launches its OWN headless Chrome over CDP (the
 *   auto-discovered chrome-cdp skill), drives its single flow, and writes + verifies a
 *   black-box `e2e/tests/<slug>.cdp.mjs` (importing ../cdp-client.mjs).
 * - 'cli' → a `cli-driver` that runs the target's CLI through its built-in `bash`
 *   (NO browser, NO chrome-cdp, NO cdp-client), and writes + verifies a black-box
 *   `e2e/tests/<slug>.cli.mjs` (importing ../cli-client.mjs).
 * Either way it verifies the test green with `run_spec` and returns a JSON verdict.
 *
 * This lives in src/qa/ (NOT src/agents/): flue auto-discovers every src/agents/*.ts
 * as a top-level agent that must default-export createAgent(); a subagent profile is
 * not that — it is passed to the lead's `subagents: [...]`.
 *
 * Factory because it needs `cfg` for `createRunSpecTool` + kind resolution.
 *
 * INHERITANCE NOTES (flue subagent semantics):
 * - The driver does NOT inherit the lead's instructions or custom tools — both are
 *   set here. `tools` is ONLY `run_spec`; built-ins (bash/read/write/edit/grep/glob)
 *   are always present. catalog_flows / open_pull_request stay LEAD-ONLY.
 * - No `skills[]`: the lead omits `cwd` on its `task` calls, so the child inherits
 *   `cfg.workspace`, where the materialized chrome-cdp skill + cdp-client (web) or the
 *   cli-client (cli) live — the web driver auto-discovers the skill; a cli target has
 *   no skill, its developer tool is the built-in `bash`.
 * - No `durability`: it is rejected on subagent profiles (it stays on the lead).
 */
export const driverProfile = (cfg: QaConfig): AgentProfile => {
  const spec =
    cfg.kind === 'cli'
      ? {
          name: 'cli-driver',
          description:
            'Exercises ONE catalogued CLI scenario by running the target CLI via bash, writes a black-box ' +
            'e2e/tests/<slug>.cli.mjs (importing ../cli-client.mjs) asserting stdout/stderr/exit-code, ' +
            'verifies it green with run_spec, and returns a JSON verdict. NO browser/CDP — the terminal is ' +
            'the tool. Give it the scenario slug, its spec, and a unique FLOW_INDEX.',
          instructions: buildCliDriverInstructions(cfg),
        }
      : {
          name: 'browser-driver',
          description:
            'Drives ONE catalogued user flow in its own headless Chrome over CDP, writes a black-box ' +
            'e2e/tests/<slug>.cdp.mjs (importing ../cdp-client.mjs), verifies it green with run_spec, ' +
            'and returns a JSON verdict. Give it the flow slug, its spec, and a unique FLOW_INDEX.',
          instructions: buildDriverInstructions(cfg),
        }

  return defineAgentProfile({
    ...spec,
    model: DRIVER_MODEL,
    thinkingLevel: 'medium',
    tools: [createRunSpecTool(cfg)],
  })
}
