import { useStyletron } from 'baseui'
import type { Hunk } from '../../types'

type PatchViewProps = {
  hunks: Hunk[]
}

export const PatchView = ({ hunks }: PatchViewProps) => {
  const [css] = useStyletron()

  return (
    <div>
      {hunks.map((hunk) => (
        <div
          key={hunk.id}
          className={css({
            marginBottom: '16px',
          })}
        >
          {/* Hunk Header */}
          <div
            className={css({
              padding: '8px 12px',
              backgroundColor: '#27272a',
              color: '#71717a',
              fontSize: '12px',
              fontFamily: 'monospace',
              borderBottom: '1px solid #3f3f46',
            })}
          >
            {hunk.header}
          </div>

          {/* Hunk Content - Side by side */}
          <div
            className={css({
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              fontSize: '12px',
              fontFamily: 'monospace',
            })}
          >
            {/* Left side - deletions */}
            <div
              className={css({
                borderRight: '1px solid #3f3f46',
                backgroundColor: '#18181b',
              })}
            >
              {hunk.content
                .split('\n')
                .map((line, i) => {
                  if (line.startsWith('@@')) {
                    return null
                  }
                  if (line.startsWith('-')) {
                    return (
                      <div
                        key={`${hunk.id}-del-${i}`}
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
                  }
                  if (line.startsWith(' ')) {
                    return (
                      <div
                        key={`${hunk.id}-ctx-${i}`}
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
                })
                .filter(Boolean)}
            </div>

            {/* Right side - additions */}
            <div
              className={css({
                backgroundColor: '#18181b',
              })}
            >
              {hunk.content
                .split('\n')
                .map((line, i) => {
                  if (line.startsWith('@@')) {
                    return null
                  }
                  if (line.startsWith('+')) {
                    return (
                      <div
                        key={`${hunk.id}-add-${i}`}
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
                  }
                  if (line.startsWith(' ')) {
                    return (
                      <div
                        key={`${hunk.id}-ctx2-${i}`}
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
                })
                .filter(Boolean)}
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
