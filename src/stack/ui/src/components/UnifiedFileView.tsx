import { useMemo, useState, useEffect } from 'react'
import { useStyletron } from 'baseui'
import type { Hunk } from '../types'
import { createStarryNight, common } from '@wooorm/starry-night'
import { toHtml } from 'hast-util-to-html'

type LineType = 'normal' | 'added' | 'removed' | 'modified'

type LineInfo = {
  lineNumber: number
  content: string
  type: LineType
  highlighted: string
}

type UnifiedFileViewProps = {
  fileName: string
  fileContent: string
  hunks: Hunk[]
}

const parseHunksToLineInfo = (hunks: Hunk[]): Map<number, LineType> => {
  const lineMap = new Map<number, LineType>()

  for (const hunk of hunks) {
    const lines = hunk.content.split('\n')
    let currentNewLine = hunk.newStart

    for (const line of lines) {
      if (line.startsWith('@@')) continue

      if (line.startsWith('+')) {
        // Line was added
        lineMap.set(currentNewLine, 'added')
        currentNewLine++
      } else if (line.startsWith('-')) {
        // Line was removed - we don't show these in the unified view
        // since we're showing the current state of the file
      } else if (line.startsWith(' ')) {
        // Context line - unchanged
        currentNewLine++
      }
    }
  }

  return lineMap
}

const getLanguageFromFileName = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const langMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'tsx',
    js: 'javascript',
    jsx: 'jsx',
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
  const [starryNight, setStarryNight] = useState<Awaited<ReturnType<typeof createStarryNight>> | null>(null)

  // Initialize starry-night
  useEffect(() => {
    createStarryNight(common).then(setStarryNight)
  }, [])

  const lineInfos = useMemo((): LineInfo[] => {
    if (!starryNight) {
      // Return plain text while loading
      const lineTypeMap = parseHunksToLineInfo(hunks)
      const lines = fileContent.split('\n')
      return lines.map((content, idx) => ({
        lineNumber: idx + 1,
        content,
        type: lineTypeMap.get(idx + 1) || 'normal',
        highlighted: content,
      }))
    }

    const lineTypeMap = parseHunksToLineInfo(hunks)
    const lines = fileContent.split('\n')
    const language = getLanguageFromFileName(fileName)
    const scope = starryNight.flagToScope(language)

    return lines.map((content, idx) => {
      const lineNumber = idx + 1
      const type = lineTypeMap.get(lineNumber) || 'normal'

      if (!scope) {
        // Fallback to plain text if language not supported
        return {
          lineNumber,
          content,
          type,
          highlighted: content,
        }
      }

      try {
        const tree = starryNight.highlight(content, scope)
        const highlighted = toHtml(tree)

        return {
          lineNumber,
          content,
          type,
          highlighted,
        }
      } catch {
        // Fallback to plain text if highlighting fails
        return {
          lineNumber,
          content,
          type,
          highlighted: content,
        }
      }
    })
  }, [fileContent, hunks, fileName, starryNight])

  return (
    <div className={css({
      fontFamily: 'monospace',
      fontSize: '12px',
      lineHeight: '1.5',
      backgroundColor: '#18181b',
      overflow: 'auto',
    })}>
      <style>{`
        /* Starry-night CSS - GitHub dark theme */
        @import url('https://esm.sh/@wooorm/starry-night@3/style/dark');
      `}</style>
      {lineInfos.map((lineInfo) => {
        const backgroundColor =
          lineInfo.type === 'added' ? '#052e16' :
          lineInfo.type === 'removed' ? '#450a0a' :
          'transparent'

        const borderLeftColor =
          lineInfo.type === 'added' ? '#10b981' :
          lineInfo.type === 'removed' ? '#ef4444' :
          'transparent'

        return (
          <div
            key={lineInfo.lineNumber}
            className={css({
              display: 'flex',
              backgroundColor,
              borderLeft: lineInfo.type !== 'normal' ? `3px solid ${borderLeftColor}` : 'none',
              paddingLeft: lineInfo.type !== 'normal' ? '9px' : '12px',
            })}
          >
            {/* Line number */}
            <span className={css({
              display: 'inline-block',
              width: '50px',
              textAlign: 'right',
              paddingRight: '12px',
              color: '#71717a',
              userSelect: 'none',
              flexShrink: 0,
            })}>
              {lineInfo.lineNumber}
            </span>

            {/* Code content with syntax highlighting */}
            <span
              className={css({
                flex: 1,
                whiteSpace: 'pre',
                overflowWrap: 'normal',
                color: '#fafafa',
              })}
              dangerouslySetInnerHTML={{ __html: lineInfo.highlighted }}
            />
          </div>
        )
      })}
    </div>
  )
}
