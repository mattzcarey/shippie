# GitHub Action reference

Shippie ships as a composite GitHub Action that runs the prebuilt code-review agent on
your pull requests. It sets up Node 22, installs Shippie, and runs `npx flue run review`.
The agent posts inline comments (via the `suggest_change` tool) and leaves its final
message as the PR summary comment.

## Inputs

All inputs are optional except `GITHUB_TOKEN`.

| Input | Description | Required | Default |
| --- | --- | --- | --- |
| `MODEL` | Flue model specifier in `provider/model` form, e.g. `anthropic/claude-sonnet-4-6`, `openai/gpt-5`, `openrouter/...`. | No | `anthropic/claude-sonnet-4-6` |
| `REVIEW_LANGUAGE` | Target natural language for review feedback. | No | `English` |
| `THINKING_LEVEL` | Reasoning effort: `off` \| `minimal` \| `low` \| `medium` \| `high` \| `xhigh`. | No | `medium` |
| `IGNORE` | Comma-separated glob patterns to skip, e.g. `**/*.test.ts,dist/**`. | No | — |
| `CUSTOM_INSTRUCTIONS` | Extra instructions appended to the review prompt. | No | — |
| `MCP_SERVERS` | JSON object of remote (HTTP/SSE) MCP servers to attach. See below. | No | — |
| `ANTHROPIC_API_KEY` | Anthropic API key (for `anthropic/<model>`). | No | — |
| `OPENAI_API_KEY` | OpenAI API key (for `openai/<model>`). | No | — |
| `OPENROUTER_API_KEY` | OpenRouter API key (for `openrouter/<model>`). | No | — |
| `CLOUDFLARE_API_KEY` | Cloudflare API token (for `cloudflare-workers-ai/<model>` or `cloudflare-ai-gateway/<model>`). | No | — |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (required for the Cloudflare Workers AI / AI Gateway providers). | No | — |
| `CLOUDFLARE_GATEWAY_ID` | Cloudflare AI Gateway ID (only for `cloudflare-ai-gateway/<model>`). | No | — |
| `GITHUB_TOKEN` | GitHub token used to post review comments. | **Yes** | — |

Provide the provider credential that matches your chosen `MODEL`. For example, the
default model (`anthropic/claude-sonnet-4-6`) needs `ANTHROPIC_API_KEY`.

### `MCP_SERVERS`

Only remote MCP servers (HTTP/SSE) are supported. Pass a JSON string:

```json
{
  "context7": {
    "url": "https://mcp.context7.com/mcp",
    "transport": "streamable-http",
    "headers": { "Authorization": "Bearer ${MY_TOKEN}" }
  }
}
```

`transport` and `headers` are optional, and a top-level `{"mcpServers": { ... }}`
wrapper is also accepted. MCP tools appear to the model as `mcp__<name>__<tool>`.

## Required permissions and checkout

The caller's workflow must:

- check out with **`fetch-depth: 0`** so Shippie can diff the full PR range, and
- grant **`pull-requests: write`** (to post comments) and **`contents: read`**.

## Example caller workflow

Review every PR into `main`, re-running on each push:

```yaml
name: Shippie 🚢

on:
  pull_request:
    branches: [main]

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

      - name: Shippie 🚢
        uses: mattzcarey/shippie@v0
        with:
          GITHUB_TOKEN: ${{ github.token }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          MODEL: anthropic/claude-sonnet-4-6
          THINKING_LEVEL: medium
          REVIEW_LANGUAGE: English
          IGNORE: "**/*.test.ts,dist/**"
          CUSTOM_INSTRUCTIONS: "Pay special attention to error handling."
```

To run only when explicitly requested (saving API costs and skipping draft PRs),
trigger on `review_requested` for a dedicated bot account instead:

```yaml
on:
  pull_request:
    types: [review_requested]

permissions:
  pull-requests: write
  contents: read

jobs:
  review:
    if: ${{ github.event.requested_reviewer.login == 'your-shippie-bot' }}
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: mattzcarey/shippie@v0
        with:
          GITHUB_TOKEN: ${{ github.token }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Re-request the bot as a reviewer to trigger a fresh review.
