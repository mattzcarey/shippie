/**
 * Renders the GitHub Actions workflow YAML that `shippie init` / `shippie qa init` /
 * `shippie qa fanout-init` scaffold. The workflow bodies live as real `.yml` files in
 * `bin/templates/` (shipped via package.json `files: ["bin"]`) — so they get YAML
 * syntax highlighting + linting and no longer need hand-escaped `${{ }}` in JS strings.
 * The few genuinely-dynamic fragments (the cross-OS verify matrix, the fan-out repo
 * list) are computed here and substituted into `{{TOKEN}}` placeholders.
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const templatesDir = join(dirname(fileURLToPath(import.meta.url)), 'templates')
const readTemplate = (name) => readFileSync(join(templatesDir, name), 'utf8')

/**
 * Substitute `{{TOKEN}}` placeholders. The replacement is a FUNCTION so a `$` in a
 * value (GitHub `${{ ... }}` expressions) is inserted literally, not interpreted as a
 * String.prototype.replace special pattern (`$&`, `$1`, …).
 */
const fill = (template, tokens) =>
  Object.entries(tokens).reduce(
    (out, [key, value]) => out.replace(`{{${key}}}`, () => value),
    template
  )

/** The review workflow — reviews every pull request. Fully static. */
export const renderReviewWorkflow = () => readTemplate('review.yml')

/**
 * The weekly + on-demand autonomous QA workflow. The "author" job runs the agent
 * (Linux, holds the model key) and opens a PR; the "verify" job re-runs the committed
 * tests (no agent, no key) so the PR's checks prove them green. With `crossOs` the
 * verify job fans out to a 3-OS matrix (ubuntu + windows + macos), installing Chrome +
 * ffmpeg per-OS and uploading per-OS artifacts.
 */
export const renderQaWorkflow = ({ crossOs = false } = {}) => {
  const runsOn = crossOs
    ? `    strategy:
      fail-fast: false
      matrix:
        os: [ubuntu-latest, windows-latest, macos-latest]
    runs-on: \${{ matrix.os }}`
    : `    runs-on: ubuntu-latest`

  const ffmpeg = crossOs
    ? `      # ffmpeg (screencast → mp4): per-OS package manager.
      - name: Install ffmpeg (Linux)
        if: runner.os == 'Linux'
        run: sudo apt-get update && sudo apt-get install -y ffmpeg
      - name: Install ffmpeg (macOS)
        if: runner.os == 'macOS'
        run: brew install ffmpeg
      - name: Install ffmpeg (Windows)
        if: runner.os == 'Windows'
        run: choco install ffmpeg -y --no-progress`
    : `      - name: Install ffmpeg (screencast → mp4)
        run: sudo apt-get update && sudo apt-get install -y ffmpeg`

  // On windows-latest the default shell is PowerShell; the array/nullglob/shopt
  // script is bash-only, so pin shell: bash (Git Bash ships on the windows runner).
  const testShell = crossOs ? '        shell: bash\n' : ''
  const artifactName = crossOs ? 'e2e-artifacts-${{ matrix.os }}' : 'e2e-artifacts'

  return fill(readTemplate('qa.yml'), {
    RUNS_ON: runsOn,
    FFMPEG: ffmpeg,
    TEST_SHELL: testShell,
    ARTIFACT_NAME: artifactName,
  })
}

/**
 * The cross-repo fan-out control workflow. On a schedule + on demand it DISPATCHES
 * each target repo's own shippie-qa.yml (never pushing or opening PRs in the targets).
 * `repos` fills the dispatch matrix; an empty list writes a commented placeholder.
 */
export const renderFanoutWorkflow = (repos) => {
  const matrixBlock =
    repos.length > 0
      ? repos.map((r) => `          - ${r}`).join('\n')
      : `          # >>> Fill in the target repos (owner/repo), one per line. <<<
          # Re-run: shippie qa fanout-init owner/repoA,owner/repoB
          # - my-org/app-one
          # - my-org/app-two`

  return fill(readTemplate('fanout.yml'), { MATRIX: matrixBlock })
}
