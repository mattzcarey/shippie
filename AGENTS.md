# Repository Guidelines

Shippie is a **prebuilt code-review agent built on [flue](https://github.com/withastro/flue)**
(which runs the agent loop on "pi"). It ships as a flue project and as a GitHub Action, and runs
anywhere flue deploys (Node, Cloudflare, GitHub Actions, GitLab CI).

## Project Structure

- `flue.config.ts` — `defineConfig({ target: 'node' })`.
- `src/agents/reviewer.ts` — the review agent (`createAgent`): model, `local()` sandbox, instructions, and the `suggest_change` tool.
- `src/workflows/review.ts` — the one-shot review workflow (`run({ init, payload, env })`); also exports `route` so the built server can serve `POST /workflows/review`.
- `src/tools/suggest-change.ts` — `defineTool` for inline review comments.
- `src/review/` — `config.ts` (resolve config from payload/env), `diff.ts` (git diff + parsing), `instructions.ts` (review prompt + AGENTS.md/CLAUDE.md injection), `context.ts` (prompt builder), `constants.ts`, `prompt/fileInfo.ts`, `utils/filterFiles.ts`.
- `tests/` — vitest specs (`*.test.ts`), mirroring the `src/` layout (kept out of `src/` so the package code stays clean).
- `src/github/reporter.ts` — posts inline comments + summary to GitHub (Octokit) or to a local file.
- `src/mcp/connect.ts` — connects remote MCP servers from config.
- `src/common/` — shared `types.ts` and `formatting/summary.ts`.
- `action.yml` — composite GitHub Action. `docs/` — user docs (`docs/flue-migration.md` is the refactor log).

## Build, Test, and Development Commands

- Install: `npm install` (Node >= 22.19 required).
- Lint + format: `npm run check` (oxlint + oxfmt). Auto-fix: `npm run check:fix`.
- Type-check: `npm run check:types` (`tsc --noEmit`).
- Build: `npm run build` (`flue build --target node` → `dist/server.mjs`).
- Run a review locally: `npm run review` (`flue run review --target node`); reviews **staged** changes and writes to `.shippie/review/`. Pass `--payload '{"platform":"local"}'` explicitly if needed.
- Run the built server: `npm start` (`node dist/server.mjs`), then `POST /workflows/review?wait=result`.
- Tests: `npm test` (vitest).

## Coding Style

- oxfmt: two-space indent, single quotes, trailing commas (ES5), semicolons as-needed. Line width 90. Linting via oxlint (`correctness`).
- TypeScript strict; resolve `noUnused*` rather than suppressing. ESM (`"type": "module"`).
- Tools use **valibot** schemas (`v.object(...)`); the agent loop and model providers come from `@flue/runtime`.

## Models & MCP

- Model is a `provider/model` string (e.g. `anthropic/claude-sonnet-4-6`, `openai/gpt-4.1-mini`, `cloudflare-workers-ai/@cf/openai/gpt-oss-120b`). Provider keys are standard env vars (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID`).
- MCP servers are configured via the Action input `MCP_SERVERS` / env `SHIPPIE_MCP_SERVERS` (remote HTTP/SSE only) — **not** a checked-in `.mcp.json`.
- Project context: the reviewer reads root `AGENTS.md` / `CLAUDE.md` and flue auto-discovers skills in `.agents/skills/`.

## Commit and Pull Request Guidelines

- Conventional Commits (`feat:`, `fix:`, `chore:`); PR titles are enforced by `.github/workflows/check-pr-title.yml`.
- Before pushing: `npm run check`, `npm run check:types`, `npm run build`, `npm test`.
- Versioning is handled by release-please; do not bump versions manually.

## Safety

- Keep diffs minimal and scoped; do not commit secrets or `dist/`.
- Ask before adding dependencies or editing CI workflows.
