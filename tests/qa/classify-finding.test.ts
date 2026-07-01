import { describe, expect, it } from 'vitest'
import { resolveQaConfig } from '../../src/qa/config'
import { decideTier, type Finding } from '../../src/qa/pr-policy'
import { createClassifyFindingTool } from '../../src/tools/classify-finding'

const cfg = resolveQaConfig({ platform: 'local', workspace: '/tmp/qa' }, {})
const tool = createClassifyFindingTool(cfg)

const run = (finding: Finding) =>
  // The tool's execute returns the TierDecision as JSON.
  (tool.execute as (args: Finding) => Promise<string>)(finding)

describe('classify_finding tool', () => {
  const findings: Finding[] = [
    { flowSlug: 'a', tier: 'broken-flow', severity: 'low', rationale: 'r' },
    { flowSlug: 'b', tier: 'missing-coverage', severity: 'low', rationale: 'r' },
    { flowSlug: 'c', tier: 'refactor-hint', severity: 'high', rationale: 'r' },
    {
      flowSlug: 'd',
      tier: 'refactor-hint',
      severity: 'blocker',
      rationale: 'r',
      pressingNeed: true,
    },
  ]

  it('returns the same JSON decideTier produces for each tier', async () => {
    for (const finding of findings) {
      expect(JSON.parse(await run(finding))).toEqual(decideTier(finding))
    }
  })

  it('accepts broken-flow and missing-coverage, rejects soft refactor-hint', async () => {
    expect(JSON.parse(await run(findings[0])).accepted).toBe(true)
    expect(JSON.parse(await run(findings[1])).accepted).toBe(true)
    expect(JSON.parse(await run(findings[2])).accepted).toBe(false)
    expect(JSON.parse(await run(findings[3])).accepted).toBe(true)
  })
})
