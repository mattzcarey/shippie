import { useState, useMemo, useCallback } from 'react'
import { useStyletron } from 'baseui'
import { ChevronLeft, ChevronDown, ChevronRight, Folder, FileIcon, Search } from 'lucide-react'
import type { StackCommit } from '../types'

type FileTreeSidebarProps = {
  commit: StackCommit | undefined
  selectedFile: string | null
  onSelectFile: (file: string) => void
  onCollapse: () => void
  expandedFile: string | null
  onToggleExpand: (file: string | null) => void
}

type FileTreeNode = {
  name: string
  path: string
  isDirectory: boolean
  children: FileTreeNode[]
}

const buildFileTree = (files: string[]): FileTreeNode => {
  const root: FileTreeNode = {
    name: '',
    path: '',
    isDirectory: true,
    children: [],
  }

  for (const file of files) {
    const parts = file.split('/')
    let currentNode = root

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLastPart = i === parts.length - 1
      const path = parts.slice(0, i + 1).join('/')

      let childNode = currentNode.children.find(child => child.name === part)

      if (!childNode) {
        childNode = {
          name: part,
          path,
          isDirectory: !isLastPart,
          children: [],
        }
        currentNode.children.push(childNode)
      }

      currentNode = childNode
    }
  }

  return root
}

export const FileTreeSidebar = ({
  commit,
  selectedFile,
  onSelectFile,
  onCollapse,
  expandedFile,
  onToggleExpand,
}: FileTreeSidebarProps) => {
  const [css] = useStyletron()
  const [collapsedFolders, setCollapsedFolders] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const files = useMemo(() => commit?.commit.filesChanged || [], [commit?.commit.filesChanged])
  const fileTree = useMemo(() => buildFileTree(files), [files])

  const filteredFiles = useMemo(() => {
    if (!searchQuery) return files
    return files.filter(file => file.toLowerCase().includes(searchQuery.toLowerCase()))
  }, [files, searchQuery])

  const toggleFolder = useCallback((path: string) => {
    setCollapsedFolders(prev => {
      const next = new Set(prev)
      if (next.has(path)) {
        next.delete(path)
      } else {
        next.add(path)
      }
      return next
    })
  }, [])

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value)
  }, [])

  if (!commit) {
    return null
  }

  const renderTreeNode = (node: FileTreeNode, depth: number = 0): React.JSX.Element | null => {
    if (!node.isDirectory && searchQuery && !filteredFiles.includes(node.path)) {
      return null
    }

    const isExpanded = expandedFile === node.path
    const isSelected = selectedFile === node.path
    const isCollapsed = collapsedFolders.has(node.path)

    if (node.isDirectory) {
      const hasVisibleChildren = searchQuery
        ? node.children.some(child => !child.isDirectory && filteredFiles.includes(child.path))
        : node.children.length > 0

      if (searchQuery && !hasVisibleChildren) {
        return null
      }

      return (
        <div key={node.path}>
          <button
            onClick={() => toggleFolder(node.path)}
            className={css({
              width: '100%',
              textAlign: 'left',
              padding: '6px 12px',
              paddingLeft: `${12 + depth * 16}px`,
              backgroundColor: 'transparent',
              border: 'none',
              color: '#a1a1aa',
              fontSize: '13px',
              fontFamily: 'inherit',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              ':hover': {
                backgroundColor: '#27272a',
              },
            })}
          >
            {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            <Folder size={14} />
            <span>{node.name}</span>
          </button>
          {!isCollapsed && node.children.map(child => renderTreeNode(child, depth + 1))}
        </div>
      )
    }

    const handleFileClick = () => {
      // If clicking the same file that's already expanded, collapse it
      if (expandedFile === node.path) {
        onToggleExpand(null)
        onSelectFile(node.path)
      } else {
        // Otherwise expand this file
        onToggleExpand(node.path)
        onSelectFile(node.path)
      }
    }

    return (
      <button
        key={node.path}
        onClick={handleFileClick}
        className={css({
          width: '100%',
          textAlign: 'left',
          padding: '6px 12px',
          paddingLeft: `${12 + depth * 16}px`,
          backgroundColor: isExpanded ? '#581c87' : isSelected ? '#27272a' : 'transparent',
          border: 'none',
          color: isExpanded ? '#e9d5ff' : isSelected ? '#fafafa' : '#a1a1aa',
          fontSize: '13px',
          fontFamily: 'inherit',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          ':hover': {
            backgroundColor: isExpanded ? '#6b21a8' : '#27272a',
            color: '#fafafa',
          },
        })}
      >
        <FileIcon size={14} className={css({ color: '#10b981' })} />
        <span className={css({
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        })}>
          {node.name}
        </span>
      </button>
    )
  }

  return (
    <div className={css({
      width: '280px',
      borderRight: '1px solid #27272a',
      backgroundColor: '#18181b',
      display: 'flex',
      flexDirection: 'column',
    })}>
      {/* Search bar */}
      <div className={css({
        padding: '12px',
        borderBottom: '1px solid #27272a',
      })}>
        <div className={css({
          position: 'relative',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        })}>
          <div className={css({
            flex: 1,
            position: 'relative',
          })}>
            <Search className={css({
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#71717a',
            })} size={16} />
            <input
              type="text"
              placeholder="Filter files..."
              value={searchQuery}
              onChange={handleSearchChange}
              className={css({
                width: '100%',
                padding: '8px 12px 8px 36px',
                backgroundColor: '#09090b',
                border: '1px solid #3f3f46',
                borderRadius: '4px',
                color: '#fafafa',
                fontSize: '13px',
                fontFamily: 'inherit',
                outline: 'none',
                ':focus': {
                  borderColor: '#10b981',
                },
                '::placeholder': {
                  color: '#71717a',
                },
              })}
            />
          </div>
          <button
            onClick={onCollapse}
            className={css({
              backgroundColor: '#27272a',
              border: '1px solid #3f3f46',
              color: '#71717a',
              cursor: 'pointer',
              padding: '8px',
              display: 'flex',
              alignItems: 'center',
              borderRadius: '4px',
              ':hover': {
                backgroundColor: '#3f3f46',
                color: '#a1a1aa',
              },
            })}
          >
            <ChevronLeft size={16} />
          </button>
        </div>
      </div>

      {/* File Tree */}
      <div className={css({
        flex: 1,
        overflowY: 'auto',
        padding: '8px 0',
      })}>
        {fileTree.children.map(child => renderTreeNode(child, 0))}
      </div>
    </div>
  )
}
