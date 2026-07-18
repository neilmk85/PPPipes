import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SiteFloatingNav, { SUB_CONTRACTOR_NAV } from './SiteFloatingNav'
import {
  ClipboardList, Receipt, CalendarDays, Archive,
  TrendingUp, Wrench, ArrowLeft,
} from 'lucide-react'

interface SiteCard {
  key: string; tag: string; label: string; description: string
  icon: React.ReactNode; buttonLabel: string
  accentColor: string; disabled?: boolean
}

const CARDS: SiteCard[] = [
  {
    key: 'sub-contracts', tag: 'AGREEMENT', label: 'Sub-contract Agreement',
    description: 'Record the work order / agreement received from the main contractor — scope, quantities, rates and terms.',
    icon: <ClipboardList size={20} />, buttonLabel: 'View Agreements', accentColor: '#0d9488',
  },
  {
    key: 'client-bills', tag: 'BILLING', label: 'RA Bills',
    description: 'Raise Running Account Bills to the main contractor with GST, TDS and retention deductions tracked.',
    icon: <Receipt size={20} />, buttonLabel: 'View RA Bills', accentColor: '#0d9488',
  },
  {
    key: 'daily-progress', tag: 'TRACKING', label: 'Daily Progress',
    description: 'Log daily work completed — chainage, quantity, labour deployed and site conditions.',
    icon: <CalendarDays size={20} />, buttonLabel: 'View Progress', accentColor: '#06b6d4',
  },
  {
    key: 'material-stock', tag: 'INVENTORY', label: 'Material Tracking',
    description: 'Track material received from main contractor or self-arranged, and record consumption on site.',
    icon: <Archive size={20} />, buttonLabel: 'View Stock', accentColor: '#14b8a6',
  },
  {
    key: 'sub-labour', tag: 'RESOURCES', label: 'Labour & Equipment',
    description: 'Log PP Pipes\' own manpower and equipment deployed on the sub-contracted scope of work.',
    icon: <Wrench size={20} />, buttonLabel: 'View Resources', accentColor: '#f59e0b',
  },
  {
    key: 'sub-reports', tag: 'ANALYTICS', label: 'Progress Report',
    description: 'Physical and financial progress — billed vs certified vs paid, work completed vs contracted.',
    icon: <TrendingUp size={20} />, buttonLabel: 'View Report', accentColor: '#8b5cf6',
  },
]

function Card({ card }: { card: SiteCard }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const active = hovered && !card.disabled

  return (
    <div
      onClick={() => !card.disabled && navigate(`/site/${card.key}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#ffffff', borderRadius: 16, padding: '24px 24px 20px',
        cursor: card.disabled ? 'default' : 'pointer',
        boxShadow: active
          ? '0 20px 50px rgba(0,0,0,0.13), 0 6px 16px rgba(0,0,0,0.07)'
          : '0 4px 20px rgba(0,0,0,0.07), 0 1px 6px rgba(0,0,0,0.04)',
        transform: active ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease',
        opacity: card.disabled ? 0.5 : 1,
      }}
    >
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', marginBottom: 10 }}>{card.tag}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>{card.label}</div>
      <div style={{ color: '#64748b', lineHeight: 1.7, fontSize: 13, marginBottom: 18 }}>{card.description}</div>
      <div style={{
        fontSize: 12, fontWeight: 600,
        color: card.disabled ? '#94a3b8' : card.accentColor,
        transform: active ? 'translateX(4px)' : 'translateX(0)',
        transition: 'transform 0.22s ease',
      }}>
        {card.disabled ? 'Coming Soon' : `${card.buttonLabel} →`}
      </div>
    </div>
  )
}

export default function SubContractorPage() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #134e4a 0%, #0f766e 30%, #0d9488 65%, #14b8a6 100%)',
        padding: '28px 48px 36px',
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <button
            onClick={() => navigate('/site')}
            style={{ position: 'absolute', left: 0, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={16} />
          </button>
          <SiteFloatingNav inline items={SUB_CONTRACTOR_NAV} />
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>SUB-CONTRACTOR</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'white', marginBottom: 4 }}>PP Pipes as Sub-contractor</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Track agreements, raise RA bills and log daily progress on pipe-laying work</p>
      </div>

      {/* Cards */}
      <div style={{ padding: '36px 48px 64px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 18 }}>
          {CARDS.map(card => <Card key={card.key} card={card} />)}
        </div>
      </div>
    </div>
  )
}
