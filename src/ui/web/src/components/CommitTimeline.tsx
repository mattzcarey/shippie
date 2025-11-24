import { useStyletron } from 'baseui'
import { GitCommit } from 'lucide-react'
import type { StackCommit } from '../types'

type CommitTimelineProps = {
  commits: StackCommit[]
  selectedCommit: string | null
  onSelectCommit: (hash: string) => void
}

export const CommitTimeline = ({
  commits,
  selectedCommit,
  onSelectCommit,
}: CommitTimelineProps) => {
  const [css] = useStyletron()

  return (
    <div className={css({
      width: '280px',
      borderLeft: '1px solid #27272a',
      backgroundColor: '#18181b',
      display: 'flex',
      flexDirection: 'column',
    })}>
      {/* Header */}
      <div className={css({
        padding: '12px',
        borderBottom: '1px solid #27272a',
      })}>
        <span className={css({
          fontSize: '12px',
          color: '#a1a1aa',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        })}>
          Commit Timeline
        </span>
      </div>

      {/* Commit List */}
      <div className={css({
        flex: 1,
        overflowY: 'auto',
      })}>
        {commits.map((commit) => {
          const isSelected = selectedCommit === commit.commit.hash

          return (
            <div key={commit.commit.hash}>
              <button
                onClick={() => onSelectCommit(commit.commit.hash)}
                className={css({
                  width: '100%',
                  textAlign: 'left',
                  padding: '12px',
                  backgroundColor: isSelected ? '#27272a' : 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  position: 'relative',
                  fontFamily: 'inherit',
                  ':hover': {
                    backgroundColor: '#27272a',
                  },
                })}
              >

                <div className={css({
                  display: 'flex',
                  gap: '12px',
                })}>
                  {/* Commit dot */}
                  <div className={css({
                    position: 'relative',
                    zIndex: 1,
                  })}>
                    <GitCommit
                      size={16}
                      className={css({
                        color: isSelected ? '#10b981' : '#71717a',
                      })}
                    />
                  </div>

                  {/* Commit info */}
                  <div className={css({
                    flex: 1,
                    minWidth: 0,
                  })}>
                    {/* Commit message */}
                    <div className={css({
                      fontSize: '13px',
                      color: isSelected ? '#fafafa' : '#a1a1aa',
                      marginBottom: '4px',
                      fontWeight: 500,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    })}>
                      {commit.commit.message}
                    </div>

                    {/* Commit meta */}
                    <div className={css({
                      fontSize: '11px',
                      color: '#71717a',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    })}>
                      <span>{commit.commit.shortHash}</span>
                      <span>·</span>
                      <span>{commit.commit.author.split(' ')[0]}</span>
                    </div>

                    {/* Date */}
                    <div className={css({
                      fontSize: '11px',
                      color: '#52525b',
                      marginTop: '2px',
                    })}>
                      {commit.commit.date}
                    </div>
                  </div>
                </div>
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )
}
