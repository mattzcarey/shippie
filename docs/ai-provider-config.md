# Model & Provider Configuration

shippie selects a model with a single `provider/model` string. The provider prefix
tells flue which built-in provider to use (and therefore which credentials to read),
and the rest is the model id passed through to that provider.

```
anthropic/claude-sonnet-4-6
openai/gpt-4.1-mini
cloudflare-workers-ai/@cf/openai/gpt-oss-120b
```

## Built-in providers

| Provider prefix         | Credentials                                                   | Example model id                              |
| ----------------------- | ------------------------------------------------------------ | --------------------------------------------- |
| `anthropic`             | `ANTHROPIC_API_KEY`                                          | `anthropic/claude-sonnet-4-6`                 |
| `openai`                | `OPENAI_API_KEY`                                             | `openai/gpt-4.1-mini` (also `openai/gpt-5`)   |
| `openrouter`            | `OPENROUTER_API_KEY`                                         | `openrouter/anthropic/claude-sonnet-4-6`      |
| `cloudflare-workers-ai` | `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID`              | `cloudflare-workers-ai/@cf/openai/gpt-oss-120b` |
| `cloudflare-ai-gateway` | `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID` + `CLOUDFLARE_GATEWAY_ID` | `cloudflare-ai-gateway/anthropic/claude-sonnet-4-6` |
| `litellm`               | `LITELLM_API_KEY` + `LITELLM_BASE_URL`                               | `litellm/anthropic/claude-sonnet-4-6`             |

## Setting the model

The default model is `anthropic/claude-sonnet-4-6`. You can override it three ways:

- **GitHub Action input** — `MODEL`:

  ```yaml
  - uses: mattzcarey/shippie@main
    with:
      MODEL: openai/gpt-4.1-mini
    env:
      OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
      GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
  ```

- **Environment variable** — `SHIPPIE_MODEL` (used by the Action, also works locally):

  ```bash
  SHIPPIE_MODEL=openai/gpt-4.1-mini flue run review --target node
  ```

- **Workflow payload** — `payload.model` when invoking the review workflow directly:

  ```bash
  flue run review --target node --payload '{"platform":"local","model":"openai/gpt-4.1-mini"}'
  ```

## Thinking level

`thinkingLevel` tunes how much reasoning effort the model spends. Valid values are
`off`, `minimal`, `low`, `medium`, `high`, and `xhigh`; the default is `medium`.

Set it with the `THINKING_LEVEL` Action input, the `SHIPPIE_THINKING_LEVEL` env var,
or `payload.thinkingLevel`:

```yaml
- uses: mattzcarey/shippie@main
  with:
    MODEL: anthropic/claude-sonnet-4-6
    THINKING_LEVEL: high
```

```bash
flue run review --target node --payload '{"platform":"local","thinkingLevel":"high"}'
```

## Cloudflare Workers AI

`cloudflare-workers-ai` runs Node-compatible, URL-backed Workers AI models. It needs:

- `CLOUDFLARE_API_KEY` — accepts either a Cloudflare API **token** with AI access, or a
  `wrangler login` **OAuth token** that has the AI scope.
- `CLOUDFLARE_ACCOUNT_ID` — your Cloudflare account id.

```bash
export CLOUDFLARE_API_KEY=...        # API token or wrangler OAuth token with AI access
export CLOUDFLARE_ACCOUNT_ID=...
flue run review --target node \
  --payload '{"platform":"local","model":"cloudflare-workers-ai/@cf/openai/gpt-oss-120b"}'
```

**Recommended model:** `@cf/openai/gpt-oss-120b`. Other strong options are
`@cf/qwen/qwen3-30b-a3b-fp8` and `@cf/zai-org/glm-5.2`.

**Warning:** small models are weak at tool-calling, which the review agent relies on
heavily. Avoid models like `@cf/meta/llama-3.3-70b` for reviews — they tend to fail to
call tools reliably.

For a Cloudflare AI Gateway in front of these models, use the
`cloudflare-ai-gateway` prefix and additionally set `CLOUDFLARE_GATEWAY_ID`.

## LiteLLM (AI gateway)

[LiteLLM](https://litellm.ai) is an AI gateway that lets you access 100+ LLM providers
(OpenAI, Anthropic, Azure, Bedrock, Vertex, Groq, Ollama, and more) through a single
OpenAI-compatible endpoint. Run a LiteLLM proxy and point shippie at it:

```bash
export LITELLM_API_KEY=sk-...      # proxy master or virtual key
export LITELLM_BASE_URL=http://localhost:4000
SHIPPIE_MODEL=litellm/anthropic/claude-sonnet-4-6 npm run review
```

GitHub Action:

```yaml
- uses: mattzcarey/shippie@main
  with:
    MODEL: litellm/anthropic/claude-sonnet-4-6
  env:
    LITELLM_API_KEY: ${{ secrets.LITELLM_API_KEY }}
    LITELLM_BASE_URL: https://litellm.example.com
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The model string after `litellm/` is passed directly to the proxy, so use whatever
model identifiers your LiteLLM config defines.

## Custom OpenAI-compatible providers

To use a self-hosted or third-party OpenAI-compatible endpoint (for example Ollama or
an internal gateway), register it with `registerProvider()` in `src/app.ts`. Once
registered, reference it like any other provider via its `provider/model` string.
