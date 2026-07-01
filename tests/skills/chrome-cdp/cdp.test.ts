import { type ChildProcess, execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import net from 'node:net'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Integration test for the PATCHED chrome-cdp client (docs/ambient-qa.md §3a, P1).
 * Drives a REAL headless Chrome to prove the patch works end-to-end:
 *   - endpoint discovery by --port via /json/version (not the upstream macOS-only path)
 *   - the new `fill` command (focus + select + insertText)
 *   - list/nav/eval/click against the per-port daemon
 *
 * OPT-IN: only runs when QA_CDP_E2E=1 AND a Chrome binary is found, so it never
 * launches a browser in the default `npm test` job. Run locally with:
 *   QA_CDP_E2E=1 npm test -- cdp
 */

const CDP = join(process.cwd(), 'src/skills/chrome-cdp/scripts/cdp.mjs')

function resolveChrome(): string | null {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN))
    return process.env.CHROME_BIN
  for (const c of [
    'google-chrome',
    'google-chrome-stable',
    'chromium',
    'chromium-browser',
  ]) {
    try {
      const p = execFileSync('which', [c], { encoding: 'utf8' }).trim()
      if (p) return p
    } catch {
      // not on PATH
    }
  }
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  return existsSync(mac) ? mac : null
}

function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer()
    srv.once('error', reject)
    srv.listen(0, () => {
      const { port } = srv.address() as net.AddressInfo
      srv.close(() => resolve(port))
    })
  })
}

const chrome = resolveChrome()
const enabled = process.env.QA_CDP_E2E === '1' && chrome !== null

describe.skipIf(!enabled)('chrome-cdp patched client (real Chrome)', () => {
  let chromeProc: ChildProcess
  let profile: string
  let port: number

  const run = (...args: string[]): string =>
    execFileSync('node', [CDP, '--port', String(port), ...args], {
      encoding: 'utf8',
    }).trim()

  beforeAll(async () => {
    port = await freePort()
    profile = mkdtempSync(join(tmpdir(), 'cdp-test-'))
    chromeProc = spawn(
      chrome as string,
      [
        '--headless=new',
        '--disable-gpu',
        '--no-sandbox',
        '--disable-dev-shm-usage',
        `--remote-debugging-port=${port}`,
        `--user-data-dir=${profile}`,
        '--no-first-run',
        '--no-default-browser-check',
        'about:blank',
      ],
      { detached: true, stdio: 'ignore' }
    )
    const deadline = Date.now() + 30_000
    while (Date.now() < deadline) {
      try {
        const r = await fetch(`http://127.0.0.1:${port}/json/version`)
        if (r.ok) return
      } catch {
        // not ready yet
      }
      await new Promise((r) => setTimeout(r, 200))
    }
    throw new Error('Chrome DevTools endpoint never came up')
  }, 40_000)

  afterAll(() => {
    try {
      run('stop')
    } catch {
      // daemon may already be gone
    }
    try {
      if (chromeProc?.pid) process.kill(-chromeProc.pid, 'SIGKILL')
    } catch {
      try {
        chromeProc?.kill('SIGKILL')
      } catch {
        // already dead
      }
    }
    try {
      rmSync(profile, { recursive: true, force: true })
    } catch {
      // best effort
    }
  })

  it('lists a page target on the chosen port (no macOS-path dependency)', () => {
    const out = run('list')
    expect(out.length).toBeGreaterThan(0)
  })

  it('navigates, fills (replacing the value), clicks, and evals', () => {
    const target = run('list').split('\n')[0].split(/\s+/)[0]
    expect(target).toMatch(/^[0-9a-f]+$/i)

    run(
      'nav',
      target,
      'data:text/html,<title>QA</title><input id=e value=x>' +
        '<button id=b onclick="window.__c=(window.__c||0)+1">go</button>'
    )
    expect(run('eval', target, 'document.title')).toBe('QA')

    // `fill` must REPLACE the pre-existing value "x", not append to it.
    run('fill', target, '#e', 'qa@example.com')
    expect(run('eval', target, "document.querySelector('#e').value")).toBe(
      'qa@example.com'
    )

    run('click', target, '#b')
    expect(run('eval', target, 'String(window.__c)')).toBe('1')
  })
})
