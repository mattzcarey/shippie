import { createContext, useContext, useState, ReactNode } from 'react'

type BranchContextType = {
  baseBranch: string | undefined
  currentBranch: string | undefined
  setBaseBranch: (branch: string) => void
  setCurrentBranch: (branch: string) => void
}

const BranchContext = createContext<BranchContextType | undefined>(undefined)

export const BranchProvider = ({ children }: { children: ReactNode }) => {
  const [baseBranch, setBaseBranch] = useState<string | undefined>(undefined)
  const [currentBranch, setCurrentBranch] = useState<string | undefined>(undefined)

  return (
    <BranchContext.Provider value={{ baseBranch, currentBranch, setBaseBranch, setCurrentBranch }}>
      {children}
    </BranchContext.Provider>
  )
}

export const useBranchContext = () => {
  const context = useContext(BranchContext)
  if (!context) {
    throw new Error('useBranchContext must be used within BranchProvider')
  }
  return context
}
