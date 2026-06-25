// cli-client — a tiny, dependency-free CLI test driver (node:child_process only).
//
// This is the COMMITTED-TEST surface for shippie qa's `cli` target kind: black-box
// e2e tests are node scripts that `import { run } from '../cli-client.mjs'`, spawn the
// target's CLI, and assert on stdout/stderr/exit-code with node:assert, exiting 0/1.
// No Chrome, no cdp-client — the "developer tool" for a CLI/lib target is the terminal.
// (mirrors cdp-client.mjs, which is the committed-test surface for `web` targets.)
//
//   import { run } from '../cli-client.mjs'
//   import assert from 'node:assert/strict'
//   const r = await run('node', ['bin/cli.js', '--help'])
//   assert.equal(r.code, 0)
//   assert.match(r.stdout, /usage/i)
//
// Everything is relative to E2E_CWD (the target checkout) so the same test runs
// against any checkout via that env var, mirroring how CDP tests use E2E_BASE_URL.

import { spawn } from 'node:child_process'

const DEFAULT_TIMEOUT_MS = 60_000

// Cap captured stdout/stderr so a runaway command can't blow up memory. ~16 MiB
// per stream is far more than any sane CLI test inspects; once hit we stop appending.
const MAX_OUTPUT_BYTES = 16 * 1024 * 1024

/**
 * Spawn a command (NO shell — argv is passed verbatim, so no quoting/injection
 * surprises) and resolve with its captured output. Never rejects on a nonzero exit
 * — the exit code is part of the result a test asserts on. Rejects only when the
 * binary cannot be spawned at all (ENOENT) or the timeout fires.
 *
 * @param {string} command  the executable (e.g. 'node', 'cargo', './target/release/app')
 * @param {string[]} [args]  argv for the executable
 * @param {object} [opts]
 * @param {string} [opts.cwd]  working dir; defaults to $E2E_CWD then process.cwd()
 * @param {Record<string,string>} [opts.env]  extra env (merged over process.env)
 * @param {string} [opts.input]  written to the child's stdin, then stdin is closed
 * @param {number} [opts.timeoutMs]  kill (SIGKILL) + reject after this; default 60s
 * @returns {Promise<{ stdout: string, stderr: string, code: number, signal: string|null, timedOut: boolean }>}
 */
export function run(command, args = [], opts = {}) {
  const cwd = opts.cwd ?? process.env.E2E_CWD ?? process.cwd()
  const env = { ...process.env, ...opts.env }
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    let timedOut = false
    let settled = false

    const timer = setTimeout(() => {
      timedOut = true
      try {
        child.kill('SIGKILL')
      } catch {
        // already gone
      }
    }, timeoutMs)

    const finish = (fn, arg) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      fn(arg)
    }

    child.stdout.on('data', (d) => {
      if (stdout.length < MAX_OUTPUT_BYTES) stdout += d
    })
    child.stderr.on('data', (d) => {
      if (stderr.length < MAX_OUTPUT_BYTES) stderr += d
    })
    child.on('error', (err) =>
      finish(reject, new Error(`failed to spawn ${command}: ${err.message}`))
    )
    child.on('close', (code, signal) => {
      if (timedOut) {
        finish(
          reject,
          new Error(`timed out after ${timeoutMs}ms: ${command} ${args.join(' ')}`)
        )
        return
      }
      // A signal-killed child reports code=null; surface 1 so assert.equal(r.code, 0) fails.
      finish(resolve, {
        stdout,
        stderr,
        code: code ?? 1,
        signal: signal ?? null,
        timedOut,
      })
    })

    if (opts.input != null) child.stdin.write(String(opts.input))
    child.stdin.end()
  })
}

/**
 * Convenience for a shell one-liner (pipes, globs, &&). Runs `sh -c <commandString>`;
 * takes the same opts as `run`. Prefer `run(command, args)` (no shell) for fixed argv —
 * use this only when the scenario genuinely needs shell features. The string is your
 * responsibility (no quoting is done for you).
 *
 *   const r = await runShell('echo hi | tr a-z A-Z')
 *   assert.equal(r.stdout.trim(), 'HI')
 */
export function runShell(commandString, opts = {}) {
  return run('sh', ['-c', commandString], opts)
}
