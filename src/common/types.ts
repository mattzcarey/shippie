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
