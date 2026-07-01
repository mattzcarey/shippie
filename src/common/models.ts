/**
 * Centralised model configuration — the SINGLE place model defaults and env-var
 * precedence live. No agent, tool, or workflow hardcodes a model string; every role
 * resolves through here. So `SHIPPIE_MODEL` alone configures the whole system, and
 * each role has exactly one documented override that falls back to the base.
 *
 * Precedence per role (first non-empty value wins):
 *   review + /shippie mention : SHIPPIE_MODEL                                          → sonnet
 *   qa lead + healer          : SHIPPIE_QA_MODEL        → SHIPPIE_MODEL                 → opus
 *   qa per-flow drivers       : SHIPPIE_QA_DRIVER_MODEL → SHIPPIE_QA_MODEL → SHIPPIE_MODEL → sonnet
 *
 * The `override` argument is the workflow payload's `model` (highest precedence —
 * back-compat with `flue run <wf> --payload '{"model":"..."}'`).
 */
type Env = Record<string, string | undefined>

/** General / cost-tier default: review, the QA per-flow drivers, and the mention agent. */
export const DEFAULT_MODEL = 'anthropic/claude-sonnet-4-6'
/** Judgment-tier default: the QA lead + healer (exploration, root-cause, source fixes). */
export const DEFAULT_QA_LEAD_MODEL = 'anthropic/claude-opus-4-8'

/** First value that is neither undefined nor empty (env vars are often set to ""). */
const firstSet = (...vals: (string | undefined)[]): string | undefined =>
  vals.find((v) => v !== undefined && v !== '')

/** Model for the review agent and the `/shippie` mention agent. */
export const resolveModel = (env: Env, override?: string): string =>
  firstSet(override, env.SHIPPIE_MODEL) ?? DEFAULT_MODEL

/** Model for the QA lead + healer — the judgment tier. Inherits `SHIPPIE_MODEL`. */
export const resolveQaLeadModel = (env: Env, override?: string): string =>
  firstSet(override, env.SHIPPIE_QA_MODEL, env.SHIPPIE_MODEL) ?? DEFAULT_QA_LEAD_MODEL

/**
 * Model for the QA per-flow drivers — the cheap "hands" tier. Inherits the QA lead
 * knobs so setting `SHIPPIE_MODEL`/`SHIPPIE_QA_MODEL` moves the drivers too; falls back
 * to the general default only when nothing is configured (keeps the opus-lead/
 * sonnet-driver split as the zero-config cost optimisation).
 */
export const resolveQaDriverModel = (env: Env, override?: string): string =>
  firstSet(
    override,
    env.SHIPPIE_QA_DRIVER_MODEL,
    env.SHIPPIE_QA_MODEL,
    env.SHIPPIE_MODEL
  ) ?? DEFAULT_MODEL
