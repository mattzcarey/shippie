import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * Drives the committed cdp-client against a real Chrome + a tiny local server, the
 * same way `run_spec` runs a generated test (`node <script>` importing the client).
 * The script is self-contained (it hosts its own server) so it mirrors a real run.
 * OPT-IN: only runs with QA_CDP_E2E=1 (so the default `npm test` never launches a
 * browser). Run locally with: QA_CDP_E2E=1 npm test -- cdp-client
 */
const enabled = process.env.QA_CDP_E2E === '1'
const CLIENT = join(process.cwd(), 'src/skills/chrome-cdp/scripts/cdp-client.mjs')

const HTML =
  '<!doctype html><html><head><title>Demo</title></head><body>' +
  '<h1>Demo</h1>' +
  '<input name="email" aria-label="Email" />' +
  '<button onclick="document.title=\'clicked\'">Go</button>' +
  '</body></html>'

describe.skipIf(!enabled)('cdp-client drives real Chrome', () => {
  let dir: string
  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'cdp-client-test-'))
  })
  afterAll(() => {
    try {
      rmSync(dir, { recursive: true, force: true })
    } catch {
      // best effort
    }
  })

  it('goto / title / text / fill / click / shot end-to-end', () => {
    const script = join(dir, 'drive.mjs')
    writeFileSync(
      script,
      `import http from 'node:http'
import { open } from ${JSON.stringify(CLIENT)}
import assert from 'node:assert/strict'

const PAGE = ${JSON.stringify(HTML)}
const server = http.createServer((_q, s) => { s.setHeader('content-type', 'text/html'); s.end(PAGE) })
await new Promise((r) => server.listen(0, r))
const baseURL = 'http://127.0.0.1:' + server.address().port

const b = await open({ baseURL, video: false })
try {
  await b.goto('/')
  assert.equal(await b.title(), 'Demo')
  assert.match(await b.text('h1'), /Demo/)
  await b.fill('[name=email]', 'qa@example.com')
  assert.equal(await b.eval("document.querySelector('[name=email]').value"), 'qa@example.com')
  await b.click('button')
  assert.equal(await b.title(), 'clicked')
  await b.shot('shot.png')
  console.log('PASS')
} finally {
  await b.close()
  server.close()
}
`
    )
    const out = execFileSync('node', [script], {
      encoding: 'utf8',
      env: { ...process.env, E2E_ARTIFACTS_DIR: dir },
    })
    expect(out).toContain('PASS')
  }, 90_000)
})
