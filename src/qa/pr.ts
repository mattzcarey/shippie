import { existsSync } from 'node:fs'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Octokit } from 'octokit'
import type { QaConfig } from './config'
import { brokenFlowBranch, isoWeekBranch, type Tier } from './pr-policy'

export interface OpenPrArgs {
  tier: Tier
  title: string
  body: string
  /** Repo-relative paths written this session to commit (specs + their .md). */
  paths: string[]
  /**
   * Defaults to the iso-week branch — EXCEPT broken-flow with a `flowSlug`, which
   * defaults to a stable per-flow branch (`shippie-qa/fix/<slug>`).
   */
  branch?: string
  /**
   * The catalogued flow this PR fixes. REQUIRED for tier 'broken-flow': it keys
   * the per-flow dedupe (stable branch + a title-slug marker), so re-running does
   * not open a second PR for the same broken flow.
   */
  flowSlug?: string
}

export interface OpenPrResult {
  changed: boolean
  branch: string
  prUrl: string | null
  reason: string
}

type Gh = Octokit['rest']

const CDP_CLIENT = 'e2e/cdp-client.mjs'

/**
 * Stable, human-readable marker embedded in a broken-flow PR title so the same
 * broken flow dedupes even if the branch was overridden. Search is substring on
 * the title, so the marker is unambiguous (`[flow:<slug>]`).
 */
export const flowMarker = (flowSlug: string): string => `[flow:${flowSlug}]`

/** Find an OPEN broken-flow PR for this slug by the title marker (secondary dedupe). */
const findOpenPrByFlow = async (
  rest: Gh,
  opts: { owner: string; repo: string; flowSlug: string }
): Promise<{ number: number; html_url: string; head: string } | undefined> => {
  const { owner, repo, flowSlug } = opts
  const marker = flowMarker(flowSlug)
  const { data } = await rest.pulls.list({ owner, repo, state: 'open', per_page: 100 })
  const hit = data.find((p) => p.title.includes(marker))
  return hit
    ? { number: hit.number, html_url: hit.html_url, head: hit.head.ref }
    : undefined
}

/** If the PR commits a CDP test, also commit the driver it imports (../cdp-client.mjs). */
const withClient = (workspace: string, paths: string[]): string[] => {
  const hasTest = paths.some(
    (p) => p.endsWith('.cdp.mjs') && p.replace(/\\/g, '/').includes('e2e/tests/')
  )
  if (hasTest && !paths.includes(CDP_CLIENT) && existsSync(join(workspace, CDP_CLIENT))) {
    return [...paths, CDP_CLIENT]
  }
  return paths
}

/** Commit the given files onto `branch` via the git database API (no local git creds). */
const commitFiles = async (
  rest: Gh,
  opts: {
    owner: string
    repo: string
    branch: string
    workspace: string
    paths: string[]
    message: string
  }
): Promise<{ changed: boolean }> => {
  const { owner, repo, branch, workspace, paths, message } = opts
  const def = (await rest.repos.get({ owner, repo })).data.default_branch

  let parentSha: string
  let branchExists = false
  try {
    const ref = await rest.git.getRef({ owner, repo, ref: `heads/${branch}` })
    parentSha = ref.data.object.sha
    branchExists = true
  } catch {
    const ref = await rest.git.getRef({ owner, repo, ref: `heads/${def}` })
    parentSha = ref.data.object.sha
  }

  const parentCommit = await rest.git.getCommit({ owner, repo, commit_sha: parentSha })
  const baseTree = parentCommit.data.tree.sha

  const tree = await Promise.all(
    paths.map(async (path) => {
      const content = await readFile(join(workspace, path), 'utf8')
      const blob = await rest.git.createBlob({ owner, repo, content, encoding: 'utf-8' })
      return { path, mode: '100644' as const, type: 'blob' as const, sha: blob.data.sha }
    })
  )

  const newTree = await rest.git.createTree({ owner, repo, base_tree: baseTree, tree })
  // Content-addressed: an identical tree means nothing changed → skip the commit.
  if (newTree.data.sha === baseTree) return { changed: false }

  const commit = await rest.git.createCommit({
    owner,
    repo,
    message,
    tree: newTree.data.sha,
    parents: [parentSha],
  })
  if (branchExists) {
    await rest.git.updateRef({
      owner,
      repo,
      ref: `heads/${branch}`,
      sha: commit.data.sha,
    })
  } else {
    await rest.git.createRef({
      owner,
      repo,
      ref: `refs/heads/${branch}`,
      sha: commit.data.sha,
    })
  }
  return { changed: true }
}

