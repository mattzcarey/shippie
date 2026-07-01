import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { writeCatalog } from '../../src/qa/catalog'

describe('writeCatalog', () => {
  let dir: string
  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), 'qa-cat-'))
  })
  afterAll(async () => {
    await rm(dir, { recursive: true, force: true })
  })

  it('writes one markdown file per flow under e2e/specs', async () => {
    const msg = await writeCatalog(dir, [
      {
        slug: 'login',
        title: 'Log in',
        priority: 'high',
        needs: ['browser', 'auth'],
        steps: ['Go to /login', 'Submit valid credentials'],
        expected: ['Lands on /dashboard'],
      },
    ])
    expect(msg).toContain('login (high)')

    const md = await readFile(join(dir, 'e2e', 'specs', 'login.md'), 'utf8')
    expect(md).toContain('# Log in')
    expect(md).toContain('**priority:** high')
    expect(md).toContain('**needs:** browser, auth')
    expect(md).toContain('1. Go to /login')
    expect(md).toContain('- Lands on /dashboard')
  })
})
