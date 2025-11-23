import type { StackCommit, RestackOperation } from '../types'

// Use the current origin (window.location.origin) so it works on any port
const API_BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000'

export const api = {
  async getCommits(baseBranch?: string, currentBranch?: string): Promise<StackCommit[]> {
    const params = new URLSearchParams()
    if (baseBranch) params.append('base', baseBranch)
    if (currentBranch) params.append('branch', currentBranch)

    const url = params.toString()
      ? `${API_BASE_URL}/api/commits?${params.toString()}`
      : `${API_BASE_URL}/api/commits`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Failed to fetch commits')
    }
    return response.json()
  },

  async getBranchInfo(): Promise<{ currentBranch: string; baseBranch: string }> {
    const response = await fetch(`${API_BASE_URL}/api/branch`)
    if (!response.ok) {
      throw new Error('Failed to fetch branch info')
    }
    return response.json()
  },

  async getBranches(): Promise<{ local: string[]; remote: string[]; all: string[] }> {
    const response = await fetch(`${API_BASE_URL}/api/branches`)
    if (!response.ok) {
      throw new Error('Failed to fetch branches')
    }
    return response.json()
  },

  async applyRestack(operations: RestackOperation[]): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/restack`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(operations),
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Failed to apply restack')
    }
  },

  async checkHealth(): Promise<{ status: string; gitRoot: string }> {
    const response = await fetch(`${API_BASE_URL}/api/health`)
    if (!response.ok) {
      throw new Error('Health check failed')
    }
    return response.json()
  },
}
