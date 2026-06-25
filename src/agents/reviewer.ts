import '../common/litellm'
import { createAgent } from '@flue/runtime'
import { local } from '@flue/runtime/node'
import { createReporter } from '../github/reporter'
import { type ReviewPayload, resolveReviewConfig } from '../review/config'
import { buildInstructions } from '../review/instructions'
import { createSuggestChangeTool } from '../tools/suggest-change'

/**
 * The Shippie code-review agent. Runs in a `local()` sandbox over the repo
 * checkout, with the built-in pi tools (`read`/`grep`/`glob`/`bash`/`task`) plus
 * the `suggest_change` tool for posting inline review comments.
 *
 * The initializer re-runs on every harness init; it reads the workflow payload
 * and environment to resolve model, instructions, and the reporter binding.
 */
export default createAgent<ReviewPayload>(async ({ payload, env }) => {
  const cfg = resolveReviewConfig(payload, env as NodeJS.ProcessEnv)
  const reporter = createReporter(cfg)

  return {
    model: cfg.model,
    thinkingLevel: cfg.thinkingLevel,
    sandbox: local({ cwd: cfg.workspace }),
    cwd: cfg.workspace,
    instructions: await buildInstructions(cfg),
    tools: [createSuggestChangeTool(reporter)],
  }
})
