import { Check, GitCommit } from 'lucide-react'
import type { StackCommit } from '../types'

type CommitListProps = {
  commits: StackCommit[]
  selectedHashes: string[]
  onToggle: (hash: string) => void
}

export const CommitList = ({ commits, selectedHashes, onToggle }: CommitListProps) => {
  return (
    <div className="p-4">
      <h2 className="text-lg font-semibold text-gray-800 mb-4">Select Commits</h2>
      <div className="space-y-2">
        {commits.map((commit) => {
          const isSelected = selectedHashes.includes(commit.commit.hash)
          return (
            <button
              type="button"
              key={commit.commit.hash}
              onClick={() => onToggle(commit.commit.hash)}
              className={`w-full text-left p-3 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center mt-0.5 ${
                    isSelected ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                  }`}
                >
                  {isSelected && <Check className="w-3 h-3 text-white" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <GitCommit className="w-4 h-4 text-gray-400 flex-shrink-0" />
                    <span className="font-mono text-sm text-gray-600">
                      {commit.commit.shortHash}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 mb-1 line-clamp-2">
                    {commit.commit.message}
                  </p>
                  <div className="flex items-center gap-2 text-xs text-gray-500">
                    <span>{commit.commit.author}</span>
                    <span>•</span>
                    <span>{commit.commit.date}</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-500">
                    {commit.commit.filesChanged.length} file
                    {commit.commit.filesChanged.length !== 1 ? 's' : ''} changed
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
