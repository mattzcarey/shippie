import { describe, expect, test } from 'bun:test'
import { mkdir, rmdir, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findImportantFiles, findRulesFiles, formatRulesContext } from '../rulesFiles'

const createTempWorkspace = async (): Promise<string> => {
  const tempDir = join(tmpdir(), `test-workspace-${Date.now()}`)
  await mkdir(tempDir, { recursive: true })
  return tempDir
}

const cleanupTempWorkspace = async (dir: string): Promise<void> => {
  await rmdir(dir, { recursive: true })
}

describe('rulesFiles', () => {
  test('findRulesFiles finds and parses .mdc files correctly', async () => {
    const workspace = await createTempWorkspace()

    try {
      await mkdir(join(workspace, '.cursor', 'rules'), { recursive: true })

      const mdcContent = `---
description: Test rule for TypeScript files
globs: 
  - "*.ts"
  - "*.tsx"
alwaysApply: true
---
This is a test rule for TypeScript files.
It should be applied to all TS files.`

      await writeFile(join(workspace, '.cursor', 'rules', 'test.mdc'), mdcContent)

      const rulesFiles = await findRulesFiles(workspace)

      expect(rulesFiles).toHaveLength(1)
      expect(rulesFiles[0].path).toBe('.cursor/rules/test.mdc')
      expect(rulesFiles[0].type).toBe('mdc')
      expect(rulesFiles[0].description).toBe('Test rule for TypeScript files')
      expect(rulesFiles[0].frontmatter?.globs).toEqual(['*.ts', '*.tsx'])
      expect(rulesFiles[0].frontmatter?.alwaysApply).toBe(true)
    } finally {
      await cleanupTempWorkspace(workspace)
    }
  })

  test('findRulesFiles handles string format globs correctly', async () => {
    const workspace = await createTempWorkspace()

    try {
      await mkdir(join(workspace, '.cursor', 'rules'), { recursive: true })

      const mdcContent = `---
description: Guidelines and best practices for building Convex projects
globs: "**/*.ts,**/*.tsx,**/*.js,**/*.jsx"
---
This rule applies to multiple file types.`

      await writeFile(join(workspace, '.cursor', 'rules', 'convex.mdc'), mdcContent)

      const rulesFiles = await findRulesFiles(workspace)

      expect(rulesFiles).toHaveLength(1)
      expect(rulesFiles[0].frontmatter?.globs).toEqual([
        '**/*.ts',
        '**/*.tsx',
        '**/*.js',
        '**/*.jsx',
      ])
      expect(rulesFiles[0].description).toBe(
        'Guidelines and best practices for building Convex projects'
      )
    } finally {
      await cleanupTempWorkspace(workspace)
    }
  })

  test('findRulesFiles finds .md files with frontmatter correctly', async () => {
    const workspace = await createTempWorkspace()

    try {
      await mkdir(join(workspace, '.cursor', 'rules'), { recursive: true })

      const mdContent = `---
description: React component guidelines
globs: ["**/*.jsx", "**/*.tsx"]
alwaysApply: false
---
# React Best Practices
      
Always use functional components.
Prefer hooks over class components.`

      await writeFile(join(workspace, '.cursor', 'rules', 'react.md'), mdContent)

      const rulesFiles = await findRulesFiles(workspace)

      expect(rulesFiles).toHaveLength(1)
      expect(rulesFiles[0].path).toBe('.cursor/rules/react.md')
      expect(rulesFiles[0].type).toBe('md')
      expect(rulesFiles[0].description).toBe('React component guidelines')
      expect(rulesFiles[0].frontmatter?.globs).toEqual(['**/*.jsx', '**/*.tsx'])
      expect(rulesFiles[0].frontmatter?.alwaysApply).toBe(false)
    } finally {
      await cleanupTempWorkspace(workspace)
    }
  })

  test('findRulesFiles finds .md files without frontmatter correctly', async () => {
    const workspace = await createTempWorkspace()

    try {
      await mkdir(join(workspace, '.windsurfrules'), { recursive: true })

      const mdContent = `# React Best Practices
      
Always use functional components.
Prefer hooks over class components.
Keep components small and focused.`

      await writeFile(join(workspace, '.windsurfrules', 'react.md'), mdContent)

      const rulesFiles = await findRulesFiles(workspace)

      expect(rulesFiles).toHaveLength(1)
      expect(rulesFiles[0].path).toBe('.windsurfrules/react.md')
      expect(rulesFiles[0].type).toBe('md')
      expect(rulesFiles[0].description).toContain('React Best Practices')
      expect(rulesFiles[0].frontmatter).toBeUndefined()
    } finally {
      await cleanupTempWorkspace(workspace)
    }
  })

  test('findRulesFiles finds files in .windsurf/rules/ directory', async () => {
    const workspace = await createTempWorkspace()

    try {
      await mkdir(join(workspace, '.windsurf', 'rules'), { recursive: true })

      const mdContent = `# TypeScript Guidelines
      
Use strict mode and proper typing.
Prefer interfaces over types for object shapes.
Always specify return types for functions.`

      await writeFile(join(workspace, '.windsurf', 'rules', 'typescript.md'), mdContent)

      const rulesFiles = await findRulesFiles(workspace)

      expect(rulesFiles).toHaveLength(1)
      expect(rulesFiles[0].path).toBe('.windsurf/rules/typescript.md')
      expect(rulesFiles[0].type).toBe('md')
      expect(rulesFiles[0].description).toContain('TypeScript Guidelines')
      expect(rulesFiles[0].frontmatter).toBeUndefined()
    } finally {
      await cleanupTempWorkspace(workspace)
    }
  })

  test('findImportantFiles finds and reads important documentation', async () => {
    const workspace = await createTempWorkspace()

    try {
      const agentsContent = `# AI Agents Guide

This project uses AI agents for code review.
Please follow these guidelines when working with agents.`

      const claudeContent = `# Claude Instructions

Use concise responses.
Focus on code quality.`

      await writeFile(join(workspace, 'AGENTS.md'), agentsContent)
      await writeFile(join(workspace, 'CLAUDE.md'), claudeContent)

      const importantFiles = await findImportantFiles(workspace)

      expect(importantFiles).toHaveLength(2)

      const agentsFile = importantFiles.find((f) => f.path === 'AGENTS.md')
      const claudeFile = importantFiles.find((f) => f.path === 'CLAUDE.md')

      expect(agentsFile?.content).toBe(agentsContent)
      expect(claudeFile?.content).toBe(claudeContent)
    } finally {
      await cleanupTempWorkspace(workspace)
    }
  })

  test('formatRulesContext creates proper formatted output', async () => {
    const rulesFiles = [
      {
        path: '.cursor/rules/test.mdc',
        type: 'mdc' as const,
        description: 'Test rule for TypeScript',
        content: 'This is the full content of the rule.',
        frontmatter: {
          globs: ['*.ts', '*.tsx'],
          alwaysApply: true,
        },
      },
      {
        path: '.cursor/rules/brief.mdc',
        type: 'mdc' as const,
        description: 'Brief rule description',
        content: 'Brief rule content.',
        frontmatter: {
          globs: ['*.js'],
          alwaysApply: false,
        },
      },
    ]

    const importantFiles = [
      {
        path: 'AGENTS.md',
        content: '# Agent Guidelines\n\nFollow these rules.',
      },
    ]

    const context = formatRulesContext(rulesFiles, importantFiles)

    expect(context).toContain('Project Context')
    expect(context).toContain('See these rules files for more info:')
    expect(context).toContain('.cursor/rules/brief.mdc: Brief rule description')
    expect(context).toContain('Applies to: *.js')
    expect(context).toContain('Always-apply rules (full content):')
    expect(context).toContain('## .cursor/rules/test.mdc')
    expect(context).toContain('This is the full content of the rule.')
    expect(context).toContain('Important project documentation:')
    expect(context).toContain('## AGENTS.md')
    expect(context).toContain('# Agent Guidelines')
  })

  test('formatRulesContext handles only alwaysApply rules', () => {
    const rulesFiles = [
      {
        path: '.cursor/rules/always.mdc',
        type: 'mdc' as const,
        description: 'Always apply rule',
        content: 'Full content that should always be included.',
        frontmatter: {
          alwaysApply: true,
        },
      },
    ]

    const context = formatRulesContext(rulesFiles, [])

    expect(context).toContain('Always-apply rules (full content):')
    expect(context).toContain('## .cursor/rules/always.mdc')
    expect(context).toContain('Full content that should always be included.')
    expect(context).not.toContain('See these rules files for more info:')
  })

  test('formatRulesContext handles rules without alwaysApply', () => {
    const rulesFiles = [
      {
        path: '.cursor/rules/normal.mdc',
        type: 'mdc' as const,
        description: 'Normal rule description',
        content: 'Content that should not be included.',
        frontmatter: {
          globs: ['*.ts'],
        },
      },
    ]

    const context = formatRulesContext(rulesFiles, [])

    expect(context).toContain('See these rules files for more info:')
    expect(context).toContain('.cursor/rules/normal.mdc: Normal rule description')
    expect(context).not.toContain('Always-apply rules')
    expect(context).not.toContain('Content that should not be included.')
  })

  test('formatRulesContext returns empty string when no files found', () => {
    const context = formatRulesContext([], [])
    expect(context).toBe('')
  })
})
