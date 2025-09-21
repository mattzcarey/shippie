# Repository Guidelines

## Dos and Don’ts

- Do install Bun 1.x locally and run `bun i` before executing scripts; do not mix package managers without prior agreement.
- Do run `bun run check`, `bun run check:types`, and targeted tests before pushing; do not commit `dist/` or other generated artifacts.
- Do keep diffs minimal and follow the existing two-space indentation, single quotes, and Biome formatting; do not reformat unrelated files or bypass Biome.
- Do update entries in `docs/` and `templates/` whenever CLI flags or defaults change; do not alter workflow inputs or secrets without mirroring updates in `.github/workflows/`.
- Do review `todo.md` and existing rules documentation before adding new guidance; do not remove rule files or MCP configs without a replacement plan.

## Project Structure and Module Organization

- Shippie is a TypeScript + Bun CLI and GitHub Action that performs automated code reviews using LLMs.
- The CLI entrypoint is `src/index.ts`; `src/review` contains agent logic and prompts, `src/configure` handles project setup, and `src/common` holds shared platform, API, and utility code.
- Evaluation scenarios and supporting harnesses live under `src/specs`; keep new tests aligned with this layout.
- Documentation stays in `docs/`; `todo.md` tracks open work, while `templates/` supplies CI YAML that `tsup.config.ts` copies into `dist/` during builds.
- GitHub automation is defined in `.github/workflows/`; the published composite action is configured through `action.yml` in the repository root.

## Build, Test, and Development Commands

- Install dependencies with Bun: `bun i` (run from the repository root before other scripts).
- Lint with Biome via `bun run check`; apply automatic fixes using `bun run check:fix` if needed (`biome.json` is the source of truth).
- Type-check with `bun run check:types`, which references `tsconfig.json`.
- Build distributables using `bun run build`; this runs `tsup` and copies workflow templates into `dist/`.
- Run unit suites with `bun test:unit` or scope to a single file, e.g. `bun test src/review/utils/specs/filterFiles.test.ts`.
- Execute end-to-end scenarios with `bun test:e2e` once `OPENAI_API_KEY`, `BASE_SHA`, and `GITHUB_SHA` are exported (matches `.github/workflows/pr.yml`).
- Drive the configure flow with `bun run configure --platform=github` when updating templates or onboarding repos.
- Exercise the review flow locally with `bun run review --platform=local --debug`; provide the same environment variables as CI when inspecting real diffs.

## Coding Style and Naming Conventions

- Respect the Biome settings: two-space indentation, single quotes, trailing commas (ES5), and semicolons only when required.
- TypeScript is compiled with strict options; resolve `noUnused*`, `noFallthroughCasesInSwitch`, and related warnings instead of suppressing them (`tsconfig.json`).
- Allow Biome to order and deduplicate imports (`organizeImports.enabled: true`); avoid manual sorting that fights the formatter.
- Use lower-case or kebab-case directory and file names consistent with existing modules (e.g. `src/review/utils`).
- Prefer concise `//` comments for non-obvious logic; use the shared `logger` from `src/common/utils/logger.ts` for runtime diagnostics.
- Tests rely on `bun:test`; colocate new specs under `specs/` folders that mirror the source module you are exercising.

## Testing Guidelines

- Add or update unit tests in `src/**/specs/` whenever behavior changes; match the existing `*.test.ts` naming.
- Re-run individual files with `bun test path/to/file.test.ts` to focus on just the specs you are editing.
- Ensure `bun test:unit` passes before opening a PR; it covers review, configure, and shared modules.
- Treat `bun test:e2e` as optional unless credentials are available; it calls live models via `ScenarioRunner` and needs the same environment as CI.
- When expanding scenarios in `src/specs/scenarios/`, update the registry and expectations so automated checks remain meaningful.

## Commit and Pull Request Guidelines

- Follow Conventional Commits (`feat:`, `fix:`, `chore:`); `.github/workflows/check-pr-title.yml` enforces compliant PR titles.
- Keep commits narrow and reference related issues or discussions in the body when context helps reviewers.
- Match the CI sequence before pushing: `bun run check`, `bun run check:types`, `bun run build`, and the relevant `bun test` targets from `.github/workflows/pr.yml`.
- Capture CLI output changes with screenshots or logs when they affect users or documentation in `docs/` and `templates/`.
- Leave versioning to release-please (`CHANGELOG.md` and npm publishing); do not bump versions manually.

## Safety and Permissions

- Ask before adding dependencies, renaming files, or editing CI workflows; keep each change tightly scoped to the problem.
- Safe actions: read or list files, run file-scoped linting or tests, and craft minimal patches focused on the affected module.
- Avoid mass formatting, renaming, or reorganizing files; Biome should only touch lines you modify intentionally.
- Never commit secrets or telemetry tokens; load them via `.env` locally and repository secrets in CI as defined in `action.yml`.
- When uncertain about impact, propose a brief plan and wait for confirmation instead of guessing.

## Security and Configuration Tips

- Copy `.env.example` to `.env` for local work and populate keys such as `OPENAI_API_KEY`; keep credentials out of version control.
- Manage MCP servers via `.shippie/mcp.json` or `.cursor/mcp.json`; ensure any referenced commands or URLs are reachable before enabling them.
- When updating workflow templates in `templates/`, verify the generated `dist/*.yml` matches the published action expectations and adjust documentation in `docs/` accordingly.
