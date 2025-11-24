import type { RestackOperation } from '../types'
import { Layers, X, AlertCircle, Loader2, Trash2, Play } from 'lucide-react'

type RestackPanelProps = {
  operations: RestackOperation[]
  applying: boolean
  error: string | null
  onRemove: (index: number) => void
  onClear: () => void
  onApply: () => void
}

export const RestackPanel = ({
  operations,
  applying,
  error,
  onRemove,
  onClear,
  onApply,
}: RestackPanelProps) => {
  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-800">
              Restack Operations
            </h2>
          </div>
          {operations.length > 0 && (
            <button
              onClick={onClear}
              disabled={applying}
              className="text-xs text-gray-500 hover:text-red-600 flex items-center gap-1 disabled:opacity-50"
            >
              <Trash2 className="w-3 h-3" />
              Clear
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600">
          {operations.length} operation{operations.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="m-4 bg-red-50 border-2 border-red-200 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">Error</p>
              <p className="text-sm text-red-600 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Operations List */}
      <div className="flex-1 overflow-y-auto p-4">
        {operations.length === 0 ? (
          <div className="text-center text-gray-500 mt-12">
            <Layers className="w-12 h-12 mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No operations yet</p>
            <p className="text-xs mt-2">
              Click on hunks in the center panel to add them
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {operations.map((op, index) => (
              <div
                key={index}
                className="bg-white border border-gray-200 rounded-lg p-3 group hover:border-gray-300 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-gray-700 mb-1">
                      Target Commit #{op.targetCommitIndex}
                    </div>
                    <div className="text-xs text-gray-600 font-mono truncate">
                      {op.fileId}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Hunk: {op.hunkId}
                    </div>
                  </div>
                  <button
                    onClick={() => onRemove(index)}
                    disabled={applying}
                    className="flex-shrink-0 text-gray-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Apply Button */}
      <div className="p-4 border-t border-gray-200 bg-gray-50">
        <button
          onClick={onApply}
          disabled={operations.length === 0 || applying}
          className="w-full bg-blue-600 text-white rounded-lg px-4 py-3 font-semibold
                     hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed
                     transition-colors flex items-center justify-center gap-2"
        >
          {applying ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Applying...
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Apply Restack
            </>
          )}
        </button>
        {operations.length > 0 && !applying && (
          <p className="text-xs text-gray-500 text-center mt-2">
            This will restructure your commits
          </p>
        )}
      </div>
    </div>
  )
}
