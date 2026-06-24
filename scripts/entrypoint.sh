#!/usr/bin/env bash
# The agent owns the Chrome lifecycle (launches it per-flow over CDP); tini (PID 1)
# reaps any zombies. We only run the QA workflow.
set -euo pipefail
exec npx flue run qa --target node "$@"
