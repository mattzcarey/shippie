import { useState } from 'react'
import type { RestackOperation } from '../types'
import { api } from '../api/client'

export const useRestack = () => {
  const [operations, setOperations] = useState<RestackOperation[]>([])
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const addOperation = (operation: RestackOperation) => {
    setOperations((prev) => [...prev, operation])
  }

  const removeOperation = (index: number) => {
    setOperations((prev) => prev.filter((_, i) => i !== index))
  }

  const clearOperations = () => {
    setOperations([])
  }

  const applyRestack = async () => {
    if (operations.length === 0) {
      setError('No operations to apply')
      return
    }

    try {
      setApplying(true)
      setError(null)
      await api.applyRestack(operations)
      setOperations([])
      // Success! You may want to show a success message
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to apply restack')
    } finally {
      setApplying(false)
    }
  }

  return {
    operations,
    applying,
    error,
    addOperation,
    removeOperation,
    clearOperations,
    applyRestack,
  }
}
