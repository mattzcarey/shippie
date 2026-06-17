# Run Shippie on demand (`/shippie` on a PR)

Comment `/shippie` on a pull request to run Shippie on demand. There are two ways to wire it up:

| Mode | How | Hosting |
| --- | --- | --- |
| **Actions on comment** (recommended) | a GitHub Actions workflow triggered by the comment | none — runs in CI |
| **Webhook channel** | a deployed Flue server with a GitHub webhook | a hosted server |

Both also coexist with the automatic per-PR review (see [setup.md](setup.md)).

> We use `/shippie` (a command), not `@shippie` (which would imply a real GitHub user account).

---

## Actions on comment (no server) — recommended

Add a workflow that runs when a PR comment contains `/shippie`. It resolves the PR's refs and runs the
Shippie action — no hosting, just Actions minutes.

```yaml
# .github/workflows/shippie-mention.yml
name: Shippie /shippie

on:
  issue_comment:
    types: [created]

permissions:
  pull-requests: write
  contents: read

jobs:
  shippie:
    if: >-
      ${{ github.event.issue.pull_request &&
          github.event.comment.user.type != 'Bot' &&
          contains(github.event.comment.body, '/shippie') &&
          contains(fromJSON('["OWNER","MEMBER","COLLABORATOR"]'), github.event.comment.author_association) }}
    runs-on: ubuntu-latest
    steps:
      - name: Resolve PR refs
        id: pr
        env:
          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        run: |
          data=$(gh pr view "${{ github.event.issue.number }}" \
            --repo "${{ github.repository }}" --json headRefOid,baseRefOid)
          echo "head_sha=$(echo "$data" | jq -r .headRefOid)" >> "$GITHUB_OUTPUT"
          echo "base_sha=$(echo "$data" | jq -r .baseRefOid)" >> "$GITHUB_OUTPUT"

      - uses: actions/checkout@v4
        with:
          ref: refs/pull/${{ github.event.issue.number }}/head
          fetch-depth: 0

      - name: Ensure base commit is present
        run: git fetch --no-tags --depth=1 origin "${{ steps.pr.outputs.base_sha }}" || true

      - name: Run Shippie 🚢
        uses: mattzcarey/shippie@v0
        with:
          MODEL: anthropic/claude-sonnet-4-6
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          PR_NUMBER: ${{ github.event.issue.number }}
          BASE_SHA: ${{ steps.pr.outputs.base_sha }}
          HEAD_SHA: ${{ steps.pr.outputs.head_sha }}
```

Then comment `/shippie review` on any pull request. This runs the same review as the per-PR action
(inline comments + a summary). This repo dogfoods it in `.github/workflows/shippie-mention.yml`.

> **Security:** the `author_association` gate (`OWNER`/`MEMBER`/`COLLABORATOR`) is important. This job
> runs with write permissions and secrets and checks out PR head code, so without the gate a fork author
> could trigger it on malicious code (a "pwn request"). Keep the gate; only trusted collaborators can run
> `/shippie`.

> The Actions-on-comment path runs a **review**. For free-form questions (`/shippie does X handle Y?`),
> use the webhook channel below, whose agent can answer as well as review.

---

## Webhook channel (deploy a server)

Shippie also ships a GitHub **channel** (`src/channels/github.ts`, built on
[`@flue/github`](https://github.com/withastro/flue)). Deployed as a server it serves a webhook at
`POST https://<your-host>/channels/github/webhook`; a `/shippie` comment is verified, dispatched to the
`mention` agent, which fetches the PR diff if needed and replies. Use this when you want real-time
responses, free-form Q&A, or to run outside GitHub Actions.

### Deploy

Shippie deploys anywhere Flue does (Node, Cloudflare, Render, Fly…). The simplest is Node:

```bash
npm install
npm run build            # -> dist/server.mjs
node dist/server.mjs     # listens on $PORT (default 3000)
```

Set on the server:

| Variable | Purpose |
| --- | --- |
| `GITHUB_WEBHOOK_SECRET` | **Required.** Verifies inbound webhook deliveries. |
| `GITHUB_TOKEN` | **Required.** Authenticates Shippie's reply comments + diff fetches. |
| `SHIPPIE_MODEL` | Model specifier (default `anthropic/claude-sonnet-4-6`). |
| *provider key* | e.g. `ANTHROPIC_API_KEY` — see [ai-provider-config.md](ai-provider-config.md). |

### Register the webhook

Repo (or org) **Settings → Webhooks → Add webhook**:

- **Payload URL:** `https://<your-host>/channels/github/webhook`
- **Content type:** `application/json`
- **Secret:** the same value as `GITHUB_WEBHOOK_SECRET`
- **Events:** **Issue comments** and **Pull request review comments**

Then comment `/shippie review` (or ask a question) on any issue or pull request. Shippie ignores comments
from bots (including itself), and the channel replies asynchronously (GitHub expects a `2xx` within ~10s).
