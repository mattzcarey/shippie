TO THE AI.

Shippie is a code-review agent built on [flue](https://github.com/withastro/flue), run with
Node + npm. It runs the agent loop on "pi" (flue's built-in tools), reviews PRs in CI via the
GitHub Action and staged changes locally (`npx shippie review`), and deploys anywhere flue deploys.

Ethos of the package:

- A headless flue agent that reviews code using flue's built-in ("pi") tools plus `suggest_change`
- Works natively in GitHub Actions and Node
- Model-agnostic via flue model strings (anthropic / openai / openrouter / Cloudflare Workers AI)
- Acts as a Model Context Protocol (MCP) client (remote HTTP/SSE) configured via the Action input
- Reads `AGENTS.md` / `CLAUDE.md` and `.agents/skills/` for project context

Go through these todos, one by one. When they are complete add a ✅ to the left of the todo. If you
fail to do them add a ❌ to the left of the todo.

TODO:

- Optional `@flue/github` channel: a webhook server mode for live "@shippie review" comments alongside the one-shot CI workflow.
- Large-diff handling: tune flue context compaction so very large PRs compress context before resuming the review.
- Improve inline-comment reliability on smaller / open models (e.g. Cloudflare Workers AI).
- Re-create review eval/scenario tests on the flue workflow (the old `src/specs` scenarios were removed).
- Landing page and better docs.
- Telemetry on errors and on AI usage (basic anonymous `review_started` telemetry is already in place).
