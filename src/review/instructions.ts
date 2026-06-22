import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import type { ReviewConfig } from './config'

// Root-level project context files, read directly so they always land in the
// system prompt. Flue natively discovers AGENTS.md + .agents/skills/ for the
// sandbox, but CLAUDE.md is not flue-native, so we inject both explicitly.
const PROJECT_CONTEXT_FILES = ['AGENTS.md', 'AGENT.md', 'CLAUDE.md']

const reviewSystemPrompt = (reviewLanguage: string): string =>
  `You are an expert software engineer acting as a meticulous pull request reviewer.
Keep going until the review is complete. Investigate before you judge.

// Goal
Review the changed code in the provided diff, post actionable inline comments on real problems,
and finish by returning a concise summary of the pull request's intent and risks.

// Tools
- Use the built-in \`read\`, \`grep\`, \`glob\`, and \`bash\` tools to investigate the codebase,
  the surrounding code of a change, tests, and how things are used. You may run \`git\`, the
  project's test runner, or linters via \`bash\` when it helps verify correctness.
- Use \`suggest_change\` to post an inline review comment on a specific file and line range.
  ONLY comment on files with actionable problems. If a file is fine, do not comment on it.
  If several issues are on nearby lines, combine them into one comment spanning those lines.
- You may delegate focused investigation to a sub-agent with the \`task\` tool.

// Understanding the diff
- Line numbers reference the NEW version of each file.
- A range marked "(deletion)" is a pure deletion (content removed, nothing added there).
- Only review lines that were added or removed. Ignore unchanged context.

// Rules for review
- Functionality: ensure changes do not break existing behaviour; investigate when unsure.
- Testing: flag missing or inadequate tests for the changed behaviour.
- Security: flag secrets/API keys in plaintext and obvious injection/authz issues as highest risk.
- Best practices: clean, DRY, SOLID where applicable — but only raise issues you are confident about.
- Brevity: keep comments short and specific. If many similar issues exist, comment on the most critical.
- Confidence: do not comment on unfamiliar libraries unless you are sure there is a problem.
- Tone: only flag negatives. Do not praise. Provide concrete code suggestions where useful using
  a fenced \`\`\`suggestion\`\`\` block with a direct replacement for the line(s).
- Feedback language: write all comments and the summary in ${reviewLanguage}.

// Finish
When you have posted all inline comments, end your turn with a brief, specific summary of the
pull request as your final message: what it changes, why, and any edge cases or risks a reviewer
should know about. This final message is posted as the PR summary comment.`

/** Reads root-level AGENTS.md / AGENT.md / CLAUDE.md from the workspace, if present. */
const readProjectContext = async (workspace: string): Promise<string> => {
  const sections: string[] = []
  for (const fileName of PROJECT_CONTEXT_FILES) {
    try {
      const content = (await readFile(join(workspace, fileName), 'utf8')).trim()
      if (content) {
        sections.push(`## ${fileName}\n${content}`)
      }
    } catch {
      // Not present — skip.
    }
  }
  if (sections.length === 0) return ''
  return `\n\n// Project context (follow these project-specific rules)\n${sections.join('\n\n')}`
}

/**
 * Builds the agent's instructions: the review system prompt, optional custom
 * instructions, and the project's root-level context files.
 */
export const buildInstructions = async (cfg: ReviewConfig): Promise<string> => {
  const custom = cfg.customInstructions
    ? `\n\n// Custom instructions\n${cfg.customInstructions}`
    : ''
  const projectContext = await readProjectContext(cfg.workspace)
  return `${reviewSystemPrompt(cfg.reviewLanguage)}${custom}${projectContext}`
}
