import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { Octokit } from 'octokit'
import type { QaConfig } from './config'
import { isoWeekBranch, type Tier } from './pr-policy'

export interface OpenPrArgs {
  tier: Tier
  title: string
  body: string
  /** Repo-relative paths written this session to commit (specs + their .md). */
  paths: string[]
  /** Defaults to the iso-week branch. */
  branch?: string
}

export interface OpenPrResult {
  changed: boolean
  branch: string
  prUrl: string | null
  reason: string
}

type Gh = Octokit['rest']

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

/**
 * Commit the spec/fix files onto a deterministic iso-week branch and open (or
 * UPDATE) a PR. Idempotent across weekly re-runs: pushes onto an existing open PR
 * for the branch instead of opening a second one, and skips an empty diff. Uses
 * the octokit git database API, so it needs no local git credentials.
 */
export const openOrUpdatePr = async (
  cfg: QaConfig,
  a: OpenPrArgs
): Promise<OpenPrResult> => {
  const branch = a.branch ?? isoWeekBranch()
  if (!cfg.github) {
    return { changed: false, branch, prUrl: null, reason: 'no github target (local run)' }
  }
  const { owner, repo, token } = cfg.github
  const rest = new Octokit({ auth: token }).rest

  const head = await commitFiles(rest, {
    owner,
    repo,
    branch,
    workspace: cfg.workspace,
    paths: a.paths,
    message: a.title,
  })
  if (!head.changed) return { changed: false, branch, prUrl: null, reason: 'empty diff' }

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

  const base = (await rest.repos.get({ owner, repo })).data.default_branch
  const created = await rest.pulls.create({
    owner,
    repo,
    head: branch,
    base,
    title: a.title,
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
