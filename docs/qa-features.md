# Shippie QA — Feature Overview

The authoritative answer to *"what can the Shippie QA agent do, and how does it work?"*

---

## 1. What it is

**Shippie QA is an autonomous, ambient end-to-end QA agent.** It is a prebuilt [flue](https://github.com/earendil-works/flue) agent (running on the `@earendil-works/pi-ai` provider) that explores a running product, catalogs its real user flows, fans out a fleet of subagents to QA each flow in parallel, and writes **dependency-free e2e tests that run with just `node`** (no Playwright, no install step). When it finds a broken flow it attempts a minimal source fix plus a failing→passing regression test, and it opens **tiered pull requests** for the coverage it added and the bugs it fixed. It runs three ways from one codebase: as a **scheduled + on-demand GitHub Action** (`mattzcarey/shippie/qa@v0`), **locally** via `shippie qa`, or as a **Docker monolith** image. It QAs two target kinds — **web** products (drives headless Chrome over the Chrome DevTools Protocol) and **CLI/terminal** products (drives the target's CLI via bash).

---

## 2. Agent architecture

### The lead + its subagents

The run is a single flue agent — the **QA lead** (`src/agents/qa-lead.ts`, depth 0) — that fans out to three subagent **profiles** (all depth-1 siblings). The lead carries the judgment (model `anthropic/claude-opus-4-8`, `thinkingLevel: 'high'`); the per-flow drivers are cheap "hands".

| Agent | File | Model | Thinking | Role |
|-------|------|-------|----------|------|
| **qa-lead** | `src/agents/qa-lead.ts` | `anthropic/claude-opus-4-8` | high | Explores, catalogs flows, fans out, classifies findings, opens PRs. Owns the lead-only tools. |
| **browser-driver** | `src/qa/browser-driver.ts` | `anthropic/claude-sonnet-4-6` | medium | (web kind) Drives ONE flow in its own headless Chrome over CDP, writes + self-verifies a `.cdp.mjs` test, returns a JSON verdict. |
| **cli-driver** | `src/qa/cli-driver.ts` | `anthropic/claude-sonnet-4-6` | medium | (cli kind) Runs ONE CLI scenario via bash, writes + self-verifies a `.cli.mjs` test, returns a JSON verdict. |
| **healer** | `src/qa/healer.ts` | `anthropic/claude-opus-4-8` | high | Repairs ONE broken flow — minimal source fix + a failing→passing regression test, verified green. The headline capability, so it gets the strongest model. |

> **Why the subagent profiles live in `src/qa/` and not `src/agents/`:** flue auto-discovers every `src/agents/*.ts` as a top-level agent that must default-export `createAgent()`. A subagent profile is not that — it is built with `defineAgentProfile` and passed to the lead's `subagents: [...]`. Putting these in `src/agents/` would crash the flue server at boot.

All three drivers/healer are *always declared* on the lead's `subagents`; which one the lead delegates to is chosen by `cfg.kind` in the kind-branched instructions and kickoff prompt. Subagents do **not** inherit the lead's instructions or custom tools — each carries its own full rubric, and each is given **only** the `run_spec` tool (plus the always-present built-ins: `bash`/`read`/`write`/`edit`/`grep`/`glob`). `catalog_flows`, `classify_finding`, and `open_pull_request` stay **lead-only**.

### The loop

```
explore  →  catalog flows  →  fan out drivers (parallel)  →  run_spec (self-verify green)
   →  heal broken flows  →  classify every finding  →  open tiered PR(s)  →  finish (JSON)
```

1. **EXPLORE** — read README/AGENTS.md/routes/package.json; activate the `chrome-cdp` skill (web) or run the CLI via `bash` (cli) to confirm the target is reachable and learn resilient selectors / real output before delegating.
2. **CATALOG** — call `catalog_flows`, which writes the backlog to `e2e/specs/<slug>.md` (one human-readable doc per flow: slug, title, priority, steps, expected outcomes). This is both the work backlog and a review artifact.
3. **FAN OUT** — for each catalogued flow, emit a `task` call to the right driver. **Parallelism with a throttle:** multiple `task` calls in a single turn run in parallel, capped at **≤3 per turn** to bound Chrome memory; more than 3 flows run in successive batches. Each driver works alone, launches its own browser/runs the CLI, writes `e2e/tests/<slug>.{cdp,cli}.mjs`, verifies it green with `run_spec`, and returns a JSON verdict.
4. **COLLECT** — the lead reads every verdict (`pass` / `broken` / `flaky`). It may re-run a suspect spec itself with `run_spec`. A flow counts as covered only if its driver returned `pass`.
5. **HEAL** — for each `broken` flow (same ≤3/turn throttle), the lead delegates to a `healer`, which root-causes in the repo (white-box to fix, black-box to test), makes the smallest correct source change, writes/repairs the regression test failing→passing, and verifies it green. If it genuinely cannot fix the app, it leaves the source untouched, writes a repro spec that captures the broken state, and returns a precise "needs human" diagnosis.
6. **CLASSIFY** — call `classify_finding` for *every* finding to get its accepted tier (the mechanical PR bar; see §4).
7. **OPEN PRs** — `open_pull_request` once per accepted finding: a missing-coverage PR for the green specs, a broken-flow PR per healed flow, and a refactor-hint PR only when the classifier accepts it.
8. **FINISH** — the lead ends its turn with a single JSON result object (`flowsCatalogued`, `results`, `passed`, `broken`, `healed`, `prUrl`, `prUrls`, `summary`).

### The flue task-tool fan-out

Fan-out uses flue's built-in `task` tool: `agent: "browser-driver" | "cli-driver" | "healer"` plus a `prompt` that gives the subagent everything it needs to work alone (the flow slug, a unique `FLOW_INDEX`, the full spec pasted inline, and the base URL / build+run command). The lead deliberately **omits `cwd`** on `task` calls so each child inherits `cfg.workspace` — which is where `.agents/skills/chrome-cdp` and `e2e/cdp-client.mjs` (or `e2e/cli-client.mjs`) were materialized — so the chrome-cdp skill auto-discovers and the test's `../cdp-client.mjs` import resolves.

### The `local()` sandbox

The lead runs in flue's `local()` sandbox (`@flue/runtime/node`) rooted at `cfg.workspace`: host filesystem + real `bash` (on macOS/Linux; on Windows flue's bash is cmd.exe, which the chrome-cdp skill cannot use — the agent reports the limitation instead). `local()` env is an **allowlist snapshot**, so the lead explicitly passes:

