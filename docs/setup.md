# Setup Instructions 🤖

Shippie 🚢 is a prebuilt code-review agent built on [flue](https://github.com/withastro/flue). It runs the agent loop on "pi" and reviews your code through a one-shot review workflow — either as a GitHub Action on pull requests, or locally against your staged changes.

## Prerequisites

- Node >= 22.19
- Git
- An API key for your chosen model provider (Anthropic, OpenAI, OpenRouter, or Cloudflare)

## GitHub Action 🚀

Add a workflow that runs shippie on every pull request. The job must check out with `fetch-depth: 0` (so the full diff is available) and grant `pull-requests: write` and `contents: read` permissions.

Create `.github/workflows/shippie.yml`:

```yaml
name: Shippie

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

      - name: Run shippie
        uses: mattzcarey/shippie@v0
        with:
          MODEL: anthropic/claude-sonnet-4-6
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

`GITHUB_TOKEN` is required. Provide the API key secret that matches your `MODEL` provider (see [Models](#models) below). Pin `@v<X>` to the major version you want.

The action is a composite action that runs `actions/setup-node@v4` (Node 22), installs dependencies, and runs `npx flue run review`. The agent's final message becomes the PR summary comment, and inline findings are posted via the `suggest_change` tool.

### Action inputs

All inputs are optional unless noted.

| Input | Default | Notes |
| --- | --- | --- |
| `MODEL` | `anthropic/claude-sonnet-4-6` | `provider/model` string |
| `REVIEW_LANGUAGE` | `English` | |
| `THINKING_LEVEL` | `medium` | `off` \| `minimal` \| `low` \| `medium` \| `high` \| `xhigh` |
| `IGNORE` | — | comma-separated glob patterns |
| `CUSTOM_INSTRUCTIONS` | — | extra guidance for the reviewer |
| `MCP_SERVERS` | — | JSON string of remote MCP servers |
| `GITHUB_TOKEN` | — | **required** |
| `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `OPENROUTER_API_KEY` | — | provider credentials |
| `CLOUDFLARE_API_KEY` / `CLOUDFLARE_ACCOUNT_ID` / `CLOUDFLARE_GATEWAY_ID` | — | for Cloudflare providers |

## Local Usage 🌈

Shippie also runs locally with no server, reviewing your **staged** changes (`git diff --cached`).

Clone and install (Node >= 22.19):

```shell
git clone https://github.com/mattzcarey/shippie.git
cd shippie
npm install
```

Set up your `.env` with a model and the matching API key:

```shell
SHIPPIE_MODEL=anthropic/claude-sonnet-4-6
ANTHROPIC_API_KEY=<your-api-key>
```

Stage the files you want reviewed, then run:

```shell
npm run review
```

This is an alias for `flue run review --target node` with the local platform. In local mode shippie reviews your staged diff and writes the results to `.shippie/review/local_*.md`.

You can also run the workflow directly and pass the platform in the payload:

```shell
flue run review --target node --payload '{"platform":"local"}'
```

## Self-built Server 📦

Shippie can build itself into a publishable, runnable server:

```shell
flue build --target node   # -> dist/server.mjs
node dist/server.mjs       # or: npm start
```

Once running, trigger a review by calling the workflow endpoint and waiting for the result:

```shell
curl -X POST 'http://localhost:<port>/workflows/review?wait=result'
```

The package `main` is `./dist/server.mjs`.

## Models

Use a `provider/model` string and supply the matching credential:

| Provider | Example model | Credentials |
| --- | --- | --- |
| `anthropic/<model>` | `anthropic/claude-sonnet-4-6` | `ANTHROPIC_API_KEY` |
| `openai/<model>` | `openai/gpt-4.1-mini`, `openai/gpt-5` | `OPENAI_API_KEY` |
| `openrouter/<model>` | — | `OPENROUTER_API_KEY` |
| `cloudflare-workers-ai/<model>` | `cloudflare-workers-ai/@cf/openai/gpt-oss-120b` | `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID` |
| `cloudflare-ai-gateway/<model>` | — | `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_GATEWAY_ID` |
| `litellm/<model>` | `litellm/anthropic/claude-sonnet-4-6` | `LITELLM_API_KEY` + `LITELLM_BASE_URL` |

For Cloudflare Workers AI, prefer larger models with strong tool-calling (e.g. `@cf/openai/gpt-oss-120b`, `@cf/qwen/qwen3-30b-a3b-fp8`, `@cf/zai-org/glm-5.2`); small models like `@cf/meta/llama-3.3-70b` are weak at tool-calling. For LiteLLM, see [AI Provider Configuration](./ai-provider-config.md#litellm-ai-gateway). Custom OpenAI-compatible providers (Ollama, gateways) are registered with `registerProvider()` in `src/app.ts`.
