import { useStyletron } from 'baseui'
import { ChevronLeft, File } from 'lucide-react'
import type { StackCommit } from '../types'

type FileTreeSidebarProps = {
  commit: StackCommit | undefined
  selectedFile: string | null
  onSelectFile: (file: string) => void
  onCollapse: () => void
}

export const FileTreeSidebar = ({
  commit,
  selectedFile,
  onSelectFile,
  onCollapse,
}: FileTreeSidebarProps) => {
  const [css] = useStyletron()

  if (!commit) {
    return null
  }

  const files = commit.commit.filesChanged || []

  return (
    <div className={css({
      width: '250px',
      borderRight: '1px solid #27272a',
      backgroundColor: '#18181b',
      display: 'flex',
      flexDirection: 'column',
    })}>
      {/* Header */}
      <div className={css({
        padding: '12px',
        borderBottom: '1px solid #27272a',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      })}>
        <span className={css({
          fontSize: '12px',
          color: '#a1a1aa',
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        })}>
          Files Changed
        </span>
        <button
          onClick={onCollapse}
          className={css({
            backgroundColor: 'transparent',
            border: 'none',
            color: '#71717a',
            cursor: 'pointer',
            padding: '4px',
            display: 'flex',
            alignItems: 'center',
            ':hover': {
              color: '#a1a1aa',
            },
          })}
        >
          <ChevronLeft size={16} />
        </button>
      </div>

      {/* File List */}
      <div className={css({
        flex: 1,
        overflowY: 'auto',
      })}>
        {files.map((file) => (
          <button
            key={file}
            onClick={() => onSelectFile(file)}
            className={css({
              width: '100%',
              textAlign: 'left',
              padding: '8px 12px',
              backgroundColor: selectedFile === file ? '#27272a' : 'transparent',
              border: 'none',
              color: selectedFile === file ? '#fafafa' : '#a1a1aa',
              fontSize: '12px',
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderLeft: selectedFile === file ? '2px solid #10b981' : '2px solid transparent',
              ':hover': {
                backgroundColor: '#27272a',
                color: '#fafafa',
              },
            })}
          >
            <File size={14} />
            <span className={css({
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            })}>
              {file}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
