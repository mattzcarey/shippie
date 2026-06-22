import { relative } from 'node:path'
import type { ReviewFileWithDiff } from './diff'
import { createFileInfo } from './prompt/fileInfo'

/**
 * Builds the user prompt for a review: a file tree with changed line ranges,
 * followed by the raw unified diff of each file under review. The agent can read
 * the full current files and surrounding code with its built-in tools.
 */
export const buildReviewPrompt = (
  files: ReviewFileWithDiff[],
  workspace: string
): string => {
  const fileTree = createFileInfo(files, workspace)

  const diffs = files
    .map((file) => {
      const path = relative(workspace, file.fileName)
      return `### ${path}\n\`\`\`diff\n${file.diff}\n\`\`\``
    })
    .join('\n\n')

  return `${fileTree}
Below are the diffs for the files changed in this pull request. Review them, investigate the
surrounding code with your tools, and post inline comments on real problems with \`suggest_change\`.

${diffs}`
}
