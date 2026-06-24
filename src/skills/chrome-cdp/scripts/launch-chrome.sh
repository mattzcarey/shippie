#!/usr/bin/env bash
# launch-chrome.sh <port> [profile-dir]
# Launch headless Chrome DETACHED (survives across bash tool calls) and block until
# its CDP endpoint is ready. Portable: uses setsid on Linux, falls back to
# nohup+disown on macOS (which has no setsid). $CHROME_BIN selects the binary.
set -euo pipefail

PORT="${1:-9222}"
PROFILE="${2:-$(mktemp -d)}"
BIN="${CHROME_BIN:-$(command -v google-chrome || command -v google-chrome-stable \
  || command -v chromium || command -v chromium-browser \
  || echo "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome")}"

FLAGS=(--headless=new --disable-gpu --no-sandbox --disable-dev-shm-usage
  --remote-debugging-port="$PORT" --user-data-dir="$PROFILE")
# Tolerate self-signed / corporate-proxy certs on external HTTPS targets (QA).
[ "${CDP_IGNORE_CERT_ERRORS:-}" = "1" ] && FLAGS+=(--ignore-certificate-errors)
FLAGS+=(about:blank)
LOG="/tmp/chrome-$PORT.log"

if command -v setsid >/dev/null 2>&1; then
  setsid nohup "$BIN" "${FLAGS[@]}" >"$LOG" 2>&1 &
else
  nohup "$BIN" "${FLAGS[@]}" >"$LOG" 2>&1 &
  disown || true
fi

for _ in $(seq 1 100); do
  if curl -sf "http://127.0.0.1:$PORT/json/version" >/dev/null 2>&1; then
    echo "chrome ready on port $PORT (profile $PROFILE)"
    exit 0
  fi
  sleep 0.2
done
echo "chrome failed to start on port $PORT; see $LOG" >&2
exit 1
