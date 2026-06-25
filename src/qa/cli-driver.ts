import { type AgentProfile, defineAgentProfile } from '@flue/runtime'
import { createRunSpecTool } from '../tools/run-spec'
import type { QaConfig } from './config'
import { buildCliDriverInstructions } from './instructions'

/** Cheap "hands" model for the per-scenario drivers — judgment stays with the opus lead. */
const DRIVER_MODEL = 'anthropic/claude-sonnet-4-6'

/**
 * `cli-driver` — a subagent PROFILE the lead fans out to, ONE per catalogued CLI
 * scenario, for NON-WEB targets (`cfg.kind === 'cli'`: a CLI tool, a binary, a node
 * package with a `bin`, a Rust/Go lib's command surface). Each driver runs the
 * target's CLI through its built-in `bash` tool (the terminal IS the "developer tool"
 * here — there is NO browser, NO chrome-cdp skill, NO cdp-client), learns the real
 * behavior (help text, output format, exit codes), then writes a black-box
 * `e2e/tests/<slug>.cli.mjs` (importing ../cli-client.mjs) that spawns the CLI and
 * asserts on stdout/stderr/exit-code, verifies it green with `run_spec`, and returns
 * a JSON verdict to the lead.
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
 *   are always present and are how it builds + runs the target CLI AND authors the
 *   test. catalog_flows / open_pull_request stay LEAD-ONLY.
 * - No `skills[]`: a CLI target has no skill — the developer tool is the built-in
 *   `bash`. The lead omits `cwd` on its `task` calls, so the child inherits
 *   `cfg.workspace`, where `e2e/cli-client.mjs` is materialized, so the test's
 *   `import { run } from '../cli-client.mjs'` resolves.
 * - No `durability`: it is rejected on subagent profiles (it stays on the lead).
 */
export const cliDriverProfile = (cfg: QaConfig): AgentProfile =>
  defineAgentProfile({
    name: 'cli-driver',
    description:
      'Exercises ONE catalogued CLI scenario by running the target CLI via bash, writes a black-box ' +
      'e2e/tests/<slug>.cli.mjs (importing ../cli-client.mjs) asserting stdout/stderr/exit-code, ' +
      'verifies it green with run_spec, and returns a JSON verdict. NO browser/CDP — the terminal is ' +
      'the tool. Give it the scenario slug, its spec, and a unique FLOW_INDEX.',
    model: DRIVER_MODEL,
    thinkingLevel: 'medium',
    instructions: buildCliDriverInstructions(cfg),
    tools: [createRunSpecTool(cfg)],
  })