- `CHROME_BIN` — so the agent's bash can launch the right browser,
- `CDP_IGNORE_CERT_ERRORS=1` — so the agent and the tests can load external HTTPS behind TLS-inspecting proxies / self-signed certs,
- `CI=1`.

### Compaction & durability

- **Compaction:** `{ keepRecentTokens: 6000 }` on the lead — screenshots are heavy in context, so old turns are compacted aggressively.
- **Durability:** `{ timeoutMs: 75 * 60_000 }` (75 min) — deliberately sized below the GitHub Actions hosted-runner ceiling (6h) and the author job's 90-min `timeout-minutes`. Subagent profiles reject `durability`, so it lives only on the lead.

---

## 3. The two target kinds

The kind (`QaKind` in `src/qa/config.ts`) is `'web'` by default; `'cli'` only when explicitly requested (payload `kind` or `SHIPPIE_QA_KIND=cli`). The heal/classify/tiered-PR structure is identical for both — only the driver, the developer tool, and the committed test shape differ.

### `web` — headless Chrome over CDP (default)

The agent's **interactive tool** is the vendored `chrome-cdp` skill (`src/skills/chrome-cdp/`), materialized into `<workspace>/.agents/skills/chrome-cdp/` at run start so flue auto-discovers it. It is a dependency-free CLI (Node 22+ built-in WebSocket — no MCP, no Puppeteer/Playwright):

```
node .agents/skills/chrome-cdp/scripts/cdp.mjs --port $PORT <command> <target>
```

`bash .agents/skills/chrome-cdp/scripts/launch-chrome.sh "$PORT"` launches headless Chrome detached (setsid on Linux, nohup+disown on macOS) so it survives across bash calls; `cdp.mjs` runs as a per-port daemon (each `node cdp.mjs <cmd>` is a fresh client process talking to the backgrounded Chrome over a unix socket). Commands include `list / snap (accessibility tree) / nav / fill / click / clickxy / type / press / eval / html / net / shot / evalraw / stop`. `snap` is the recommended way to learn resilient role/name/label selectors. Parallel drivers use a unique port per flow (`9222 + FLOW_INDEX`).

