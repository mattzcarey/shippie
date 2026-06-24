#!/usr/bin/env bash
# Run the QA workflow via the PREBUILT server (dist/server.mjs) using the shippie
# CLI. This path needs only @flue/runtime at runtime — NOT @flue/cli / miniflare /
# workerd / vite — so it sidesteps native optional-dep issues (e.g. a missing
# @cloudflare/workerd-<platform> binary) that `npx flue run` would hit. The agent
# owns the Chrome lifecycle (launches it per-flow over CDP); tini (PID 1) reaps it.
set -euo pipefail
# Honor `docker run -w <dir>` (e.g. -v "$PWD":/work -w /work) so output lands in the
# mounted repo; fall back to the current dir, then /app/.qa-run.
WORKDIR="${SHIPPIE_QA_WORKSPACE:-${PWD:-/app/.qa-run}}"
mkdir -p "$WORKDIR"
cd "$WORKDIR"
exec node /app/bin/shippie.mjs qa
