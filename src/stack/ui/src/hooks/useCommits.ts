import { useState, useEffect } from 'react'
import type { StackCommit } from '../types'
import { api } from '../api/client'

export const useCommits = () => {
  const [commits, setCommits] = useState<StackCommit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchCommits = async () => {
      try {
        setLoading(true)
        const data = await api.getCommits()
        setCommits(data)
        setError(null)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch commits')
      } finally {
        setLoading(false)
      }
    }

    fetchCommits()
  }, [])

  const toggleCommitSelection = (hash: string) => {
    setCommits((prev) =>
      prev.map((commit) =>
        commit.commit.hash === hash
          ? { ...commit, selected: !commit.selected }
          : commit
      )
    )
  }

  return { commits, loading, error, toggleCommitSelection }
}