**Committed tests** are node scripts at `e2e/tests/<slug>.cdp.mjs` importing `../cdp-client.mjs` (`src/skills/chrome-cdp/scripts/cdp-client.mjs`, materialized to `e2e/cdp-client.mjs`). The `cdp-client` is a dependency-free driver — `open()` launches its **own** headless Chrome (so the test self-launches; you never launch Chrome inside a test) and returns a driver with:

`open / goto / url / title / text / html / eval / fill / type / click / clickAt / press / waitFor / waitForText / snapshot / shot / close`

Notable cdp-client behaviors:

- **Screencast → mp4:** records a screencast by default and `close()` assembles `session.mp4` via ffmpeg (degrades to leaving frames if ffmpeg is absent). `close()` also tears down Chrome.
- **Viewports:** `open({ viewport })` or `$E2E_VIEWPORT` accepts `"1280x900"`, `"375x812@2"` (with deviceScaleFactor), or a preset — `mobile` (390×844@3), `tablet` (820×1180@2), `desktop` (1280×900@1) — applied via `Emulation.setDeviceMetricsOverride`. The per-run browser size is the one thing that changes per web target, with no test edit.
- **External HTTPS cert tolerance:** cert-tolerant for external HTTPS (`CDP_IGNORE_CERT_ERRORS`), so it loads sites behind corporate TLS-inspecting proxies / self-signed certs.
- **Black-box discipline (enforced by the rubric):** drive only public surfaces (URL/UI/HTTP); never import app internals; relative `goto` paths so the same test runs against any `E2E_BASE_URL`; assert on user-visible values; wait on conditions (`waitFor`/`waitForText`), never sleep; one journey per test; match rendered (CSS-transformed) text case-insensitively or assert on stable attributes.

#### Session capture v0 (the web authoring path)

The intended authoring flow for web tests is **record-while-driving → gen-test → faithful test**. When `$CDP_RECORD=<path>` is set, `cdp.mjs` appends one JSON line per *successful* mutating/navigating command to a JSONL log (recordable ops: `nav`, `fill`, `click`, `type`, `press`, `clickxy` — written under their `cdp-client` method names, e.g. `clickxy → clickAt`, `nav → nav`). Recording is best-effort and never throws, so a log-write failure cannot break the live drive. A companion `gen-test.mjs` turns that log into a faithful `e2e/tests/<slug>.cdp.mjs`. (The record half is built in the vendored `cdp.mjs`; `gen-test.mjs` is the in-progress other half — see §8.)

### `cli` — terminal / CLI

There is **no browser, no chrome-cdp skill, no cdp-client** here: the agent's developer tool is the built-in `bash`. The driver builds the target if needed (`cargo build --release`, `npm run build`, `go build`, `make`) and runs the CLI directly to learn its real behavior (help text, output format, exit codes, stderr-on-error).

**Committed tests** are node scripts at `e2e/tests/<slug>.cli.mjs` importing `../cli-client.mjs` (`src/qa/cli-client.mjs`, materialized to `e2e/cli-client.mjs`). The `cli-client` is dependency-free (node:child_process only) and exports:

- **`run(command, args?, opts?)`** — spawns NO shell (argv verbatim, no injection surprises). Never rejects on a nonzero exit (the exit code is the assertion target); rejects only on ENOENT (cannot spawn) or timeout. Resolves `{ stdout, stderr, code, signal, timedOut }`. `opts`: `{ cwd, env, input, timeoutMs }` — `cwd` defaults to `$E2E_CWD` (the target checkout) then `process.cwd()`; default timeout 60s; output capped at ~16 MiB/stream.
- **`runShell(commandString, opts?)`** — `sh -c <commandString>` for pipes/globs/`&&`; use only when the scenario genuinely needs shell features.

The CLI rubric mirrors the web one: drive only the public CLI surface (command, args, stdin, exit code, stdout/stderr); never import target internals; resolve paths relative to `E2E_CWD`; assert on exit code (`r.code`) and stdout/stderr matched case-insensitively or with stable substrings; one scenario per test; the test source IS the review artifact.

> Both kinds run with **just `node`** and no install — the verify job globs `e2e/tests/*.mjs` (both `.cdp.mjs` and `.cli.mjs`).

---

## 4. PR tiers (`decideTier`)

The PR bar is **mechanical, not vibes** — `decideTier` in `src/qa/pr-policy.ts`, exposed to the lead as the `classify_finding` tool. Every finding must be classified before a PR is opened, and a PR is opened only for an *accepted* finding.

