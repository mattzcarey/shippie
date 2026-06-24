import { defineTool } from '@flue/runtime'
import * as v from 'valibot'
import type { QaConfig } from '../qa/config'
import { listArtifacts, runShell } from '../qa/exec'

/**
 * `run_spec` — the agent runs a generated Playwright spec headless and gets back
 * pass/fail + artifact paths (trace.zip, video.webm, results.json). Use after
 * writing a spec, before declaring a flow done — only a green spec is kept.
 */
export const createRunSpecTool = (cfg: QaConfig) =>
  defineTool({
    name: 'run_spec',
    description:
      'Run a generated Playwright spec headless and return pass/fail plus artifact paths ' +
      '(trace.zip, video.webm, results.json). Use after writing a spec, before declaring the flow done.',
    parameters: v.object({
      specPath: v.pipe(
        v.string(),
        v.minLength(1),
        v.description('Path to the .spec.ts, relative to repo root')
      ),
      project: v.optional(
        v.pipe(v.string(), v.description("Playwright project, e.g. 'chromium'"))
      ),
    }),
    execute: async ({ specPath, project }) => {
      const args = ['playwright', 'test', specPath, '--reporter=json']
      if (project) args.push(`--project=${project}`)
      const res = await runShell('npx', args, {
        cwd: cfg.workspace,
        env: { CI: '1', E2E_BASE_URL: cfg.target },
      })
      return JSON.stringify({
        ok: res.exitCode === 0,
        exitCode: res.exitCode,
        stdout: res.stdout.slice(-4000),
        stderr: res.stderr.slice(-2000),
        artifacts: listArtifacts(cfg.workspace),
      })
    },
  })
