import { useStyletron } from 'baseui'
import { getChangeTypeColors, type ChangeType } from '../theme/colors'

type ChangeTypeBadgeProps = {
  changeType: ChangeType
}

export const ChangeTypeBadge = ({ changeType }: ChangeTypeBadgeProps) => {
  const [css] = useStyletron()
  const colors = getChangeTypeColors(changeType)

  return (
    <span className={css({
      fontSize: '10px',
      color: '#71717a',
      backgroundColor: 'transparent',
      padding: '3px 0',
      textTransform: 'uppercase',
      fontWeight: 500,
      letterSpacing: '0.05em',
      position: 'relative',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '4px',
      '::before': {
        content: '""',
        width: '4px',
        height: '4px',
        borderRadius: '50%',
        backgroundColor: colors.icon,
        display: 'inline-block',
      },
    })}>
      {changeType}
    </span>
  )
}
