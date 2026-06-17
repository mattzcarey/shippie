# Tagging Shippie (live reviews via `@shippie`)

Shippie can run in two modes:

| Mode | Trigger | Deployment | Use |
| --- | --- | --- | --- |
| **One-shot review** | every PR (CI) or `npx shippie review` | GitHub Action / `flue run` — no server | Automatic review on each pull request |
| **Live channel** | someone comments `@shippie …` | a deployed Flue **server** with a GitHub webhook | On-demand reviews and questions |

This page covers the **live channel**. For the per-PR CI review see [setup.md](setup.md).

## How it works

Shippie ships a GitHub **channel** (`src/channels/github.ts`, built on [`@flue/github`](https://github.com/withastro/flue)). When deployed as a server it serves a webhook at:

```
POST https://<your-host>/channels/github/webhook
```

When someone comments `@shippie …` on an issue or pull request, the webhook verifies the
delivery, then dispatches the request to the `mention` agent, which reads the comment, fetches
the PR diff if needed, and replies with a single comment.

## Deploy the server

Shippie is a Flue project, so it deploys anywhere Flue does (Node, Cloudflare, Render, Fly, GitLab CI…). The simplest is Node:

```bash
npm install
npm run build            # -> dist/server.mjs
node dist/server.mjs     # listens on $PORT (default 3000)
```

Set these environment variables on the server:

| Variable | Purpose |
| --- | --- |
| `GITHUB_WEBHOOK_SECRET` | **Required.** Verifies inbound webhook deliveries. |
| `GITHUB_TOKEN` | **Required.** Authenticates Shippie's reply comments (and diff fetches). |
| `SHIPPIE_MODEL` | Model specifier (default `anthropic/claude-sonnet-4-6`). |
| *provider key* | e.g. `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / Cloudflare creds — see [ai-provider-config.md](ai-provider-config.md). |

## Register the GitHub webhook

In your repo (or org) **Settings → Webhooks → Add webhook**:

- **Payload URL:** `https://<your-host>/channels/github/webhook`
- **Content type:** `application/json`
- **Secret:** the same value as `GITHUB_WEBHOOK_SECRET`
- **Events:** select **Issue comments** and **Pull request review comments**

## Use it

Comment on any issue or pull request:

```text
@shippie review
```

or ask a question:

```text
@shippie does this change handle the empty-input case?
```

Shippie replies as a comment. Notes:

- Only comments containing `@shippie` trigger it; it ignores comments from bots (including itself).
- On a pull request, `@shippie review` fetches the diff via the GitHub API and posts a concise review.
- The channel is webhook-driven and stateless; GitHub expects a `2xx` within ~10s, so Shippie admits the work and replies asynchronously.
