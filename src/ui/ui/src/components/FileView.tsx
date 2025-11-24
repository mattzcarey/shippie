import type { StackCommit, RestackOperation } from '../types'
import { File, FileText, FilePlus, FileX, FileEdit } from 'lucide-react'

type FileViewProps = {
  commits: StackCommit[]
  onHunkSelect: (operation: RestackOperation) => void
}

export const FileView = ({ commits, onHunkSelect }: FileViewProps) => {
  if (commits.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center text-gray-500">
          <File className="w-16 h-16 mx-auto mb-4 text-gray-300" />
          <p className="text-lg">Select commits to view their changes</p>
        </div>
      </div>
    )
  }

  const getFileIcon = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return <FilePlus className="w-4 h-4 text-green-600" />
      case 'deleted':
        return <FileX className="w-4 h-4 text-red-600" />
      case 'modified':
        return <FileEdit className="w-4 h-4 text-blue-600" />
      default:
        return <FileText className="w-4 h-4 text-gray-600" />
    }
  }

  const getChangeTypeColor = (changeType: string) => {
    switch (changeType) {
      case 'added':
        return 'bg-green-50 border-green-200 text-green-700'
      case 'deleted':
        return 'bg-red-50 border-red-200 text-red-700'
      case 'modified':
        return 'bg-blue-50 border-blue-200 text-blue-700'
      default:
        return 'bg-gray-50 border-gray-200 text-gray-700'
    }
  }

  const renderDiffLine = (line: string, index: number) => {
    const firstChar = line[0]
    let bgColor = ''
    let textColor = 'text-gray-800'

    if (firstChar === '+') {
      bgColor = 'bg-green-50'
      textColor = 'text-green-900'
    } else if (firstChar === '-') {
      bgColor = 'bg-red-50'
      textColor = 'text-red-900'
    } else if (firstChar === '@') {
      bgColor = 'bg-blue-50'
      textColor = 'text-blue-700 font-semibold'
    }

    return (
      <div
        key={index}
        className={`px-4 py-0.5 font-mono text-xs ${bgColor} ${textColor} whitespace-pre`}
      >
        {line}
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {commits.map((commit) => (
        <div key={commit.commit.hash} className="space-y-4">
          {/* Commit Header */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-mono text-sm text-gray-600">
                    {commit.commit.shortHash}
                  </span>
                  <span className="text-xs text-gray-400">•</span>
                  <span className="text-sm text-gray-600">
                    {commit.commit.author}
                  </span>
                </div>
                <p className="text-base font-medium text-gray-800">
                  {commit.commit.message}
                </p>
              </div>
            </div>
          </div>

          {/* Files */}
          {commit.changes.map((file) => (
            <div
              key={file.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              {/* File Header */}
              <div
                className={`px-4 py-3 border-b ${getChangeTypeColor(
                  file.changeType
                )}`}
              >
                <div className="flex items-center gap-2">
                  {getFileIcon(file.changeType)}
                  <span className="font-mono text-sm font-medium">
                    {file.fileName}
                  </span>
                  <span className="text-xs uppercase font-semibold">
                    {file.changeType}
                  </span>
                </div>
              </div>

              {/* Hunks */}
              <div className="divide-y divide-gray-200">
                {file.hunks.map((hunk) => (
                  <div key={hunk.id} className="group">
                    <button
                      onClick={() =>
                        onHunkSelect({
                          targetCommitIndex: 0,
                          hunkId: hunk.id,
                          fileId: file.id,
                        })
                      }
                      className="w-full hover:bg-gray-50 transition-colors"
                    >
                      <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                        <span className="text-xs font-mono text-gray-600">
                          {hunk.header}
                        </span>
                        <span className="text-xs text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity">
                          Click to add to restack
                        </span>
                      </div>
                      <div className="text-left">
                        {hunk.content
                          .split('\n')
                          .map((line, lineIndex) =>
                            renderDiffLine(line, lineIndex)
                          )}
                      </div>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
