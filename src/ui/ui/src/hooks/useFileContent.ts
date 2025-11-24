import { useQuery } from '@tanstack/react-query'

type UseFileContentParams = {
  commitHash?: string
  filePath?: string
  enabled?: boolean
}

type FileContentResponse = {
  content: string
}

export const useFileContent = ({ commitHash, filePath, enabled = true }: UseFileContentParams) => {
  return useQuery({
    queryKey: ['file-content', commitHash, filePath],
    queryFn: async () => {
      if (!commitHash || !filePath) {
        throw new Error('commitHash and filePath are required')
      }

      const params = new URLSearchParams({
        commit: commitHash,
        file: filePath,
      })

      const response = await fetch(`/api/file-content?${params}`)
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to fetch file content')
      }

      const data: FileContentResponse = await response.json()
      return data.content
    },
    enabled: enabled && !!commitHash && !!filePath,
    staleTime: 1000 * 60 * 60, // Cache for 1 hour - file content at a specific commit never changes
  })
}
