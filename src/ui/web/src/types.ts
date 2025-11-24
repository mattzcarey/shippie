// Types mirroring the backend types from src/common/types.ts

export type CommitInfo = {
  hash: string
  shortHash: string
  author: string
  date: string
  message: string
  filesChanged: string[]
}

export type Hunk = {
  id: string
  fileId: string
  oldStart: number
  oldLines: number
  newStart: number
  newLines: number
  content: string
  header: string
}

export type FileChange = {
  id: string
  fileName: string
  changeType: 'added' | 'modified' | 'deleted' | 'renamed'
  hunks: Hunk[]
  oldPath?: string
  fullContent?: string
}

export type StackCommit = {
  commit: CommitInfo
  changes: FileChange[]
  selected: boolean
}

export type RestackOperation = {
  targetCommitIndex: number
  hunkId: string
  fileId: string
}
