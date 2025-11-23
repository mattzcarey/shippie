import { useState, useEffect, useRef } from 'react'
import { useStyletron } from 'baseui'
import { ChevronDown } from 'lucide-react'
import { useBranches } from '../hooks/useBranches'

type BranchSelectorProps = {
  currentBranch: string
  baseBranch: string
  onCurrentBranchChange: (branch: string) => void
  onBaseBranchChange: (branch: string) => void
}

export const BranchSelector = ({ currentBranch, baseBranch, onCurrentBranchChange, onBaseBranchChange }: BranchSelectorProps) => {
  const [css] = useStyletron()
  const [showBaseDropdown, setShowBaseDropdown] = useState(false)
  const [showCurrentDropdown, setShowCurrentDropdown] = useState(false)
  const baseDropdownRef = useRef<HTMLDivElement>(null)
  const currentDropdownRef = useRef<HTMLDivElement>(null)
  const { data: branches, isLoading: branchesLoading } = useBranches()

  const allBranches = branches?.all || []

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (baseDropdownRef.current && !baseDropdownRef.current.contains(event.target as Node)) {
        setShowBaseDropdown(false)
      }
      if (currentDropdownRef.current && !currentDropdownRef.current.contains(event.target as Node)) {
        setShowCurrentDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div className={css({
      display: 'flex',
      alignItems: 'center',
      gap: '16px',
      padding: '12px 16px',
      borderBottom: '1px solid #27272a',
      backgroundColor: '#18181b',
    })}>
      {/* Shippie branding */}
      <div className={css({
        fontFamily: '"Courier New", Courier, monospace',
        fontSize: '18px',
        fontWeight: 'bold',
        color: '#10b981',
        letterSpacing: '2px',
        textTransform: 'uppercase',
        marginRight: '24px',
      })}>
        shippie
      </div>

      {/* Base branch dropdown */}
      <div ref={baseDropdownRef} className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        position: 'relative',
      })}>
        <button
          onClick={() => setShowBaseDropdown(!showBaseDropdown)}
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
            color: '#a1a1aa',
            fontSize: '13px',
            fontFamily: 'inherit',
            cursor: 'pointer',
            ':hover': {
              backgroundColor: '#3f3f46',
            },
          })}
        >
          <span>{baseBranch}</span>
          <ChevronDown size={14} />
        </button>

        {showBaseDropdown && (
          <div className={css({
            position: 'absolute',
            top: '100%',
            left: 0,
            marginTop: '4px',
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 50,
            minWidth: '200px',
          })}>
            <div className={css({
              padding: '8px',
              fontSize: '11px',
              color: '#71717a',
              borderBottom: '1px solid #3f3f46',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            })}>
              Base Branch
            </div>
            {branchesLoading && (
              <div className={css({
                padding: '8px 12px',
                fontSize: '13px',
                color: '#71717a',
              })}>
                Loading branches...
              </div>
            )}
            {!branchesLoading && allBranches.length === 0 && (
              <div className={css({
                padding: '8px 12px',
                fontSize: '13px',
                color: '#71717a',
              })}>
                No branches found
              </div>
            )}
            {!branchesLoading && allBranches.map(branch => (
              <button
                key={branch}
                onClick={() => {
                  setShowBaseDropdown(false)
                  onBaseBranchChange(branch)
                }}
                className={css({
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: branch === baseBranch ? '#10b981' : '#a1a1aa',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  ':hover': {
                    backgroundColor: '#3f3f46',
                  },
                })}
              >
                {branch}
              </button>
            ))}
          </div>
        )}
      </div>

      <span className={css({ color: '#71717a', fontSize: '13px' })}>...</span>

      <div ref={currentDropdownRef} className={css({
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        position: 'relative',
      })}>
        <button
          onClick={() => setShowCurrentDropdown(!showCurrentDropdown)}
          className={css({
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
            color: '#fafafa',
            fontSize: '13px',
            fontFamily: 'inherit',
            cursor: 'pointer',
            ':hover': {
              backgroundColor: '#3f3f46',
            },
          })}
        >
          <span>{currentBranch}</span>
          <ChevronDown size={14} />
        </button>

        {showCurrentDropdown && (
          <div className={css({
            position: 'absolute',
            top: '100%',
            right: 0,
            marginTop: '4px',
            backgroundColor: '#27272a',
            border: '1px solid #3f3f46',
            boxShadow: '0 4px 12px rgba(0, 0, 0, 0.3)',
            zIndex: 50,
            minWidth: '200px',
          })}>
            <div className={css({
              padding: '8px',
              fontSize: '11px',
              color: '#71717a',
              borderBottom: '1px solid #3f3f46',
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            })}>
              Comparison Branch
            </div>
            {branchesLoading && (
              <div className={css({
                padding: '8px 12px',
                fontSize: '13px',
                color: '#71717a',
              })}>
                Loading branches...
              </div>
            )}
            {!branchesLoading && allBranches.length === 0 && (
              <div className={css({
                padding: '8px 12px',
                fontSize: '13px',
                color: '#71717a',
              })}>
                No branches found
              </div>
            )}
            {!branchesLoading && allBranches.map(branch => (
              <button
                key={branch}
                onClick={() => {
                  setShowCurrentDropdown(false)
                  onCurrentBranchChange(branch)
                }}
                className={css({
                  display: 'block',
                  width: '100%',
                  textAlign: 'left',
                  padding: '8px 12px',
                  fontSize: '13px',
                  color: branch === currentBranch ? '#10b981' : '#a1a1aa',
                  backgroundColor: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  ':hover': {
                    backgroundColor: '#3f3f46',
                  },
                })}
              >
                {branch}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
