import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowRight } from 'lucide-react'

const MAIN_FEATURES = [
  'Projects & Sites', 'Contractors & Work Orders',
  'Work Bills & Payments', 'Material Stock',
  'Daily Progress', 'Financial Reports',
]

const SUB_FEATURES = [
  'Sub-contract Agreement', 'RA Bills to Client',
  'Daily Progress Tracking', 'Material Tracking',
  'Progress Reports', 'Labour & Equipment',
]

function MainVisual() {
  return (
    <svg viewBox="0 0 300 400" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <circle cx="260" cy="40" r="130" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      <circle cx="260" cy="40" r="80" stroke="rgba(255,255,255,0.07)" strokeWidth="1" />
      <line x1="90" y1="110" x2="210" y2="70" stroke="rgba(167,139,250,0.22)" strokeWidth="0.8" />
      <line x1="90" y1="110" x2="240" y2="180" stroke="rgba(167,139,250,0.18)" strokeWidth="0.8" />
      <line x1="90" y1="110" x2="170" y2="260" stroke="rgba(167,139,250,0.2)" strokeWidth="0.8" />
      <line x1="90" y1="110" x2="50" y2="230" stroke="rgba(167,139,250,0.15)" strokeWidth="0.8" />
      <line x1="90" y1="110" x2="145" y2="155" stroke="rgba(167,139,250,0.28)" strokeWidth="0.8" />
      <line x1="210" y1="70" x2="240" y2="180" stroke="rgba(167,139,250,0.13)" strokeWidth="0.8" />
      <line x1="240" y1="180" x2="170" y2="260" stroke="rgba(167,139,250,0.13)" strokeWidth="0.8" />
      <line x1="170" y1="260" x2="260" y2="300" stroke="rgba(167,139,250,0.1)" strokeWidth="0.8" />
      <line x1="145" y1="155" x2="240" y2="180" stroke="rgba(167,139,250,0.16)" strokeWidth="0.8" />
      <line x1="50" y1="230" x2="170" y2="260" stroke="rgba(167,139,250,0.12)" strokeWidth="0.8" />
      <circle cx="90" cy="110" r="7" fill="rgba(167,139,250,0.85)" />
      <circle cx="90" cy="110" r="14" stroke="rgba(167,139,250,0.25)" strokeWidth="1" />
      <circle cx="210" cy="70" r="4.5" fill="rgba(167,139,250,0.55)" />
      <circle cx="240" cy="180" r="4.5" fill="rgba(167,139,250,0.55)" />
      <circle cx="170" cy="260" r="5" fill="rgba(167,139,250,0.6)" />
      <circle cx="50" cy="230" r="4" fill="rgba(167,139,250,0.4)" />
      <circle cx="145" cy="155" r="3.5" fill="rgba(167,139,250,0.6)" />
      <circle cx="260" cy="300" r="3.5" fill="rgba(167,139,250,0.3)" />
      <rect x="72" y="280" width="80" height="2" rx="1" fill="rgba(255,255,255,0.06)" />
      <rect x="72" y="290" width="55" height="2" rx="1" fill="rgba(255,255,255,0.04)" />
    </svg>
  )
}

