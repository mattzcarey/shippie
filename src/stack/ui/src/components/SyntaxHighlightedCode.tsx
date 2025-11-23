import { useEffect, useRef } from 'react'
import { useStyletron } from 'baseui'
import Prism from 'prismjs'
import 'prismjs/themes/prism-tomorrow.css'

// Import common language support
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-scss'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'

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
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
    json: 'json',
    css: 'css',
    scss: 'scss',
    sh: 'bash',
    bash: 'bash',
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
  const codeRef = useRef<HTMLElement>(null)
  const language = getLanguageFromFileName(fileName)

  useEffect(() => {
    if (codeRef.current) {
      Prism.highlightElement(codeRef.current)
    }
  }, [code, language])

  const lines = code.split('\n')

  return (
    <div className={css({
      backgroundColor: '#1d1f21',
      borderRadius: '4px',
      overflow: 'hidden',
      border: '1px solid #3f3f46',
    })}>
      <div className={css({
        display: 'grid',
        gridTemplateColumns: showLineNumbers ? 'auto 1fr' : '1fr',
        fontSize: '12px',
        fontFamily: 'monospace',
      })}>
        {/* Line numbers */}
        {showLineNumbers && (
          <div className={css({
            backgroundColor: '#27272a',
            borderRight: '1px solid #3f3f46',
            padding: '12px 16px 12px 12px',
            textAlign: 'right',
            color: '#52525b',
            userSelect: 'none',
            lineHeight: '1.5',
          })}>
            {lines.map((_, i) => {
              const lineNum = i + 1
              const isAdded = diffLines?.added.has(lineNum)
              const isRemoved = diffLines?.removed.has(lineNum)

              return (
                <div
                  key={i}
                  className={css({
                    backgroundColor: isAdded ? '#052e16' : isRemoved ? '#450a0a' : 'transparent',
                    color: isAdded ? '#86efac' : isRemoved ? '#fca5a5' : '#52525b',
                  })}
                >
                  {lineNum}
                </div>
              )
            })}
          </div>
        )}

        {/* Code content with syntax highlighting */}
        <pre className={css({
          margin: 0,
          padding: '12px',
          fontSize: '12px',
          fontFamily: 'monospace',
          overflowX: 'auto',
          lineHeight: '1.5',
          backgroundColor: 'transparent',
        })}>
          <code
            ref={codeRef}
            className={`language-${language}`}
            style={{
              backgroundColor: 'transparent',
            }}
          >
            {code}
          </code>
        </pre>
      </div>
    </div>
  )
}