/** Resolve the branch for a request: per-flow for broken-flow, else iso-week. */
const resolveBranch = (a: OpenPrArgs): string => {
  if (a.branch) return a.branch
  if (a.tier === 'broken-flow' && a.flowSlug) return brokenFlowBranch(a.flowSlug)
  return isoWeekBranch()
}

/**
 * Commit the spec/fix files onto a deterministic branch and open (or UPDATE) a PR.
 *
 * Dedupe is tier-aware and idempotent across re-runs:
 *   - missing-coverage / refactor-hint → iso-week branch; pushes onto an existing
 *     open PR for that branch instead of opening a second one.
 *   - broken-flow (with `flowSlug`) → a stable per-flow branch
 *     (`shippie-qa/fix/<slug>`), PLUS a secondary title-marker search across open
 *     PRs, so the SAME broken flow never opens a 2nd PR even across weeks: it
 *     commits onto / updates the existing flow PR. The fix files + the
 *     failing→passing regression test are committed together (any repo-relative
 *     path in `paths` is committed; the CDP driver is auto-included).
 *
 * Skips an empty diff. Uses the octokit git database API — no local git creds.
 */
export const openOrUpdatePr = async (
  cfg: QaConfig,
  a: OpenPrArgs
): Promise<OpenPrResult> => {
  let branch = resolveBranch(a)
  if (!cfg.github) {
    return { changed: false, branch, prUrl: null, reason: 'no github target (local run)' }
  }
  const { owner, repo, token } = cfg.github
  const rest = new Octokit({ auth: token }).rest

  // Broken-flow: if an open PR for this flow already exists (matched by the title
  // marker), commit onto ITS head branch and update it — never open a second PR
  // for the same broken flow. This is the per-flow dedupe in addition to the
  // (already per-flow) branch head guard below.
  let existingByFlow: { number: number; html_url: string; head: string } | undefined
  if (a.tier === 'broken-flow' && a.flowSlug) {
    existingByFlow = await findOpenPrByFlow(rest, { owner, repo, flowSlug: a.flowSlug })
    if (existingByFlow) branch = existingByFlow.head
  }

  // Auto-include the CDP driver so the committed suite runs standalone in the verify job.
  const paths = withClient(cfg.workspace, a.paths)

  const head = await commitFiles(rest, {
    owner,
    repo,
    branch,
    workspace: cfg.workspace,
    paths,
    message: a.title,
  })
  if (!head.changed) return { changed: false, branch, prUrl: null, reason: 'empty diff' }

  // Already found the flow's open PR by title marker → update it.
  if (existingByFlow) {
    await rest.pulls.update({
      owner,
      repo,
      pull_number: existingByFlow.number,
      body: a.body,
    })
    return {
      changed: true,
      branch,
      prUrl: existingByFlow.html_url,
      reason: 'updated existing',
    }
  }

  const { data: open } = await rest.pulls.list({
    owner,
    repo,
    state: 'open',
    head: `${owner}:${branch}`,
  })
  const existing = open[0]
  if (existing) {
    await rest.pulls.update({ owner, repo, pull_number: existing.number, body: a.body })
    return { changed: true, branch, prUrl: existing.html_url, reason: 'updated existing' }
  }

  // Ensure broken-flow titles carry the flow marker so the next run's title-search
  // dedupe finds this PR (belt-and-suspenders if the caller omitted it).
  const title =
    a.tier === 'broken-flow' && a.flowSlug && !a.title.includes(flowMarker(a.flowSlug))
      ? `${a.title} ${flowMarker(a.flowSlug)}`
      : a.title

  const base = (await rest.repos.get({ owner, repo })).data.default_branch
  const created = await rest.pulls.create({
    owner,
    repo,
    head: branch,
    base,
    title,
    body: a.body,
  })
  return { changed: true, branch, prUrl: created.data.html_url, reason: 'opened' }
}

// The open_pull_request tool returns its result to the MODEL, not to the workflow.
// To make the GitHub-Actions output seam robust (branch/changed/prUrl), the tool
// also persists the result here and the workflow reads it back after the session.
const lastPrPath = (workspace: string): string =>
  join(workspace, '.shippie', 'qa', 'last-pr.json')

export const writeLastPr = async (
  workspace: string,
  result: OpenPrResult
): Promise<void> => {
  const file = lastPrPath(workspace)
  await mkdir(dirname(file), { recursive: true })
  await writeFile(file, JSON.stringify(result))
}

export const readLastPr = async (workspace: string): Promise<OpenPrResult | null> => {
  try {
    return JSON.parse(await readFile(lastPrPath(workspace), 'utf8')) as OpenPrResult
  } catch {
    return null
  }
}
