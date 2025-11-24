import { useStyletron } from 'baseui'
import { Check, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { api } from '../api/client'
import type { RestackLine, RestackCommit } from '../types'
import type { StackCommit } from '../types'
import { useBranchContext } from '../contexts/BranchContext'

// Type for a selectable line from a commit's diff
type SelectableLine = {
  id: string // unique ID: commitHash-fileId-hunkId-line-index
  commitHash: string
  commitMessage: string // for display
  fileId: string
  fileName: string
  hunkId: string
  lineNumber: number // line number within the diff content
  content: string
  lineType: 'add' | 'delete' | 'context'
  selected: boolean
}

// Type for a new commit being constructed
type NewCommit = {
  id: string
  message: string
  lineIds: string[] // IDs of lines assigned to this commit
}

type RestackPanelProps = {
  selectedCommits: StackCommit[]
  onExit: () => void
}

export const RestackPanel = ({ selectedCommits, onExit }: RestackPanelProps) => {
  const [css] = useStyletron()
  const { baseBranch } = useBranchContext()

  // Parse all selected commits into individual selectable lines
  const allLines = useMemo(() => {
    const lines: SelectableLine[] = []

    for (const commit of selectedCommits) {
      for (const fileChange of commit.changes) {
        for (const hunk of fileChange.hunks) {
          // Split hunk content into individual lines
          const hunkLines = hunk.content.split('\n')

          hunkLines.forEach((line, index) => {
            if (!line) return // Skip empty lines

            let lineType: 'add' | 'delete' | 'context' = 'context'
            if (line.startsWith('+')) {
              lineType = 'add'
            } else if (line.startsWith('-')) {
              lineType = 'delete'
            }

            // Only include add/delete lines (skip context lines)
            if (lineType !== 'context') {
              lines.push({
                id: `${commit.commit.hash}-${fileChange.id}-${hunk.id}-line-${index}`,
                commitHash: commit.commit.hash,
                commitMessage: commit.commit.message,
                fileId: fileChange.id,
                fileName: fileChange.fileName,
                hunkId: hunk.id,
                lineNumber: index,
                content: line,
                lineType,
                selected: false,
              })
            }
          })
        }
      }
    }

    return lines
  }, [selectedCommits])

  // State for line selections and new commits
  const [lines, setLines] = useState<SelectableLine[]>(allLines)
  const [newCommits, setNewCommits] = useState<NewCommit[]>([])
  const [showCommitDialog, setShowCommitDialog] = useState(false)
  const [newCommitMessage, setNewCommitMessage] = useState('')
  const [isRestacking, setIsRestacking] = useState(false)
  const [restackError, setRestackError] = useState<string | null>(null)

  // Toggle line selection
  const toggleLineSelection = (lineId: string) => {
    setLines((prev) =>
      prev.map((line) => (line.id === lineId ? { ...line, selected: !line.selected } : line))
    )
  }

  // Select all visible lines
  const selectAllLines = () => {
    setLines((prev) => prev.map((line) => ({ ...line, selected: true })))
  }

  // Get selected lines
  const selectedLines = lines.filter((line) => line.selected)

  // Add selected lines to a new commit
  const handleAddToCommit = () => {
    if (selectedLines.length === 0) return

    if (newCommitMessage.trim()) {
      // Create new commit with selected lines
      const newCommit: NewCommit = {
        id: `commit-${Date.now()}`,
        message: newCommitMessage.trim(),
        lineIds: selectedLines.map((line) => line.id),
      }

      setNewCommits((prev) => [...prev, newCommit])

      // Remove assigned lines from the available pool
      setLines((prev) => prev.filter((line) => !line.selected))

      // Reset
      setNewCommitMessage('')
      setShowCommitDialog(false)
    } else {
      // Show dialog to get commit message
      setShowCommitDialog(true)
    }
  }

  const handleCreateCommitWithMessage = () => {
    if (!newCommitMessage.trim()) return
    handleAddToCommit()
  }

  // Count lines by file for display
  const fileGroups = useMemo(() => {
    const groups = new Map<string, SelectableLine[]>()

    for (const line of lines) {
      const existing = groups.get(line.fileName) || []
      existing.push(line)
      groups.set(line.fileName, existing)
    }

    return groups
  }, [lines])

  return (
    <div
      className={css({
        display: 'flex',
        flex: 1,
        overflow: 'hidden',
      })}
    >
      {/* Left side: Selectable lines */}
      <div
        className={css({
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          borderRight: '1px solid #27272a',
          backgroundColor: '#09090b',
        })}
      >
        {/* Header */}
        <div
          className={css({
            padding: '12px 16px',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          })}
        >
          <div>
            <div
              className={css({
                fontSize: '14px',
                fontWeight: 600,
                color: '#fafafa',
                marginBottom: '4px',
              })}
            >
              Select Lines to Restack
            </div>
            <div
              className={css({
                fontSize: '12px',
                color: '#71717a',
              })}
            >
              {lines.length} lines remaining · {selectedLines.length} selected
            </div>
          </div>

          <div
            className={css({
              display: 'flex',
              gap: '8px',
            })}
          >
            <button
              type="button"
              onClick={selectAllLines}
              className={css({
                padding: '6px 12px',
                backgroundColor: '#27272a',
                border: 'none',
                borderRadius: '4px',
                color: '#fafafa',
                fontSize: '12px',
                cursor: 'pointer',
                ':hover': {
                  backgroundColor: '#3f3f46',
                },
              })}
            >
              Select All
            </button>

            <button
              type="button"
              onClick={handleAddToCommit}
              disabled={selectedLines.length === 0}
              className={css({
                padding: '6px 12px',
                backgroundColor: selectedLines.length > 0 ? '#7c3aed' : '#27272a',
                border: 'none',
                borderRadius: '4px',
                color: selectedLines.length > 0 ? '#fafafa' : '#71717a',
                fontSize: '12px',
                fontWeight: 500,
                cursor: selectedLines.length > 0 ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                ':hover': {
                  backgroundColor: selectedLines.length > 0 ? '#6d28d9' : '#27272a',
                },
              })}
            >
              <Plus size={14} />
              Add to Commit
            </button>
          </div>
        </div>

        {/* Lines list */}
        <div
          className={css({
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
          })}
        >
          {Array.from(fileGroups.entries()).map(([fileName, fileLines]) => (
            <div
              key={fileName}
              className={css({
                marginBottom: '16px',
              })}
            >
              {/* File header */}
              <div
                className={css({
                  fontSize: '12px',
                  fontWeight: 600,
                  color: '#a1a1aa',
                  padding: '8px 12px',
                  backgroundColor: '#18181b',
                  borderRadius: '4px',
                  marginBottom: '4px',
                })}
              >
                {fileName}
              </div>

              {/* Lines */}
              {fileLines.map((line) => (
                <button
                  key={line.id}
                  type="button"
                  onClick={() => toggleLineSelection(line.id)}
                  className={css({
                    width: '100%',
                    textAlign: 'left',
                    padding: '6px 12px',
                    backgroundColor: line.selected ? '#7c3aed22' : 'transparent',
                    border: line.selected ? '1px solid #7c3aed' : '1px solid transparent',
                    borderRadius: '3px',
                    cursor: 'pointer',
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '2px',
                    color: line.lineType === 'add' ? '#86efac' : '#fca5a5',
                    ':hover': {
                      backgroundColor: line.selected ? '#7c3aed33' : '#27272a',
                    },
                  })}
                >
                  {/* Checkbox indicator */}
                  <div
                    className={css({
                      width: '16px',
                      height: '16px',
                      borderRadius: '3px',
                      border: '2px solid',
                      borderColor: line.selected ? '#7c3aed' : '#52525b',
                      backgroundColor: line.selected ? '#7c3aed' : 'transparent',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    })}
                  >
                    {line.selected && <Check size={12} color="#fff" />}
                  </div>

                  {/* Line content */}
                  <span
                    className={css({
                      flex: 1,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    })}
                  >
                    {line.content}
                  </span>
                </button>
              ))}
            </div>
          ))}

          {lines.length === 0 && (
            <div
              className={css({
                textAlign: 'center',
                padding: '48px 16px',
                color: '#71717a',
                fontSize: '14px',
              })}
            >
              All lines have been assigned to commits!
            </div>
          )}
        </div>
      </div>

      {/* Right side: New commit sequence */}
      <div
        className={css({
          width: '320px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#18181b',
        })}
      >
        {/* Header */}
        <div
          className={css({
            padding: '12px 16px',
            borderBottom: '1px solid #27272a',
          })}
        >
          <div
            className={css({
              fontSize: '14px',
              fontWeight: 600,
              color: '#fafafa',
              marginBottom: '4px',
            })}
          >
            New Commit Sequence
          </div>
          <div
            className={css({
              fontSize: '12px',
              color: '#71717a',
            })}
          >
            {newCommits.length} commit{newCommits.length !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Commits list */}
        <div
          className={css({
            flex: 1,
            overflowY: 'auto',
            padding: '8px',
          })}
        >
          {newCommits.map((commit, index) => (
            <div
              key={commit.id}
              className={css({
                padding: '12px',
                backgroundColor: '#27272a',
                borderRadius: '4px',
                marginBottom: '8px',
              })}
            >
              <div
                className={css({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  marginBottom: '8px',
                })}
              >
                <div
                  className={css({
                    width: '20px',
                    height: '20px',
                    borderRadius: '10px',
                    backgroundColor: '#7c3aed',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '11px',
                    fontWeight: 600,
                  })}
                >
                  {index + 1}
                </div>
                <div
                  className={css({
                    fontSize: '13px',
                    color: '#fafafa',
                    fontWeight: 500,
                    flex: 1,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  })}
                >
                  {commit.message}
                </div>
              </div>
              <div
                className={css({
                  fontSize: '11px',
                  color: '#71717a',
                })}
              >
                {commit.lineIds.length} line{commit.lineIds.length !== 1 ? 's' : ''}
              </div>
            </div>
          ))}

          {newCommits.length === 0 && (
            <div
              className={css({
                textAlign: 'center',
                padding: '48px 16px',
                color: '#71717a',
                fontSize: '12px',
              })}
            >
              No commits created yet.
              <br />
              Select lines and click "Add to Commit"
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          className={css({
            padding: '12px 16px',
            borderTop: '1px solid #27272a',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          })}
        >
          {/* Error display */}
          {restackError && (
            <div
              className={css({
                padding: '8px 12px',
                backgroundColor: '#450a0a',
                border: '1px solid #991b1b',
                borderRadius: '4px',
                color: '#fca5a5',
                fontSize: '12px',
              })}
            >
              {restackError}
            </div>
          )}

          <button
            type="button"
            onClick={async () => {
              if (!baseBranch) {
                setRestackError('No base branch selected')
                return
              }

              setIsRestacking(true)
              setRestackError(null)

              try {
                // Convert our local types to API types
                const apiLines: RestackLine[] = allLines.map((line) => ({
                  id: line.id,
                  commitHash: line.commitHash,
                  fileName: line.fileName,
                  content: line.content,
                  lineType: line.lineType as 'add' | 'delete',
                }))

                const apiCommits: RestackCommit[] = newCommits.map((commit) => ({
                  message: commit.message,
                  lineIds: commit.lineIds,
                }))

                await api.applyRestack({
                  baseBranch,
                  selectedCommitHashes: selectedCommits.map((c) => c.commit.hash),
                  newCommits: apiCommits,
                  allLines: apiLines,
                })

                // Success! Exit edit mode
                onExit()
              } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to apply restack'
                setRestackError(message)
              } finally {
                setIsRestacking(false)
              }
            }}
            disabled={newCommits.length === 0 || lines.length > 0 || isRestacking}
            className={css({
              padding: '8px 16px',
              backgroundColor:
                newCommits.length > 0 && lines.length === 0 && !isRestacking
                  ? '#10b981'
                  : '#27272a',
              border: 'none',
              borderRadius: '4px',
              color:
                newCommits.length > 0 && lines.length === 0 && !isRestacking
                  ? '#fff'
                  : '#71717a',
              fontSize: '13px',
              fontWeight: 600,
              cursor:
                newCommits.length > 0 && lines.length === 0 && !isRestacking
                  ? 'pointer'
                  : 'not-allowed',
              ':hover': {
                backgroundColor:
                  newCommits.length > 0 && lines.length === 0 && !isRestacking
                    ? '#059669'
                    : '#27272a',
              },
            })}
          >
            {isRestacking ? 'Restacking...' : 'Finish Restack'}
          </button>

          <button
            type="button"
            onClick={onExit}
            className={css({
              padding: '8px 16px',
              backgroundColor: 'transparent',
              border: '1px solid #27272a',
              borderRadius: '4px',
              color: '#a1a1aa',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              ':hover': {
                backgroundColor: '#27272a',
              },
            })}
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Commit message dialog */}
      {showCommitDialog && (
        <div
          className={css({
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          })}
          onClick={() => setShowCommitDialog(false)}
        >
          <div
            className={css({
              backgroundColor: '#18181b',
              border: '1px solid #27272a',
              borderRadius: '8px',
              padding: '24px',
              width: '500px',
              maxWidth: '90vw',
            })}
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              className={css({
                fontSize: '16px',
                fontWeight: 600,
                color: '#fafafa',
                marginBottom: '16px',
              })}
            >
              Create New Commit
            </h3>

            <div
              className={css({
                marginBottom: '16px',
              })}
            >
              <label
                className={css({
                  display: 'block',
                  fontSize: '12px',
                  fontWeight: 500,
                  color: '#a1a1aa',
                  marginBottom: '8px',
                })}
              >
                Commit message
              </label>
              <input
                type="text"
                value={newCommitMessage}
                onChange={(e) => setNewCommitMessage(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleCreateCommitWithMessage()
                  }
                }}
                placeholder="Enter commit message..."
                autoFocus
                className={css({
                  width: '100%',
                  padding: '8px 12px',
                  backgroundColor: '#09090b',
                  border: '1px solid #27272a',
                  borderRadius: '4px',
                  color: '#fafafa',
                  fontSize: '13px',
                  outline: 'none',
                  ':focus': {
                    border: '1px solid #7c3aed',
                  },
                })}
              />
            </div>

            <div
              className={css({
                fontSize: '12px',
                color: '#71717a',
                marginBottom: '16px',
              })}
            >
              {selectedLines.length} line{selectedLines.length !== 1 ? 's' : ''} selected
            </div>

            <div
              className={css({
                display: 'flex',
                gap: '8px',
                justifyContent: 'flex-end',
              })}
            >
              <button
                type="button"
                onClick={() => setShowCommitDialog(false)}
                className={css({
                  padding: '8px 16px',
                  backgroundColor: 'transparent',
                  border: '1px solid #27272a',
                  borderRadius: '4px',
                  color: '#a1a1aa',
                  fontSize: '13px',
                  cursor: 'pointer',
                  ':hover': {
                    backgroundColor: '#27272a',
                  },
                })}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCreateCommitWithMessage}
                disabled={!newCommitMessage.trim()}
                className={css({
                  padding: '8px 16px',
                  backgroundColor: newCommitMessage.trim() ? '#7c3aed' : '#27272a',
                  border: 'none',
                  borderRadius: '4px',
                  color: newCommitMessage.trim() ? '#fff' : '#71717a',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: newCommitMessage.trim() ? 'pointer' : 'not-allowed',
                  ':hover': {
                    backgroundColor: newCommitMessage.trim() ? '#6d28d9' : '#27272a',
                  },
                })}
              >
                Create Commit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
