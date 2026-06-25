import type { SandboxFactory } from '@flue/runtime'
import { local } from '@flue/runtime/node'

/**
 * Compute/sandbox provider — the override seam for "local runner now, Cloudflare
 * Sandbox SDK later" (docs/ambient-qa.md §10). Maps directly onto flue's own
 * SandboxFactory, so it introduces no new flue concept. Today shippie qa uses the
 * local default ONLY: host fs + bash inside a GitHub Action runner. The single
 * planned remote backend is the Cloudflare Sandbox SDK (`@cloudflare/sandbox`); a
 * future `CloudflareSandboxComputeProvider` would wrap a sandbox container so
 * bash/read/write/edit execute inside it — the agent loop is unchanged. It is NOT
 * built yet — see `computeProviderKind` below.
 */
export interface ComputeProvider {
  sandbox(opts: { cwd: string; env?: Record<string, string | undefined> }): SandboxFactory
}

/** v0 default: host filesystem + shell on the runner. */
export class LocalComputeProvider implements ComputeProvider {
  sandbox(opts: {
    cwd: string
    env?: Record<string, string | undefined>
  }): SandboxFactory {
    return local(opts)
  }
}

/** The implemented backend today, plus the single planned remote one. */
export type ComputeProviderKind = 'local' | 'cloudflare-sandbox'

/**
 * Selected by env: `COMPUTE_PROVIDER=local|cloudflare-sandbox`.
 *
 * Only `'local'` is implemented (`LocalComputeProvider`, host fs + bash on the
 * GitHub Action runner). The Cloudflare Sandbox SDK backend is planned but NOT
 * built yet; requesting it throws rather than silently falling back.
 */
export const computeProviderKind = (): ComputeProviderKind => {
  if (process.env.COMPUTE_PROVIDER === 'cloudflare-sandbox') {
    // TODO(cloudflare-sandbox): implement a ComputeProvider backed by
    // @cloudflare/sandbox (createSandbox -> SandboxFactory) so bash/read/write/
    // edit run inside the sandbox container.
    throw new Error(
      "COMPUTE_PROVIDER='cloudflare-sandbox' is not implemented yet; shippie qa currently supports only local execution on the runner (COMPUTE_PROVIDER=local)."
    )
  }
  return 'local'
}
