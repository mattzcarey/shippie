import { useState } from 'react'
import { useCommits } from './hooks/useCommits'
import { useRestack } from './hooks/useRestack'
import { CommitList } from './components/CommitList'
import { FileView } from './components/FileView'
import { RestackPanel } from './components/RestackPanel'
import { GitBranch, Loader2 } from 'lucide-react'

function App() {
  const { commits, loading, error: commitsError, toggleCommitSelection } = useCommits()
  const {
    operations,
    applying,
    error: restackError,
    addOperation,
    removeOperation,
    clearOperations,
    applyRestack,
  } = useRestack()

  const [selectedCommits, setSelectedCommits] = useState<string[]>([])

  const handleToggleCommit = (hash: string) => {
    toggleCommitSelection(hash)
    setSelectedCommits((prev) =>
      prev.includes(hash) ? prev.filter((h) => h !== hash) : [...prev, hash]
    )
  }

  const selectedCommitData = commits.filter((c) =>
    selectedCommits.includes(c.commit.hash)
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-500 mx-auto mb-4" />
          <p className="text-gray-600 text-lg">Loading commits...</p>
        </div>
      </div>
    )
  }

  if (commitsError) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center max-w-md">
          <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
            <h2 className="text-red-700 text-xl font-semibold mb-2">Error</h2>
            <p className="text-red-600">{commitsError}</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <GitBranch className="w-6 h-6 text-blue-600" />
          <h1 className="text-2xl font-bold text-gray-800">Shippie Stack</h1>
        </div>
        <div className="text-sm text-gray-500">
          {commits.length} commits • {selectedCommits.length} selected
        </div>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel: Commit List */}
        <aside className="w-80 bg-white border-r border-gray-200 overflow-y-auto">
          <CommitList
            commits={commits}
            selectedHashes={selectedCommits}
            onToggle={handleToggleCommit}
          />
        </aside>

        {/* Center Panel: File Diffs */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <FileView commits={selectedCommitData} onHunkSelect={addOperation} />
        </main>

        {/* Right Panel: Restack Preview */}
        <aside className="w-96 bg-white border-l border-gray-200 overflow-y-auto">
          <RestackPanel
            operations={operations}
            applying={applying}
            error={restackError}
            onRemove={removeOperation}
            onClear={clearOperations}
            onApply={applyRestack}
          />
        </aside>
      </div>
    </div>
  )
}

export default App
