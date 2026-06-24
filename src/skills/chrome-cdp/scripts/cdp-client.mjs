// cdp-client — a tiny, dependency-free CDP test driver (Node 22+ built-in WebSocket).
//
// This is the COMMITTED-TEST surface for shippie qa: black-box e2e tests are node
// scripts that `import { open } from '../cdp-client.mjs'`, drive the page, assert with
// node:assert, and exit 0/1. No Playwright. `open()` launches its OWN headless Chrome
// (cert-tolerant for external HTTPS), records a screencast by default, and `close()`
// assembles it to an .mp4 (via ffmpeg; degrades to frames if ffmpeg is absent).
//
//   import { open } from '../cdp-client.mjs'
//   import assert from 'node:assert/strict'
//   const b = await open({ baseURL: process.env.E2E_BASE_URL })
//   try { await b.goto('/'); assert.equal(await b.title(), 'Demo Shop'); ... }
//   finally { await b.close() }

import { execFileSync, spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, isAbsolute, join } from 'node:path'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const resolveChrome = () => {
  if (process.env.CHROME_BIN && existsSync(process.env.CHROME_BIN)) return process.env.CHROME_BIN
  for (const c of ['google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser']) {
    try {
      const p = execFileSync('which', [c], { encoding: 'utf8' }).trim()
      if (p) return p
    } catch {
      // keep looking
    }
  }
  const mac = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
  if (existsSync(mac)) return mac
  throw new Error('No Chrome/Chromium found. Set CHROME_BIN.')
}

const hasFfmpeg = () => {
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

// Minimal CDP connection over a page target's websocket.
class Conn {
  #ws
  #id = 0
  #pending = new Map()
  #handlers = new Map()

  async connect(wsUrl) {
    await new Promise((resolve, reject) => {
      this.#ws = new WebSocket(wsUrl)
      this.#ws.onopen = resolve
      this.#ws.onerror = () => reject(new Error(`CDP websocket error: ${wsUrl}`))
    })
    this.#ws.onmessage = (ev) => {
      const msg = JSON.parse(ev.data)
      if (msg.id && this.#pending.has(msg.id)) {
        const { resolve, reject } = this.#pending.get(msg.id)
        this.#pending.delete(msg.id)
        if (msg.error) reject(new Error(msg.error.message))
        else resolve(msg.result)
      } else if (msg.method && this.#handlers.has(msg.method)) {
        for (const h of this.#handlers.get(msg.method)) h(msg.params || {})
      }
    }
  }

  send(method, params = {}) {
    const id = ++this.#id
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject })
      this.#ws.send(JSON.stringify({ id, method, params }))
      setTimeout(() => {
        if (this.#pending.has(id)) {
          this.#pending.delete(id)
          reject(new Error(`CDP timeout: ${method}`))
        }
      }, 30_000)
    })
  }

  on(method, handler) {
    if (!this.#handlers.has(method)) this.#handlers.set(method, new Set())
    this.#handlers.get(method).add(handler)
  }

  close() {
    try {
      this.#ws?.close()
    } catch {
      // already closed
    }
  }
}

const evalValue = async (cdp, expression) => {
  const res = await cdp.send('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  if (res.exceptionDetails) {
    throw new Error(res.exceptionDetails.exception?.description || res.exceptionDetails.text)
  }
  return res.result.value
}

/**
 * Launch headless Chrome, attach over CDP, start a screencast, and return a driver.
 * Options (all optional): baseURL, chromeBin, port, ignoreCertErrors (default true —
 * QA tolerates self-signed / corporate-proxy certs), artifactsDir, video (filename
 * or false to disable), headless.
 */
