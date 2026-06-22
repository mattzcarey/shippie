import { relative } from 'node:path'
import picomatch from 'picomatch'
import type { ReviewFile } from '../../common/types'
import { defaultIgnoredGlobs } from '../constants'

/**
 * Drops files matching the ignore globs. `fileName` is absolute, but ignore
 * globs (e.g. `dist/**`, `node_modules/**`) are repo-relative, so pass the
 * `workspace` to match against the workspace-relative path — otherwise
 * directory globs never match an absolute path and ignored files slip through.
 */
export const filterFiles = (
  files: ReviewFile[],
  ignoredGlobs?: string[],
  workspace?: string
): ReviewFile[] => {
  const globs = ignoredGlobs ?? Array.from(defaultIgnoredGlobs)

  if (globs.length === 0) {
    return files
  }

  const isMatch = picomatch(globs, { dot: true })

  return files.filter((file) => {
    const candidate = workspace ? relative(workspace, file.fileName) : file.fileName
    return !isMatch(candidate)
  })
}
