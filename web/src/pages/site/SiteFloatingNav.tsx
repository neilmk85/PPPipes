import { useNavigate, useLocation } from 'react-router-dom'

const NAV_ITEMS = [
  { key: 'projects',                  label: 'Projects',         disabled: false },
  { key: 'contractors',               label: 'Contractors',      disabled: false },
  { key: 'work-orders',               label: 'Work Orders',      disabled: false },
  { key: 'material-stock',            label: 'Material Stock',   disabled: true  },
  { key: 'work-bills',                label: 'Work Bills',       disabled: false },
  { key: 'material-issues',           label: 'Material Issues',  disabled: true  },
  { key: 'progress-claims',           label: 'Progress Claims',  disabled: true  },
  { key: 'daily-progress',            label: 'Daily Progress',   disabled: true  },
  { key: 'reports/financial-summary',         label: 'Financial Report',      disabled: false },
  { key: 'reports/progress-report',           label: 'Progress Report',       disabled: false },
  { key: 'reports/work-bills-by-contractor',  label: 'Bills by Contractor',   disabled: false },
]

type NavTheme = 'dark' | 'light'

export default function SiteFloatingNav({ theme = 'light', inline = false }: { theme?: NavTheme; inline?: boolean }) {
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
        {NAV_ITEMS.map(item => {
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
