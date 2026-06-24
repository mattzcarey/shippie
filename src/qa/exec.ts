import { execFile } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

export interface ShellResult {
  exitCode: number
  stdout: string
  stderr: string
}

interface ExecError {
  code?: number
  stdout?: string
  stderr?: string
  message?: string
}

/** Run a command (no shell) and capture output; never throws on a nonzero exit. */
export const runShell = async (
  cmd: string,
  args: string[],
  opts: { cwd: string; env?: Record<string, string | undefined> }
): Promise<ShellResult> => {
  try {
    const { stdout, stderr } = await execFileAsync(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, ...opts.env },
      maxBuffer: 64 * 1024 * 1024,
    })
    return { exitCode: 0, stdout, stderr }
  } catch (e) {
    const err = e as ExecError
    return {
      exitCode: err.code ?? 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? err.message ?? String(e),
    }
  }
}

/** Recursively list files under a dir (bounded), as workspace-relative paths. */
const walk = (dir: string, workspace: string, cap: number, out: string[]): void => {
  if (out.length >= cap) return
  for (const name of readdirSync(dir)) {
    if (out.length >= cap) return
    const abs = join(dir, name)
    if (statSync(abs).isDirectory()) walk(abs, workspace, cap, out)
    else out.push(relative(workspace, abs))
  }
}

/** Generated Playwright artifacts (trace/video/report) under e2e/, for the verdict. */
export const listArtifacts = (workspace: string, cap = 200): string[] => {
  const out: string[] = []
  for (const d of ['e2e/.artifacts', 'e2e/report']) {
    const abs = join(workspace, d)
    if (existsSync(abs)) walk(abs, workspace, cap, out)
  }
  return out
}
