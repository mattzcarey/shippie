import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

export type FlowPriority = 'high' | 'medium' | 'low'
export type FlowNeed = 'browser' | 'api' | 'auth' | 'billing'

/** One user-meaningful product journey — the unit the drivers turn into specs. */
export interface Flow {
  /** kebab-case → spec file name. */
  slug: string
  title: string
  priority: FlowPriority
  entryUrl?: string
  needs: FlowNeed[]
  steps: string[]
  expected: string[]
}

const renderFlowMd = (f: Flow): string =>
  `# ${f.title}

- **slug:** ${f.slug}
- **priority:** ${f.priority}
- **entry:** ${f.entryUrl ?? '(start page)'}
- **needs:** ${f.needs.join(', ') || 'browser'}

## Steps

${f.steps.map((s, i) => `${i + 1}. ${s}`).join('\n')}

## Expected

${f.expected.map((e) => `- ${e}`).join('\n')}
`

/**
 * Persist the catalogued flows as `e2e/specs/<slug>.md` — the human-readable
 * backlog the drivers turn into Playwright specs, and a review artifact.
 */
export const writeCatalog = async (workspace: string, flows: Flow[]): Promise<string> => {
  const dir = join(workspace, 'e2e', 'specs')
  await mkdir(dir, { recursive: true })
  for (const f of flows) {
    await writeFile(join(dir, `${f.slug}.md`), renderFlowMd(f))
  }
  const summary = flows.map((f) => `${f.slug} (${f.priority})`).join(', ')
  return `Wrote ${flows.length} flow spec(s) to e2e/specs/: ${summary}`
}
