import { createHash, randomUUID } from 'node:crypto'

const TELEMETRY_URL = 'https://telemetry.shippie.dev/events'

/** Anonymous, opt-out usage telemetry. Disable with SHIPPIE_TELEMETRY=false. */
export interface TelemetryInput {
  enabled: boolean
  /** Stable seed (owner/repo or workspace path) hashed into an anonymous id. */
  repoSeed: string
  platform: string
  model: string
}

const anonId = (seed: string): string =>
  createHash('sha256').update(seed).digest('hex').slice(0, 32)

/**
 * Fire-and-forget anonymous event. Never throws and never blocks; aborts after
 * 3s. No code or file contents are sent — only an anonymized repo id, the
 * platform, the model, host info, and any event-specific `extra` fields.
 */
const sendEvent = (
  eventType: string,
  input: TelemetryInput,
  extra: Record<string, unknown> = {}
): void => {
  if (!input.enabled) return

  const event = {
    event_type: eventType,
    run_id: randomUUID(),
    repo_id: anonId(input.repoSeed),
    platform: input.platform,
    model: input.model,
    ...extra,
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

/** Fire-and-forget anonymous "review_started" event (with the reviewed-file count). */
export const sendReviewStarted = (input: TelemetryInput, reviewed: number): void =>
  sendEvent('review_started', input, { reviewed })

/** Fire-and-forget anonymous "qa_started" event. */
export const sendQaStarted = (input: TelemetryInput): void =>
  sendEvent('qa_started', input)
