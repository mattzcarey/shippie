import { createHash, randomUUID } from 'node:crypto'

const TELEMETRY_URL = 'https://telemetry.shippie.dev/events'

/** Anonymous, opt-out usage telemetry. Disable with SHIPPIE_TELEMETRY=false. */
export interface TelemetryInput {
  enabled: boolean
  /** Stable seed (owner/repo or workspace path) hashed into an anonymous id. */
  repoSeed: string
  platform: string
  model: string
  reviewed: number
}

const anonId = (seed: string): string =>
  createHash('sha256').update(seed).digest('hex').slice(0, 32)

/**
 * Fire-and-forget anonymous "review_started" event. Never throws and never
 * blocks the review; aborts after 3s. No code or file contents are sent — only
 * an anonymized repo id, the platform, the model, and host info.
 */
export const sendReviewStarted = (input: TelemetryInput): void => {
  if (!input.enabled) return

  const event = {
    event_type: 'review_started',
    run_id: randomUUID(),
    repo_id: anonId(input.repoSeed),
    platform: input.platform,
    model: input.model,
    reviewed: input.reviewed,
    system: {
      platform: process.platform,
      arch: process.arch,
      node_version: process.version,
      shippie_version: process.env.npm_package_version ?? 'unknown',
    },
  }

  void fetch(TELEMETRY_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(event),
    signal: AbortSignal.timeout(3000),
  }).catch(() => {})
}