function SubVisual() {
  return (
    <svg viewBox="0 0 300 400" fill="none" xmlns="http://www.w3.org/2000/svg"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <circle cx="260" cy="360" r="150" stroke="rgba(255,255,255,0.04)" strokeWidth="1" />
      <path d="M-10 70 Q55 70 80 100 Q105 130 160 128 Q215 126 240 96 Q265 66 310 68"
        stroke="rgba(94,234,212,0.22)" strokeWidth="1.5" fill="none" />
      <path d="M-10 145 Q45 145 80 168 Q115 191 165 189 Q215 187 248 164 Q281 141 310 143"
        stroke="rgba(94,234,212,0.18)" strokeWidth="1.5" fill="none" />
      <path d="M-10 225 Q70 225 105 248 Q140 271 185 266 Q230 261 258 238 Q286 215 310 217"
        stroke="rgba(94,234,212,0.15)" strokeWidth="1.5" fill="none" />
      <path d="M-10 305 Q60 305 100 284 Q140 263 195 278 Q250 293 310 290"
        stroke="rgba(94,234,212,0.11)" strokeWidth="1.5" fill="none" />
      <circle cx="80" cy="100" r="5" stroke="rgba(94,234,212,0.55)" strokeWidth="1.5" fill="rgba(20,184,166,0.2)" />
      <circle cx="160" cy="128" r="5" stroke="rgba(94,234,212,0.55)" strokeWidth="1.5" fill="rgba(20,184,166,0.2)" />
      <circle cx="240" cy="96" r="4.5" stroke="rgba(94,234,212,0.45)" strokeWidth="1.5" fill="rgba(20,184,166,0.15)" />
      <circle cx="80" cy="168" r="4.5" stroke="rgba(94,234,212,0.45)" strokeWidth="1.5" fill="rgba(20,184,166,0.15)" />
      <circle cx="165" cy="189" r="5" stroke="rgba(94,234,212,0.5)" strokeWidth="1.5" fill="rgba(20,184,166,0.18)" />
      <circle cx="105" cy="248" r="4.5" stroke="rgba(94,234,212,0.4)" strokeWidth="1.5" fill="rgba(20,184,166,0.12)" />
      <circle cx="195" cy="278" r="4.5" stroke="rgba(94,234,212,0.4)" strokeWidth="1.5" fill="rgba(20,184,166,0.12)" />
      <rect x="20" y="54" width="36" height="10" rx="2.5" fill="rgba(94,234,212,0.14)" />
      <rect x="20" y="130" width="36" height="10" rx="2.5" fill="rgba(94,234,212,0.11)" />
      <rect x="20" y="210" width="36" height="10" rx="2.5" fill="rgba(94,234,212,0.09)" />
      <rect x="20" y="290" width="36" height="10" rx="2.5" fill="rgba(94,234,212,0.07)" />
    </svg>
  )
}

interface CardDef {
  role: string
  tagline: string
  title: string
  subtitle: string
  features: string[]
  route: string
  gradient: string
  glow: string
  glowHover: string
  accent: string
  visual: React.ReactNode
  cta: string
  disabled?: boolean
}

const CARDS: CardDef[] = [
  {
    role: 'MAIN CONTRACTOR',
    tagline: 'You manage\nthe site',
    title: 'PP Pipes as Main Contractor',
    subtitle: 'PP Pipes is contracted directly by the project owner. Manage sub-contractors, work orders, billing, and full site operations from one place.',
    features: MAIN_FEATURES,
    route: '/site/main-contractor',
    gradient: 'linear-gradient(150deg, #1a0640 0%, #2e1065 28%, #4c1d95 55%, #5b21b6 78%, #6d28d9 100%)',
    glow: '0 0 0 1px rgba(109,40,217,0.22), 0 4px 32px rgba(76,29,149,0.12)',
    glowHover: '0 0 0 1px rgba(124,58,237,0.52), 0 12px 64px rgba(109,40,217,0.26), 0 0 120px rgba(76,29,149,0.1)',
    accent: '#a78bfa',
    visual: <MainVisual />,
    cta: 'Enter main contractor mode',
  },
  {
    role: 'SUB-CONTRACTOR',
    tagline: 'You deliver\nthe work',
    title: 'PP Pipes as Sub-contractor',
    subtitle: 'PP Pipes is hired by a main civil contractor for pipe-laying work. Raise RA Bills, track agreements, and log daily progress on your scope.',
    features: SUB_FEATURES,
    route: '/site/sub-contractor',
    gradient: 'linear-gradient(150deg, #020617 0%, #0c1a3d 28%, #1e3a8a 55%, #1d4ed8 78%, #3b82f6 100%)',
    glow: '0 0 0 1px rgba(29,78,216,0.22), 0 4px 32px rgba(30,58,138,0.12)',
    glowHover: '0 0 0 1px rgba(59,130,246,0.52), 0 12px 64px rgba(29,78,216,0.26), 0 0 120px rgba(30,58,138,0.1)',
    accent: '#93c5fd',
    visual: <SubVisual />,
    cta: 'Enter sub-contractor mode',
  },
]

