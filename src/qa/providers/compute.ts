import type { SandboxFactory } from '@flue/runtime'
import { local } from '@flue/runtime/node'

/**
 * Compute/sandbox provider — the override seam for "local runner now, remote VM
 * later" (docs/ambient-qa.md §10). Maps directly onto flue's own SandboxFactory,
 * so it introduces no new flue concept. v0 uses the local default (host fs + bash
 * on the runner); a future `RemoteComputeProvider` wraps a VM/sandbox SDK so
 * bash/read/write/edit execute on a remote machine — the agent loop is unchanged.
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

// Selected by env later: COMPUTE_PROVIDER=local|remote, COMPUTE_ENDPOINT.
export const computeProviderKind = (): 'local' | 'remote' =>
  process.env.COMPUTE_PROVIDER === 'remote' ? 'remote' : 'local'
