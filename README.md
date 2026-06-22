# Shippie 🚢 (formerly Code Review GPT)

[![NPM][npm_badge]][npm]
[![Contributors][contributors_badge]][contributors]
[![Pulse][pulse_badge]][pulse]
[![License][license_badge]][license]
[![Twitter][twitter_badge]][twitter]

## Helps you ship faster

Shippie is a prebuilt code-review agent built on [flue](https://github.com/withastro/flue). It runs an agent loop (on `pi`) that reads your diff, explores the codebase with real developer tools, and posts focused review comments — picking up issues a human reviewer would, such as:

- Exposed secrets
- Slow or inefficient code
- Potential bugs or unhandled edge cases

The agent uses flue's built-in `pi` tools (`read`, `write`, `edit`, `bash`, `grep`, `glob`, `task`) plus shippie's `suggest_change` tool for inline comments. It can also act as a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) client to reach external tools like browser automation, infrastructure, and observability.

## Demo

https://github.com/mattzcarey/shippie/assets/77928207/92029baf-f691-465f-8d15-e1363fcb808e

## Ethos 💭

- A prebuilt review **workflow**, not a bespoke CLI — the agent loop runs on flue + `pi`.
- Runs **anywhere flue deploys**: Node, Cloudflare, GitHub Actions, GitLab CI.
- Functions as a human code reviewer, using flue's built-in tools instead of a hand-rolled tool registry.
- Provider-agnostic: Anthropic, OpenAI, OpenRouter, and **Cloudflare Workers AI** out of the box.
- Acts as an MCP client (remote HTTP/SSE) for integration with external tools.

## Quick start 🚀

### GitHub Action

Run `npx shippie init` to scaffold the workflow below, then add your provider API key as a repo secret. Or add it manually — it needs a full checkout (`fetch-depth: 0`), PR write permissions, and a provider API key.

```yaml
# .github/workflows/shippie.yml
name: Shippie

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
      - uses: mattzcarey/shippie@v0
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
```

See [Action Options](docs/action-options.md) for all inputs (`MODEL`, `THINKING_LEVEL`, `IGNORE`, `CUSTOM_INSTRUCTIONS`, `MCP_SERVERS`, and the provider keys).

### Local

Run the review workflow locally with no server. Local mode reviews your **staged changes** (`git diff --cached`) and writes results to `.shippie/review/local_*.md`:

```bash
flue run review --target node --payload '{"platform":"local"}'
```

Or via the package script:

```bash
npm run review
```

### Run on demand with `/shippie`

Comment `/shippie review` on a pull request to run shippie on demand — either via a GitHub Actions workflow (no server) or a deployed webhook channel. See [Run Shippie on demand](docs/tag-shippie.md).

## Setup Instructions 💫

See the [setup instructions](docs/setup.md) for more docs on how to set up shippie in your CI/CD pipeline and run it locally.

### Additional Documentation

- [Setup](docs/setup.md) - Get shippie running in CI and locally
- [AI Provider Configuration](docs/ai-provider-config.md) - Configure Anthropic, OpenAI, OpenRouter, and Cloudflare Workers AI
- [Action Options](docs/action-options.md) - GitHub Action configuration options
- [Model Context Protocol (MCP)](docs/mcp.md) - Give shippie access to external tools
- [Rules Files](docs/rules-files.md) - Inject project context via `AGENTS.md` / `CLAUDE.md` and Agent Skills
- [Subagent Tool](docs/subagent-tool.md) - Delegate work to flue subagents with the `task` tool
- [On-demand /shippie](docs/tag-shippie.md) - Run shippie by commenting `/shippie` (Actions or webhook)

## Development 🔧

This repo targets Node >= 22.19 with npm.

1. Clone the repository:

   ```shell
   git clone https://github.com/mattzcarey/shippie.git
   cd shippie
   ```

2. Install dependencies:

   ```shell
   npm install
   ```

3. Set up your API key:

   - Copy `.env.example` to `.env`.
   - Set the provider key you want to use, e.g. `ANTHROPIC_API_KEY` (or `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `CLOUDFLARE_API_KEY` + `CLOUDFLARE_ACCOUNT_ID`).

4. Run the review workflow:

   ```shell
   npm run review
   ```

   Useful commands:

   - `npm run dev` — run flue in dev mode
   - `npm run build` — build a publishable Node server to `dist/server.mjs` (run it with `npm run start`, then `POST /workflows/review?wait=result`)
   - `npm run check` — lint/format with biome
   - `npm run check:types` — typecheck with tsc
   - `npm test` — run tests

   See `package.json` for the full list of scripts.

5. Make a PR 🎉

We use [release-please](https://github.com/googleapis/release-please) on this project. If you want to create a new release from your PR, please make sure your PR title follows the [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) format. The release-please bot will automatically create a new release for you when your PR is merged.

- fix: which represents bug fixes, and correlates to a patch version.
- feat: which represents a new feature, and correlates to a SemVer minor.
- feat!:, or fix!:, refactor!:, etc., which represent a breaking change (indicated by the !) and will result in a major version.

## Contributors 🙏

Thanks to our wonderful contributors!

<a href="https://github.com/mattzcarey/shippie/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=mattzcarey/shippie" />
</a>

## Roadmap 🌏

Have a look at the [discussion tab](https://github.com/mattzcarey/shippie/discussions) for the latest chat and ideas. I am actively working on the items in [todo.md](todo.md).


## Star History ⭐️

[![Star History Chart](https://api.star-history.com/svg?repos=mattzcarey/shippie&type=Date)](https://star-history.com/#mattzcarey/shippie&Date)

<!-- Badges -->

[npm]: https://www.npmjs.com/package/shippie
[npm_badge]: https://img.shields.io/npm/dm/shippie.svg
[license]: https://opensource.org/licenses/MIT
[license_badge]: https://img.shields.io/github/license/mattzcarey/shippie.svg?color=blue&style=flat-square&ghcache=unused
[contributors]: https://github.com/mattzcarey/shippie/graphs/contributors
[contributors_badge]: https://img.shields.io/github/contributors/mattzcarey/shippie
[pulse]: https://github.com/mattzcarey/shippie/pulse
[pulse_badge]: https://img.shields.io/github/commit-activity/m/mattzcarey/shippie
[twitter]: https://twitter.com/intent/follow?screen_name=mattzcarey
[twitter_badge]: https://img.shields.io/twitter/follow/mattzcarey?style=social&logo=twitter
