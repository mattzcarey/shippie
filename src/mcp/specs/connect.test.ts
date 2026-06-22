import type { ToolDefinition } from '@flue/runtime'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { McpServerInput } from '../../review/config'
import { connectMcpServers } from '../connect'

const { connectMcpServer } = vi.hoisted(() => ({ connectMcpServer: vi.fn() }))

vi.mock('@flue/runtime', async (orig) => ({
  ...(await orig<typeof import('@flue/runtime')>()),
  connectMcpServer,
}))

const tool = (name: string): ToolDefinition => ({ name }) as unknown as ToolDefinition

beforeEach(() => {
  connectMcpServer.mockReset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('connectMcpServers', () => {
  it('returns empty tools with a no-op close for an empty servers map', async () => {
    const result = await connectMcpServers({})

    expect(result.tools).toEqual([])
    expect(connectMcpServer).not.toHaveBeenCalled()
    await expect(result.close()).resolves.toBeUndefined()
  })

  it('connects each server, aggregates flattened tools and closes every connection', async () => {
    const closeA = vi.fn().mockResolvedValue(undefined)
    const closeB = vi.fn().mockResolvedValue(undefined)
    connectMcpServer
      .mockResolvedValueOnce({
        name: 'a',
        tools: [tool('a1'), tool('a2')],
        close: closeA,
      })
      .mockResolvedValueOnce({ name: 'b', tools: [tool('b1')], close: closeB })

    const servers: Record<string, McpServerInput> = {
      a: {
        url: 'https://a.example/mcp',
        transport: 'streamable-http',
        headers: { 'x-a': '1' },
      },
      b: { url: 'https://b.example/mcp', transport: 'sse' },
    }

    const result = await connectMcpServers(servers)

    expect(connectMcpServer).toHaveBeenCalledTimes(2)
    expect(connectMcpServer).toHaveBeenCalledWith('a', {
      url: 'https://a.example/mcp',
      transport: 'streamable-http',
      headers: { 'x-a': '1' },
    })
    expect(connectMcpServer).toHaveBeenCalledWith('b', {
      url: 'https://b.example/mcp',
      transport: 'sse',
      headers: undefined,
    })

    expect(result.tools.map((t) => t.name)).toEqual(['a1', 'a2', 'b1'])

    await result.close()
    expect(closeA).toHaveBeenCalledTimes(1)
    expect(closeB).toHaveBeenCalledTimes(1)
  })

  it('skips a server that fails to connect, logs it, and still connects the others', async () => {
    const closeOk = vi.fn().mockResolvedValue(undefined)
    connectMcpServer
      .mockRejectedValueOnce(new Error('boom'))
      .mockResolvedValueOnce({ name: 'good', tools: [tool('g1')], close: closeOk })

    const servers: Record<string, McpServerInput> = {
      bad: { url: 'https://bad.example/mcp' },
      good: { url: 'https://good.example/mcp' },
    }

    const result = await connectMcpServers(servers)

    expect(connectMcpServer).toHaveBeenCalledTimes(2)
    expect(console.error).toHaveBeenCalledTimes(1)
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to connect MCP server "bad"')
    )
    expect(result.tools.map((t) => t.name)).toEqual(['g1'])

    await expect(result.close()).resolves.toBeUndefined()
    expect(closeOk).toHaveBeenCalledTimes(1)
  })
})
