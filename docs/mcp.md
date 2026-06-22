# Model Context Protocol (MCP) Configuration

Shippie can debug failures in obscure browsers, perform QA testing, understand the original goal of a ticket and generally do the things a human would do using external tools supplied via MCP servers.

You can give the shippie agent access to a web browser, database, documentation, project management systems or any other external tools that expose a remote MCP endpoint.

Shippie acts as an MCP client, like Cursor, Windsurf, VSCode and Claude.

## How MCP servers are supplied

MCP servers are configured as a JSON string, passed in one of two ways:

- The GitHub Action input `MCP_SERVERS`
- The environment variable `SHIPPIE_MCP_SERVERS`

There is **no** checked-in `.mcp.json` / `.cursor/mcp.json` / `.shippie/mcp.json` file. That mechanism has been removed — configuration now lives in your workflow inputs or environment, not in the repo.

## Remote servers only (no stdio)

flue supports **remote MCP only** — servers reachable over HTTP or SSE. There is **no** stdio/command transport. This is a deliberate limitation compared with the old shippie: you can no longer launch a server with `command`/`args` (e.g. `npx -y @package/mcp-server`). Any server you want to use must be running and reachable at a URL.

If a tool only ships as a stdio server, host it behind an HTTP/SSE bridge and point shippie at that URL.

## JSON shape

```json
{
  "<name>": {
    "url": "https://your-mcp-server.example.com/mcp",
    "transport": "streamable-http",
    "headers": {
      "Authorization": "Bearer your_token"
    }
  }
}
```

Fields:

- `url` (required) — the remote MCP endpoint.
- `transport` (optional) — `"streamable-http"` or `"sse"`. Inferred when omitted.
- `headers` (optional) — sent with every request, e.g. for authentication.

A top-level `{"mcpServers": { ... }}` wrapper is also accepted:

```json
{
  "mcpServers": {
    "context7": {
      "url": "https://mcp.context7.com/mcp",
      "transport": "streamable-http"
    }
  }
}
```

## How tools appear to the agent

Each MCP tool is exposed to the model as `mcp__<name>__<tool>`, where `<name>` is the key you gave the server in the JSON. For a server named `context7` exposing a `resolve-library-id` tool, the agent sees `mcp__context7__resolve-library-id`.

## Example: wiring MCP_SERVERS in a caller workflow

```yaml
name: Shippie Review

on:
  pull_request:

permissions:
  pull-requests: write
  contents: read

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: mattzcarey/shippie@main
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          MODEL: anthropic/claude-sonnet-4-6
          MCP_SERVERS: |
            {
              "context7": {
                "url": "https://mcp.context7.com/mcp",
                "transport": "streamable-http"
              },
              "internal-docs": {
                "url": "https://mcp.internal.example.com/sse",
                "transport": "sse",
                "headers": {
                  "Authorization": "Bearer ${{ secrets.DOCS_MCP_TOKEN }}"
                }
              }
            }
```

The same JSON can be supplied directly to a local run via the `SHIPPIE_MCP_SERVERS` environment variable:

```bash
SHIPPIE_MCP_SERVERS='{"context7":{"url":"https://mcp.context7.com/mcp"}}' \
  flue run review --target node --payload '{"platform":"local"}'
```
