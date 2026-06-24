import { defineTool } from '@flue/runtime'
import * as v from 'valibot'
import type { QaConfig } from '../qa/config'
import { listArtifacts, runShell } from '../qa/exec'

/**
 * `run_spec` — run a generated CDP e2e test (a node script that imports
 * `../cdp-client.mjs`, drives the page, and asserts) and return pass/fail plus
 * artifact paths (screenshots, session.mp4). The test self-launches headless
 * Chrome via the client, so this is just `node <test>`. Use after writing a test,
 * before declaring the flow done — only a green test is kept.
 */
export const createRunSpecTool = (cfg: QaConfig) =>
  defineTool({
    name: 'run_spec',
    description:
      'Run a generated CDP e2e test (a node script using ../cdp-client.mjs) and return pass/fail ' +
      'plus artifact paths (screenshots, session.mp4). Exit code 0 = pass. Use after writing a test, ' +
      'before declaring the flow done.',
    parameters: v.object({
      specPath: v.pipe(
        v.string(),
        v.minLength(1),
        v.description('Path to the .cdp.mjs test, relative to repo root')
      ),
      baseUrl: v.optional(
        v.pipe(
          v.string(),
          v.description(
            'Base URL the test targets (E2E_BASE_URL). Pass the booted dev-server URL ' +
              'when no global target was configured; otherwise the configured target is used.'
          )
        )
      ),
    }),
    execute: async ({ specPath, baseUrl }) => {
      const target = baseUrl ?? cfg.target
      // Only set E2E_BASE_URL when defined — an empty value would make relative goto()
      // navigate to an invalid URL (the client then fails fast with a clear message).
      const env: Record<string, string | undefined> = {
        CHROME_BIN: cfg.chromeBin,
        E2E_ARTIFACTS_DIR: 'e2e/.artifacts',
        // QA tolerates self-signed / corporate-proxy certs on external HTTPS targets.
        CDP_IGNORE_CERT_ERRORS: '1',
      }
      if (target) env.E2E_BASE_URL = target
      if (cfg.viewport) env.E2E_VIEWPORT = cfg.viewport
      const res = await runShell('node', [specPath], { cwd: cfg.workspace, env })
      return JSON.stringify({
        ok: res.exitCode === 0,
        exitCode: res.exitCode,
        stdout: res.stdout.slice(-4000),
        stderr: res.stderr.slice(-2000),
        artifacts: listArtifacts(cfg.workspace),
      })
    },
  })
