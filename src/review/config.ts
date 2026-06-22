import type { ThinkingLevel } from '@flue/runtime'

/**
 * Remote MCP server entry. Flue only supports remote (HTTP/SSE) MCP transports,
 * so unlike the old `.mcp.json` there is no `command`/stdio option. MCP servers
 * are supplied via the GitHub Action config (payload or `SHIPPIE_MCP_SERVERS`),
 * never from a checked-in `.mcp.json`.
 */
export interface McpServerInput {
  url: string
  transport?: 'streamable-http' | 'sse'
  headers?: Record<string, string>
}

export type ReviewPlatform = 'github' | 'local'

/** Payload accepted by the `review` workflow (`flue run review --payload '{...}'`). */
export interface ReviewPayload {
  platform?: ReviewPlatform
  /** Path to the repository checkout to review. Defaults to GITHUB_WORKSPACE or cwd. */
  workspace?: string
  /** Flue model specifier, e.g. `anthropic/claude-sonnet-4-6`. */
  model?: string
  thinkingLevel?: ThinkingLevel
  reviewLanguage?: string
  ignore?: string[]
  customInstructions?: string
  /** Anonymous usage telemetry. Defaults to true; set false to opt out. */
  telemetry?: boolean
  owner?: string
  repo?: string
  prNumber?: number
  baseSha?: string
  headSha?: string
  mcpServers?: Record<string, McpServerInput>
}

export interface GithubTarget {
  owner: string
  repo: string
  prNumber: number
  token: string
}

export interface ReviewConfig {
  platform: ReviewPlatform
  workspace: string
  model: string
  thinkingLevel: ThinkingLevel
  reviewLanguage: string
  ignore?: string[]
  customInstructions?: string
  telemetry: boolean
  baseSha?: string
  headSha?: string
  github?: GithubTarget
  mcpServers: Record<string, McpServerInput>
}

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6'
const DEFAULT_THINKING: ThinkingLevel = 'medium'

const parseMcpServers = (
  payload: ReviewPayload,
  env: NodeJS.ProcessEnv
): Record<string, McpServerInput> => {
  if (payload.mcpServers && Object.keys(payload.mcpServers).length > 0) {
    return payload.mcpServers
  }
  const raw = env.SHIPPIE_MCP_SERVERS
  if (!raw) return {}
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    // Accept either a bare map of servers or a `{ mcpServers: {...} }` wrapper.
    const servers =
      parsed && typeof parsed === 'object' && 'mcpServers' in parsed
        ? (parsed.mcpServers as Record<string, McpServerInput>)
        : (parsed as Record<string, McpServerInput>)
    return servers ?? {}
  } catch {
    return {}
  }
}

/**
 * Resolves the full review configuration from the workflow payload and the
 * environment. Payload values win; GitHub Actions env vars fill the gaps.
 */
export const resolveReviewConfig = (
  payload: ReviewPayload | undefined,
  env: NodeJS.ProcessEnv = process.env
): ReviewConfig => {
  const p = payload ?? {}

  const platform: ReviewPlatform = p.platform ?? (env.GITHUB_ACTIONS ? 'github' : 'local')
  const workspace = p.workspace ?? env.GITHUB_WORKSPACE ?? process.cwd()
  const model = p.model ?? env.SHIPPIE_MODEL ?? DEFAULT_MODEL
  const thinkingLevel =
    p.thinkingLevel ?? (env.SHIPPIE_THINKING_LEVEL as ThinkingLevel) ?? DEFAULT_THINKING
  const reviewLanguage = p.reviewLanguage ?? env.SHIPPIE_REVIEW_LANGUAGE ?? 'English'
  const baseSha = p.baseSha ?? env.BASE_SHA
  const headSha = p.headSha ?? env.HEAD_SHA ?? env.GITHUB_SHA

  const ignore =
    p.ignore ??
    (env.SHIPPIE_IGNORE
      ? env.SHIPPIE_IGNORE.split(',')
          .map((g) => g.trim())
          .filter(Boolean)
      : undefined)
  const customInstructions = p.customInstructions ?? env.SHIPPIE_CUSTOM_INSTRUCTIONS
  const telemetry = p.telemetry ?? env.SHIPPIE_TELEMETRY !== 'false'

  let github: GithubTarget | undefined
  if (platform === 'github') {
    const repoSlug = env.GITHUB_REPOSITORY ?? '/'
    const owner = p.owner ?? repoSlug.split('/')[0]
    const repo = p.repo ?? repoSlug.split('/')[1]
    const prNumber = p.prNumber ?? Number(env.SHIPPIE_PR_NUMBER ?? '0')
    const token = env.GITHUB_TOKEN ?? ''
    if (owner && repo && prNumber > 0) {
      github = { owner, repo, prNumber, token }
    }
  }

  return {
    platform,
    workspace,
    model,
    thinkingLevel,
    reviewLanguage,
    ignore,
    customInstructions,
    telemetry,
    baseSha,
    headSha,
    github,
    mcpServers: parseMcpServers(p, env),
  }
}
