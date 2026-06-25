/**
 * Browser provider — the override seam for "local headless CDP now, Cloudflare
 * Sandbox SDK later" (docs/ambient-qa.md §10).
 *
 * Today shippie qa runs ONLY locally inside a GitHub Action runner: the agent
 * loop drives Chrome via the `chrome-cdp` SKILL (bash launches Chrome on the
 * runner, the agent attaches over CDP), so the loop itself does not call this
 * provider. The interface exists as the documented seam for the SINGLE planned
 * remote backend: the Cloudflare Sandbox SDK (`@cloudflare/sandbox` — a sandboxed
 * container with a terminal, ports and a preview URL). A future
 * `CloudflareSandboxCdpProvider` would launch Chrome inside the sandbox and point
 * the patched cdp.mjs (`--ws-endpoint/--headers`) at the sandbox's exposed ws://
 * endpoint, and nothing else changes. The remote impl is NOT built yet — see
 * `browserProviderKind` below.
 */
export interface CdpEndpoint {
  /** Browser-level ws:// DevTools endpoint. */
  webSocketDebuggerUrl: string
  /** HTTP base for /json/* discovery (local only). */
  httpBase?: string
  /** Auth headers for a remote (Cloudflare Sandbox) endpoint. */
  headers?: Record<string, string>
}

export interface BrowserHandle {
  readonly endpoint: CdpEndpoint
  /** Idempotent: kill the local Chrome / destroy the Cloudflare Sandbox session. */
  release(): Promise<void>
}

export interface BrowserProvider {
  /** `flowId` lets parallel drivers get isolated browsers (distinct ports / sessions). */
  acquire(opts: { flowId: string }): Promise<BrowserHandle>
}

/** The implemented backend today, plus the single planned remote one. */
export type BrowserProviderKind = 'local' | 'cloudflare-sandbox'

/**
 * Selected by env: `BROWSER_PROVIDER=local|cloudflare-sandbox`.
 *
 * Only `'local'` is implemented (Chrome on the GitHub Action runner). The
 * Cloudflare Sandbox SDK backend is planned but NOT built yet; requesting it is
 * surfaced here rather than silently falling back, so callers fail loudly.
 */
export const browserProviderKind = (): BrowserProviderKind => {
  if (process.env.BROWSER_PROVIDER === 'cloudflare-sandbox') {
    // TODO(cloudflare-sandbox): launch Chrome inside a @cloudflare/sandbox
    // container and return its exposed ws:// endpoint as the CdpEndpoint.
    throw new Error(
      "BROWSER_PROVIDER='cloudflare-sandbox' is not implemented yet; shippie qa currently supports only local execution on the runner (BROWSER_PROVIDER=local)."
    )
  }
  return 'local'
}
