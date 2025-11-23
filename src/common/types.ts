export type LineRange = {
  start: number
  end: number
  // When true, this range represents pure deletions (content was removed)
  isPureDeletion?: boolean
}

export type ReviewFile = {
  fileName: string
  fileContent: string
  changedLines: LineRange[]
}

export enum PlatformOptions {
  GITHUB = 'github',
  GITLAB = 'gitlab',
  AZDEV = 'azdev',
  LOCAL = 'local',
}

// Base arguments provided by yargs and global options
type BaseArgs = {
  _?: (string | number)[]
  $0?: string
  debug: boolean
  telemetry: boolean
}

// Arguments for the configure command
export type ConfigureArgs = BaseArgs & {
  platform?: PlatformOptions | string // Allow string initially
}

// Arguments for the review command
export type ReviewArgs = BaseArgs & {
  modelString: string
  reviewLanguage: string
  platform: PlatformOptions | string
  maxSteps: number
  baseUrl?: string
  ignore?: string[]
  customInstructions?: string
}

// Arguments for the stack command
export type StackArgs = BaseArgs & {
  port: number
  commits: number
  open: boolean
}

export type ParsedArgs = ConfigureArgs | ReviewArgs | StackArgs

// Git types for commit restructuring (stack command)
export type CommitInfo = {
  hash: string
  shortHash: string
  author: string
  date: string
  message: string
  filesChanged: string[]
}

export type Hunk = {
  id: string // unique ID for UI tracking
  fileId: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  content: string // the actual diff content
  header: string // @@ ... @@ line
}

export type FileChange = {
  id: string
  fileName: string
  changeType: 'added' | 'modified' | 'deleted' | 'renamed'
  hunks: Hunk[]
  oldPath?: string // for renames
}

export type StackCommit = {
  commit: CommitInfo
  changes: FileChange[]
  selected: boolean // for UI selection
}

export type RestackOperation = {
  targetCommitIndex: number // which commit (new or existing)
  hunkId: string
  fileId: string
}
