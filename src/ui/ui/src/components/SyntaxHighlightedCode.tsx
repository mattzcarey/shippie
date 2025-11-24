import { useStyletron } from 'baseui'
import Editor from '@monaco-editor/react'

type SyntaxHighlightedCodeProps = {
  code: string
  fileName: string
  showLineNumbers?: boolean
  diffLines?: {
    added: Set<number>
    removed: Set<number>
  }
}

// Detect language from file extension
const getLanguageFromFileName = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase()

  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    css: 'css',
    scss: 'scss',
    sh: 'shell',
    bash: 'shell',
    py: 'python',
    yml: 'yaml',
    yaml: 'yaml',
    md: 'markdown',
    go: 'go',
    rs: 'rust',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
  }

  return languageMap[ext || ''] || 'typescript'
}

export const SyntaxHighlightedCode = ({
  code,
  fileName,
  showLineNumbers = true,
  diffLines,
}: SyntaxHighlightedCodeProps) => {
  const [css] = useStyletron()
  const language = getLanguageFromFileName(fileName)

  // Calculate decorations for added/removed lines
  const decorations: Array<{
    range: {
      startLineNumber: number
      startColumn: number
      endLineNumber: number
      endColumn: number
    }
    options: {
      isWholeLine: boolean
      className: string
      glyphMarginClassName: string
    }
  }> = []
  if (diffLines) {
    for (const lineNum of diffLines.added) {
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
        },
      })
    }
    for (const lineNum of diffLines.removed) {
      decorations.push({
        range: {
          startLineNumber: lineNum,
          startColumn: 1,
          endLineNumber: lineNum,
          endColumn: 1,
        },
        options: {
          isWholeLine: true,
          className: 'removed-line',
          glyphMarginClassName: 'removed-glyph',
        },
      })
    }
  }

  return (
    <div className={css({
      borderRadius: '4px',
      overflow: 'hidden',
      border: '1px solid #3f3f46',
    })}>
      <style>{`
        .added-line {
          background-color: #052e16 !important;
        }
        .removed-line {
          background-color: #450a0a !important;
        }
        .added-glyph {
          background-color: #10b981 !important;
        }
        .removed-glyph {
          background-color: #ef4444 !important;
        }
      `}</style>
      <Editor
        height="600px"
        language={language}
        value={code}
        theme="vs-dark"
        options={{
          readOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          lineNumbers: showLineNumbers ? 'on' : 'off',
          folding: false,
          glyphMargin: diffLines ? true : false,
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