export async function open(opts = {}) {
  const baseURL = opts.baseURL ?? process.env.E2E_BASE_URL ?? ''
  const chromeBin = opts.chromeBin ?? resolveChrome()
  const port = opts.port ?? 9222 + Math.floor(Math.random() * 1000)
  const ignoreCertErrors = opts.ignoreCertErrors ?? process.env.CDP_STRICT_TLS !== '1'
  const artifactsDir = opts.artifactsDir ?? process.env.E2E_ARTIFACTS_DIR ?? 'e2e/.artifacts'
  const wantVideo = opts.video !== false
  const videoName = typeof opts.video === 'string' ? opts.video : 'session.mp4'

  const profile = mkdtempSync(join(tmpdir(), 'cdp-client-'))
  const flags = [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--disable-dev-shm-usage',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
  ]
  if (ignoreCertErrors) flags.push('--ignore-certificate-errors')
  flags.push('about:blank')
  const proc = spawn(chromeBin, flags, { stdio: 'ignore' })

  // Wait for the DevTools endpoint + a page target.
  let pageWs
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      const page = list.find((t) => t.type === 'page')
      if (page?.webSocketDebuggerUrl) {
        pageWs = page.webSocketDebuggerUrl
        break
      }
    } catch {
      // not ready
    }
    await sleep(150)
  }
  if (!pageWs) {
    try {
      proc.kill('SIGKILL')
    } catch {
      // ignore
    }
    throw new Error(`Chrome DevTools page target never appeared on port ${port}`)
  }

  const cdp = new Conn()
  await cdp.connect(pageWs)
  await cdp.send('Page.enable')
  await cdp.send('Runtime.enable')
  await cdp.send('DOM.enable')

  // Screencast → frames (acked so they keep flowing). Assembled on close().
  const framesDir = wantVideo ? mkdtempSync(join(tmpdir(), 'cdp-frames-')) : null
  let frameIndex = 0
  if (wantVideo) {
    cdp.on('Page.screencastFrame', async ({ data, sessionId }) => {
      try {
        const n = String(++frameIndex).padStart(5, '0')
        writeFileSync(join(framesDir, `frame-${n}.jpg`), Buffer.from(data, 'base64'))
        await cdp.send('Page.screencastFrameAck', { sessionId })
      } catch {
        // a dropped frame is non-fatal
      }
    })
    await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 60, everyNthFrame: 1 })
  }

  const resolveUrl = (path) => {
    if (/^https?:\/\//.test(path)) return path
    if (!baseURL) return path
    return baseURL.replace(/\/$/, '') + (path.startsWith('/') ? path : `/${path}`)
  }

  const outPath = (name) => {
    const p = isAbsolute(name) ? name : join(artifactsDir, name)
    mkdirSync(dirname(p), { recursive: true })
    return p
  }

  const client = {
    async goto(path) {
      const url = resolveUrl(path)
      await cdp.send('Page.navigate', { url })
      // wait for document ready
      const deadline = Date.now() + 30_000
      while (Date.now() < deadline) {
        if ((await evalValue(cdp, 'document.readyState')) === 'complete') return
        await sleep(100)
      }
      throw new Error(`Timed out loading ${url}`)
    },
    url: () => evalValue(cdp, 'location.href'),
    title: () => evalValue(cdp, 'document.title'),
    eval: (expr) => evalValue(cdp, expr),
    text: async (sel) => {
      const v = await evalValue(
        cdp,
        `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('not found: ' + ${JSON.stringify(sel)}); return el.innerText; })()`
      )
      return v
    },
    html: (sel) =>
      evalValue(
        cdp,
        sel
          ? `document.querySelector(${JSON.stringify(sel)})?.outerHTML ?? ''`
          : 'document.documentElement.outerHTML'
      ),
    async fill(sel, value) {
      await evalValue(
        cdp,
        `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('not found: ' + ${JSON.stringify(sel)}); el.scrollIntoView({block:'center'}); el.focus(); if (el.select) el.select(); return true; })()`
      )
      await cdp.send('Input.insertText', { text: String(value) })
    },
    type: (text) => cdp.send('Input.insertText', { text: String(text) }),
    async click(sel) {
      await evalValue(
        cdp,
        `(() => { const el = document.querySelector(${JSON.stringify(sel)}); if (!el) throw new Error('not found: ' + ${JSON.stringify(sel)}); el.scrollIntoView({block:'center'}); el.click(); return true; })()`
      )
    },
    async clickAt(x, y) {
      const base = { x, y, button: 'left', clickCount: 1 }
      await cdp.send('Input.dispatchMouseEvent', { ...base, type: 'mousePressed' })
      await cdp.send('Input.dispatchMouseEvent', { ...base, type: 'mouseReleased' })
    },
    async press(key) {
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyDown', key })
      await cdp.send('Input.dispatchKeyEvent', { type: 'keyUp', key })
    },
    async waitFor(sel, { timeout = 10_000, visible = true } = {}) {
      const deadline = Date.now() + timeout
      const check = visible
        ? `(() => { const el = document.querySelector(${JSON.stringify(sel)}); return !!el && el.offsetParent !== null; })()`
        : `!!document.querySelector(${JSON.stringify(sel)})`
      while (Date.now() < deadline) {
        if (await evalValue(cdp, check)) return
        await sleep(120)
      }
      throw new Error(`waitFor timed out: ${sel}`)
    },
    async waitForText(sel, expected, { timeout = 10_000 } = {}) {
      const deadline = Date.now() + timeout
      const re = expected instanceof RegExp ? expected : null
      while (Date.now() < deadline) {
        const v = await evalValue(
          cdp,
          `document.querySelector(${JSON.stringify(sel)})?.innerText ?? ''`
        )
        if (re ? re.test(v) : v.includes(expected)) return v
        await sleep(120)
      }
      throw new Error(`waitForText timed out: ${sel} ~ ${expected}`)
    },
    async snapshot() {
      const { nodes } = await cdp.send('Accessibility.getFullAXTree')
      return nodes
        .map((n) => {
          const role = n.role?.value || ''
          const name = n.name?.value || ''
          if (!role || role === 'none' || role === 'generic') return null
          return name ? `[${role}] ${name}` : `[${role}]`
        })
        .filter(Boolean)
        .join('\n')
    },
    async shot(name = 'screenshot.png') {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'png' })
      const p = outPath(name)
      writeFileSync(p, Buffer.from(data, 'base64'))
      return p
    },
    async close() {
      if (wantVideo) {
        try {
          await cdp.send('Page.stopScreencast')
        } catch {
          // ignore
        }
        if (frameIndex > 0) assembleVideo(framesDir, outPath(videoName))
      }
      cdp.close()
      try {
        proc.kill('SIGKILL')
      } catch {
        // already gone
      }
      try {
        rmSync(profile, { recursive: true, force: true })
        if (framesDir) rmSync(framesDir, { recursive: true, force: true })
      } catch {
        // best effort
      }
    },
  }

  return client
}

const assembleVideo = (framesDir, outFile) => {
  if (!hasFfmpeg()) {
    console.error(`[cdp-client] ffmpeg not found; screencast frames left in ${framesDir}`)
    return
  }
  try {
    execFileSync(
      'ffmpeg',
      [
        '-y',
        '-framerate',
        '6',
        '-i',
        join(framesDir, 'frame-%05d.jpg'),
        '-c:v',
        'libx264',
        '-pix_fmt',
        'yuv420p',
        '-vf',
        'pad=ceil(iw/2)*2:ceil(ih/2)*2',
        outFile,
      ],
      { stdio: 'ignore' }
    )
    console.error(`[cdp-client] wrote screencast ${outFile}`)
  } catch (e) {
    console.error(`[cdp-client] ffmpeg failed: ${e instanceof Error ? e.message : e}`)
  }
}
