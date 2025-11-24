import { useQuery } from '@tanstack/react-query'
import type { StackCommit } from '../types'
import { api } from '../api/client'

export const useCommits = (baseBranch?: string, currentBranch?: string) => {
  return useQuery<StackCommit[], Error>({
    queryKey: ['commits', { base: baseBranch || 'default', current: currentBranch || 'default' }],
    queryFn: () => api.getCommits(baseBranch, currentBranch),
    gcTime: 1000 * 60 * 60, // Keep in cache for 1 hour
    staleTime: 1000 * 60 * 10, // Consider data fresh for 10 minutes (diffs don't change often)
  })
}
