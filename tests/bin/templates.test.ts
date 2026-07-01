import { describe, expect, it } from 'vitest'
// The renderer is plain ESM shipped in the package; import it directly.
import {
  renderFanoutWorkflow,
  renderQaWorkflow,
  renderReviewWorkflow,
} from '../../bin/templates.mjs'

/**
 * Byte-for-byte snapshots of the scaffolded GitHub Actions workflows. The bodies live
 * as real `.yml` files in bin/templates/ with `{{TOKEN}}` substitution; these pin the
 * rendered output so a template or renderer edit that changes what `shippie init` /
 * `shippie qa init` / `shippie qa fanout-init` write shows up as a reviewable diff.
 */

describe('renderReviewWorkflow', () => {
  it('review.yml', () => {
    expect(renderReviewWorkflow()).toMatchSnapshot()
  })
})

describe('renderQaWorkflow', () => {
  it('qa.yml — ubuntu-only (default)', () => {
    expect(renderQaWorkflow()).toMatchSnapshot()
  })
  it('qa.yml — cross-os matrix', () => {
    expect(renderQaWorkflow({ crossOs: true })).toMatchSnapshot()
  })
})

describe('renderFanoutWorkflow', () => {
  it('fanout.yml — empty (placeholder matrix)', () => {
    expect(renderFanoutWorkflow([])).toMatchSnapshot()
  })
  it('fanout.yml — with target repos', () => {
    expect(renderFanoutWorkflow(['owner/a', 'owner/b', 'owner/c'])).toMatchSnapshot()
  })
})
