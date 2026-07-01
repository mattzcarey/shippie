import { describe, expect, it } from 'vitest'
import {
  DEFAULT_MODEL,
  DEFAULT_QA_LEAD_MODEL,
  resolveModel,
  resolveQaDriverModel,
  resolveQaLeadModel,
} from '../../src/common/models'

describe('resolveModel (review + mention)', () => {
  it('defaults, reads SHIPPIE_MODEL, and honours the override', () => {
    expect(resolveModel({})).toBe(DEFAULT_MODEL)
    expect(resolveModel({ SHIPPIE_MODEL: 'x/y' })).toBe('x/y')
    expect(resolveModel({ SHIPPIE_MODEL: 'x/y' }, 'over/ride')).toBe('over/ride')
    expect(resolveModel({ SHIPPIE_MODEL: '' })).toBe(DEFAULT_MODEL) // empty env is treated as unset
  })
})

describe('resolveQaLeadModel (qa lead + healer)', () => {
  it('precedence: override > SHIPPIE_QA_MODEL > SHIPPIE_MODEL > default', () => {
    expect(resolveQaLeadModel({})).toBe(DEFAULT_QA_LEAD_MODEL)
    expect(resolveQaLeadModel({ SHIPPIE_MODEL: 'base/m' })).toBe('base/m')
    expect(
      resolveQaLeadModel({ SHIPPIE_MODEL: 'base/m', SHIPPIE_QA_MODEL: 'qa/m' })
    ).toBe('qa/m')
    expect(resolveQaLeadModel({ SHIPPIE_QA_MODEL: 'qa/m' }, 'over/ride')).toBe(
      'over/ride'
    )
  })
})

describe('resolveQaDriverModel (per-flow drivers)', () => {
  it('inherits the lead knobs so one env var moves the whole system', () => {
    // Zero-config keeps the cheap driver default (opus lead + sonnet driver split).
    expect(resolveQaDriverModel({})).toBe(DEFAULT_MODEL)
    // Setting SHIPPIE_MODEL / SHIPPIE_QA_MODEL moves the drivers too (the bug this fixes).
    expect(resolveQaDriverModel({ SHIPPIE_MODEL: 'base/m' })).toBe('base/m')
    expect(resolveQaDriverModel({ SHIPPIE_QA_MODEL: 'qa/m' })).toBe('qa/m')
    // Dedicated override wins and lets you keep a cheaper driver tier.
    expect(
      resolveQaDriverModel({
        SHIPPIE_QA_MODEL: 'qa/m',
        SHIPPIE_QA_DRIVER_MODEL: 'cheap/m',
      })
    ).toBe('cheap/m')
  })
})
