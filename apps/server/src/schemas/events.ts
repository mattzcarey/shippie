import { z } from 'zod'

export enum EventType {
  REVIEW_STARTED = 'review_started',
  REVIEW_STOPPED = 'review_stopped',
  CONFIGURE = 'configure',
}

// get environment info from process.env
export const ReviewStartedSchema = z.object({
  repo_id: z.string(),
  run_id: z.string(),
  event_type: z.literal(EventType.REVIEW_STARTED),
  args: z.record(z.unknown()),
  system: z.object({
    platform: z.string(),
    arch: z.string(),
    shippie_version: z.string(),
    node_version: z.string(),
  }),
  // to add in the future, this is more invasive.
  environment: z.record(z.unknown()).optional(),
  timestamp: z.string(),
})

export type ReviewStartedEvent = z.infer<typeof ReviewStartedSchema>

// this one is all about the ai stuff and what happened during the review
export const ReviewStoppedSchema = z.object({
  repo_id: z.string(),
  run_id: z.string(),
  event_type: z.literal(EventType.REVIEW_STOPPED),
  result: z.object({
    success: z.boolean(),
    error_message: z.string().optional(),
  }),
  tools_called: z.array(z.string()).optional(),
  tokens: z
    .object({
      input: z.number().optional(),
      output: z.number().optional(),
      total: z.number().optional(),
    })
    .optional(),
  details: z.object({
    code_language: z.string().optional(),
    lines_added: z.number().optional(),
    lines_deleted: z.number().optional(),
  }),
  duration_seconds: z.number().optional(),
  timestamp: z.string().optional(),
})

export type ReviewStoppedEvent = z.infer<typeof ReviewStoppedSchema>

// this one is all about what was selected during the configure step
export const ConfigureSchema = z.object({
  repo_id: z.string(),
  event_type: z.literal(EventType.CONFIGURE),
  args: z.record(z.unknown()).optional(),
  timestamp: z.string().optional(),
})

export type ConfigureEvent = z.infer<typeof ConfigureSchema>

export type TelemetryEvent = ReviewStartedEvent | ReviewStoppedEvent | ConfigureEvent
