import { useEffect, useState, useMemo } from 'react'
import { useStyletron } from 'baseui'
import { createStarryNight, common } from '@wooorm/starry-night'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'

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
    scss: 'css',
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
  const [starryNight, setStarryNight] = useState<Awaited<ReturnType<typeof createStarryNight>> | null>(null)
  const language = getLanguageFromFileName(fileName)

  // Initialize starry-night
  useEffect(() => {
    createStarryNight(common).then(setStarryNight)
  }, [])

  const lines = code.split('\n')

  // Generate highlighted React nodes for each line
  const highlightedLines = useMemo(() => {
    if (!starryNight) {
      // Return plain text while loading
      return lines.map(line => line)
    }

    const scope = starryNight.flagToScope(language)

    if (!scope) {
      // Fallback to plain text if language not supported
      return lines.map(line => line)
    }

    return lines.map(line => {
      try {
        const tree = starryNight.highlight(line, scope)
        return toJsxRuntime(tree, { Fragment, jsx, jsxs })
      } catch {
        // Fallback to plain text if highlighting fails
        return line
      }
    })
  }, [starryNight, language, lines])

  return (
    <div className={css({
      backgroundColor: '#1d1f21',
      borderRadius: '4px',
      overflow: 'hidden',
      border: '1px solid #3f3f46',
    })}>
      <link rel="stylesheet" href="https://esm.sh/@wooorm/starry-night@3/style/dark" />
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
        <div className={css({
          padding: '12px',
          fontSize: '12px',
          fontFamily: 'monospace',
          overflowX: 'auto',
          lineHeight: '1.5',
          backgroundColor: 'transparent',
        })}>
          {highlightedLines.map((highlightedLine, i) => (
            <div
              key={i}
              className={css({
                whiteSpace: 'pre',
                color: '#fafafa',
              })}
            >
              {highlightedLine}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
