import { createAgent } from '@flue/runtime'
import { local } from '@flue/runtime/node'
import { createReporter } from '../github/reporter'
import { connectMcpServers } from '../mcp/connect'
import { resolveReviewConfig } from '../review/config'
import { buildInstructions } from '../review/instructions'
import { createSuggestChangeTool } from '../tools/suggest-change'

/**
 * The Shippie code-review agent. Runs in a `local()` sandbox over the repo
 * checkout, with the built-in pi tools (`read`/`grep`/`glob`/`bash`/`task`) plus
 * the `suggest_change` tool for posting inline review comments.
 *
 * The initializer re-runs on every harness init. In flue beta.9 the agent
 * initializer receives only `{ id, env }` (no per-invocation payload), so the run
 * config — model, instructions, the reporter binding, and any MCP tools — is
 * resolved entirely from the environment (the same vars the Action/CLI already
 * set). The workflow supplies the actual work (the diff/context) via the prompt.
 */
export default createAgent(async ({ env }) => {
  const cfg = resolveReviewConfig(undefined, env as NodeJS.ProcessEnv)
  const reporter = createReporter(cfg)
  // MCP tools are optional (empty unless SHIPPIE_MCP_SERVERS is configured). They
  // are connected here per init; the review is one-shot, so the process exit tears
  // the connections down.
  const mcp = await connectMcpServers(cfg.mcpServers)

  return {
    model: cfg.model,
    thinkingLevel: cfg.thinkingLevel,
    sandbox: local({ cwd: cfg.workspace }),
    cwd: cfg.workspace,
    instructions: await buildInstructions(cfg),
    tools: [createSuggestChangeTool(reporter), ...mcp.tools],
  }
})
