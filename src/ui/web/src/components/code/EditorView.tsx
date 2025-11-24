import { useMemo } from 'react'
import { useStyletron } from 'baseui'
import type { Hunk } from '../../types'
import Editor from '@monaco-editor/react'

type EditorViewProps = {
  fileName: string
  fileContent: string
  hunks: Hunk[]
  height?: string
  deletedFile?: boolean
}

// Build unified diff content with both additions and deletions
const buildUnifiedDiff = (fileContent: string, hunks: Hunk[]): { content: string; decorations: any[] } => {
  if (!fileContent) {
    return { content: '', decorations: [] }
  }
  const fileLines = fileContent.split('\n')
  const result: string[] = []
  const decorations: any[] = []

  // Sort hunks by starting position
  const sortedHunks = [...hunks].sort((a, b) => a.newStart - b.newStart)

  let fileLineIndex = 0
  let displayLineNumber = 1

  for (const hunk of sortedHunks) {
    // Add unchanged lines before this hunk
    const linesBeforeHunk = hunk.newStart - 1
    while (fileLineIndex < linesBeforeHunk && fileLineIndex < fileLines.length) {
      result.push(fileLines[fileLineIndex])
      fileLineIndex++
      displayLineNumber++
    }

    // Process hunk lines
    const hunkLines = hunk.content.split('\n').filter(line => !line.startsWith('@@'))

    for (const line of hunkLines) {
      if (line.startsWith('-')) {
        // Deleted line
        result.push(line.substring(1)) // Remove the '-' prefix
        decorations.push({
          range: {
            startLineNumber: displayLineNumber,
            startColumn: 1,
            endLineNumber: displayLineNumber,
            endColumn: 1000,
          },
          options: {
            isWholeLine: true,
            className: 'deleted-line',
            glyphMarginClassName: 'deleted-glyph',
          },
        })
        displayLineNumber++
      } else if (line.startsWith('+')) {
        // Added line
        result.push(line.substring(1)) // Remove the '+' prefix
        decorations.push({
          range: {
            startLineNumber: displayLineNumber,
            startColumn: 1,
            endLineNumber: displayLineNumber,
            endColumn: 1000,
          },
          options: {
            isWholeLine: true,
            className: 'added-line',
            glyphMarginClassName: 'added-glyph',
          },
        })
        displayLineNumber++
        fileLineIndex++ // Added lines consume from the file
      } else if (line.startsWith(' ')) {
        // Unchanged line in hunk
        result.push(line.substring(1))
        displayLineNumber++
        fileLineIndex++
      }
    }
  }

  // Add remaining unchanged lines after last hunk
  while (fileLineIndex < fileLines.length) {
    result.push(fileLines[fileLineIndex])
    fileLineIndex++
    displayLineNumber++
  }

  const content = result.join('\n')
  return { content, decorations }
}

const getLanguageFromFileName = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    css: 'css',
    scss: 'scss',
    md: 'markdown',
    sh: 'shell',
    bash: 'shell',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
  }
  return langMap[ext || ''] || 'typescript'
}

export const EditorView = ({ fileName, fileContent, hunks, deletedFile = false }: EditorViewProps) => {
  const [css] = useStyletron()

  const { content, decorations } = useMemo(() => {
    return buildUnifiedDiff(fileContent, hunks)
  }, [fileContent, hunks])

  const language = getLanguageFromFileName(fileName)

  return (
    <div className={css({
      fontFamily: 'monospace',
      fontSize: '12px',
      lineHeight: '1.5',
      backgroundColor: '#18181b',
      height: 'calc(83vh)',
      maxHeight: 'calc(83vh)',
      position: 'relative',
    })}>
      {deletedFile && (
        <div className={css({
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(127, 29, 29, 0.15)',
          pointerEvents: 'none',
          zIndex: 1,
          border: '2px solid rgba(239, 68, 68, 0.3)',
        })} />
      )}
      <style>{`
        .added-line {
          background-color: #052e16 !important;
        }
        .added-glyph {
          background-color: #10b981 !important;
          width: 3px !important;
        }
        .deleted-line {
          background-color: #450a0a !important;
          opacity: 0.7;
          text-decoration: line-through;
        }
        .deleted-glyph {
          background-color: #ef4444 !important;
          width: 3px !important;
        }
      `}</style>
      <Editor
        height="100%"
        language={language}
        value={content}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: 'on',
          folding: false,
          glyphMargin: true,
          lineDecorationsWidth: 0,
          lineNumbersMinChars: 3,
          renderLineHighlight: 'none',
          scrollbar: {
            vertical: 'auto',
            horizontal: 'auto',
          },
          overviewRulerLanes: 0,
          hideCursorInOverviewRuler: true,
          overviewRulerBorder: false,
          fontSize: 13,
          fontFamily: "'Monaco', 'Menlo', 'Consolas', monospace",
          automaticLayout: true,
        }}
        onMount={(editor) => {
          if (decorations.length > 0) {
            editor.createDecorationsCollection(decorations)
          }
        }}
      />
    </div>
  )
}
