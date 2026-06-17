import { exec } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { LineRange, ReviewFile } from '../common/types'
import type { ReviewConfig } from './config'

const execAsync = promisify(exec)

/** A changed file plus the raw unified diff for that file. */
export interface ReviewFileWithDiff extends ReviewFile {
  diff: string
}

/** Parsed changed file (no content) — what {@link parseDiff} returns. */
export interface ParsedDiffFile {
  fileName: string
  changedLines: LineRange[]
  diff: string
}

// AMRT = Added/Modified/Renamed/Type-changed. -U0 = no context lines.
const DIFF_OPTS = '--diff-filter=AMRT -U0'

const buildDiffCommand = (cfg: ReviewConfig): string => {
  const base = `git -C "${cfg.workspace}" diff ${DIFF_OPTS}`
  if (cfg.baseSha && cfg.headSha) {
    return `${base} ${cfg.baseSha} ${cfg.headSha}`
  }
  // Local default: review staged changes.
  return `${base} --cached`
}

/**
 * Parses the combined output of `git diff -U0` into per-file changed-line ranges
 * (referenced from the new file) and the raw diff text for each file.
 */
export const parseDiff = (rawDiff: string, workspace: string): ParsedDiffFile[] => {
  const diffHeaderRegex = /^diff --git a\/(.+) b\/(.+)$/
  const hunkHeaderRegex = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

  const files: ParsedDiffFile[] = []
  let current: ParsedDiffFile | null = null

  for (const line of rawDiff.split('\n')) {
    const headerMatch = line.match(diffHeaderRegex)
    if (headerMatch) {
      current = {
        fileName: join(workspace, headerMatch[2]),
        changedLines: [],
        diff: line,
      }
      files.push(current)
      continue
    }

    if (!current) continue
    current.diff += `\n${line}`

    const hunkMatch = line.match(hunkHeaderRegex)
    if (!hunkMatch) continue

    const oldLineCount = hunkMatch[2] ? Number.parseInt(hunkMatch[2], 10) : 1
    const newStartLine = Number.parseInt(hunkMatch[3], 10)
    const newLineCount = hunkMatch[4] ? Number.parseInt(hunkMatch[4], 10) : 1

    if (newLineCount > 0) {
      current.changedLines.push({
        start: newStartLine,
        end: newStartLine + newLineCount - 1,
      })
    } else if (oldLineCount > 0) {
      // Pure deletion: anchor at the line where content was removed.
      current.changedLines.push({
        start: newStartLine,
        end: newStartLine,
        isPureDeletion: true,
      })
    }
  }

  return files
}

/**
 * Computes the changed files for the review using a single `git diff -U0` call.
 * Returns each file with its content, changed-line ranges, and raw diff.
 */
export const getChangedFiles = async (
  cfg: ReviewConfig
): Promise<{ files: ReviewFileWithDiff[]; rawDiff: string }> => {
  const command = buildDiffCommand(cfg)
  const { stdout: rawDiff } = await execAsync(command, { maxBuffer: 1024 * 1024 * 20 })

  if (!rawDiff.trim()) {
    return { files: [], rawDiff: '' }
  }

  const files = await Promise.all(
    parseDiff(rawDiff, cfg.workspace).map(async (file): Promise<ReviewFileWithDiff> => {
      let fileContent = ''
      try {
        fileContent = await readFile(file.fileName, 'utf8')
      } catch {
        // File may have been deleted/renamed; the diff still carries the change.
      }
      return { ...file, fileContent }
    })
  )

  return { files, rawDiff }
}
