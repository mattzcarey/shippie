/**
 * Browser provider — the override seam for "local headless CDP now, remote
 * browser later" (docs/ambient-qa.md §10).
 *
 * v0's agent loop drives Chrome via the `chrome-cdp` SKILL (bash launches Chrome,
 * the agent attaches over CDP), so the loop itself does not call this provider.
 * It exists as the documented seam: a future non-skill caller — or the hosted
 * product — swaps `LocalHeadlessChromeProvider` for a `RemoteCdpProvider` that
 * points at a remote `ws://` endpoint, and nothing else changes. DO NOT build the
 * remote impl here; the patched cdp.mjs already accepts `--ws-endpoint/--headers`.
 */
export interface CdpEndpoint {
  /** Browser-level ws:// DevTools endpoint. */
  webSocketDebuggerUrl: string
  /** HTTP base for /json/* discovery (local only). */
  httpBase?: string
  /** Auth headers for a remote endpoint. */
  headers?: Record<string, string>
}

export interface BrowserHandle {
  readonly endpoint: CdpEndpoint
  /** Idempotent: kill the local Chrome / release the remote session. */
  release(): Promise<void>
}

export interface BrowserProvider {
  /** `flowId` lets parallel drivers get isolated browsers (distinct ports / sessions). */
  acquire(opts: { flowId: string }): Promise<BrowserHandle>
}

// Selected by env later: BROWSER_PROVIDER=local|remote, CDP_WS_ENDPOINT, CDP_HEADERS.
export const browserProviderKind = (): 'local' | 'remote' =>
  process.env.BROWSER_PROVIDER === 'remote' ? 'remote' : 'local'
