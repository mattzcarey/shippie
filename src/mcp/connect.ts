import { type ToolDefinition, connectMcpServer } from '@flue/runtime'
import type { McpServerInput } from '../review/config'

export interface McpConnection {
  tools: ToolDefinition[]
  close: () => Promise<void>
}

/**
 * Connects to the MCP servers supplied via the GitHub Action config (NOT a
 * `.mcp.json`). Flue supports remote HTTP/SSE transports only, so each entry
 * must be a `url`. A server that fails to connect is skipped (logged to stderr)
 * rather than aborting the whole review.
 */
export const connectMcpServers = async (
  servers: Record<string, McpServerInput>
): Promise<McpConnection> => {
  const entries = Object.entries(servers)
  if (entries.length === 0) {
    return { tools: [], close: async () => {} }
  }

  const connections = (
    await Promise.all(
      entries.map(async ([name, opts]) => {
        try {
          return await connectMcpServer(name, {
            url: opts.url,
            transport: opts.transport,
            headers: opts.headers,
          })
        } catch (error) {
          console.error(
            `[shippie] Failed to connect MCP server "${name}": ${error instanceof Error ? error.message : String(error)}`
          )
          return null
        }
      })
    )
  ).filter((c): c is NonNullable<typeof c> => c !== null)

  return {
    tools: connections.flatMap((c) => c.tools),
    close: async () => {
      await Promise.all(connections.map((c) => c.close().catch(() => {})))
    },
  }
}
