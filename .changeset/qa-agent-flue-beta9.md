---
"shippie": minor
---

**`shippie qa` — an autonomous ambient end-to-end QA agent**, plus a migration to **flue 1.0.0-beta.9** and centralised model configuration.

- **New agent: `shippie qa`.** Explores a repo, catalogs its real user flows, fans out per-flow driver subagents, and writes **dependency-free e2e tests that run with just `node`** — web targets are driven in headless Chrome over CDP (`e2e/tests/*.cdp.mjs` + a committed `cdp-client`, no Playwright), CLI targets via the terminal (`e2e/tests/*.cli.mjs` + `cli-client`). Broken flows get a healer subagent (minimal source fix + failing→passing regression test) and findings open **tiered PRs** (broken-flow / missing-coverage / refactor-hint, deduped). Runs as a scheduled + on-demand GitHub Action (`mattzcarey/shippie/qa@v0`), locally via `shippie qa`, or as a Docker monolith; `shippie qa init` / `shippie qa fanout-init` scaffold the workflows (now real YAML templates under `bin/templates/`).
- **flue 1.0.0-beta.9** (from beta.1): tools use the new `{ input, run(ctx) }` shape, agents self-configure from env, workflows are `defineWorkflow({ agent, input, run })`. The pinned pi-ai `0.79.10` override + retry patch are gone (beta.9 needs pi-ai `^0.80.2`, which retries transient model errors natively). `@flue/github` stays beta.1 until a newer release exists (no runtime dep — safe split).
- **Centralised model config** (`src/common/models.ts`): no agent hardcodes a model. `SHIPPIE_MODEL` alone configures the whole system; per-role overrides `SHIPPIE_QA_MODEL` (QA lead + healer) and `SHIPPIE_QA_DRIVER_MODEL` (per-flow drivers) fall back to it. Zero-config keeps the opus-lead / sonnet-driver cost split.
