import { defineTool } from '@flue/runtime'
import * as v from 'valibot'
import type { Reporter } from '../github/reporter'

/**
 * `suggest_change` — posts an inline review comment on a file line or range.
 * Replaces the old AI-SDK `suggest_change` tool; the reporter handles GitHub or
 * local output. Errors are thrown so the agent can correct the line/path.
 */
export const createSuggestChangeTool = (reporter: Reporter) =>
  defineTool({
    name: 'suggest_change',
    description:
      'Post an inline review comment on a specific file and line range. Only use this on files with actionable problems. If several issues are on nearby lines, combine them into one comment that spans all of those lines. Include a fenced ```suggestion``` block with a direct replacement when proposing a concrete fix.',
    parameters: v.object({
      filePath: v.pipe(
        v.string(),
        v.minLength(1),
        v.description('Path to the file, relative to the repo root or absolute.')
      ),
      comment: v.pipe(
        v.string(),
        v.minLength(1),
        v.description('The review comment. Short, specific, and actionable.')
      ),
      startLine: v.optional(
        v.pipe(
          v.number(),
          v.description('First line of the range (new-file line number).')
        )
      ),
      endLine: v.optional(
        v.pipe(
          v.number(),
          v.description('Last line of the range (new-file line number).')
        )
      ),
    }),
    execute: async ({ filePath, comment, startLine, endLine }) => {
      const url = await reporter.postReviewComment({
        filePath,
        comment,
        startLine,
        endLine,
      })
      return url ? `Comment posted: ${url}` : 'Comment posted.'
    },
  })
