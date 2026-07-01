import { describe, expect, it } from 'vitest'
import { run, runShell } from '../../src/qa/cli-client.mjs'

/**
 * Dogfoods the committed cli-client — the COMMITTED-TEST surface for shippie qa's
 * `cli` target kind. `run_spec` runs a generated `.cli.mjs` test with `node <script>`
 * importing this helper; here we exercise the same helper directly. No browser is
 * spawned (only `node`/`sh`), so this runs in the default suite (NOT opt-in gated).
 */
describe('cli-client run()', () => {
  it('captures stdout and a zero exit code', async () => {
    const r = await run('node', ['-e', "process.stdout.write('hello'); process.exit(0)"])
    expect(r.stdout).toBe('hello')
    expect(r.code).toBe(0)
  }, 30_000)

  it('returns a nonzero exit code instead of throwing', async () => {
    const r = await run('node', ['-e', 'process.exit(3)'])
    expect(r.code).toBe(3)
  }, 30_000)

  it('captures stderr', async () => {
    const r = await run('node', ['-e', "process.stderr.write('boom'); process.exit(1)"])
    expect(r.stderr).toBe('boom')
    expect(r.code).toBe(1)
  }, 30_000)

  it('feeds stdin via opts.input', async () => {
    const r = await run('node', ['-e', 'process.stdin.pipe(process.stdout)'], {
      input: 'piped',
    })
    expect(r.stdout).toBe('piped')
    expect(r.code).toBe(0)
  }, 30_000)

  it('passes extra env via opts.env', async () => {
    const r = await run('node', ['-e', 'process.stdout.write(process.env.QA_PROBE)'], {
      env: { QA_PROBE: 'set' },
    })
    expect(r.stdout).toBe('set')
  }, 30_000)

  it('rejects on a missing binary (ENOENT)', async () => {
    await expect(run('definitely-not-a-real-binary-xyz')).rejects.toThrow(
      /failed to spawn/
    )
  }, 30_000)
})

describe('cli-client runShell()', () => {
  it('runs a shell one-liner with a pipe', async () => {
    const r = await runShell('echo hi | tr a-z A-Z')
    expect(r.stdout.trim()).toBe('HI')
    expect(r.code).toBe(0)
  }, 30_000)
})
