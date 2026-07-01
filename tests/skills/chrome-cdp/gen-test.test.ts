import { describe, expect, it } from 'vitest'
// @ts-expect-error — vendored dependency-free .mjs, no type declarations
import { logToTest } from '../../../src/skills/chrome-cdp/scripts/gen-test.mjs'

const FIXTURE = [
  { op: 'nav', url: '/login' },
  { op: 'fill', selector: 'input[name=email]', text: 'qa@example.com' },
  { op: 'fill', selector: 'input[name=password]', text: 'hunter2' },
  { op: 'click', selector: 'button[type=submit]' },
  { op: 'type', text: 'hello' },
  { op: 'press', key: 'Enter' },
  { op: 'clickAt', x: 412, y: 388 },
]

describe('gen-test logToTest', () => {
  const src = logToTest(FIXTURE, { name: 'login', baseUrl: 'http://localhost:3000' })

  it('imports the committed client and node assert', () => {
    expect(src).toContain("import { open } from '../cdp-client.mjs'")
    expect(src).toContain("import assert from 'node:assert/strict'")
    expect(src).toContain('const b = await open({ baseURL: process.env.E2E_BASE_URL })')
  })

  it('replays every recorded op via the matching cdp-client method', () => {
    expect(src).toContain("await b.goto('/login')")
    expect(src).toContain("await b.fill('input[name=email]', 'qa@example.com')")
    expect(src).toContain("await b.fill('input[name=password]', 'hunter2')")
    expect(src).toContain("await b.click('button[type=submit]')")
    expect(src).toContain("await b.type('hello')")
    expect(src).toContain("await b.press('Enter')")
    expect(src).toContain('await b.clickAt(412, 388)')
  })

  it('scaffolds a TODO assertion marker and prints PASS in a try/finally', () => {
    expect(src).toContain('// TODO: add assertions')
    expect(src).toContain("console.log('PASS')")
    expect(src).toContain('await b.close()')
  })

  it('escapes quotes in selectors/text safely', () => {
    const tricky = logToTest(
      [{ op: 'fill', selector: "input[name='x']", text: "it's" }],
      {
        name: 'q',
      }
    )
    // single quotes inside the emitted single-quoted literal must be backslash-escaped
    expect(tricky).toContain("await b.fill('input[name=\\'x\\']', 'it\\'s')")
  })

  it('handles an empty log without throwing and still emits a runnable shell', () => {
    const empty = logToTest([], { name: 'empty' })
    expect(empty).toContain('// (no recorded actions)')
    expect(empty).toContain("console.log('PASS')")
  })
})
