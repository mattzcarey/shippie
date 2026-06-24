---
name: chrome-cdp
description: >-
  Drive a headless Chrome over the Chrome DevTools Protocol (CDP) for browser QA —
  navigate, click, fill forms, read the DOM/accessibility tree, screenshot, and assert.
  Use whenever a task requires loading a web page and interacting with it like a user.
  Chrome is launched by a bash step (recipe below); this skill attaches over CDP — no
  MCP server, no Puppeteer/Playwright needed to drive.
---

# Driving Chrome over CDP (no MCP, no Playwright-for-driving)

`scripts/cdp.mjs` is a dependency-free CLI (Node 22+ built-in WebSocket). You launch headless
Chrome from a `bash` step, then attach to it on a port. Every command is:

```
node .agents/skills/chrome-cdp/scripts/cdp.mjs --port $PORT <command> <target> [args]
```

where `<target>` is a **targetId prefix** from `cdp list` (copy the prefix shown, e.g. `18EB6379`).

## 1. Launch ONCE per flow — survives across bash calls

Each `bash` tool call is a fresh process group, so a launched browser is only reachable later if it is
**detached**. The helper handles that portably (setsid on Linux, nohup+disown on macOS), uses
`$CHROME_BIN`, bakes in `--no-sandbox --disable-dev-shm-usage` (mandatory as root / in a container), and
blocks until the CDP endpoint is ready. Use a unique port per flow (parallel-safe):

```bash
PORT=$(( 9222 + ${FLOW_INDEX:-0} ))
bash .agents/skills/chrome-cdp/scripts/launch-chrome.sh "$PORT"
```

## 2. Drive it. `--port $PORT` re-discovers the ws endpoint via /json/version each call —
##    no shell variable survives between bash calls, only the port does.

```bash
CDP="node .agents/skills/chrome-cdp/scripts/cdp.mjs --port $PORT"
T=$($CDP list | head -1 | awk '{print $1}')        # the open page's targetId prefix
$CDP nav  "$T" "$BASE_URL/login"
$CDP snap "$T"                                       # accessibility tree → derive getByRole locators
$CDP fill "$T" "input[name=email]" "qa@example.com" # focus + select + insertText (React/Vue-safe)
$CDP fill "$T" "input[name=password]" "hunter2"
$CDP click "$T" "button[type=submit]"               # JS el.click() via eval — covers standard buttons/links
# $CDP clickxy "$T" 412 388                          # real Input.dispatchMouseEvent at CSS px, for
#                                                     #   real-input-only handlers (see `shot` DPR note)
$CDP eval "$T" "location.pathname"                  # assert post-conditions
$CDP shot "$T" /tmp/f$PORT-01.png                   # then `read` the PNG (vision) to assert visually
$CDP evalraw "$T" "DOM.getDocument" '{}'             # raw-CDP escape hatch (method + JSON params)
```

Notes:
- **`fill <target> <selector> <text>`** is the reliable way to set a form field — it focuses the
  element, selects existing content, then `Input.insertText` so frameworks see real input events.
- Raw **`type <target> <text>`** has **no selector**; it inserts at whatever currently has focus.
- **`click`** is `el.click()` via eval — won't fire real-input-only handlers (drag, native pickers);
  use **`clickxy`** with CSS pixels for those.
- Prefer **`snap`** (accessibility tree) to choose **role-based locators** (`getByRole`/`getByLabel`/
  `getByText`) when you then write the Playwright spec — far more resilient than coordinates.

## 3. Remote browser override seam (do NOT use in v0)

```bash
node .agents/skills/chrome-cdp/scripts/cdp.mjs \
  --ws-endpoint "$CDP_WS_ENDPOINT" --headers "$CDP_HEADERS" snap "$T"
```

## 4. Teardown at flow end (you own the lifecycle; flue won't reap it)

```bash
node .agents/skills/chrome-cdp/scripts/cdp.mjs --port $PORT stop || true
pkill -f "remote-debugging-port=$PORT" || true
```

## Coordinates (for `clickxy`)

`shot` saves an image at native resolution: image px = CSS px × DPR. `clickxy` takes **CSS pixels**
(`CSS px = image px / DPR`). `shot` prints the page DPR; on a typical Retina (DPR=2) divide by 2.
