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

  test('findImportantFiles finds and reads important documentation', async () => {
    const workspace = await createTempWorkspace()

    try {
      const todoContent = `# Todo List

- Fix bugs
- Add features`

      const contributingContent = `# Contributing Guide

Please follow these guidelines when contributing.`

      await writeFile(join(workspace, 'todo.md'), todoContent)
      await writeFile(join(workspace, 'CONTRIBUTING.md'), contributingContent)

      const importantFiles = await findImportantFiles(workspace)

      expect(importantFiles).toHaveLength(2)

      const todoFile = importantFiles.find((f) => f.path === 'todo.md')
      const contributingFile = importantFiles.find((f) => f.path === 'CONTRIBUTING.md')

      expect(todoFile?.content).toBe(todoContent)
      expect(contributingFile?.content).toBe(contributingContent)
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

  test('findRulesFiles finds root-level rule files (AGENTS.md, AGENT.md, CLAUDE.md)', async () => {
    const workspace = await createTempWorkspace()

    try {
      const agentsContent = `---
description: AI Agents Guidelines
globs: ["**/*.ts", "**/*.js"]
alwaysApply: true
---
# AI Agents Guidelines

Use AI agents responsibly.`

      const agentContent = `# Agent Configuration

This file contains agent-specific rules.`

      const claudeContent = `---
description: Claude Instructions
---
# Claude Instructions

Be concise and helpful.`

      await writeFile(join(workspace, 'AGENTS.md'), agentsContent)
      await writeFile(join(workspace, 'AGENT.md'), agentContent)
      await writeFile(join(workspace, 'CLAUDE.md'), claudeContent)

      const rulesFiles = await findRulesFiles(workspace)

      expect(rulesFiles).toHaveLength(3)

      const agentsFile = rulesFiles.find((f) => f.path === 'AGENTS.md')
      const agentFile = rulesFiles.find((f) => f.path === 'AGENT.md')
      const claudeFile = rulesFiles.find((f) => f.path === 'CLAUDE.md')

      expect(agentsFile?.type).toBe('md')
      expect(agentsFile?.description).toBe('AI Agents Guidelines')
      expect(agentsFile?.frontmatter?.alwaysApply).toBe(true)
      expect(agentsFile?.frontmatter?.globs).toEqual(['**/*.ts', '**/*.js'])

      expect(agentFile?.type).toBe('md')
      expect(agentFile?.description).toContain('Agent Configuration')
      expect(agentFile?.frontmatter).toBeUndefined()

      expect(claudeFile?.type).toBe('md')
      expect(claudeFile?.description).toBe('Claude Instructions')
      expect(claudeFile?.frontmatter?.alwaysApply).toBeUndefined()
    } finally {
      await cleanupTempWorkspace(workspace)
    }
  })

  test('findRulesFiles deduplicates rules by content hash', async () => {
    const workspace = await createTempWorkspace()

    try {
      await mkdir(join(workspace, '.cursor', 'rules'), { recursive: true })

      const duplicateContent = `# React Guidelines

Always use functional components.`

      // Create two files with identical content
      await writeFile(join(workspace, '.cursor', 'rules', 'react1.md'), duplicateContent)
      await writeFile(join(workspace, '.cursor', 'rules', 'react2.md'), duplicateContent)

      const rulesFiles = await findRulesFiles(workspace)

      // Should only return one rule due to deduplication
      expect(rulesFiles).toHaveLength(1)
      expect(rulesFiles[0].content.trim()).toBe(duplicateContent.trim())
    } finally {
      await cleanupTempWorkspace(workspace)
    }
  })

  test('findRulesFiles deduplicates rules by similar descriptions, preferring more specific paths', async () => {
    const workspace = await createTempWorkspace()

    try {
      await mkdir(join(workspace, '.cursor', 'rules'), { recursive: true })

      const rootContent = `---
description: React Guidelines
---
# React Guidelines

Root level react rules.`

      const specificContent = `---
description: React Guidelines  
---
# React Guidelines

More specific react rules from cursor directory.`

      // Create files with same description but different specificity
      await writeFile(join(workspace, 'AGENTS.md'), rootContent)
      await writeFile(join(workspace, '.cursor', 'rules', 'react.md'), specificContent)

      const rulesFiles = await findRulesFiles(workspace)

      // Should keep the more specific one (.cursor/rules/react.md)
      expect(rulesFiles).toHaveLength(1)
      expect(rulesFiles[0].path).toBe('.cursor/rules/react.md')
      expect(rulesFiles[0].content.trim()).toContain('More specific react rules')
    } finally {
      await cleanupTempWorkspace(workspace)
    }
  })

  test('findImportantFiles no longer includes AGENTS.md, AGENT.md, CLAUDE.md', async () => {
    const workspace = await createTempWorkspace()

    try {
      const agentsContent = '# AI Agents Guide'
      const claudeContent = '# Claude Instructions'
      const todoContent = '# Todo List'

      await writeFile(join(workspace, 'AGENTS.md'), agentsContent)
      await writeFile(join(workspace, 'CLAUDE.md'), claudeContent)
      await writeFile(join(workspace, 'todo.md'), todoContent)

      const importantFiles = await findImportantFiles(workspace)

      // Should only include todo.md, not the agent/claude files
      expect(importantFiles).toHaveLength(1)
      expect(importantFiles[0].path).toBe('todo.md')

      // Verify these files are now handled as rules files instead
      const rulesFiles = await findRulesFiles(workspace)
      expect(rulesFiles.some((f) => f.path === 'AGENTS.md')).toBe(true)
      expect(rulesFiles.some((f) => f.path === 'CLAUDE.md')).toBe(true)
    } finally {
      await cleanupTempWorkspace(workspace)
    }
  })
})
