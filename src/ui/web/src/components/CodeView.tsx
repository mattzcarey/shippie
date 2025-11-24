import { useStyletron } from 'baseui'
import { ChevronDown, ChevronRight, Loader2, Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { useFileContent } from '../hooks/useFileContent'
import type { StackCommit } from '../types'
import { ChangeTypeBadge } from './ChangeTypeBadge'
import { EditorView, PatchView } from './code'

type CodeViewProps = {
  commit: StackCommit | undefined
  selectedFile: string | null
  onExpandSidebar: () => void
  sidebarCollapsed: boolean
  expandedFile: string | null
  onToggleExpand: (file: string | null) => void
  collapsedFiles: string[]
  onToggleFileCollapse: (file: string) => void
}

export const CodeView = ({
  commit,
  selectedFile,
  onExpandSidebar,
  sidebarCollapsed,
  expandedFile,
  onToggleExpand,
  collapsedFiles,
  onToggleFileCollapse,
}: CodeViewProps) => {
  const [css] = useStyletron()
  const fileRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  // Fetch full file content when a file is expanded
  const {
    data: fileContent,
    isLoading: fileContentLoading,
    error: fileContentError,
  } = useFileContent({
    commitHash: commit?.commit.hash,
    filePath: expandedFile || undefined,
    enabled: !!expandedFile && !!commit,
  })

  // Scroll to selected file in patch mode
  useEffect(() => {
    if (selectedFile && !expandedFile) {
      const fileElement = fileRefs.current.get(selectedFile)
      if (fileElement) {
        fileElement.scrollIntoView({ behavior: 'instant', block: 'start' })
      }
    }
  }, [selectedFile, expandedFile])

  const filesToShow = useMemo(() => {
    if (!commit) return []
    // In expanded mode, show only the expanded file
    if (expandedFile) {
      return commit.changes.filter((change) => change.fileName === expandedFile)
    }
    // In patch mode, always show all files
    return commit.changes
  }, [expandedFile, commit])

  if (!commit) {
    return (
      <div
        className={css({
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#71717a',
        })}
      >
        No commit selected
      </div>
    )
  }

  return (
    <div
      className={css({
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        backgroundColor: '#09090b',
        overflow: 'hidden',
      })}
    >
      {/* Show expand button if sidebar collapsed */}
      {sidebarCollapsed && (
        <button
          type="button"
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
      <div
        className={css({
          flex: 1,
          overflowY: 'auto',
          padding: '16px',
        })}
      >
        {filesToShow.map((fileChange) => {
          const isCollapsed = collapsedFiles.includes(fileChange.fileName)
          const isSelected = selectedFile === fileChange.fileName

          return (
            <div
              key={fileChange.fileName}
              ref={(el) => {
                if (el) {
                  fileRefs.current.set(fileChange.fileName, el)
                } else {
                  fileRefs.current.delete(fileChange.fileName)
                }
              }}
              className={css({
                marginBottom: '16px',
                border:
                  isSelected && !expandedFile ? '1px solid #10b981' : '1px solid #27272a',
                backgroundColor: '#18181b',
              })}
            >
              {/* File Header */}
              {/* biome-ignore lint/a11y/noStaticElementInteractions: Conditional click handler with proper role and keyboard support */}
              <div
                role={expandedFile === fileChange.fileName ? 'button' : 'presentation'}
                tabIndex={expandedFile === fileChange.fileName ? 0 : -1}
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  backgroundColor: '#27272a',
                  borderBottom: isCollapsed ? 'none' : '1px solid #3f3f46',
                  cursor: expandedFile === fileChange.fileName ? 'pointer' : 'default',
                  ':hover':
                    expandedFile === fileChange.fileName
                      ? {
                          backgroundColor: '#3f3f46',
                        }
                      : {},
                })}
                onClick={() => {
                  if (expandedFile === fileChange.fileName) {
                    onToggleExpand(null)
                  }
                }}
                onKeyDown={(e) => {
                  if (
                    expandedFile === fileChange.fileName &&
                    (e.key === 'Enter' || e.key === ' ')
                  ) {
                    e.preventDefault()
                    onToggleExpand(null)
                  }
                }}
              >
                {/* Collapse/Expand button - hidden in expanded view */}
                {expandedFile !== fileChange.fileName && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleFileCollapse(fileChange.fileName)
                    }}
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
                    <span className={css({ fontWeight: 600 })}>
                      {fileChange.fileName}
                    </span>
                    <ChangeTypeBadge changeType={fileChange.changeType} />
                  </button>
                )}
                {/* In expanded view, show file name - entire bar is clickable */}
                {expandedFile === fileChange.fileName && (
                  <div
                    className={css({
                      flex: 1,
                      display: 'flex',
                      alignItems: 'center',
                      padding: '12px',
                      gap: '8px',
                      fontSize: '13px',
                      fontFamily: 'inherit',
                    })}
                  >
                    <span className={css({ fontWeight: 600, color: '#fafafa' })}>
                      {fileChange.fileName}
                    </span>
                    <ChangeTypeBadge changeType={fileChange.changeType} />
                  </div>
                )}
                {/* Expand/Minimize button */}
                {expandedFile !== fileChange.fileName && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onToggleExpand(fileChange.fileName)
                    }}
                    className={css({
                      padding: '12px',
                      backgroundColor: 'transparent',
                      border: 'none',
                      color: '#71717a',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      ':hover': {
                        backgroundColor: '#3f3f46',
                        color: '#a78bfa',
                      },
                    })}
                    title="View file in fullscreen"
                  >
                    <Maximize2 size={16} />
                  </button>
                )}
                {/* In expanded view, show minimize icon as visual indicator */}
                {expandedFile === fileChange.fileName && (
                  <div
                    className={css({
                      padding: '12px',
                      color: '#a78bfa',
                      display: 'flex',
                      alignItems: 'center',
                    })}
                  >
                    <Minimize2 size={16} />
                  </div>
                )}
              </div>

              {/* Diff Content */}
              {!isCollapsed && (
                <div
                  className={css({
                    padding: '16px',
                  })}
                >
                  {expandedFile === fileChange.fileName ? (
                    fileContentLoading ? (
                      <div
                        className={css({
                          padding: '48px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '16px',
                          color: '#71717a',
                        })}
                      >
                        <Loader2
                          className={css({ animation: 'spin 1s linear infinite' })}
                          size={32}
                        />
                        <span>Loading file content...</span>
                      </div>
                    ) : fileContentError ? (
                      <div
                        className={css({
                          padding: '24px',
                          textAlign: 'center',
                          color: '#f87171',
                          backgroundColor: '#450a0a',
                          border: '1px solid #991b1b',
                        })}
                      >
                        Failed to load file content: {String(fileContentError)}
                      </div>
                    ) : fileContent?.content ? (
                      <EditorView
                        fileName={fileChange.fileName}
                        fileContent={fileContent.content}
                        hunks={fileChange.hunks}
                        deletedFile={fileContent.deletedInCommit}
                      />
                    ) : (
                      <div
                        className={css({
                          padding: '24px',
                          textAlign: 'center',
                          color: '#71717a',
                        })}
                      >
                        Full file content not available
                      </div>
                    )
                  ) : (
                    <PatchView hunks={fileChange.hunks} />
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
