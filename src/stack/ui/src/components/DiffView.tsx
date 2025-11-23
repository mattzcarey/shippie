import { useState, useMemo, useCallback } from 'react'
import { useStyletron } from 'baseui'
import { ChevronRight, ChevronDown, Maximize2, Minimize2, Loader2 } from 'lucide-react'
import type { StackCommit } from '../types'
import { UnifiedFileView } from './UnifiedFileView'
import { useFileContent } from '../hooks/useFileContent'

type DiffViewProps = {
  commit: StackCommit | undefined
  selectedFile: string | null
  onExpandSidebar: () => void
  sidebarCollapsed: boolean
  expandedFile: string | null
  onToggleExpand: (file: string | null) => void
}

export const DiffView = ({
  commit,
  selectedFile,
  onExpandSidebar,
  sidebarCollapsed,
  expandedFile,
  onToggleExpand,
}: DiffViewProps) => {
  const [css] = useStyletron()
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set())

  // Fetch full file content when a file is expanded
  const { data: fileContent, isLoading: fileContentLoading, error: fileContentError } = useFileContent({
    commitHash: commit?.commit.hash,
    filePath: expandedFile || undefined,
    enabled: !!expandedFile && !!commit,
  })

  const toggleFileCollapse = useCallback((fileName: string) => {
    setCollapsedFiles(prev => {
      const next = new Set(prev)
      if (next.has(fileName)) {
        next.delete(fileName)
      } else {
        next.add(fileName)
      }
      return next
    })
  }, [])

  const filesToShow = useMemo(() => {
    if (!commit) return []
    if (expandedFile) {
      return commit.changes.filter(change => change.fileName === expandedFile)
    }
    if (selectedFile) {
      return commit.changes.filter(change => change.fileName === selectedFile)
    }
    return commit.changes
  }, [expandedFile, selectedFile, commit])

  if (!commit) {
    return (
      <div className={css({
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#71717a',
      })}>
        No commit selected
      </div>
    )
  }

  return (
    <div className={css({
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#09090b',
      overflow: 'hidden',
    })}>
      {/* Show expand button if sidebar collapsed */}
      {sidebarCollapsed && (
        <button
          onClick={onExpandSidebar}
          className={css({
            position: 'absolute',
            top: '60px',
            left: '8px',
            zIndex: 10,
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
            color: '#a1a1aa',
            padding: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            ':hover': {
              backgroundColor: '#3f3f46',
              color: '#fafafa',
            },
          })}
        >
          <ChevronRight size={16} />
        </button>
      )}

      {/* Scrollable diff content */}
      <div className={css({
        flex: 1,
        overflowY: 'auto',
        padding: '16px',
      })}>
        {filesToShow.map((fileChange) => {
          const isCollapsed = collapsedFiles.has(fileChange.fileName)

          return (
            <div
              key={fileChange.fileName}
              className={css({
                marginBottom: '16px',
                border: '1px solid #27272a',
                backgroundColor: '#18181b',
              })}
            >
              {/* File Header */}
              <div className={css({
                display: 'flex',
                alignItems: 'center',
                backgroundColor: '#27272a',
                borderBottom: isCollapsed ? 'none' : '1px solid #3f3f46',
              })}>
                <button
                  onClick={() => toggleFileCollapse(fileChange.fileName)}
                  className={css({
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: '#fafafa',
                    fontSize: '13px',
                    fontFamily: 'inherit',
                    cursor: 'pointer',
                    gap: '8px',
                    ':hover': {
                      backgroundColor: '#3f3f46',
                    },
                  })}
                >
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  <span className={css({ fontWeight: 600 })}>{fileChange.fileName}</span>
                  <span className={css({
                    fontSize: '11px',
                    color: '#71717a',
                    textTransform: 'uppercase',
                  })}>
                    {fileChange.changeType}
                  </span>
                </button>
                <button
                  onClick={() => onToggleExpand(expandedFile === fileChange.fileName ? null : fileChange.fileName)}
                  className={css({
                    padding: '12px',
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: expandedFile === fileChange.fileName ? '#a78bfa' : '#71717a',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    ':hover': {
                      backgroundColor: '#3f3f46',
                      color: '#a78bfa',
                    },
                  })}
                  title={expandedFile === fileChange.fileName ? 'Exit fullscreen' : 'View file in fullscreen'}
                >
                  {expandedFile === fileChange.fileName ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
              </div>

              {/* Diff Content */}
              {!isCollapsed && (
                <div className={css({
                  padding: '16px',
                })}>
                  {expandedFile === fileChange.fileName ? (
                    fileContentLoading ? (
                      <div className={css({
                        padding: '48px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '16px',
                        color: '#71717a',
                      })}>
                        <Loader2 className={css({ animation: 'spin 1s linear infinite' })} size={32} />
                        <span>Loading file content...</span>
                      </div>
                    ) : fileContentError ? (
                      <div className={css({
                        padding: '24px',
                        textAlign: 'center',
                        color: '#f87171',
                        backgroundColor: '#450a0a',
                        border: '1px solid #991b1b',
                      })}>
                        Failed to load file content: {String(fileContentError)}
                      </div>
                    ) : fileContent ? (
                      <UnifiedFileView
                        fileName={fileChange.fileName}
                        fileContent={fileContent}
                        hunks={fileChange.hunks}
                      />
                    ) : (
                      <div className={css({
                        padding: '24px',
                        textAlign: 'center',
                        color: '#71717a',
                      })}>
                        Full file content not available
                      </div>
                    )
                  ) : (
                    fileChange.hunks.map((hunk) => (
                    <div
                      key={hunk.id}
                      className={css({
                        marginBottom: '16px',
                      })}
                    >
                      {/* Hunk Header */}
                      <div className={css({
                        padding: '8px 12px',
                        backgroundColor: '#27272a',
                        color: '#71717a',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        borderBottom: '1px solid #3f3f46',
                      })}>
                        {hunk.header}
                      </div>

                      {/* Hunk Content - Side by side */}
                      <div className={css({
                        display: 'grid',
                        gridTemplateColumns: '1fr 1fr',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                      })}>
                        {/* Left side - deletions */}
                        <div className={css({
                          borderRight: '1px solid #3f3f46',
                          backgroundColor: '#18181b',
                        })}>
                          {hunk.content.split('\n').map((line, i) => {
                            if (line.startsWith('@@')) {
                              return null
                            }
                            if (line.startsWith('-')) {
                              return (
                                <div
                                  key={i}
                                  className={css({
                                    backgroundColor: '#450a0a',
                                    padding: '2px 8px',
                                    color: '#fca5a5',
                                    overflowWrap: 'break-word',
                                    wordBreak: 'break-all',
                                  })}
                                >
                                  {line}
                                </div>
                              )
                            } else if (line.startsWith(' ')) {
                              return (
                                <div
                                  key={i}
                                  className={css({
                                    padding: '2px 8px',
                                    color: '#71717a',
                                    overflowWrap: 'break-word',
                                    wordBreak: 'break-all',
                                  })}
                                >
                                  {line}
                                </div>
                              )
                            }
                            return null
                          }).filter(Boolean)}
                        </div>

                        {/* Right side - additions */}
                        <div className={css({
                          backgroundColor: '#18181b',
                        })}>
                          {hunk.content.split('\n').map((line, i) => {
                            if (line.startsWith('@@')) {
                              return null
                            }
                            if (line.startsWith('+')) {
                              return (
                                <div
                                  key={i}
                                  className={css({
                                    backgroundColor: '#052e16',
                                    padding: '2px 8px',
                                    color: '#86efac',
                                    overflowWrap: 'break-word',
                                    wordBreak: 'break-all',
                                  })}
                                >
                                  {line}
                                </div>
                              )
                            } else if (line.startsWith(' ')) {
                              return (
                                <div
                                  key={i}
                                  className={css({
                                    padding: '2px 8px',
                                    color: '#71717a',
                                    overflowWrap: 'break-word',
                                    wordBreak: 'break-all',
                                  })}
                                >
                                  {line}
                                </div>
                              )
                            }
                            return null
                          }).filter(Boolean)}
                        </div>
                      </div>
                    </div>
                  ))
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