| Tier | Bar | What ships | Branch / dedupe |
|------|-----|-----------|-----------------|
| **broken-flow** | **Always accepted** | The healer's source fix **together with** the failing→passing regression test + the flow's spec doc. For `fixed:false`, a repro spec + a clear "needs human" callout. | Stable per-flow branch `shippie-qa/fix/<slug>` (NOT week-stamped, so a bug accumulates onto ONE healing PR until merged). Deduped by `flowSlug`: a `[flow:<slug>]` title marker + an open-PR title search means re-running never opens a 2nd PR for the same broken flow — it updates the existing one. |
| **missing-coverage** | **LOW bar** — any new green spec is accepted | All green test files for passing flows + their `e2e/specs/<slug>.md` docs. | Iso-week branch `shippie-qa/<year>-W<week>` (e.g. `shippie-qa/2026-W26`). Weekly re-runs accumulate onto the same week's PR; successive weeks make distinct reviewable PRs. |
| **refactor-hint** | **VERY HIGH bar** — rejected unless `pressingNeed: true` **AND** severity is `blocker`/`high` | Only opened if `classify_finding` accepted it (refactor PRs go stale fast, so it is off by default). | Iso-week branch. |

PRs are committed via the Octokit git database API (blob → tree → commit → ref) — **no local git credentials** needed, and an identical (content-addressed) tree is detected as an **empty diff and skipped**. Any committed test auto-includes its dependency-free driver as a sibling (`.cdp.mjs → e2e/cdp-client.mjs`, `.cli.mjs → e2e/cli-client.mjs`) so the suite runs standalone in the verify job. The `open_pull_request` tool also persists its result to `.shippie/qa/last-pr.json` so the Action's output seam (`branch`/`changed`/`pr_url`) reads it back robustly rather than parsing stdout.

---

## 5. How to run it

### Locally — `shippie qa`

`bin/shippie.mjs qa` boots the bundled flue server (`dist/server.mjs`) on a random local port, POSTs `POST /workflows/qa?wait=result` once with `{ platform: 'local', workspace: cwd }`, prints the JSON result, and exits. Config comes from the environment (see §6). For a web target set `SHIPPIE_QA_TARGET`; for a CLI/lib target set `SHIPPIE_QA_KIND=cli`. (A `local` run has no GitHub target, so it does not open PRs — `openOrUpdatePr` returns `"no github target (local run)"`.)

```bash
# web target
export ANTHROPIC_API_KEY=...
SHIPPIE_QA_TARGET=http://localhost:5173 shippie qa

# CLI/lib target
SHIPPIE_QA_KIND=cli shippie qa
```

### The GitHub Action — `mattzcarey/shippie/qa@v0`

The composite action `qa/action.yml` runs on Node 22, installs Shippie (`--include=dev` so `@flue/cli` is present), re-applies the pi-ai patch and **asserts it took** (fails loudly on version drift), then runs `npx flue run qa --root "$ROOT" --target node --payload '{"platform":"github","workspace":"$GITHUB_WORKSPACE"}'`. It exposes outputs `branch` / `changed` / `pr_url` / `base_url` read back from `.shippie/qa/last-pr.json`.

`shippie qa init` scaffolds `.github/workflows/shippie-qa.yml` (+ an `e2e/.gitignore` ignoring `.artifacts/`). The scaffolded workflow has two jobs:

- **author** (ubuntu, 90-min timeout, holds the model key) — runs the agent and opens the PR.
- **verify** (no agent, no key) — checks out the PR branch and re-runs the committed tests with plain `node` + system Chrome + ffmpeg, uploading `e2e/.artifacts/` (screenshots, `session.mp4`). The PR's own checks prove the suite green.

It runs **weekly** (`cron: "0 6 * * 1"`, Mondays 06:00 UTC) and **on demand** (`workflow_dispatch` with `target` / `scope` / `model` inputs). Add `--cross-os` to scaffold a 3-OS verify matrix (ubuntu + windows + macos), installing Chrome + ffmpeg per-OS and uploading per-OS artifacts.

```bash
shippie qa init                 # weekly + on-demand QA workflow
shippie qa init --cross-os      # + verify on ubuntu + windows + macos
gh workflow run shippie-qa.yml -f target=https://your-app.example.com
```

### Cross-repo fan-out — `shippie qa fanout-init`

