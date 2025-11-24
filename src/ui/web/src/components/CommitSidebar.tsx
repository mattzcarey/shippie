import type { StackCommit } from '../types'
import { ChevronDown, GitBranch } from 'lucide-react'
import { useState } from 'react'

type CommitSidebarProps = {
  commits: StackCommit[]
  selectedHashes: string[]
  onToggle: (hash: string) => void
  currentBranch?: string
  baseBranch?: string
}

const COMMIT_COLORS = [
  'text-emerald-400 border-emerald-500',
  'text-cyan-400 border-cyan-500',
  'text-violet-400 border-violet-500',
  'text-amber-400 border-amber-500',
  'text-rose-400 border-rose-500',
  'text-sky-400 border-sky-500',
  'text-pink-400 border-pink-500',
  'text-lime-400 border-lime-500',
]

export const CommitSidebar = ({
  commits,
  selectedHashes,
  onToggle,
  currentBranch = 'main',
  baseBranch = 'main',
}: CommitSidebarProps) => {
  const [showBranchMenu, setShowBranchMenu] = useState(false)

  return (
    <aside className="w-64 border-r border-zinc-800 bg-zinc-900/50 flex flex-col">
      {/* Branch Picker */}
      <div className="p-3 border-b border-zinc-800">
        <div className="relative">
          <button
            onClick={() => setShowBranchMenu(!showBranchMenu)}
            className="w-full flex items-center justify-between gap-2 px-2 py-1.5 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 text-xs transition-colors"
          >
            <div className="flex items-center gap-2 min-w-0">
              <GitBranch className="w-3 h-3 text-emerald-400 flex-shrink-0" />
              <span className="text-zinc-300 truncate">{currentBranch}</span>
            </div>
            <ChevronDown className="w-3 h-3 text-zinc-500 flex-shrink-0" />
          </button>

          {showBranchMenu && (
            <div className="absolute top-full left-0 right-0 mt-1 bg-zinc-900 border border-zinc-700 shadow-2xl z-50">
              <div className="p-2 border-b border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider">
                Switch Branch
              </div>
              <button className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 flex items-center gap-2">
                <GitBranch className="w-3 h-3" />
                <span>main</span>
              </button>
              <button className="w-full text-left px-3 py-2 text-xs text-zinc-400 hover:bg-zinc-800 flex items-center gap-2">
                <GitBranch className="w-3 h-3" />
                <span>develop</span>
              </button>
            </div>
          )}
        </div>

        <div className="mt-2 text-[10px] text-zinc-600">
          {commits.length} commits ahead of {baseBranch}
        </div>
      </div>

      {/* Commit List */}
      <div className="flex-1 overflow-y-auto">
        {commits.map((commit, index) => {
          const isSelected = selectedHashes.includes(commit.commit.hash)
          const colorClass = COMMIT_COLORS[index % COMMIT_COLORS.length]

          return (
            <button
              key={commit.commit.hash}
              onClick={() => onToggle(commit.commit.hash)}
              className={`w-full text-left p-2 border-b border-zinc-800/50 transition-all
                ${isSelected
                  ? 'bg-zinc-800/80'
                  : 'hover:bg-zinc-800/40'
                }`}
            >
              <div className="flex items-start gap-2">
                {/* Selection indicator */}
                {isSelected ? (
                  <div className={`flex-shrink-0 text-[9px] font-bold border px-1 py-0.5 ${colorClass} mt-0.5`}>
                    #{index + 1}
                  </div>
                ) : (
                  <div className="flex-shrink-0 w-5 h-4" />
                )}

                <div className="flex-1 min-w-0">
                  {/* Hash & Message */}
                  <div className={`text-[11px] leading-tight ${
                    isSelected ? 'text-zinc-200' : 'text-zinc-500'
                  }`}>
                    <span className={`${isSelected ? colorClass.split(' ')[0] : 'text-zinc-600'} mr-1`}>
                      {commit.commit.shortHash}
                    </span>
                    {commit.commit.message.slice(0, 40)}
                    {commit.commit.message.length > 40 && '...'}
                  </div>

                  {/* Meta */}
                  <div className="flex items-center gap-1.5 text-[9px] text-zinc-600 mt-1">
                    <span>{commit.commit.author.split(' ')[0]}</span>
                    <span>·</span>
                    <span>{commit.commit.filesChanged.length}f</span>
                  </div>
                </div>
              </div>
            </button>
          )
        })}
      </div>

      {/* Footer Actions */}
      <div className="p-2 border-t border-zinc-800 space-y-1.5">
        <button className="w-full bg-emerald-600 hover:bg-emerald-500 text-zinc-950 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-colors">
          Apply Restack
        </button>
        <button className="w-full border border-zinc-700 hover:bg-zinc-800 text-zinc-400 px-2 py-1 text-[9px] uppercase tracking-wider transition-colors">
          Reset
        </button>
      </div>
    </aside>
  )
}
