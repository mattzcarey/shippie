---
"shippie": patch
---

Fix `shippie review` / `shippie qa` dying after ~5 minutes with a bare `fetch failed`. The CLI held one `fetch(...?wait=result)` open for the whole workflow run, and Node's built-in fetch (undici) enforces a ~300s idle timeout — killing any run that stayed quiet for longer (essentially every real QA run) and tearing the server down mid-flight. The workflow wait now uses a `node:http` request, which has no client-side idle timeout.
