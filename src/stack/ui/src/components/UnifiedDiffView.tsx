import type { StackCommit, Hunk } from '../types'
import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

type UnifiedDiffViewProps = {
  commits: StackCommit[]
  allCommits: StackCommit[]
  hunkAssignments: Record<string, string>
  onAssignHunk: (hunkId: string, commitHash: string) => void
}

const COMMIT_COLORS = [
  { text: 'text-emerald-400', bg: 'bg-emerald-500/20', border: 'border-emerald-500', badge: 'bg-emerald-600' },
  { text: 'text-cyan-400', bg: 'bg-cyan-500/20', border: 'border-cyan-500', badge: 'bg-cyan-600' },
  { text: 'text-violet-400', bg: 'bg-violet-500/20', border: 'border-violet-500', badge: 'bg-violet-600' },
  { text: 'text-amber-400', bg: 'bg-amber-500/20', border: 'border-amber-500', badge: 'bg-amber-600' },
  { text: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500', badge: 'bg-rose-600' },
  { text: 'text-sky-400', bg: 'bg-sky-500/20', border: 'border-sky-500', badge: 'bg-sky-600' },
  { text: 'text-pink-400', bg: 'bg-pink-500/20', border: 'border-pink-500', badge: 'bg-pink-600' },
  { text: 'text-lime-400', bg: 'bg-lime-500/20', border: 'border-lime-500', badge: 'bg-lime-600' },
]

export const UnifiedDiffView = ({
  commits,
  allCommits,
  hunkAssignments,
  onAssignHunk,
}: UnifiedDiffViewProps) => {
  const [showingAssignMenu, setShowingAssignMenu] = useState<string | null>(null)

  if (commits.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-zinc-600">
          <div className="text-4xl mb-4">←</div>
          <p className="text-xs">Select commits to view unified diff</p>
        </div>
      </div>
    )
  }

  const getCommitColor = (commitHash: string) => {
    const index = allCommits.findIndex((c) => c.commit.hash === commitHash)
    return COMMIT_COLORS[index % COMMIT_COLORS.length]
  }

  const getCommitNumber = (commitHash: string) => {
    return allCommits.findIndex((c) => c.commit.hash === commitHash) + 1
  }

  const renderDiffLine = (line: string, index: number) => {
    const firstChar = line[0]
    let bgColor = ''
    let textColor = 'text-zinc-400'
    let borderColor = ''

    if (firstChar === '+') {
      bgColor = 'bg-emerald-500/10'
      textColor = 'text-emerald-300'
      borderColor = 'border-l-2 border-emerald-500/50'
    } else if (firstChar === '-') {
      bgColor = 'bg-rose-500/10'
      textColor = 'text-rose-300'
      borderColor = 'border-l-2 border-rose-500/50'
    } else if (firstChar === '@') {
      bgColor = 'bg-zinc-800/50'
      textColor = 'text-cyan-400'
    }

    return (
      <div
        key={index}
        className={`px-4 py-0.5 text-[11px] leading-relaxed ${bgColor} ${textColor} ${borderColor}`}
      >
        <span className="select-none text-zinc-700 inline-block w-8">
          {firstChar !== '@' && index.toString().padStart(4, ' ')}
        </span>
        <span className="whitespace-pre">{line}</span>
      </div>
    )
  }

  const renderHunkWithBadge = (
    hunk: Hunk,
    file: any,
    commitHash: string
  ) => {
    const assignedCommitHash = hunkAssignments[hunk.id] || commitHash
    const color = getCommitColor(assignedCommitHash)
    const commitNum = getCommitNumber(assignedCommitHash)
    const isShowingMenu = showingAssignMenu === hunk.id

    return (
      <div key={hunk.id} className="group relative">
        {/* Hunk Header with Commit Badge */}
        <div className="sticky top-0 z-10 bg-zinc-900/95 backdrop-blur-sm border-y border-zinc-800/50 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Commit Badge */}
            <button
              onClick={() => setShowingAssignMenu(isShowingMenu ? null : hunk.id)}
              className={`text-[10px] font-bold px-2 py-1 ${color.badge} ${color.text} border ${color.border} hover:brightness-125 transition-all flex items-center gap-1`}
            >
              #{commitNum}
              {isShowingMenu ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
            </button>

            {/* Hunk Info */}
            <span className="text-[10px] text-zinc-500 font-mono">
              {hunk.header}
            </span>
            <span className="text-[10px] text-zinc-600">
              {file.fileName}
            </span>
          </div>

          <div className="text-[10px] text-zinc-600">
            {hunk.newLines} lines
          </div>
        </div>

        {/* Assignment Menu */}
        {isShowingMenu && (
          <div className="absolute top-full left-4 z-20 bg-zinc-900 border border-zinc-700 shadow-2xl mt-1 min-w-[200px]">
            <div className="p-2 border-b border-zinc-800 text-[10px] text-zinc-500 uppercase tracking-wider">
              Assign to commit
            </div>
            {allCommits.map((commit, idx) => {
              const commitColor = COMMIT_COLORS[idx % COMMIT_COLORS.length]
              return (
                <button
                  key={commit.commit.hash}
                  onClick={() => {
                    onAssignHunk(hunk.id, commit.commit.hash)
                    setShowingAssignMenu(null)
                  }}
                  className={`w-full text-left px-3 py-2 text-xs hover:bg-zinc-800 flex items-center gap-2 border-b border-zinc-800/50 last:border-b-0`}
                >
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 ${commitColor.badge} ${commitColor.text} border ${commitColor.border}`}>
                    #{idx + 1}
                  </span>
                  <span className="text-zinc-400 truncate">
                    {commit.commit.shortHash} · {commit.commit.message.slice(0, 30)}...
                  </span>
                </button>
              )
            })}
            <button
              onClick={() => {
                // Create new commit logic
                setShowingAssignMenu(null)
              }}
              className="w-full text-left px-3 py-2 text-xs bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border-t-2 border-emerald-600"
            >
              + New Commit
            </button>
          </div>
        )}

        {/* Diff Content */}
        <div className={`border-l-2 ${color.border}`}>
          {hunk.content.split('\n').map((line, lineIndex) =>
            renderDiffLine(line, lineIndex)
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto bg-zinc-950">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-zinc-900 border-b border-zinc-800 px-6 py-4">
        <h2 className="text-xs uppercase tracking-wider text-zinc-500 mb-2">
          Unified Diff View
        </h2>
        <p className="text-[10px] text-zinc-600">
          Click commit badges to reassign hunks • Scroll to see all changes
        </p>
      </div>

      {/* Diff Content */}
      <div className="p-4 space-y-6">
        {commits.map((commit) => (
          <div key={commit.commit.hash}>
            {commit.changes.map((file) => (
              <div key={file.id} className="mb-4">
                {/* File Header */}
                <div className="bg-zinc-900 border border-zinc-800 px-4 py-2 mb-2">
                  <div className="text-xs text-zinc-400">{file.fileName}</div>
                  <div className="text-[10px] text-zinc-600 mt-1">
                    {file.changeType} • {file.hunks.length} hunks
                  </div>
                </div>

                {/* Hunks */}
                {file.hunks.map((hunk) =>
                  renderHunkWithBadge(hunk, file, commit.commit.hash)
                )}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
