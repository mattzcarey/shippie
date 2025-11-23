import { useState } from 'react'
import { useStyletron } from 'baseui'
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react'
import type { StackCommit } from '../types'

type DiffViewProps = {
  commit: StackCommit | undefined
  selectedFile: string | null
  onExpandSidebar: () => void
  sidebarCollapsed: boolean
}

export const DiffView = ({
  commit,
  selectedFile,
  onExpandSidebar,
  sidebarCollapsed,
}: DiffViewProps) => {
  const [css] = useStyletron()
  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set())

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

  const toggleFileCollapse = (fileName: string) => {
    setCollapsedFiles(prev => {
      const next = new Set(prev)
      if (next.has(fileName)) {
        next.delete(fileName)
      } else {
        next.add(fileName)
      }
      return next
    })
  }

  const filesToShow = selectedFile
    ? commit.changes.filter(change => change.fileName === selectedFile)
    : commit.changes

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
              <button
                onClick={() => toggleFileCollapse(fileChange.fileName)}
                className={css({
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px',
                  backgroundColor: '#27272a',
                  border: 'none',
                  color: '#fafafa',
                  fontSize: '13px',
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  ':hover': {
                    backgroundColor: '#3f3f46',
                  },
                })}
              >
                <div className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                })}>
                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                  <span className={css({ fontWeight: 600 })}>{fileChange.fileName}</span>
                  <span className={css({
                    fontSize: '11px',
                    color: '#71717a',
                    textTransform: 'uppercase',
                  })}>
                    {fileChange.changeType}
                  </span>
                </div>
              </button>

              {/* Diff Content */}
              {!isCollapsed && (
                <div className={css({
                  padding: '16px',
                })}>
                  {fileChange.hunks.map((hunk) => (
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
                            if (line.startsWith('-')) {
                              return (
                                <div
                                  key={i}
                                  className={css({
                                    backgroundColor: '#450a0a',
                                    padding: '2px 8px',
                                    color: '#fca5a5',
                                  })}
                                >
                                  {line}
                                </div>
                              )
                            } else if (line.startsWith(' ') || line.startsWith('@@')) {
                              return (
                                <div
                                  key={i}
                                  className={css({
                                    padding: '2px 8px',
                                    color: '#71717a',
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
                            if (line.startsWith('+')) {
                              return (
                                <div
                                  key={i}
                                  className={css({
                                    backgroundColor: '#052e16',
                                    padding: '2px 8px',
                                    color: '#86efac',
                                  })}
                                >
                                  {line}
                                </div>
                              )
                            } else if (line.startsWith(' ') || line.startsWith('@@')) {
                              return (
                                <div
                                  key={i}
                                  className={css({
                                    padding: '2px 8px',
                                    color: '#71717a',
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
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
