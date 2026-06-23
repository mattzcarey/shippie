import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { z } from 'zod'
import {
  ConfigureSchema,
  EventType,
  ReviewStartedSchema,
  ReviewStoppedSchema,
  type TelemetryEvent,
} from './schemas/events'

const app = new Hono<{ Bindings: Env }>()

app.use(
  '*',
  cors({
    origin: '*',
    allowMethods: ['POST'],
    allowHeaders: ['Content-Type'],
    exposeHeaders: ['Content-Length'],
    maxAge: 86400,
  })
)

app.post('/events', async (c) => {
  try {
    const body = await c.req.json()
    const event_type = body.event_type

    const event = {
      ...body,
      timestamp: new Date().toISOString(),
    }

    let validatedEvent: TelemetryEvent

    switch (event_type) {
      case EventType.REVIEW_STARTED: {
        const validated = ReviewStartedSchema.parse(event)
        validatedEvent = validated
        break
      }
      case EventType.REVIEW_STOPPED: {
        const validated = ReviewStoppedSchema.parse(event)
        validatedEvent = validated
        break
      }
      case EventType.CONFIGURE: {
        const validated = ConfigureSchema.parse(event)
        validatedEvent = validated
        break
      }
      default:
        return c.json({ error: 'Invalid event type' }, 400)
    }

    await c.env.TELEMETRY_PIPELINE.send([validatedEvent])

    return c.json({ success: true }, 200)
  } catch (error) {
    console.error('Telemetry error:', error)

    if (error instanceof z.ZodError) {
      return c.json({ error: 'Validation error', details: error.errors }, 400)
    }

    return c.json({ error: 'Failed to process telemetry data' }, 500)
  }
})

// Fallback route
app.all('*', (c) => {
  return c.json({ error: 'Not found' }, 404)
})

export default app
