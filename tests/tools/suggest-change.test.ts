import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Reporter } from '../../src/github/reporter'
import { createSuggestChangeTool } from '../../src/tools/suggest-change'

const makeReporter = (postReviewComment: Reporter['postReviewComment']): Reporter => ({
  postReviewComment,
  postSummary: vi.fn(),
})

describe('createSuggestChangeTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('defines a suggest_change tool with parameters', () => {
    const reporter = makeReporter(vi.fn().mockResolvedValue('http://c'))
    const tool = createSuggestChangeTool(reporter)

    expect(tool.name).toBe('suggest_change')
    expect(tool.input).toBeTypeOf('object')
    expect(tool.input).not.toBeNull()
    expect(tool.run).toBeTypeOf('function')
  })

  it('forwards args to reporter.postReviewComment and returns the url', async () => {
    const postReviewComment = vi.fn().mockResolvedValue('http://c')
    const reporter = makeReporter(postReviewComment)
    const tool = createSuggestChangeTool(reporter)

    const args = {
      filePath: 'src/index.ts',
      comment: 'fix this',
      startLine: 10,
      endLine: 12,
    }
    const result = await tool.run({ input: args })

    expect(postReviewComment).toHaveBeenCalledTimes(1)
    expect(postReviewComment).toHaveBeenCalledWith({
      filePath: 'src/index.ts',
      comment: 'fix this',
      startLine: 10,
      endLine: 12,
    })
    expect(typeof result).toBe('string')
    expect(result).toContain('http://c')
  })

  it("returns 'Comment posted.' when postReviewComment returns undefined", async () => {
    const postReviewComment = vi.fn().mockResolvedValue(undefined)
    const reporter = makeReporter(postReviewComment)
    const tool = createSuggestChangeTool(reporter)

    const result = await tool.run({
      input: {
        filePath: 'src/index.ts',
        comment: 'fix this',
      },
    })

    expect(postReviewComment).toHaveBeenCalledTimes(1)
    expect(result).toBe('Comment posted.')
  })
})
