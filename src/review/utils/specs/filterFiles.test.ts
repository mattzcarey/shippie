import { describe, expect, test } from 'vitest'

import type { ReviewFile } from '../../../common/types'
import { filterFiles } from '../filterFiles'

describe('filterFiles unit test', () => {
  test('uses default ignored globs when no globs provided', () => {
    const testFiles: ReviewFile[] = [
      {
        fileName: 'src/component.tsx',
        fileContent: 'export const Component = () => <div>Hello</div>',
        changedLines: [],
      },
      {
        fileName: 'src/types.d.ts',
        fileContent: 'declare module "test"',
        changedLines: [],
      },
      {
        fileName: 'dist/bundle.js',
        fileContent: 'bundled code',
        changedLines: [],
      },
      {
        fileName: 'node_modules/package/index.js',
        fileContent: 'module code',
        changedLines: [],
      },
      {
        fileName: 'package-lock.json',
        fileContent: '{"lockfileVersion": 1}',
        changedLines: [],
      },
    ]

    const result = filterFiles(testFiles)

    expect(result.length).toEqual(1)
    expect(result[0].fileName).toBe('src/component.tsx')
  })

  test('filters files matching custom glob patterns', () => {
    const testFiles: ReviewFile[] = [
      {
        fileName: 'src/component.tsx',
        fileContent: 'export const Component = () => <div>Hello</div>',
        changedLines: [],
      },
      {
        fileName: 'src/utils.ts',
        fileContent: 'export const helper = () => {}',
        changedLines: [],
      },
      {
        fileName: 'README.md',
        fileContent: '# Project',
        changedLines: [],
      },
      {
        fileName: 'package.json',
        fileContent: '{"name": "test"}',
        changedLines: [],
      },
    ]

    const result = filterFiles(testFiles, ['*.md', '*.json'])

    expect(result.length).toEqual(2)
    expect(result.some((f) => f.fileName === 'src/component.tsx')).toBe(true)
    expect(result.some((f) => f.fileName === 'src/utils.ts')).toBe(true)
    expect(result.some((f) => f.fileName === 'README.md')).toBe(false)
    expect(result.some((f) => f.fileName === 'package.json')).toBe(false)
  })

  test('filters files matching directory patterns', () => {
    const testFiles: ReviewFile[] = [
      {
        fileName: 'src/component.tsx',
        fileContent: 'export const Component = () => <div>Hello</div>',
        changedLines: [],
      },
      {
        fileName: 'dist/bundle.js',
        fileContent: 'bundled code',
        changedLines: [],
      },
      {
        fileName: 'node_modules/package/index.js',
        fileContent: 'module code',
        changedLines: [],
      },
      {
        fileName: 'test/spec.ts',
        fileContent: 'test code',
        changedLines: [],
      },
    ]

    const result = filterFiles(testFiles, ['dist/**', 'node_modules/**'])

    expect(result.length).toEqual(2)
    expect(result.some((f) => f.fileName === 'src/component.tsx')).toBe(true)
    expect(result.some((f) => f.fileName === 'test/spec.ts')).toBe(true)
    expect(result.some((f) => f.fileName === 'dist/bundle.js')).toBe(false)
    expect(result.some((f) => f.fileName === 'node_modules/package/index.js')).toBe(false)
  })

  test('handles empty custom globs array', () => {
    const testFiles: ReviewFile[] = [
      {
        fileName: 'src/component.tsx',
        fileContent: 'export const Component = () => <div>Hello</div>',
        changedLines: [],
      },
      {
        fileName: 'README.md',
        fileContent: '# Project',
        changedLines: [],
      },
    ]

    const result = filterFiles(testFiles, [])
    expect(result.length).toEqual(2)
  })

  test('handles complex glob patterns', () => {
    const testFiles: ReviewFile[] = [
      {
        fileName: 'src/components/Button.tsx',
        fileContent: 'component code',
        changedLines: [],
      },
      {
        fileName: 'src/utils/helper.ts',
        fileContent: 'utility code',
        changedLines: [],
      },
      {
        fileName: 'tests/unit/button.test.ts',
        fileContent: 'test code',
        changedLines: [],
      },
      {
        fileName: 'docs/api.md',
        fileContent: 'documentation',
        changedLines: [],
      },
    ]

    const result = filterFiles(testFiles, ['**/tests/**', 'docs/**'])

    expect(result.length).toEqual(2)
    expect(result.some((f) => f.fileName === 'src/components/Button.tsx')).toBe(true)
    expect(result.some((f) => f.fileName === 'src/utils/helper.ts')).toBe(true)
    expect(result.some((f) => f.fileName === 'tests/unit/button.test.ts')).toBe(false)
    expect(result.some((f) => f.fileName === 'docs/api.md')).toBe(false)
  })
})
