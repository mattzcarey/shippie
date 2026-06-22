# Subagents and the `task` Tool

shippie runs its review agent on flue (which drives the agent loop on "pi"). For focused, token-heavy investigation the reviewer doesn't spawn a bespoke sub-agent — it uses flue's built-in **`task`** tool, optionally targeting a named **subagent profile** declared on the agent.

## The `task` tool

`task` delegates a self-contained piece of work to a child agent that runs in its own context window. The parent reviewer hands over a goal; the child investigates and returns a single summary back to the parent. This keeps the parent's context small while still allowing deep, multi-step exploration.

The child agent:

- Has its own fresh context, separate from the parent reviewer.
- Has access to the same flue built-in tools — `read`, `write`, `edit`, `bash`, `grep`, `glob` (and `task` itself).
- **Auto-discovers the target directory's `AGENTS.md`** plus any Agent Skills under `<dir>/.agents/skills/<name>/SKILL.md`, so the delegated work is grounded in that project's own conventions.
- Returns a final message that becomes the result the parent reads.

This is the replacement for the old custom `spawn_subagent` tool — there is no separate `maxSteps` knob and no bespoke report schema to configure.

## Named subagent profiles

Beyond ad-hoc delegation, you can declare **named subagent profiles** on the agent. A profile pins a reusable configuration (its own instructions, model, and tool set) that the reviewer can dispatch to by name via `task`. This is useful when you have recurring, specialized jobs — for example a "security" reviewer or a "test-coverage" investigator — that should run with a consistent setup each time.

## When to delegate

Good candidates for `task`:

- **Code analysis** — examine a module for race conditions, leaks, or design issues.
- **Security auditing** — review auth/authz paths for vulnerabilities.
- **Dependency analysis** — enumerate external dependencies and flag risky ones.
- **Performance investigation** — trace query patterns or hot paths.

Delegating is worth the token cost when the investigation is large enough that running it inline would crowd out the reviewer's working context. For small, quick lookups, the reviewer should just use `read`/`grep`/`glob` directly.

## Tooling and rules

- Built-in tools available to both the reviewer and any child agent: `read`, `write`, `edit`, `bash`, `grep`, `glob`, `task`.
- shippie's custom `suggest_change` tool (inline review comments) belongs to the top-level reviewer; the PR summary is the reviewer's final message.
- MCP tools are exposed as `mcp__<name>__<tool>` and are available subject to your `MCP_SERVERS` / `SHIPPIE_MCP_SERVERS` configuration.
- Project context (`AGENTS.md` / `AGENT.md` / `CLAUDE.md`) and Agent Skills are auto-discovered per target directory, so delegated work stays aligned with the conventions of the code it touches.
