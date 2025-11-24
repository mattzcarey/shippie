import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { experimental_createMCPClient, type Tool } from 'ai'
import { Experimental_StdioMCPTransport as StdioMCPTransport } from 'ai/mcp-stdio'
import { getGitRoot } from '../../git/getChangedFilesNames'
import { logger } from '../../utils/logger'

interface MCPClient {
  tools: () => Promise<Record<string, Tool>>
  close: () => Promise<void>
}

interface MCPServerConfig {
  command?: string
  args?: string[]
  url?: string
  headers?: Record<string, string>
}

interface MCPConfig {
  mcpServers: Record<string, MCPServerConfig>
}

export class MCPClientManager {
  private clients: Record<string, MCPClient | null> = {}
  private config: MCPConfig | null = null

  async loadConfig(): Promise<void> {
    try {
      const workspacePath = await getGitRoot()
      const config: MCPConfig = { mcpServers: {} }

      // Try to load from .shippie/mcp.json
      try {
        const shippieConfigPath = join(workspacePath, '.shippie', 'mcp.json')
        const shippieConfigContent = await readFile(shippieConfigPath, 'utf-8')
        const shippieConfig = JSON.parse(shippieConfigContent) as MCPConfig
        config.mcpServers = { ...config.mcpServers, ...shippieConfig.mcpServers }
        logger.info('Loaded MCP config from .shippie/mcp.json')
      } catch (error) {
        logger.debug(`No .shippie/mcp.json found or error reading it: ${error}`)
      }

      // Try to load from .cursor/mcp.json
      try {
        const cursorConfigPath = join(workspacePath, '.cursor', 'mcp.json')
        const cursorConfigContent = await readFile(cursorConfigPath, 'utf-8')
        const cursorConfig = JSON.parse(cursorConfigContent) as MCPConfig
        config.mcpServers = { ...config.mcpServers, ...cursorConfig.mcpServers }
        logger.info('Loaded MCP config from .cursor/mcp.json')
      } catch (error) {
        logger.debug(`No .cursor/mcp.json found or error reading it: ${error}`)
      }

      // If no configs were found, set config to null
      if (Object.keys(config.mcpServers).length === 0) {
        logger.warn('No MCP configuration found in .shippie/mcp.json or .cursor/mcp.json')
        this.config = null
        return
      }

      this.config = config
    } catch (error) {
      logger.error(`Failed to load MCP config: ${error}`)
      this.config = null
    }
  }

  async startClients(): Promise<void> {
    if (!this.config) {
      logger.warn('Cannot start clients: MCP config not loaded')
      return
    }

    for (const [serverName, serverConfig] of Object.entries(this.config.mcpServers)) {
      try {
        if (serverConfig.command) {
          // Use StdioMCPTransport for command-based configuration
          const transport = new StdioMCPTransport({
            command: serverConfig.command,
            args: serverConfig.args,
          })

          this.clients[serverName] = await experimental_createMCPClient({
            transport,
          })
          logger.info(`Started MCP client for ${serverName}`)
        } else if (serverConfig.url) {
          // Use SSE transport directly for URL-based configuration
          this.clients[serverName] = await experimental_createMCPClient({
            transport: {
              type: 'sse',
              url: serverConfig.url,
              headers: serverConfig.headers,
            },
          })
        } else {
          logger.error(`Invalid MCP server configuration for ${serverName}`)
          this.clients[serverName] = null
        }
      } catch (error) {
        logger.error(`Failed to create MCP client for ${serverName}: ${error}`)
        this.clients[serverName] = null
      }
    }
  }

  async getTools(): Promise<Record<string, Record<string, Tool>>> {
    const allTools: Record<string, Record<string, Tool>> = {}

    for (const [serverName, client] of Object.entries(this.clients)) {
      if (client) {
        try {
          allTools[serverName] = await client.tools()
        } catch (error) {
          logger.error(`Failed to get tools from ${serverName}: ${error}`)
          allTools[serverName] = {}
        }
      }
    }

    return allTools
  }

  async closeClients(): Promise<void> {
    for (const [serverName, client] of Object.entries(this.clients)) {
      if (client) {
        try {
          await client.close()
        } catch (error) {
          logger.error(`Failed to close MCP client ${serverName}: ${error}`)
        }
      }
    }

    this.clients = {}
  }
}
