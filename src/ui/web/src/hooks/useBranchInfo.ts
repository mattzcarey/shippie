import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export const useBranchInfo = () => {
  return useQuery({
    queryKey: ['branchInfo'],
    queryFn: () => api.getBranchInfo(),
    staleTime: 60000, // Consider data fresh for 60 seconds
  })
}
