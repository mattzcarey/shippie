# The shippie-qa monolith: node + system Chromium (the agent + the committed CDP tests
# drive it over CDP) + ffmpeg (screencast → mp4) + flue. NO Playwright. The SAME image
# runs locally (`docker run`) and in CI, so local == CI byte-for-byte.
#
#   docker build -t shippie-qa .
#   docker run --rm --shm-size=1g \
#     -e ANTHROPIC_API_KEY -e GITHUB_TOKEN \
#     -e SHIPPIE_QA_TARGET=https://your-app.example.com \
#     -v "$PWD":/work -w /work shippie-qa
FROM node:22-bookworm-slim

# System Chromium for the agent's CDP browsing + the committed cdp tests, ffmpeg to
# assemble the screencast .mp4, plus libs + tini (PID 1 reaps chrome zombies) + jq/git/curl.
RUN apt-get update && apt-get install -y --no-install-recommends \
      chromium ffmpeg fonts-liberation ca-certificates \
      libnss3 libatk-bridge2.0-0 libgtk-3-0 libasound2 libgbm1 \
      curl jq git tini \
  && rm -rf /var/lib/apt/lists/*

ENV CHROME_BIN=/usr/bin/chromium

WORKDIR /app
COPY package.json package-lock.json ./
# Prod deps only: the entrypoint runs the PREBUILT server (dist/server.mjs), which needs
# only @flue/runtime (+ octokit/valibot/picomatch) at runtime. The committed CDP tests are
# dependency-free (import ../cdp-client.mjs, drive system Chromium) — NO Playwright, NO
# @flue/cli. `npm install` (not `npm ci`) tolerates the macOS-generated lockfile omitting
# Linux-only optional deps (same reason the CI workflows use install); the lock is copied
# as a reproducibility hint. Omitting devDeps also sidesteps @flue/cli -> workerd on arm64.
RUN npm install --omit=dev --no-audit --no-fund
# Copies the repo INCLUDING the prebuilt dist/ — run `npm run build` on the host first.
COPY . .
# Fail loudly if dist wasn't prebuilt (the entrypoint runs the prebuilt dist/server.mjs).
RUN test -f dist/server.mjs || { echo "dist/server.mjs missing — run 'npm run build' before 'docker build'" >&2; exit 1; }

# The agent's bash launches Chrome per-flow on its own port; the entrypoint does NOT
# launch a browser (a single image-launched chrome would collide with the fan-out).
ENTRYPOINT ["tini", "--"]
CMD ["./scripts/entrypoint.sh"]
