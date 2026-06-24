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
COPY package*.json ./
# Full install (incl. devDeps): @flue/cli runs the agent, @playwright/test runs specs.
RUN npm ci
# Playwright's own pinned Chromium for run_spec (deterministic, separate from CHROME_BIN).
RUN npx playwright install chromium
COPY . .

# The agent's bash launches Chrome per-flow on its own port; the entrypoint does NOT
# launch a browser (a single image-launched chrome would collide with the fan-out).
ENTRYPOINT ["tini", "--"]
CMD ["./scripts/entrypoint.sh"]
