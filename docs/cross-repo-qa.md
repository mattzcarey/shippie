# Running Shippie QA across many repos (cross-repo fan-out)

Run [Shippie QA](./ambient-qa.md) across many repositories you own from a single
**control repo**, on a schedule and on demand. This guide covers the architecture, the
one-time setup, and the escape hatch for repos you can't scaffold.

## Why you can't just use `GITHUB_TOKEN`

The default `GITHUB_TOKEN` minted for a workflow run is **scoped to its own repo**. It
**cannot** push to, open a PR in, or dispatch a workflow in a *different* repo — not even
with `permissions: write-all`. So any cross-repo path needs a separate credential.

The clean credential is a **GitHub App installation token**
([`actions/create-github-app-token@v1`](https://github.com/actions/create-github-app-token)):
short-lived, scoped per-repo, auto-revoked at the end of the job, survives owner renames,
and doesn't burn a human's PAT rate limit.

## Architecture: dispatch, don't centralize

The control repo only **dispatches** each target repo's *own* `shippie-qa.yml`. The
heavy lifting (running the agent, writing specs, pushing a branch, opening a PR, running
the verify matrix) stays in the target repo, where it runs under the **target's own
`GITHUB_TOKEN`**.

```
control repo                                target repo (×N)
─────────────                               ────────────────
shippie-qa-fanout.yml                       shippie-qa.yml
  App token (actions: write)  ──dispatch──▶   GITHUB_TOKEN (contents + pull-requests: write)
                                              author → PR, verify → CDP tests
```

This token split is the whole design:

| Leg | Credential | Permissions it needs |
|---|---|---|
| Control → target **dispatch** | App installation token | `actions: write` only — all `gh workflow run` needs |
| Target's own QA run (specs, branch, PR) | the **target's** `GITHUB_TOKEN` | `contents: write` + `pull-requests: write` (already in the scaffolded workflow) |

Because the target authors under its own token, the App token needs **no** `contents` or
`pull-requests` grant on the targets. Least privilege, and the compute/secrets stay at the
edges.

## Setup

### 1. Create a GitHub App (one-time)

1. Settings → Developer settings → GitHub Apps → **New GitHub App**.
2. Permissions → Repository → **Actions: Read and write**. Nothing else is needed.
3. Generate a **private key** (downloads a `.pem`).
4. **Install** the App on every target repo. (Installing it on the control repo is not
   required.)

### 2. Wire the credential into the control repo (one-time)

In the **control** repo, Settings → Secrets and variables → Actions:

- Add the App ID as a **variable** named `QA_APP_ID`.
- Add the private key as a **secret** named `QA_APP_PRIVATE_KEY` (paste the full `.pem`).

### 3. Scaffold the fan-out workflow

From the control repo, pass the target repos (`owner/repo`) as comma- or
space-separated args:

```sh
shippie qa fanout-init me/app-one,me/app-two me/marketing-site
```

This writes `.github/workflows/shippie-qa-fanout.yml` with those repos in the dispatch
matrix. Run it with no args to scaffold the workflow with a commented placeholder matrix
you fill in by hand. Either way, edit the matrix in the generated file to add/remove repos.

### 4. Prepare each target repo (one-time)

In each target repo:

```sh
shippie qa init   # writes .github/workflows/shippie-qa.yml; commit + push to the default branch
```

Then:

- Add its model provider key as a repo secret, e.g. `ANTHROPIC_API_KEY`.
- Settings → Actions → General → enable **"Allow GitHub Actions to create and approve
  pull requests"** — without it the target's own QA run can't open its PR.

The dispatch targets the **default branch**, so `shippie-qa.yml` must be committed there.

### 5. Run it

- **Scheduled:** the fan-out workflow runs on its cron (Mondays 06:00 UTC by default).
- **On demand:**
  ```sh
  gh workflow run shippie-qa-fanout.yml
  gh workflow run shippie-qa-fanout.yml -f scope="checkout + login"
  ```

`gh workflow run` is fire-and-forget: it returns once the dispatch is accepted. Each
target then runs independently and opens a PR into itself. With `fail-fast: false`, one
mis-configured repo fails only its own matrix shard.

## Optional: the thin reusable-workflow caller

Shippie ships a reusable `workflow_call` workflow at
[`.github/workflows/qa-reusable.yml`](../.github/workflows/qa-reusable.yml). A target repo
can replace its inlined `shippie-qa.yml` with a thin caller, which lets you version-bump the
whole QA pipeline across every target from one place:

```yaml
name: Shippie QA 🧪
on:
  schedule:
    - cron: "0 6 * * 1"
  workflow_dispatch:
    inputs:
      target: { required: false, type: string }
      scope:  { required: false, type: string }
jobs:
  qa:
    uses: mattzcarey/shippie/.github/workflows/qa-reusable.yml@v0
    with:
      target: ${{ inputs.target }}
      scope:  ${{ inputs.scope }}
    secrets:
      ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

Prefer the **inlined** workflow (the `shippie qa init` default) when you want a
self-contained, debuggable file or the `--cross-os` verify matrix — that 3-OS matrix is not
expressible cleanly through `workflow_call` inputs, so the reusable workflow runs the
ubuntu-only verify leg. Prefer the **reusable caller** when you operate a fleet and want
central pipeline upgrades.

## Escape hatch: checkout-and-run in the control runner

For repos you **cannot** scaffold (can't add `shippie-qa.yml`, or org policy forbids Actions
from creating PRs there), check the target out into the control runner and run the action
directly. Now the App token must carry **`contents: write` + `pull-requests: write` on the
target**, and the agent + key are exercised in the control runner — a broader blast radius
and centralized cost, so use it sparingly.

```yaml
qa-escape-hatch:
  runs-on: ubuntu-latest
  timeout-minutes: 90
  strategy:
    fail-fast: false
    matrix:
      repo: [my-org/legacy-no-actions]
  steps:
    - uses: actions/create-github-app-token@v1
      id: app-token
      with:
        app-id: ${{ vars.QA_APP_ID }}
        private-key: ${{ secrets.QA_APP_PRIVATE_KEY }}
        owner: ${{ github.repository_owner }}
        repositories: ${{ matrix.repo }}
        permission-contents: write
        permission-pull-requests: write
    - uses: actions/checkout@v4
      with:
        repository: ${{ matrix.repo }}
        token: ${{ steps.app-token.outputs.token }}
        fetch-depth: 0
    - id: qa
      uses: mattzcarey/shippie/qa@v0
      with:
        ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
        GITHUB_TOKEN: ${{ steps.app-token.outputs.token }}   # the App token, NOT github.token
        TARGET: ${{ inputs.target }}
```

## Troubleshooting

- **"Resource not accessible by integration"** — the App isn't installed on that target, the
  `owner` doesn't match the installation, or `permission-actions: write` is missing.
- **Dispatch 404** — `shippie-qa.yml` isn't on the target's default branch yet.
- **Target run opens no PR** — "Allow GitHub Actions to create and approve pull requests" is
  off, or there was no diff (no missing coverage to add).
- **Token revoked mid-job** — expected; the App token is revoked in a post step. Only matters
  if you try to reuse it across jobs.
