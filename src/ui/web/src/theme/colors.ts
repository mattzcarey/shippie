export const changeTypeColors = {
  added: {
    text: '#86efac', // green-300
    bg: '#14532d', // green-950
    border: '#166534', // green-800
    icon: '#22c55e', // green-500
  },
  modified: {
    text: '#fcd34d', // amber-300
    bg: '#451a03', // amber-950
    border: '#92400e', // amber-800
    icon: '#f59e0b', // amber-500
  },
  deleted: {
    text: '#fca5a5', // red-300
    bg: '#450a0a', // red-950
    border: '#991b1b', // red-800
    icon: '#ef4444', // red-500
  },
  renamed: {
    text: '#d8b4fe', // purple-300
    bg: '#2e1065', // purple-950
    border: '#6b21a8', // purple-800
    icon: '#a855f7', // purple-500
  },
} as const

export type ChangeType = keyof typeof changeTypeColors

export const getChangeTypeColors = (changeType: ChangeType) => {
  return changeTypeColors[changeType]
}
