import { useMemo, useState, useEffect } from 'react'
import { useStyletron } from 'baseui'
import type { Hunk } from '../types'
import { createStarryNight, common } from '@wooorm/starry-night'
import { toJsxRuntime } from 'hast-util-to-jsx-runtime'
import { Fragment, jsx, jsxs } from 'react/jsx-runtime'

type LineType = 'normal' | 'added' | 'removed' | 'modified'

type LineInfo = {
  lineNumber: number
  content: string
  type: LineType
  highlighted: React.ReactNode
}

type UnifiedFileViewProps = {
  fileName: string
  fileContent: string
  hunks: Hunk[]
}

// Build a unified view with both additions and deletions
const buildUnifiedLines = (fileContent: string, hunks: Hunk[]): LineInfo[] => {
  const lines = fileContent.split('\n')

  // First, add all current file lines
  const fileLineMap = new Map<number, LineInfo>()
  lines.forEach((content, idx) => {
    const lineNumber = idx + 1
    fileLineMap.set(lineNumber, {
      lineNumber,
      content,
      type: 'normal',
      highlighted: content,
    })
  })

  // Now process hunks to find additions and mark where deletions should go
  for (const hunk of hunks) {
    const hunkLines = hunk.content.split('\n')
    let currentNewLine = hunk.newStart
    const deletionsBeforeLine: Map<number, string[]> = new Map()

    for (const line of hunkLines) {
      if (line.startsWith('@@')) continue

      if (line.startsWith('-')) {
        // Deletion - will be shown before the current line
        const deletedContent = line.substring(1)
        if (!deletionsBeforeLine.has(currentNewLine)) {
          deletionsBeforeLine.set(currentNewLine, [])
        }
        deletionsBeforeLine.get(currentNewLine)!.push(deletedContent)
      } else if (line.startsWith('+')) {
        // Addition - mark this line as added
        const existingLine = fileLineMap.get(currentNewLine)
        if (existingLine) {
          existingLine.type = 'added'
        }
        currentNewLine++
      } else if (line.startsWith(' ')) {
        // Context line
        currentNewLine++
      }
    }

    // Insert deletions before their corresponding lines
    deletionsBeforeLine.forEach((deletedLines, lineNumber) => {
      const existingLine = fileLineMap.get(lineNumber)
      if (existingLine) {
        // Add deletion markers
        deletedLines.forEach((content, idx) => {
          fileLineMap.set(lineNumber - 0.5 - idx * 0.1, {
            lineNumber: lineNumber - 0.5 - idx * 0.1,
            content,
            type: 'removed',
            highlighted: content,
          })
        })
      }
    })
  }

  // Sort by line number and return
  return Array.from(fileLineMap.values()).sort((a, b) => a.lineNumber - b.lineNumber)
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
    // Build unified view with additions and deletions
    const unifiedLines = buildUnifiedLines(fileContent, hunks)

    if (!starryNight) {
      // Return plain text while loading
      return unifiedLines
    }

    const language = getLanguageFromFileName(fileName)
    const scope = starryNight.flagToScope(language)

    if (!scope) {
      // Fallback to plain text if language not supported
      return unifiedLines
    }

    // Apply syntax highlighting to each line
    return unifiedLines.map(line => {
      try {
        const tree = starryNight.highlight(line.content, scope)
        const highlighted = toJsxRuntime(tree, { Fragment, jsx, jsxs })

        return {
          ...line,
          highlighted,
        }
      } catch {
        // Fallback to plain text if highlighting fails
        return line
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
      <link rel="stylesheet" href="https://esm.sh/@wooorm/starry-night@3/style/dark" />
      {lineInfos.map((lineInfo, idx) => {
        const backgroundColor =
          lineInfo.type === 'added' ? '#052e16' :
          lineInfo.type === 'removed' ? '#450a0a' :
          'transparent'

        const borderLeftColor =
          lineInfo.type === 'added' ? '#10b981' :
          lineInfo.type === 'removed' ? '#ef4444' :
          'transparent'

        const lineNumberDisplay = Number.isInteger(lineInfo.lineNumber)
          ? lineInfo.lineNumber.toString()
          : '' // Don't show line number for removed lines (they have fractional line numbers)

        return (
          <div
            key={`${lineInfo.lineNumber}-${idx}`}
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
              {lineNumberDisplay}
            </span>

            {/* Type indicator for removed/added lines */}
            <span className={css({
              display: 'inline-block',
              width: '20px',
              textAlign: 'center',
              paddingRight: '8px',
              color: lineInfo.type === 'added' ? '#10b981' : lineInfo.type === 'removed' ? '#ef4444' : 'transparent',
              userSelect: 'none',
              flexShrink: 0,
              fontWeight: 'bold',
            })}>
              {lineInfo.type === 'added' ? '+' : lineInfo.type === 'removed' ? '-' : ''}
            </span>

            {/* Code content with syntax highlighting */}
            <span
              className={css({
                flex: 1,
                whiteSpace: 'pre',
                overflowWrap: 'normal',
                color: '#fafafa',
              })}
            >
              {lineInfo.highlighted}
            </span>
          </div>
        )
      })}
    </div>
  )
}
