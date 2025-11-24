import type { LanguageModelV1, Tool } from 'ai'
import { tool } from 'ai'
import { z } from 'zod'
import {
  createSubAgentTool,
  createSubmitSummaryTool,
  createSuggestChangesTool,
  getBaseTools,
} from '../../common/llm/tools'
import type { PlatformProvider } from '../../common/platform/provider'

interface TestToolConfig {
  mockDiffs: Record<string, string>
  mockFileContents: Record<string, string>
  mockGrepResults: Record<string, string>
  mockLsResults: Record<string, string[]>
  mockGlobResults: Record<string, string[]>
}

export const createTestReadDiffTool = (config: TestToolConfig) =>
  tool({
    description:
      'Generate a diff for a file. This tool shows changes made to a file which should be reviewed. Use in conjunction with read_file to read the current state of a file.',
    parameters: z.object({
      path: z.string().describe('The absolute path to the file to generate a diff for'),
    }),
    execute: async ({ path }) => {
      return config.mockDiffs[path] || 'No changes detected'
    },
  })

export const createTestReadFileTool = (config: TestToolConfig) =>
  tool({
    description: 'Read the contents of a file.',
    parameters: z.object({
      path: z.string().describe('The path to the file to read'),
    }),
    execute: async ({ path }) => {
      return config.mockFileContents[path] || `File not found: ${path}`
    },
  })

export const createTestGrepTool = (config: TestToolConfig) =>
  tool({
    description: 'Search for patterns in files using grep.',
    parameters: z.object({
      pattern: z.string().describe('The pattern to search for'),
      path: z.string().optional().describe('Optional path to search in'),
    }),
    execute: async ({ pattern, path }) => {
      const key = `${pattern}${path ? `:${path}` : ''}`
      return config.mockGrepResults[key] || 'No matches found'
    },
  })

export const createTestLsTool = (config: TestToolConfig) =>
  tool({
    description: 'List directory contents.',
    parameters: z.object({
      path: z.string().describe('The directory path to list'),
    }),
    execute: async ({ path }) => {
      const files = config.mockLsResults[path] || []
      return files.join('\n') || `Directory not found: ${path}`
    },
  })

export const createTestGlobTool = (config: TestToolConfig) =>
  tool({
    description: 'Find files matching a glob pattern.',
    parameters: z.object({
      pattern: z.string().describe('The glob pattern to match'),
    }),
    execute: async ({ pattern }) => {
      const files = config.mockGlobResults[pattern] || []
      return files.join('\n') || 'No files found matching pattern'
    },
  })

export const createTestToolsConfig = (scenarioData: {
  files: Array<{ fileName: string; content: string; diff?: string }>
}): TestToolConfig => {
  const mockDiffs: Record<string, string> = {}
  const mockFileContents: Record<string, string> = {}
  const mockGrepResults: Record<string, string> = {}
  const mockLsResults: Record<string, string[]> = {}
  const mockGlobResults: Record<string, string[]> = {}

  // Add scenario files
  for (const file of scenarioData.files) {
    mockFileContents[file.fileName] = file.content
    mockDiffs[file.fileName] = file.diff || 'No changes detected'
  }

  // Provide realistic project structure
  mockLsResults['.'] = [
    'src/',
    'docs/',
    'templates/',
    'package.json',
    'tsconfig.json',
    'biome.json',
    'README.md',
    'LICENSE',
  ]

  mockLsResults['..'] = ['shippie/', 'other-projects/']

  mockLsResults.src = ['common/', 'configure/', 'review/', 'specs/']

  // Add common project files
  mockFileContents['package.json'] = JSON.stringify(
    {
      name: 'shippie',
      version: '1.0.0',
      description: 'Code review and automated QA tool',
      main: 'dist/index.js',
      scripts: {
        build: 'tsup',
        test: 'bun test',
        lint: 'biome check .',
      },
      dependencies: {
        ai: '^3.0.0',
        zod: '^3.0.0',
      },
    },
    null,
    2
  )

  mockFileContents['tsconfig.json'] = JSON.stringify(
    {
      compilerOptions: {
        target: 'es2022',
        module: 'esnext',
        moduleResolution: 'bundler',
        strict: true,
        esModuleInterop: true,
        skipLibCheck: true,
        forceConsistentCasingInFileNames: true,
      },
      include: ['src/**/*'],
      exclude: ['node_modules', 'dist'],
    },
    null,
    2
  )

  // Common glob patterns
  mockGlobResults['*.md'] = ['README.md', 'CHANGELOG.md']
  mockGlobResults['src/**/*.ts'] = scenarioData.files.map((f) => f.fileName)
  mockGlobResults['.cursor/rules/*'] = []
  mockGlobResults['CLAUDE.md'] = []

  // Common grep patterns
  mockGrepResults.secret = 'No matches found'
  mockGrepResults.password = 'No matches found'
  mockGrepResults['api.key'] = 'No matches found'

  return {
    mockDiffs,
    mockFileContents,
    mockGrepResults,
    mockLsResults,
    mockGlobResults,
  }
}

export const createTestTools = (
  config: TestToolConfig,
  platformProvider: PlatformProvider,
  model?: LanguageModelV1,
  includeSubAgent = true,
  maxSteps = 25
): Record<string, Tool> => {
  const tools = { ...getBaseTools() }

  // Replace system-dependent tools with test versions
  tools.read_diff = createTestReadDiffTool(config)
  tools.read_file = createTestReadFileTool(config)
  tools.grep = createTestGrepTool(config)
  tools.ls = createTestLsTool(config)
  tools.glob = createTestGlobTool(config)

  // Add platform-dependent tools
  tools.suggest_change = createSuggestChangesTool(platformProvider)
  tools.submit_summary = createSubmitSummaryTool(platformProvider)

  // Add sub-agent if requested
  if (model && includeSubAgent) {
    tools.spawn_subagent = createSubAgentTool(model, maxSteps)
  }

  return tools
}
