import { useMemo } from 'react'
import { useStyletron } from 'baseui'
import type { Hunk } from '../types'
import Editor from '@monaco-editor/react'

type UnifiedFileViewProps = {
  fileName: string
  fileContent: string
  hunks: Hunk[]
}

// Build a unified view with both additions and deletions
const buildUnifiedView = (fileContent: string, hunks: Hunk[]): { content: string; decorations: any[] } => {
  const decorations: any[] = []

  // Track which lines are added
  const addedLines = new Set<number>()

  // Process hunks to find additions
  for (const hunk of hunks) {
    const hunkLines = hunk.content.split('\n')
    let currentNewLine = hunk.newStart

    for (const line of hunkLines) {
      if (line.startsWith('@@')) continue

      if (line.startsWith('+')) {
        // Addition
        addedLines.add(currentNewLine)
        currentNewLine++
      } else if (line.startsWith(' ')) {
        // Context line
        currentNewLine++
      }
      // Deletions are not in the current file, so we skip them
    }
  }

  // Add decorations for added lines
  addedLines.forEach(lineNum => {
    decorations.push({
      range: {
        startLineNumber: lineNum,
        startColumn: 1,
        endLineNumber: lineNum,
        endColumn: 1,
      },
      options: {
        isWholeLine: true,
        className: 'added-line',
        glyphMarginClassName: 'added-glyph',
        glyphMarginHoverMessage: { value: 'Added line' },
      },
    })
  })

  return {
    content: fileContent,
    decorations,
  }
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
    md: 'markdown',
    sh: 'shell',
    bash: 'shell',
    py: 'python',
    go: 'go',
    rs: 'rust',
    java: 'java',
  }
  return langMap[ext || ''] || 'typescript'
}

export const UnifiedFileView = ({ fileName, fileContent, hunks }: UnifiedFileViewProps) => {
  const [css] = useStyletron()

  const { content, decorations } = useMemo(() => {
    return buildUnifiedView(fileContent, hunks)
  }, [fileContent, hunks])

  const language = getLanguageFromFileName(fileName)

  return (
    <div className={css({
      fontFamily: 'monospace',
      fontSize: '12px',
      lineHeight: '1.5',
      backgroundColor: '#18181b',
      overflow: 'auto',
      height: '100%',
    })}>
      <style>{`
        .added-line {
          background-color: #052e16 !important;
        }
        .added-glyph {
          background-color: #10b981 !important;
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
