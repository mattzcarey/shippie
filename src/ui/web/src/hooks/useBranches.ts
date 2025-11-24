import { useQuery } from '@tanstack/react-query'
import { api } from '../api/client'

export const useBranches = () => {
  return useQuery({
    queryKey: ['branches'],
    queryFn: () => api.getBranches(),
    staleTime: 60000, // Consider data fresh for 60 seconds
  })
}
