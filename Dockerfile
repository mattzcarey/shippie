# The shippie-qa monolith: node + system Chromium (the agent drives it over CDP) +
# flue + the agent + Playwright's own chromium (for run_spec self-verify). The SAME
# image runs locally (`docker run`) and in CI, so local == CI byte-for-byte.
#
#   docker build -t shippie-qa .
#   docker run --rm --shm-size=1g \
#     -e ANTHROPIC_API_KEY -e GITHUB_TOKEN \
#     -e SHIPPIE_QA_TARGET=https://your-app.example.com \
#     -v "$PWD":/work -w /work shippie-qa
FROM node:22-bookworm-slim

# System Chromium for the agent's CDP authoring session, plus libs + tini (PID 1
# reaps chrome zombies) + jq/git/curl.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium fonts-liberation ca-certificates \
      libnss3 libatk-bridge2.0-0 libgtk-3-0 libasound2 libgbm1 \
      curl jq git tini \
  && rm -rf /var/lib/apt/lists/*

ENV CHROME_BIN=/usr/bin/chromium

WORKDIR /app
COPY package.json ./
# `npm install` (not `npm ci`): this repo's macOS-generated lockfile omits Linux-only
# optional deps, which makes `npm ci` fail on Linux (same reason the CI workflows use
# install, see docs/flue-migration.md). devDeps are included (no NODE_ENV=production):
# @flue/cli runs the agent, @playwright/test runs specs. The `apps/*` workspaces glob
# is empty here (apps/ is .dockerignore'd), so only root deps install.
RUN npm install --no-audit --no-fund --include=dev
# Playwright's own pinned Chromium for run_spec (deterministic, separate from CHROME_BIN).
RUN npx playwright install chromium
# Copies the repo INCLUDING the prebuilt dist/ — run `npm run build` on the host first.
# The entrypoint runs the prebuilt server (dist/server.mjs), so the agent loop needs only
# @flue/runtime at runtime (no @flue/cli/vite/workerd), sidestepping native optional-dep
# issues that `npx flue run` hits on some arches (e.g. a missing @cloudflare/workerd-*).
COPY . .

# The agent's bash launches Chrome per-flow on its own port; the entrypoint does NOT
# launch a browser (a single image-launched chrome would collide with the fan-out).
ENTRYPOINT ["tini", "--"]
CMD ["./scripts/entrypoint.sh"]
