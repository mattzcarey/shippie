import { useQuery } from '@tanstack/react-query'
import type { StackCommit } from '../types'
import { api } from '../api/client'

export const useCommits = (baseBranch?: string, currentBranch?: string) => {
  return useQuery<StackCommit[], Error>({
    queryKey: ['commits', { base: baseBranch || 'default', current: currentBranch || 'default' }],
    queryFn: () => api.getCommits(baseBranch, currentBranch),
    gcTime: 1000 * 60 * 5, // Keep in cache for 5 minutes
    staleTime: 0, // Always refetch to get latest commits
    refetchInterval: 30000, // Auto-refetch every 30 seconds
    refetchOnWindowFocus: true, // Refetch when window regains focus
  })
}
