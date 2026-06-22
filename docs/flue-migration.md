# Shippie → Flue Migration Log

> **Status:** In progress. This document is both the **plan** and the **running log** for
> refactoring Shippie from a bespoke Vercel-AI-SDK agent into a **prebuilt code-review agent
> built on [flue](https://github.com/withastro/flue)**.
>
> Started: 2026-06-17. Append a dated entry to the **Change Log** section at the bottom for
> every meaningful change.

---

## 1. Goal

Turn Shippie into a **prebuilt flue agent**: a code-review agent that ships as a flue project so it

- runs natively in **Node.js and GitHub Actions** (one-shot `flue run`),
- can **deploy anywhere flue deploys** (Node server, Cloudflare Workers, GitLab CI, Daytona, Render, …),
- uses flue's **built-in "pi" tools** (`read`, `write`, `edit`, `bash`, `grep`, `glob`, `task`) instead of hand-rolled tools,
- discovers **skills** from the default `.agents/skills/` location and reads **`AGENTS.md` + `CLAUDE.md`** at the repo root,
- accepts **MCP servers only via config in the GitHub Action** (not via `.mcp.json`),
- and lets us **delete a large amount of bespoke code** (the custom agent loop, model factory, MCP client, tool registry, platform-provider abstraction, prompt builder, yargs CLI, configure templates).

This is a big refactor. Breaking changes are expected and acceptable.

## 2. Background: what flue and "pi" are

- **flue** (`@flue/runtime`, `@flue/cli`) — withastro's runtime-agnostic, headless agent-harness
  framework. "Agent = Model + Harness." You compose an agent with `createAgent()`, give it a
  sandbox, tools, skills and instructions, and drive it from a **workflow** (`run(ctx)`) or an
  **addressable agent** (HTTP) or a **channel** (webhook). Deploys to Node, Cloudflare, GitHub
  Actions, GitLab CI, etc.
- **"pi"** — `@earendil-works/pi-agent-core` / `@earendil-works/pi-ai` (Mario Zechner's pi). This is
  the underlying agent loop + built-in tools + provider catalog that flue wraps. "Use the default
  pi tools" = use flue's built-in `read/write/edit/bash/grep/glob/task` tools rather than shippie's
  custom `read_file/ls/fetch/...`.

### Key flue API facts (verbatim-sourced, see `/tmp/flue-reference.md` for the full distilled reference)

- `createAgent(() => ({ model, instructions, tools, skills, subagents, sandbox, cwd, thinkingLevel, compaction, durability }))`
- `defineTool({ name, description, parameters /* valibot v.object() or raw JSON Schema */, execute: async (args) => string })`
- `local()` from `@flue/runtime/node` → host filesystem + shell sandbox; `cwd` defaults to `process.cwd()`. Secrets are **not** exposed to the sandbox shell unless opted in via `local({ env: {...} })`.
- Built-in tools (the "pi" set): `read`, `write`, `edit`, `bash`, `grep`, `glob`, plus `task` (delegate to a child agent, which auto-discovers the child `cwd`'s `AGENTS.md` + `.agents/skills/`) and `activate_skill`.
- Workflow: `src/workflows/<name>.ts` exporting `export async function run({ init, payload, env }: FlueContext<P>)`. Drive with `init(agent) → harness.session() → session.prompt(text, { tools, result })`. Returns JSON to **stdout** (events/progress go to **stderr**).
- One-shot CI: `npx flue run <workflow> --target node --payload '{...}'`. No server required. `--root <path>` selects the flue project; `--env <path>` loads an env file.
- Models: `model: '<provider>/<model>'` (e.g. `anthropic/claude-sonnet-4-6`, `openai/gpt-5.5`, `openrouter/...`). Built-in provider env vars: `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`. Custom/gateway providers via `registerProvider()` in `src/app.ts`.
- MCP **in code**: `connectMcpServer(name, { url, transport?: 'streamable-http'|'sse', headers? })` → `connection.tools` (spread into `tools`); call `connection.close()` when done. **Remote HTTP/SSE only — no stdio/`command` transport.**
- Skills: auto-discovered at `<cwd>/.agents/skills/<name>/SKILL.md` (dir name must equal frontmatter `name`); or imported with `import s from './SKILL.md' with { type: 'skill' }` and passed in `skills: [...]`. Skills are **instructions only**, not executable capability.
- **`AGENTS.md`** is discovered by flue (system prompt / `task` tool per-directory). **`CLAUDE.md` and `.cursor/rules` are NOT supported by flue** — Shippie must read those itself and inject them.
- Structured results: `session.prompt(text, { result: v.object({...}) })` → validated `response.data`.

## 3. Architecture decision

**Shippie becomes a flue project whose primary entry is a one-shot review workflow.**

```
shippie/  (the flue project AND the published GitHub Action)
├─ flue.config.ts                 # defineConfig({ target: 'node' })
├─ src/
│  ├─ agents/
│  │  └─ reviewer.ts              # createAgent: model + local() sandbox + review tools + instructions
│  ├─ workflows/
│  │  └─ review.ts                # run({ init, payload, env }): diff → review → post → return result
│  ├─ tools/
│  │  ├─ suggest-change.ts        # defineTool, Octokit inline review comment
│  │  ├─ submit-summary.ts        # defineTool, Octokit PR summary comment
│  │  └─ read-diff.ts             # defineTool, `git diff` for one file (or fold into bash)
│  ├─ review/
│  │  ├─ instructions.ts          # the review system prompt (was prompt/prompts.ts)
│  │  └─ context.ts               # read AGENTS.md + CLAUDE.md (root) → inject; build diff context
│  ├─ github/
│  │  └─ client.ts                # Octokit + PR ref helpers (owner/repo/prNumber, commit sha)
│  ├─ git/                        # KEEP: diff computation (getFilesWithChanges, line ranges)
│  └─ mcp/
│     └─ connect.ts               # parse MCP config from action input → connectMcpServer()
├─ action.yml                     # composite: setup-node 22 → npm ci → npx flue run review
└─ docs/flue-migration.md         # this file
```

### Why a **workflow** (not a channel)

GitHub Actions runs Shippie **once per PR**. flue's **workflow + `flue run`** model is the exact fit:
no long-running server, payload in, JSON result out. The `@flue/github` **channel** is webhook-driven
and needs a deployed public server — that's a *future optional* second deployment mode (live
`@shippie review` comments), not the CI path. Both can coexist later.

### Where the diff comes from

Keep Shippie's deterministic diff computation (`src/common/git/*`) — it drives file filtering and the
exact line ranges that `suggest_change` anchors to. The workflow computes the diff in plain TS, then
feeds it into `session.prompt(...)`. The agent can still use the built-in `bash`/`read`/`grep` tools
(via `local()`) to investigate the surrounding code.

### How tokens/secrets flow

- Model provider key (`ANTHROPIC_API_KEY` etc.) → job `env:` → read by flue's model layer.
- `GITHUB_TOKEN` → used by **our Octokit client** in the `suggest_change`/`submit_summary` tools
  (bound to owner/repo/PR in trusted code; the model only chooses comment body/line/path). It is
  **not** exposed to the sandbox shell.
- MCP servers → JSON config via the Action input → `connectMcpServer()` per entry.

## 4. Module-by-module migration map

| Shippie module | Fate | Flue equivalent / notes |
| --- | --- | --- |
| `src/index.ts` (yargs dispatch) | **Remove** | `flue run review` is the entry; keep an optional thin `shippie` bin only if we still want a local CLI. |
| `src/args.ts` (yargs) | **Remove** | `flue run --payload` provides args. |
| `src/review/agent/index.ts` (retry loop) | **Remove** | flue/pi agent loop (`session.prompt`). Retry/durability via `durability`. |
| `src/review/agent/generate.ts` (`generateText`) | **Remove** | `session.prompt()`. |
| `src/review/prompt/prompts.ts` | **Move → `src/review/instructions.ts`** | Becomes the agent `instructions`. |
| `src/review/prompt/index.ts`, `fileInfo.ts`, `utils/fileLanguage.ts` | **Trim → `src/review/context.ts`** | Build the diff/file context block; drop bespoke language detection if not needed. |
| `src/review/utils/rulesFiles.ts` (rules discovery) | **Replace (shrink)** | flue auto-discovers `AGENTS.md` + `.agents/skills/`. We add a small reader for **root `AGENTS.md` + `CLAUDE.md`** only. Drop `.cursor/rules`, `.windsurf`, `clinerules`, dedup machinery. |
| `src/review/utils/filterFiles.ts` | **Keep** | Ignore-glob filtering still useful. |
| `src/common/llm/models.ts` (provider factory) | **Remove** | `model: '<provider>/<model>'` string; flue resolves providers. |
| `src/common/llm/index.ts`, `promptLength.ts`, `context.ts` | **Remove** | Handled by flue. |
| `src/common/llm/mcp/client.ts` (`.mcp.json`/`.cursor`) | **Replace → `src/mcp/connect.ts`** | `connectMcpServer()` from Action-input config. Remote HTTP/SSE only. |
| `src/common/llm/tools/{readFile,ls,glob,grep,bash,fetch,thinking}.ts` | **Remove** | Covered by built-in pi tools (`read/glob/grep/bash`). `fetch`/`thinking` dropped (or MCP). |
| `src/common/llm/tools/readDiff.ts` | **Move → `src/tools/read-diff.ts`** | `defineTool` (or rely on `bash` + `git diff`). |
| `src/common/llm/tools/suggestChanges.ts` | **Move → `src/tools/suggest-change.ts`** | `defineTool` + Octokit `pulls.createReviewComment`. |
| `src/common/llm/tools/submitSummary.ts` | **Move → `src/tools/submit-summary.ts`** | `defineTool` + Octokit `issues.createComment` (upsert by sign-off). |
| `src/common/llm/tools/subAgent.ts` | **Remove** | flue built-in `task` tool + `subagents`. |
| `src/common/llm/tools/index.ts` (registry) | **Remove** | Tools listed directly on `createAgent({ tools })`. |
| `src/common/platform/provider.ts`, `factory.ts` | **Remove** | No more provider abstraction; GitHub Octokit directly. |
| `src/common/platform/github/githubProvider.ts` | **Distill → `src/github/client.ts` + tools** | Keep the Octokit comment logic; drop the interface plumbing. |
| `src/common/platform/{gitlab,azdev,local}/` | **Remove** | gitlab/azdev were unimplemented stubs. "local" output → workflow returns JSON result / writes a file. |
| `src/common/git/*` | **Keep** | Diff computation + line ranges. |
| `src/common/formatting/{summary,usage}.ts` | **Keep (trim)** | Summary sign-off/CTA formatting; usage now from `response.usage`. |
| `src/common/api/telemetry.ts` | **Decide** | Keep opt-in telemetry or drop. (TBD) |
| `src/configure/*` + `templates/*` | **Replace** | Drop multi-platform templates; ship one `action.yml` + a documented workflow snippet. Optional `shippie init` later. |
| `src/specs/*` (e2e + scenarios) | **Rework** | Re-point scenario runner at the flue workflow. |
| `action.yml` | **Rewrite** | `setup-node@v4 (22)` → `npm ci` → `npx flue run review --target node --payload '{...}'`. |
| `package.json` | **Rewrite deps** | Add `@flue/runtime`, `@flue/cli`, `valibot`, `@octokit/rest`; remove `ai`, `@ai-sdk/*`, `yargs`, `@inquirer/prompts`, `tsup` (use `flue build`), `gray-matter`/`tinyglobby` if rules shrink enough. |

## 5. Open risks / things to verify against the real flue

1. **`flue run` from a published Action** — the flue project source must travel with the action and
   build at run time (`npx flue run review --root $GITHUB_ACTION_PATH`), with the **target repo**
   mounted as the agent's `cwd` via `local({ cwd: payload.workspace })`. Verify `--root` + a
   different sandbox `cwd` works.
2. **MCP stdio gap** — flue's `connectMcpServer` is remote-only. Shippie's old `.mcp.json` allowed
   `command`/stdio servers. We intentionally only accept **remote (URL) MCP servers via Action
   config**; document the limitation.
3. **`CLAUDE.md` discovery** — not native to flue; we read it ourselves.
4. **Inline review comments** — Octokit `pulls.createReviewComment` (path/line) is our code, not a
   flue affordance. Keep Shippie's existing single/multi-line logic.
5. **flue is `1.0.0-beta.1`** — pin versions; expect churn.

## 6. Phased plan

- **Phase 0 — Research & verify (DONE / in progress):** distil flue API; verify `flue run` + `local()` sandbox in a throwaway project.
- **Phase 1 — Skeleton + core loop:** `flue.config.ts`, `package.json` deps, `src/agents/reviewer.ts`, `src/workflows/review.ts`, the three custom tools, instructions, context (AGENTS.md/CLAUDE.md), git diff reuse. Make `flue run review` work locally.
- **Phase 2 — Module sweep (workflows):** port/remove each module per the map; delete dead code.
- **Phase 3 — Action + packaging:** rewrite `action.yml`, package.json scripts, docs, `configure` removal.
- **Phase 4 — Tests + verify:** typecheck/build clean; rework specs; end-to-end review on a sample PR.

---

## Change Log

### 2026-06-17

- **Research complete.** Pulled 66 flue source/doc files to `/tmp/flue-ref`; ran a 6-agent
  distillation workflow → full verbatim API reference at `/tmp/flue-reference.md`. Mapped every
  shippie module to its flue fate (section 4). Decided on the **workflow + `flue run`** architecture
  (section 3).
- **flue verified end-to-end** in `/tmp/flue-verify` (throwaway project):
  - `@flue/runtime` + `@flue/cli` `1.0.0-beta.1` + `valibot@1.4.1` install cleanly on Node 24.
  - `flue run echo --payload '{"msg":"it-works"}'` → clean JSON `{ "ok": true, "echoed": "it-works" }`
    on **stdout** (progress on stderr). ✓
  - `flue run sh` with `createAgent({ model: false, sandbox: local() })` + `session.shell('echo … && node --version')`
    → executed the host shell in the sandbox, returned `{ "exitCode": 0, "stdout": "hello-from-sandbox\nv24.13.0" }`. ✓
  - `flue run echo --root /tmp/flue-verify` from a different cwd works (needed for the published Action). ✓
  - No model API key in this env, so a full real-model prompt+tool run wasn't exercised; the
    workflow/sandbox/`--root` plumbing — the architectural bet — is confirmed.

### 2026-06-17 — Phase 1: core agent loop

Implemented the flue project skeleton + core review loop (the priority "fix the core agent loop"):

- `flue.config.ts` — `defineConfig({ target: 'node' })`.
- `src/agents/reviewer.ts` — `createAgent` (model + `local()` sandbox + injected instructions + `suggest_change` tool).
- `src/workflows/review.ts` — `run({ init, payload, env })`: resolve config → compute diff → filter → connect MCP → `init → session.prompt(diff, { result })` → post summary → return JSON. Returns early (`{ reviewed: 0 }`) when there is no diff, so it runs without a model key.
- `src/review/config.ts` — `resolveReviewConfig(payload, env)` (payload + GitHub-Actions env).
- `src/review/diff.ts` — clean `git diff` computation (base/head SHAs or `--cached`), per-file diff + changed-line ranges (reuses the old parsing algorithm, drops the platform/env coupling).
- `src/review/instructions.ts` — review system prompt + root `AGENTS.md`/`AGENT.md`/`CLAUDE.md` injection + custom instructions.
- `src/review/context.ts` — builds the review prompt (file tree + per-file unified diffs).
- `src/github/reporter.ts` — tiny `github | local` reporter (replaces the whole `platform/` abstraction): inline review comments + summary upsert via `octokit`, or append to `.shippie/review/*.md` locally.
- `src/tools/suggest-change.ts` — `defineTool` (valibot) → reporter inline comment.
- `src/mcp/connect.ts` — `connectMcpServer` per Action-config entry (remote HTTP/SSE only); aggregate `close()`.
- **Decisions:** `submit_summary` tool + 3-attempt retry loop → replaced by a structured `result` schema (`{ summary }`) the workflow posts. `spawn_subagent` → flue built-in `task`. `read_file/ls/glob/grep/bash/fetch/thinking/read_diff` tools → flue built-in pi tools. All logging kept off **stdout** (reserved for the JSON result).
- Added deps `@flue/runtime`, `valibot` (+ `@flue/cli` dev); reused existing `octokit`. Old deps/code still present (removed in Phase 2).
- **Verified:** `flue run review --payload '{"platform":"local"}'` on a clean tree → `{ reviewed: 0 }`.
  With one staged file it computed the diff, built instructions (reading AGENTS.md/CLAUDE.md), initialized
  the agent + `local()` sandbox, and reached the model call — failing only on `No API key for provider:
  anthropic` (the expected boundary). The core loop is functional end-to-end up to the model.

### 2026-06-17 — Phase 2: module sweep + cleanup

**Key insight:** `flue build`/`flue run` only discover & bundle `src/agents`, `src/workflows`,
`src/channels`, and `app.ts`. The rest of `src/` is invisible to flue, so removing the old bespoke
stack cannot break `flue run review` — confirmed by re-running it green after each deletion.

- **Removed 62 files** (the entire bespoke stack): `src/index.ts`, `src/args.ts`, `src/config.ts`,
  `src/review/{index,types}.ts`, `src/review/agent/*`, `src/review/prompt/{index,prompts,utils}`,
  `src/review/utils/rulesFiles.ts` (+ its test), `src/common/llm/*` (models, mcp client, all 12 tools,
  promptLength, context), `src/common/platform/*` (provider, factory, github/gitlab/azdev/local),
  `src/common/git/*`, `src/common/formatting/usage.ts`, `src/common/api/*` (telemetry),
  `src/common/utils/logger.ts`, `src/configure/*`, `src/specs/*`, `templates/*`, `tsup.config.ts`.
- **Trimmed** `src/common/types.ts` to just `ReviewFile` + `LineRange`.
- **Rewrote `action.yml`** → flue-native composite action: `actions/setup-node@v4` (Node 22) →
  `npm install --prefix $GITHUB_ACTION_PATH` → `npx flue run review --root $GITHUB_ACTION_PATH`.
  All config flows via env (`SHIPPIE_MODEL`, `SHIPPIE_*`, `BASE_SHA`/`HEAD_SHA`, `SHIPPIE_PR_NUMBER`,
  `SHIPPIE_MCP_SERVERS`, provider keys, `GITHUB_TOKEN`) — no `jq`/payload juggling. `config.ts` extended
  to read these env fallbacks.
- **Pruned 18 dependencies**: removed `ai`, `@ai-sdk/{anthropic,azure,google,openai}`, `yargs`,
  `@inquirer/prompts`, `dotenv`, `gray-matter`, `tinyglobby`, `tslog`, `ulid`, `picocolors`, `zod`,
  `@actions/github`, `@types/yargs`, `autoevals`, `tsup`. **Runtime deps are now just 4**:
  `@flue/runtime`, `octokit`, `picomatch`, `valibot`.
- **Fixed `package.json`**: removed stale `bin`/`main`/`types`; scripts now `review`/`dev`/`build` →
  `flue …`; `files` → `["src", "flue.config.ts", "action.yml"]`; added `"type": "module"`.
- **Net:** `bun test src/review` → 5/5 pass; `tsc --noEmit` clean; `biome check` clean on all 15 new
  source files; `flue run review` green.

**Source is now 16 files** (down from ~70): `agents/reviewer.ts`, `workflows/review.ts`,
`tools/suggest-change.ts`, `mcp/connect.ts`, `github/reporter.ts`, `review/{config,diff,instructions,context,constants}.ts`,
`review/prompt/fileInfo.ts`, `review/utils/filterFiles.ts` (+test), `common/{types,formatting/summary}.ts`.

### 2026-06-17 — Phase 3/4: tests, CI, docs

- **Tests (flue-aware):** refactored `diff.ts` to export `parseDiff(rawDiff, workspace)` and added
  `src/review/specs/diff.test.ts` (added/modified/pure-deletion ranges, multi-file/multi-hunk isolation,
  empty diff) and `src/review/specs/config.test.ts` (defaults, payload>env precedence, github target
  resolution, `SHIPPIE_IGNORE` parsing, MCP env parsing bare/wrapper/invalid). **`bun test src/review` →
  19/19 pass**; tsc + biome clean. Confirmed `bun run build` (flue under bun) works, so CI stays bun-based.
- **CI:** rewrote `.github/workflows/pr.yml` for flue — `build-and-test` job (bun i → `check` → `check:types`
  → `build` (flue) → `bun test src/review`) + a non-blocking `review` dogfood job (`uses: ./` with
  `MODEL: openai/gpt-4.1-mini`, `continue-on-error`). Pinned `release-package.yml` to Node 22 (publish flow:
  `bun run build` + `npm publish`; `prepublishOnly` also runs `flue build`).
- **AGENTS.md (root):** rewritten for the flue structure/commands/MCP (it was stale and is injected into the
  review prompt).
- **Docs + README:** rewriting `README.md` + `docs/{setup,ai-provider-config,action-options,mcp,rules-files,
  subagent-tool,custom-instructions-example}.md` via a parallel Workflow (one agent per file) for the flue
  model, including a Cloudflare Workers AI section. **Done** — all 8 rewritten; stale-term scan clean (only
  intentional "removed" notes remain); README badges/links preserved.

### 2026-06-17 — Migrate runtime to Node + npm (maintainer request)

- Replaced bun with **Node + npm** throughout: removed `bun.lock`, generated `package-lock.json` (clean
  `npm install`); CI (`pr.yml`, `release-package.yml`) now uses `actions/setup-node` + `npm ci`/`npm run …`
  (no `oven-sh/setup-bun`); converted all `bun …` commands in `README.md`, `docs/setup.md`, `AGENTS.md`,
  and `.github/workflows/claude.yml` to npm. (Only `todo.md` + `CHANGELOG.md` keep historical bun mentions.)
- Test runner: `bun:test` → **vitest** (`npm test` = `vitest run`; added `vitest.config.ts`, `@types/node`;
  removed `@types/bun`; `tsconfig` types `bun-types` → `node`). Added `engines.node >= 22.19.0`.
- Fixed a pre-existing malformed-JSON comma in `claude.yml`'s `mcp_config` and refreshed its stale
  description ("Vercel AI SDK + bun" → flue + Node/npm).
- **CI dogfood model = `openai/gpt-5.1-nano`** (maintainer choice). pi's catalog lists `gpt-5.1` and
  `gpt-5-nano` but not literally `gpt-5.1-nano`; the dogfood step is `continue-on-error`, so it won't block
  CI if the id is rejected (`gpt-5-nano`/`gpt-5.1` are catalog-backed fallbacks).
- **Verified under npm:** `npm run check` ✓, `npm run check:types` ✓, `npm run build` ✓, `npm test` 19/19 ✓.

### 2026-06-17 — Re-add telemetry + `npx shippie` CLI bin (maintainer request)

- **Telemetry (re-added):** `src/common/telemetry.ts` — fire-and-forget anonymous `review_started` POST to
  `https://telemetry.shippie.dev/events` (anonymized repo id = sha256 of owner/repo or workspace, run id,
  platform, model, host info — no code/file contents). Wired into the workflow after the changed-files check.
  Opt-out via `SHIPPIE_TELEMETRY=false` (env), the `TELEMETRY` Action input, or `payload.telemetry: false`;
  on by default. No new deps (`crypto.randomUUID`, global `fetch` with a 3s abort).
- **CLI bin (`npx shippie`):** `bin/shippie.mjs` + `package.json` `bin`. `shippie review` boots the prebuilt
  `dist/server.mjs` on a local port, calls `POST /workflows/review?wait=result` once, prints the JSON result,
  and exits — so it needs only the shipped `dist/` + `@flue/runtime` at runtime (no `@flue/cli`/vite). Local
  mode reviews the **staged** diff; config comes from env (same vars as the Action). `files` now ships `bin`.
- Verified: biome/tsc/tests/build all green; `shippie --help` works; `node bin/shippie.mjs review` runs an
  end-to-end staged review locally (demoed via Cloudflare Workers AI).

### 2026-06-17 — PR #470 opened; CI validated on a real PR; dogfood model fix

- Opened **PR #470** (`feat/flue-migration`) with the full migration. On the real PR, **all checks pass** —
  `build-and-test` (npm: `check` / `check:types` / `build` / `test` 19/19), CodeQL, snyk, PR-title validation.
  This confirms the npm/Node migration works in GitHub Actions.
- **Dogfood model finding:** `openai/gpt-5.1-nano` is **rejected by pi-ai's catalog** ("Unknown model
  specifier") so the self-review step errored (kept green by `continue-on-error`, posted no comment). pi's
  catalog has `gpt-5-nano`, `gpt-5.1`, `gpt-5.4-mini` (no `gpt-5.1-nano`); unknown built-in ids are
  hard-rejected, not passed through. Switched the dogfood to **`openai/gpt-5-nano`** — easy to change.
- **Maintainer decisions resolved** (done above): telemetry re-added (opt-out), `npx shippie` CLI bin added.
- Refreshed `todo.md` for the flue architecture.
- Still needs a human: confirm the dogfood/default model (gpt-5-nano vs other) and that `OPENAI_API_KEY` is
  set as a repo secret so the self-review actually posts; optional `@flue/github` live-review channel.

### 2026-06-17 — Real end-to-end PR review verified ✅ (migration complete)

PR #470's dogfood `review` job (commit `13d90fa`, model `openai/gpt-5-nano`) ran **SUCCESS** (1m40s):
**shippie reviewed its own PR via the GitHub Action and posted a summary comment** ("## General Summary
🏴‍☠️ … Inline review notes (actionable issues found) …"). This confirms the full pipeline works in
GitHub Actions: Action → `flue run review` → git diff → agent (pi tools) → reporter → GitHub comment.

Notes (model quality, not bugs): `gpt-5-nano` put its findings in the summary body rather than calling
`suggest_change` for separate inline comments (0 inline comments this run), and made a minor diff misread
(it treated a trimmed file as deleted). Stronger models (Claude / larger OpenAI) use `suggest_change` and
review more accurately — the integration is solid regardless.

**Status: the flue migration is COMPLETE and verified end-to-end.** Remaining items are maintainer
choices, not blockers: pick the default/dogfood model, optionally add a `@flue/github` live-review channel,
and merge PR #470.

### 2026-06-17 — Live `@shippie` channel + dogfood model `gpt-5.4-nano` (maintainer request)

- **GitHub channel (webhook / server mode):** added `src/channels/github.ts` (`@flue/github`
  `createGitHubChannel`) + `src/agents/mention.ts`. Commenting `@shippie …` on an issue/PR (verified
  webhook) dispatches to the `mention` agent, which fetches the PR diff via Octokit when asked to review and
  replies with a comment. Served at `POST /channels/github/webhook` on the built server; needs
  `GITHUB_WEBHOOK_SECRET` + `GITHUB_TOKEN`. Bots (including itself) are ignored. Added dep `@flue/github`.
  This is the optional second deployment mode alongside the one-shot CI review. Documented in
  `docs/tag-shippie.md` (+ README + `.env.example`).
- **Dogfood self-review model → `openai/gpt-5.4-nano`** (valid in pi's catalog; replaces `gpt-5-nano`).
- Verified: `flue build` discovers agents (`reviewer`, `mention`) + workflow (`review`) + channel (`github`);
  `npm run check` / `check:types` / `build` / `test` (19/19) all green.

### 2026-06-17 — `/shippie` on-demand trigger (Actions, no server) + rename `@` → `/`

- Trigger is now **`/shippie`** (a command), not `@shippie` (which would imply a real GitHub user account).
  Updated the channel (`src/channels/github.ts`), the `mention` agent, and docs.
- Added **Actions-on-comment** mode (no server): `.github/workflows/shippie-mention.yml` runs the action when
  a PR comment contains `/shippie` — resolves PR refs via `gh`, checks out `refs/pull/N/head`, fetches the
  base commit, then runs the review. This is the recommended way to use `/shippie` without hosting; the
  webhook channel remains for deploy-anywhere / real-time / Q&A use.
- `action.yml` gained `PR_NUMBER` / `BASE_SHA` / `HEAD_SHA` inputs (default to the `pull_request` event,
  passed explicitly for comment-triggered runs).
- `docs/tag-shippie.md` rewritten (Actions-first) and README updated.
- Verified: `npm run check` / `check:types` / `build` / `test` (19/19) green.

### 2026-06-17 — CI fix: package-lock.json sync

PR #470 commit `7eb01b7` `build-and-test` failed fast: `npm ci` EUSAGE — `package-lock.json` out of sync
(a stray `@emnapi` transitive entry from the earlier `@flue/github` install). Regenerated with
`npm install` (1 package) → `npm ci` now installs cleanly (429 packages); gate green (types/test 19-19/build).
Pushed as `e7aec8e`. (Note: the repo's default-setup **CodeQL** aggregate check also fast-fails while the
`Analyze (javascript)`/`Analyze (actions)` jobs pass — that's the repo's existing CodeQL setup, unrelated to
this migration.)

### 2026-06-17 — CI fix (npm install), dogfood → gpt-5.5, reporter fallback

- **CI root cause:** `npm ci` failed on Linux CI ("Missing `@emnapi/*` from lock file") even though it passes
  locally on macOS — the lockfile is generated on macOS and omits Linux-only optional deps (a known
  cross-platform npm lockfile quirk, not a stale lock). Switched `pr.yml` + `release-package.yml` from
  `npm ci` to **`npm install`** (what `action.yml` already does, and which works in this CI). Kept
  `package-lock.json` for reproducibility hints.
- **Dogfood self-review → `openai/gpt-5.5` + `thinkingLevel: high`** (was gpt-5.4-nano) for genuinely good
  reviews. The `review` job runs once `build-and-test` passes (it `needs:` it).
- **Acted on the self-review's feedback:** `createReporter` now degrades to local file output (with a
  visible stderr warning) when the github platform has no PR context, instead of throwing.
- Verified locally: `npm run check` / `check:types` / `build` / `test` (19/19) green.

### 2026-06-17 — CI green ✅; gpt-5.5 dogfood caught a real security finding

- **`build-and-test` PASSES on `2a8123c`** with `npm install` — the cross-platform lockfile fix worked.
  (`Analyze (javascript)`/`Analyze (actions)` pass; the repo's default-setup `CodeQL` aggregate check
  still fast-fails, unrelated to this PR.)
- **The `gpt-5.5` dogfood self-review posted 2 inline `suggest_change` comments** — a clear upgrade over the
  nano model — and caught a genuine security issue: `shippie-mention.yml` checked out untrusted PR (fork)
  code in a privileged `issue_comment` context (write perms + secrets), i.e. a "pwn request" risk.
  **Fixed** by gating the job on `author_association` (`OWNER`/`MEMBER`/`COLLABORATOR`) so only trusted
  collaborators can trigger `/shippie`; applied to the workflow, the docs example, and a security note.
  (The review's other inline comment re-flagged the `createReporter` fallback that was already applied.)
- Verified locally: `npm run check` / `check:types` / `build` / `test` (19/19) green.

**Migration status: COMPLETE, CI green, and dogfood-verified end-to-end.**

### 2026-06-18 — CodeQL alert dismissed; all checks green

The last red check was CodeQL alert **#6 `actions/untrusted-checkout-toctou/critical`** on
`shippie-mention.yml` — a genuine "pwn request" pattern (a privileged `issue_comment` workflow checks out
and runs PR-head code with secrets). The `author_association` gate auto-fixed the non-TOCTOU variant
(alert #5) but not the TOCTOU one. **Per maintainer decision, kept the collaborator-gated workflow and
dismissed alert #6** ("won't fix", mitigated by the gate). The `CodeQL` PR check now passes; **all PR #470
checks are green** (build-and-test, review, Analyze ×2, CodeQL, snyk, PR-title). For a stricter posture, the
webhook channel (`@flue/github`, API-based, no checkout) is the safe alternative for live `/shippie`.

### 2026-06-18 — Local-run fix + layered test suite (model + GitHub mocked)

- **Fixed a load-time crash** (caught by running locally per a maintainer request): the GitHub channel
  called `createGitHubChannel({ webhookSecret: '' })` at import, which throws when `GITHUB_WEBHOOK_SECRET`
  is unset — and since flue loads every discovered module, this **crashed `flue run review`** in the normal
  no-secret case (CI's `continue-on-error` dogfood masked it). Now falls back to a placeholder so the module
  loads inertly (verification fails closed). Verified: `flue run review` clean → `reviewed:0`; staged file →
  computes the diff and reaches the model. Pushed as `3489554`.
- **Added a layered test suite (vitest); every test mocks the model + GitHub/network — no real calls:**
  - **Unit:** reporter (octokit mock + temp-dir local output, incl. the `createReporter` fallback),
    suggest-change, `mcp/connect` (`connectMcpServer` mock + graceful failure), telemetry (fetch stub +
    anonymized id), instructions (temp `AGENTS.md`/`CLAUDE.md`), context, channel tools + conversation-key
    roundtrip, agent initializers (reviewer/mention). Plus existing config/diff/filterFiles.
  - **Integration:** `workflows/review` `run()` driven with a fake `init` + mocked diff/reporter/mcp —
    exercises the full orchestration (config → diff → filter → mcp → prompt → summary → result) with no real
    model/git/GitHub.
  - **e2e/smoke:** every discovered module imports without throwing when no secrets are set (the exact
    regression above), the workflow's public surface (`run` + `route`), and the reporter local fallback.
  - **67 tests across 13 files, all green; `tsc` + `biome` clean.** Run with `npm test`.

### 2026-06-22 — `shippie init`/`configure`, snyk cleared, target 0.21.0

- **Scaffold command re-added:** `shippie init` (preferred) writes `.github/workflows/shippie.yml`;
  `shippie configure` is a **deprecated alias** that warns it will be removed in the next major version.
  `--force` overwrites an existing file. Implemented in `bin/shippie.mjs`; README updated.
- **snyk cleared:** `npm audit fix` (8→3) plus `overrides` for `hono`@^4.12.26 and `esbuild`@^0.28.1
  (both transitive flue deps; patch-level bumps within flue's ranges). `npm audit` → **0 vulnerabilities**;
  `build` / `test` (73) / `flue run review` smoke all green.
- **Release target: 0.21.0 (not a major).** Despite the breaking `feat!`, this ships as a minor on 0.x via
  a `Release-As: 0.21.0` commit footer (release-please would otherwise propose 1.0.0).

### 2026-06-22 — Follow-up PR: lean package, Changesets + secure publish, review fixes

Shipped as a follow-up PR (branch `fix/package-files`) on top of merged 0.21.0:

- **Trimmed the published artifact:** `files` → `["dist", "bin"]` (was shipping all of `src/` incl. tests).
  Tarball: **6 files** (down from 38). Verified by clean-installing the tarball and running `shippie review`
  — flue resolves at runtime because `@flue/runtime` is a `dependency` and `dist/server.mjs` externalizes
  it (it is NOT bundled, but IS installed via deps), so removing `src` is safe.
- **Release tooling → Changesets** with the most-secure npm publish: `.github/workflows/release.yml`
  (`changesets/action`, **npm provenance** via `NPM_CONFIG_PROVENANCE` + `id-token: write`, **OIDC trusted
  publishing** preferred — no long-lived token; `NPM_TOKEN` fallback commented), `.changeset/config.json`
  (`@changesets/changelog-github`), an initial patch changeset. Removed `release-package.yml` (release-please).
  Maintainer step: enable the Trusted Publisher for `release.yml` on npmjs.com (else uncomment `NPM_TOKEN`).
- **Triaged all #470 review comments** (workflow audit): 7 already-fixed; fixed 4 more real ones —
  (1) `channels/github.ts` webhook-secret fallback is now an unguessable per-process random (fails closed),
  (2) `diff.ts` uses a three-dot `base...head` range (GitHub PR semantics), (3) `docs/setup.md` `@v1`→`@v0`,
  (4) `action.yml` install uses `--include=dev` so `@flue/cli` is present for `npx flue` even under
  `NODE_ENV=production`. The untrusted-checkout (`uses: ./`) finding is the CodeQL risk previously **accepted/
  dismissed**, so it's intentionally left as-is.
- 73 tests green; tsc + biome clean.

### Remaining work (next iterations)

- **Docs + README:** rewrite `docs/*.md` (setup, mcp, ai-provider-config, action-options, rules-files,
  subagent-tool, custom-instructions) and `README.md` for the flue model; document MCP-via-Action-config
  and the remote-only limitation.
- **CI:** `.github/workflows/pr.yml` (and `release-package.yml`) still run the old `bun run build`/tests —
  update to `flue build` + the new test set. Decide the publish flow (ship `src` for `flue run --root`,
  or pre-`flue build`; add a `package-lock.json` so the action can `npm ci` reproducibly).
- **`.env.example`:** update to `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GITHUB_TOKEN`.
- **Tests:** add flue-aware tests for `diff.ts` (parsing) and `config.ts` (env/payload resolution); a
  `model: false` workflow smoke test. Re-create scenario coverage if desired.
- **Full e2e (BLOCKED on a model API key):** run a real review on a sample PR to confirm inline
  `suggest_change` comments + summary posting via Octokit.
- **Decisions for the maintainer:** (1) telemetry was removed — re-add as a flue tool, or drop for good?
  (2) keep a thin `shippie` CLI bin, or is `flue run` the only entry? (3) optional second deployment mode:
  a `@flue/github` **channel** for live `@shippie review` comments (webhook server) alongside the one-shot
  CI workflow.

### 2026-06-17 — Cleanup (maintainer request)

- Removed `src/ui/web/` (an unrelated Vite app that had committed `node_modules`) and `.cursor/` (cursor
  rules), per maintainer request. `src/` is now exactly the 15 flue source files. Re-verified: `flue run
  review` green, `tsc --noEmit` clean, `bun test src/review` 5/5 pass.

### 2026-06-17 — Self-built package + Cloudflare Workers AI (maintainer request)

**Self-built, locally-runnable package:**
- `flue build --target node` → `dist/server.mjs` (single artifact). Added `export const route` to
  `src/workflows/review.ts` so the built server exposes `POST /workflows/review` (`?wait=result`).
- `package.json`: `main` → `./dist/server.mjs`; scripts `start` (`node dist/server.mjs`),
  `prepublishOnly` (`flue build`); `files` now includes `dist` (+ `src`, `flue.config.ts`, `action.yml`).
- **Verified:** `flue build` succeeds; `node dist/server.mjs` boots and serves the review workflow over
  HTTP. So shippie publishes as a self-built package and runs locally after build (server), in addition
  to one-shot `flue run review`.

**Cloudflare Workers AI provider (Node-compatible):**
- Provider id `cloudflare-workers-ai/<model>` (URL-backed via the Cloudflare API; catalog-backed in
  pi-ai, so **no `registerProvider` needed**). Credentials read from env by flue's model layer:
  `CLOUDFLARE_API_KEY` (bearer token) + `CLOUDFLARE_ACCOUNT_ID`. AI Gateway variant
  `cloudflare-ai-gateway/<model>` also takes `CLOUDFLARE_GATEWAY_ID`.
- Wired passthrough into `action.yml` (new inputs `CLOUDFLARE_API_KEY`/`CLOUDFLARE_ACCOUNT_ID`/
  `CLOUDFLARE_GATEWAY_ID`) and documented in `.env.example`. No `config.ts` change needed.
- **Tested locally with the maintainer's `wrangler login` OAuth token** (scope includes `ai (write)`;
  account `543fbdef…`): direct Workers AI calls return 200. The OAuth token works as `CLOUDFLARE_API_KEY`.
- **Model capability finding:** `@cf/meta/llama-3.3-70b-instruct-fp8-fast` is a poor agent — it emits
  tool calls as plain *text* and loops. `@cf/openai/gpt-oss-120b`, `@cf/qwen/qwen3-30b-a3b-fp8`, and
  `@cf/zai-org/glm-5.2` emit **proper structured `tool_calls`**. Recommended Cloudflare model:
  **`cloudflare-workers-ai/@cf/openai/gpt-oss-120b`**.
- **Compatibility fix (benefits all providers):** the review workflow no longer requires a structured
  `result` schema. Workers AI's OpenAI-compat endpoint returns `400` for `response_format: json_schema`
  (seen with gpt-oss after a successful `suggest_change`). The workflow now uses the agent's **final
  message** (`response.text`) as the PR summary; instructions updated to end with a summary message.
- **e2e via gpt-oss-120b:** confirmed working — after the structured-result fix the workflow completes
  with `exit 0`, posts the PR summary, and the agent posted a real inline `suggest_change` comment
  (hardcoded secret + `a - b` logic bug) in one run. gpt-oss-120b is variable run-to-run (an open
  mid-size model — one run skipped the inline comment and returned an empty final message, handled by a
  fallback summary); review depth is model-dependent, so Claude/OpenAI remain the highest-quality
  default while Cloudflare Workers AI is a fully working option. Integration — auth (OAuth token),
  provider resolution, agent loop, tool calls, reporter — is solid.