For QAing many repos you own from one control repo. `shippie qa fanout-init [owner/repoA,owner/repoB ...]` scaffolds `.github/workflows/shippie-qa-fanout.yml` into the *control* repo. On a schedule + on demand it dispatches **each target repo's own `shippie-qa.yml`** — it never pushes or opens PRs in the targets; each target runs under its **own `GITHUB_TOKEN`**.

The cross-repo credential is a **GitHub App installation token** (`actions/create-github-app-token@v1`), minted per-shard scoped to a single repo with **`actions:write` only** — all that "create a workflow dispatch event" needs. (The default repo-scoped `GITHUB_TOKEN` cannot dispatch other repos.) Setup: create a GitHub App with Repository → Actions: Read and write, install it on every target, and store its App ID as the `QA_APP_ID` repo variable + private key as the `QA_APP_PRIVATE_KEY` secret in the control repo. Each target needs its own `shippie-qa.yml`, its model key, and "Allow GitHub Actions to create and approve pull requests".

There is also a **reusable workflow**, `.github/workflows/qa-reusable.yml` (`workflow_call`), so a target can run QA as a thin caller (`uses: mattzcarey/shippie/.github/workflows/qa-reusable.yml@v0`) and pick up central version bumps via the `@v0` tag. (The reusable workflow runs the ubuntu-only verify leg; for cross-OS verification keep the inlined workflow.)

### The Docker monolith

