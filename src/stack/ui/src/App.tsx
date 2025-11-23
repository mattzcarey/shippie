import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister'
import { Client as Styletron } from 'styletron-engine-atomic'
import { Provider as StyletronProvider } from 'styletron-react'
import { BaseProvider, DarkTheme } from 'baseui'
import { NuqsAdapter } from 'nuqs/adapters/react'
import { useQueryState, parseAsString, parseAsBoolean } from 'nuqs'
import { useCommits } from './hooks/useCommits'
import { useBranchInfo } from './hooks/useBranchInfo'
import { FileTreeSidebar } from './components/FileTreeSidebar'
import { DiffView } from './components/DiffView'
import { CommitTimeline } from './components/CommitTimeline'
import { BranchSelector } from './components/BranchSelector'
import { BranchProvider, useBranchContext } from './contexts/BranchContext'
import { Loader2 } from 'lucide-react'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      gcTime: 1000 * 60 * 60, // 1 hour - must match or exceed persister maxAge
      staleTime: 1000 * 60 * 10, // Consider data fresh for 10 minutes
    },
  },
})

const persister = createAsyncStoragePersister({
  storage: window.localStorage,
  key: 'STACK_QUERY_CACHE',
})

const engine = new Styletron()

function AppContent() {
  const { data: branchInfo } = useBranchInfo()
  const { baseBranch: selectedBaseBranch, currentBranch: selectedCurrentBranch, setBaseBranch, setCurrentBranch } = useBranchContext()

  const baseBranch = selectedBaseBranch || branchInfo?.baseBranch
  const currentBranch = selectedCurrentBranch || branchInfo?.currentBranch

  const { data: commits = [], isLoading: commitsLoading, error: commitsError } = useCommits(
    baseBranch,
    currentBranch
  )

  // URL state management with nuqs
  const [selectedCommit, setSelectedCommit] = useQueryState('commit', parseAsString)
  const [selectedFile, setSelectedFile] = useQueryState('file', parseAsString)
  const [expandedFile, setExpandedFile] = useQueryState('expanded', parseAsString)
  const [leftSidebarCollapsed, setLeftSidebarCollapsed] = useQueryState('leftCollapsed', parseAsBoolean.withDefault(false))

  if (commitsLoading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#09090b'
      }}>
        <div style={{ textAlign: 'center' }}>
          <Loader2 style={{ width: 32, height: 32, margin: '0 auto 16px', color: '#10b981' }} />
          <p style={{ color: '#a1a1aa', fontSize: 14 }}>Loading repository...</p>
        </div>
      </div>
    )
  }

  if (commitsError) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100vh',
        backgroundColor: '#09090b'
      }}>
        <div style={{ maxWidth: 400, padding: 24, backgroundColor: '#450a0a', border: '1px solid #991b1b' }}>
          <h2 style={{ color: '#f87171', fontSize: 14, marginBottom: 8 }}>ERROR</h2>
          <p style={{ color: '#fca5a5', fontSize: 12 }}>{String(commitsError)}</p>
        </div>
      </div>
    )
  }

  const currentCommit = commits.find(c => c.commit.hash === selectedCommit) || commits[0]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', backgroundColor: '#09090b', color: '#fafafa' }}>
      {/* Top Bar - Branch Selector */}
      <BranchSelector
        currentBranch={currentBranch || 'main'}
        baseBranch={baseBranch || 'main'}
        onCurrentBranchChange={setCurrentBranch}
        onBaseBranchChange={setBaseBranch}
      />

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left Sidebar - File Tree */}
        {!leftSidebarCollapsed && (
          <FileTreeSidebar
            commit={currentCommit}
            selectedFile={selectedFile}
            onSelectFile={setSelectedFile}
            onCollapse={() => setLeftSidebarCollapsed(true)}
            expandedFile={expandedFile}
            onToggleExpand={setExpandedFile}
          />
        )}

        {/* Center - Diff View */}
        <DiffView
          commit={currentCommit}
          selectedFile={selectedFile}
          onExpandSidebar={() => setLeftSidebarCollapsed(false)}
          sidebarCollapsed={leftSidebarCollapsed}
          expandedFile={expandedFile}
          onToggleExpand={setExpandedFile}
        />

        {/* Right Sidebar - Commit Timeline */}
        <CommitTimeline
          commits={commits}
          selectedCommit={selectedCommit}
          onSelectCommit={setSelectedCommit}
        />
      </div>
    </div>
  )
}

function App() {
  return (
    <NuqsAdapter>
      <StyletronProvider value={engine}>
        <BaseProvider theme={DarkTheme}>
          <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister }}
          >
            <BranchProvider>
              <AppContent />
            </BranchProvider>
          </PersistQueryClientProvider>
        </BaseProvider>
      </StyletronProvider>
    </NuqsAdapter>
  )
}

export default App