function RoleCard({ card }: { card: CardDef }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const active = hovered && !card.disabled

  return (
    <div
      onClick={() => !card.disabled && navigate(card.route)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: 1,
        background: '#0c1220',
        borderRadius: 16,
        overflow: 'hidden',
        cursor: card.disabled ? 'default' : 'pointer',
        boxShadow: active ? card.glowHover : card.glow,
        transform: active ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'box-shadow 0.38s cubic-bezier(0.4,0,0.2,1), transform 0.32s cubic-bezier(0.4,0,0.2,1)',
        opacity: card.disabled ? 0.5 : 1,
      }}
    >
      {/* Top — visual pane */}
      <div style={{
        height: 260,
        flexShrink: 0,
        background: card.gradient,
        position: 'relative',
        overflow: 'hidden',
        padding: '36px 44px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}>
        {card.visual}
        <div style={{
          position: 'relative', zIndex: 1,
          fontSize: 10, fontWeight: 500, letterSpacing: '0.16em',
          color: 'rgba(255,255,255,0.45)', marginBottom: 10, textTransform: 'uppercase',
        }}>
          {card.role}
        </div>
        <div style={{
          position: 'relative', zIndex: 1,
          fontSize: 28, fontWeight: 300, color: 'white',
          lineHeight: 1.15, letterSpacing: '-0.3px',
          whiteSpace: 'pre-line',
        }}>
          {card.tagline}
        </div>
      </div>

      {/* Bottom — content pane */}
      <div style={{
        padding: '24px 32px 20px',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div style={{
          fontSize: 10, fontWeight: 500, letterSpacing: '0.16em',
          color: card.accent, marginBottom: 8, textTransform: 'uppercase', opacity: 0.9,
        }}>
          {card.role}
        </div>

        <h2 style={{
          fontSize: 20, fontWeight: 700, color: '#eef2ff',
          lineHeight: 1.2, letterSpacing: '0px', marginBottom: 8,
        }}>
          {card.title}
        </h2>

        <p style={{
          fontSize: 13, fontWeight: 300, color: '#475569',
          lineHeight: 1.7, marginBottom: 16,
        }}>
          {card.subtitle}
        </p>

        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          gap: '7px 16px', marginBottom: 20,
        }}>
          {card.features.map(f => (
            <div key={f} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              fontSize: 12, fontWeight: 400, color: '#64748b',
            }}>
              <div style={{
                width: 4, height: 4, borderRadius: '50%',
                background: card.accent, flexShrink: 0, opacity: 0.65,
              }} />
              {f}
            </div>
          ))}
        </div>

        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: hovered ? `${card.accent}12` : 'rgba(255,255,255,0.04)',
          border: `1px solid ${hovered ? card.accent + '55' : 'rgba(255,255,255,0.08)'}`,
          borderRadius: 8,
          padding: '9px 16px',
          fontSize: 12, fontWeight: 500,
          color: hovered ? card.accent : '#64748b',
          width: 'fit-content',
          transform: hovered ? 'translateX(5px)' : 'translateX(0)',
          transition: 'all 0.32s cubic-bezier(0.4,0,0.2,1)',
        }}>
          {card.cta}
          <ArrowRight size={14} style={{ opacity: 0.85 }} />
        </div>
      </div>
    </div>
  )
}

export default function SitePage() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#06090f',
      display: 'flex',
      flexDirection: 'column',
      fontFamily: "'Roboto', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: '22px 64px',
        borderBottom: '1px solid rgba(255,255,255,0.04)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
      }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.12em' }}>PP PIPES</div>
        <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.2)' }} />
        <div style={{ fontSize: 11, fontWeight: 400, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em' }}>SITE MODULE</div>
      </div>

      {/* Intro text */}
      <div style={{ padding: '56px 64px 40px' }}>
        <div style={{
          fontSize: 10, fontWeight: 500, letterSpacing: '0.14em',
          color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 16,
        }}>
          Select your operating mode
        </div>
        <h1 style={{
          fontSize: 46, fontWeight: 300, color: '#60a5fa',
          lineHeight: 1.1, letterSpacing: '-0.5px',
        }}>
          How is PP Pipes engaged on this project?
        </h1>
      </div>

      {/* Cards — full width */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, padding: '0 16px 24px' }}>
        {CARDS.map(card => <RoleCard key={card.role} card={card} />)}
      </div>
    </div>
  )
}