One image — `node:22-bookworm-slim` + Chromium + flue + the agent + the `src/skills` source that `materializeSkill()` copies at run start — is identical locally and in CI (`Dockerfile` at the repo root). `tini` is PID 1 to reap Chrome zombies. The entrypoint does **not** launch Chrome (the agent's bash launches Chrome per-flow on its own port; a single image-launched Chrome on 9222 would collide with the fan-out). `--no-sandbox --disable-dev-shm-usage` are mandatory in-container (root + small `/dev/shm`), or run `--shm-size=1g`. `docker run --rm -e ANTHROPIC_API_KEY -e GITHUB_TOKEN shippie-qa <args>` locally equals the CI step byte-for-byte. (GitHub Actions `jobs.<id>.container` is Linux-only, so the Linux author leg can run inside the image while Windows/macOS verify legs run on bare runners.)

---

## 6. Configuration knobs

Resolved by `resolveQaConfig` (`src/qa/config.ts`) from the workflow **payload** and the **environment** (payload wins). It reuses `resolveReviewConfig` for the shared fields (platform/workspace/telemetry/mcp), then resolves the GitHub target **without a PR number** (QA opens PRs; it does not review an existing one).

| Knob | Payload field | Env var(s) | Default |
|------|---------------|-----------|---------|
| Model | `model` | `SHIPPIE_QA_MODEL` → `SHIPPIE_MODEL` | `anthropic/claude-opus-4-8` |
| Thinking level | `thinkingLevel` | `SHIPPIE_QA_THINKING_LEVEL` | `high` |
| Target kind | `kind` | `SHIPPIE_QA_KIND` (`cli` to switch) | `web` |
| Target under test | `target` | `SHIPPIE_QA_TARGET` | none (web: boot a dev server; cli: detect/build) |
| Scope / focus | `scope` | `SHIPPIE_QA_SCOPE` | none |
| PR branch override | `branch` | `SHIPPIE_QA_BRANCH` | iso-week (or per-flow for broken-flow) |
| Viewport (web) | `viewport` | `SHIPPIE_QA_VIEWPORT` | client default (1280×900) |
| Chrome binary | `chromeBin` | `CHROME_BIN` | OS default (`/Applications/Google Chrome.app/...` on macOS, `google-chrome` on Linux, `chrome` on Windows) |
| Workspace | `workspace` | `GITHUB_WORKSPACE` → cwd | cwd |
| Telemetry | `telemetry` | `SHIPPIE_TELEMETRY` | `true` (set false to opt out) |
| MCP servers | `mcpServers` | — | none |
| Platform | `platform` | (auto: `github` in Actions, else `local`) | `local` |

**Target = empty:** web → the agent detects how to boot the app (e.g. a `dev` script), starts it in the background, polls the port, and uses that local URL. cli → the agent detects how to build + invoke the CLI (README, `bin`, `Cargo.toml`, Makefile).

**Viewport** accepts `"1280x900"`, `"375x812@2"`, or `mobile|tablet|desktop` → `E2E_VIEWPORT` for the specs.

**External HTTPS:** `CDP_IGNORE_CERT_ERRORS=1` is set for both the agent's interactive browser and the `run_spec` test runs, so external HTTPS behind TLS-inspecting proxies / self-signed certs loads.

**Retry tuning:** `PI_AI_RETRY_ATTEMPTS` (default 4) and `PI_AI_RETRY_BASE_MS` (default 500; `delay_i = base·3^i` + ≤250ms jitter → ~500/1500/4500/13500ms, a ~20s window). Disable entirely with `PI_AI_DISABLE_RETRY=1`. (Action inputs: `RETRY_ATTEMPTS` / `RETRY_BASE_MS`.)

The GitHub Action also accepts the provider keys (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` / `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID`) and a required `GITHUB_TOKEN`.

---

## 7. Robustness

- **pi-ai transient-retry patch** (`patches/@earendil-works+pi-ai+0.79.10.patch`, applied via `patch-package` postinstall): a transient HTTP status (408/409/429/5xx) is retried with exponential backoff + jitter instead of surfacing to the agent and aborting the run; auth/validation errors are never retried. Tunable via the env above. The Action **re-applies the patch and asserts it took** (`grep -q PI_AI_DISABLE_RETRY ... || exit 1`) so version drift or `--ignore-scripts` fails loudly rather than silently shipping the un-retried provider. pi-ai is exact-pinned so the patch keeps matching.
- **Boot-check** — `pr.yml` runs a CI boot-smoke (`node dist/server.mjs`) to catch the agent-discovery-at-boot class of failures (e.g. a subagent profile mistakenly placed in `src/agents/` that crashes the server at boot).
- **Gates** — the QA features were each built through an orchestrated workflow (research → partitioned implement → verify) gated by the boot-check and the test/lint gates before commit. `qa-smoke.yml` is a throwaway CDP feasibility probe (launch headless Chrome, reach the CDP ws endpoint, drive one command) across ubuntu/windows/macos with no API key or repo access.
- **Verify job** re-runs every committed test with plain `node` + system Chrome (no agent, no key) so a PR's checks independently prove the suite green — and on `--cross-os`, on three OSes.

---

## 8. Roadmap / not-yet

- **Remote execution is LOCAL-ONLY today.** Both provider seams — `BrowserProvider` (`src/qa/providers/browser.ts`) and `ComputeProvider` (`src/qa/providers/compute.ts`) — keep `'local'` as the only **implemented** backend: headless Chrome + bash on a GitHub Action runner. The agent loop itself does not yet call these providers; the interfaces exist as the documented seam.
- **The single planned remote backend is the Cloudflare Sandbox SDK** (`@cloudflare/sandbox`) — a sandboxed container exposing a terminal, ports, and a preview URL. `browserProviderKind()` / `computeProviderKind()` return the named unions `'local' | 'cloudflare-sandbox'` and **throw "not implemented yet"** when `BROWSER_PROVIDER=cloudflare-sandbox` / `COMPUTE_PROVIDER=cloudflare-sandbox` is requested (rather than silently falling back). No `@cloudflare/sandbox` import is added yet — it is referenced only in comments/TODOs, so compilation and boot are unaffected. (The earlier generic browserless / E2B / Daytona naming has been dropped in favor of this single backend.)
- **Session capture is web-only for now.** The record half (`$CDP_RECORD` JSONL log in `cdp.mjs`) is built; the `gen-test.mjs` log→faithful-spec generator is the in-progress other half. **Session capture for the `cli` kind is future.**
- **refactor-hint tier** ships but is off by default (very high bar) and is the least-exercised tier.

---

*Key source files: `src/agents/qa-lead.ts`; `src/qa/{config,instructions,browser-driver,cli-driver,healer,pr,pr-policy,skill,exec,catalog,cli-client.mjs}.ts`; `src/qa/providers/{browser,compute}.ts`; `src/tools/{catalog-flows,run-spec,classify-finding,open-pull-request}.ts`; `src/workflows/qa.ts`; `bin/shippie.mjs`; `qa/action.yml`; `.github/workflows/{qa-reusable,qa-smoke}.yml`; `src/skills/chrome-cdp/{SKILL.md,scripts/cdp.mjs,scripts/cdp-client.mjs,scripts/launch-chrome.sh}`; `Dockerfile`; `patches/@earendil-works+pi-ai+0.79.10.patch`. See also `docs/ambient-qa.md` (design log) and `docs/cross-repo-qa.md`.*
