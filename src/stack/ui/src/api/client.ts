import type { StackCommit, RestackOperation } from '../types'

const API_BASE_URL = 'http://localhost:3000'

export const api = {
  async getCommits(): Promise<StackCommit[]> {
    const response = await fetch(`${API_BASE_URL}/api/commits`)
    if (!response.ok) {
      throw new Error('Failed to fetch commits')
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
