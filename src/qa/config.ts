import type { ThinkingLevel } from '@flue/runtime'
import {
  type McpServerInput,
  type ReviewPayload,
  resolveReviewConfig,
} from '../review/config'

export type QaPlatform = 'github' | 'local'

/** Payload accepted by the `qa` workflow (`flue run qa --payload '{...}'`). */
export interface QaPayload {
  platform?: QaPlatform
  /** Path to the repository checkout to QA. Defaults to GITHUB_WORKSPACE or cwd. */
  workspace?: string
  model?: string
  thinkingLevel?: ThinkingLevel
  /** Anonymous usage telemetry. Defaults to true; set false to opt out. */
  telemetry?: boolean
  /** URL/path under test → E2E_BASE_URL for the generated specs. */
  target?: string
  /** Free-text flows/areas to prioritize. */
  scope?: string
  /** Override the iso-week PR branch. */
  branch?: string
  /** CHROME_BIN — local() env is an allowlist snapshot, so it must be explicit. */
  chromeBin?: string
  mcpServers?: Record<string, McpServerInput>
}

export interface QaGithubTarget {
  owner: string
  repo: string
  token: string
}

export interface QaConfig {
  platform: QaPlatform
  workspace: string
  model: string
  thinkingLevel: ThinkingLevel
  telemetry: boolean
  target?: string
  scope?: string
  branch?: string
  chromeBin: string
  /** No prNumber: QA OPENS PRs, it does not review an existing one. */
  github?: QaGithubTarget
  mcpServers: Record<string, McpServerInput>
}

const DEFAULT_QA_MODEL = 'anthropic/claude-opus-4-8'

const defaultChromeBin = (): string => {
  switch (process.platform) {
    case 'darwin':
      return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
    case 'win32':
      return 'chrome'
    default:
      return 'google-chrome'
  }
}

/**
 * Resolves the QA configuration from the workflow payload and the environment.
 * Reuses `resolveReviewConfig` for the shared fields (platform/workspace/telemetry/
 * mcp), then adds QA-specific fields and resolves the GitHub target WITHOUT a PR
 * number — QA opens PRs, whereas review reviews an existing one (its `github` is
 * only populated when `prNumber > 0`).
 */
export const resolveQaConfig = (
  payload: QaPayload | undefined,
  env: NodeJS.ProcessEnv = process.env
): QaConfig => {
  const p = payload ?? {}
  const model = p.model ?? env.SHIPPIE_QA_MODEL ?? env.SHIPPIE_MODEL ?? DEFAULT_QA_MODEL

  // Reuse review's resolution for the shared fields. The constructed payload only
  // carries the bits review understands; QA-specific fields are handled below.
  const base = resolveReviewConfig(
    {
      platform: p.platform,
      workspace: p.workspace,
      model,
      telemetry: p.telemetry,
      mcpServers: p.mcpServers,
    } satisfies ReviewPayload,
    env
  )

  let github: QaGithubTarget | undefined
  if (base.platform === 'github') {
    const [owner, repo] = (env.GITHUB_REPOSITORY ?? '/').split('/')
    const token = env.GITHUB_TOKEN ?? ''
    if (owner && repo && token) github = { owner, repo, token }
  }

  return {
    platform: base.platform,
    workspace: base.workspace,
    model: base.model,
    thinkingLevel:
      p.thinkingLevel ?? (env.SHIPPIE_QA_THINKING_LEVEL as ThinkingLevel) ?? 'high',
    telemetry: base.telemetry,
    target: p.target ?? env.SHIPPIE_QA_TARGET,
    scope: p.scope ?? env.SHIPPIE_QA_SCOPE,
    branch: p.branch ?? env.SHIPPIE_QA_BRANCH,
    chromeBin: p.chromeBin ?? env.CHROME_BIN ?? defaultChromeBin(),
    github,
    mcpServers: base.mcpServers,
  }
}
