import { useNavigate, useLocation } from 'react-router-dom'

export interface NavItem {
  key: string
  label: string
  disabled?: boolean
}

export const MAIN_CONTRACTOR_NAV: NavItem[] = [
  { key: 'projects',                             label: 'Projects'          },
  { key: 'contractors',                          label: 'Contractors'       },
  { key: 'work-orders',                          label: 'Work Orders'       },
  { key: 'material-stock',                       label: 'Material Stock'    },
  { key: 'work-bills',                           label: 'Work Bills'        },
  { key: 'daily-progress',                       label: 'Daily Progress',   disabled: true },
  { key: 'reports/financial-summary',            label: 'Financial Report', disabled: true },
  { key: 'reports/work-bills-by-contractor',     label: 'Contractor Ledger' },
  { key: 'reports/progress-report',              label: 'Progress Report',  disabled: true },
]

export const SUB_CONTRACTOR_NAV: NavItem[] = [
  { key: 'sub-contracts',   label: 'Agreement'          },
  { key: 'client-bills',    label: 'RA Bills'           },
  { key: 'daily-progress',  label: 'Daily Progress'     },
  { key: 'material-stock',  label: 'Material Tracking'  },
  { key: 'sub-labour',      label: 'Labour & Equipment' },
  { key: 'sub-reports',     label: 'Progress Report'    },
]

const DEFAULT_NAV: NavItem[] = [...MAIN_CONTRACTOR_NAV, { key: 'client-bills', label: 'RA Bills' }]

type NavTheme = 'dark' | 'light'

export default function SiteFloatingNav({
  theme = 'light',
  inline = false,
  items,
}: {
  theme?: NavTheme
  inline?: boolean
  items?: NavItem[]
}) {
  const resolvedItems = items ?? DEFAULT_NAV
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <div style={inline ? {
      display: 'flex', justifyContent: 'center',
    } : {
      position: 'sticky', top: 16, zIndex: 100,
      display: 'flex', justifyContent: 'center',
      marginBottom: 32, pointerEvents: 'none',
    }}>
      <nav style={{
        display: 'flex', alignItems: 'center', gap: 2,
        padding: '8px 10px',
        borderRadius: 999,
        background: theme === 'dark'
          ? 'rgba(15,23,42,0.88)'
          : 'rgba(255,255,255,0.82)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        boxShadow: theme === 'dark'
          ? '0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06)'
          : '0 4px 24px rgba(0,0,0,0.10), 0 0 0 1px rgba(0,0,0,0.06)',
        pointerEvents: 'all',
        flexWrap: 'nowrap',
        overflowX: 'auto',
        maxWidth: '100%',
      }}>
        {resolvedItems.map(item => {
          const isActive = pathname === `/site/${item.key}` || pathname.startsWith(`/site/${item.key}/`)
          return (
            <button
              key={item.key}
              onClick={() => !item.disabled && navigate(`/site/${item.key}`)}
              style={{
                padding: '10px 16px',
                borderRadius: 999,
                border: 'none',
                background: isActive ? '#0f172a' : 'transparent',
                color: item.disabled
                  ? (theme === 'dark' ? 'rgba(255,255,255,0.25)' : '#cbd5e1')
                  : isActive
                    ? '#fff'
                    : theme === 'dark' ? 'rgba(255,255,255,0.55)' : '#64748b',
                fontSize: 12,
                fontWeight: isActive ? 500 : 300,
                fontFamily: '"Roboto", sans-serif',
                cursor: item.disabled ? 'default' : 'pointer',
                whiteSpace: 'nowrap',
                transition: 'background 0.18s ease, color 0.18s ease',
                letterSpacing: isActive ? '0.03em' : '0.04em',
                boxShadow: 'none',
                opacity: item.disabled ? 0.5 : 1,
              }}
              onMouseEnter={e => {
                if (isActive || item.disabled) return
                e.currentTarget.style.background = theme === 'dark' ? 'rgba(255,255,255,0.10)' : '#f1f5f9'
                e.currentTarget.style.color = theme === 'dark' ? '#fff' : '#0f172a'
              }}
              onMouseLeave={e => {
                if (isActive || item.disabled) return
                e.currentTarget.style.background = 'transparent'
                e.currentTarget.style.color = theme === 'dark' ? 'rgba(255,255,255,0.55)' : '#64748b'
              }}
            >
              {item.label}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
