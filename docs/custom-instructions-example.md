# Custom Instructions Example

Custom instructions let you append one-off guidance to the review prompt for a
single run. The agent receives them in addition to its built-in instructions and
your project rules, so use them to steer a particular review (a release, a
hotfix, a risky migration) rather than to encode permanent policy.

There are three ways to supply them, in order of precedence:

1. `payload.customInstructions` (when calling the workflow directly)
2. The `CUSTOM_INSTRUCTIONS` GitHub Action input
3. The `SHIPPIE_CUSTOM_INSTRUCTIONS` environment variable

## Example value

```
Pay special attention to SQL injection, XSS, and missing input validation.
Flag any new dependency added to package.json and explain why it is needed.
Treat changes under src/payments/** as high risk and review them line by line.
```

## In a caller workflow (GitHub Action)

```yaml
name: Code Review
on:
  pull_request:

permissions:
  pull-requests: write
  contents: read

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: mattzcarey/shippie@main
        with:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          CUSTOM_INSTRUCTIONS: |
            Pay special attention to SQL injection, XSS, and missing input validation.
            Flag any new dependency added to package.json and explain why it is needed.
            Treat changes under src/payments/** as high risk and review them line by line.
```

## Local / direct workflow run

When running the workflow yourself, pass the value through the payload:

```bash
flue run review --target node --payload '{"platform":"local","customInstructions":"Focus on performance: memory usage, allocations, and algorithm complexity."}'
```

Or set the environment variable:

```bash
SHIPPIE_CUSTOM_INSTRUCTIONS="Focus on performance: memory usage, allocations, and algorithm complexity." \
  flue run review --target node --payload '{"platform":"local"}'
```

## Prefer AGENTS.md for project-wide rules

Custom instructions are per-run and easy to forget. Standards that should apply
to **every** review (coding conventions, architecture patterns, security
requirements) belong in your repository's root `AGENTS.md`, `AGENT.md`, or
`CLAUDE.md`, which shippie injects into the agent's instructions automatically.
See [Rules Files](./rules-files.md) for details.
