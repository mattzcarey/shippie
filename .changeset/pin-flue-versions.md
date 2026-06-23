---
"shippie": patch
---

Fix `shippie review` crashing on a clean install with `[flue] Agent "mention" must default-export createAgent(...)`. The `@flue/*` dependencies were ranged with a caret (`^1.0.0-beta.1`), so installs floated to `@flue/runtime@1.0.0-beta.3`, whose `createAgent` marker (`__flueAgentDefinition`) no longer matches the validator bundled into `dist/server.mjs` (built against `beta.1`'s `__flueCreatedAgent`). Pin `@flue/runtime`, `@flue/github`, and `@flue/cli` to exact `1.0.0-beta.1` so the runtime installed by `npx`/the GitHub Action always matches the bundled build output.
