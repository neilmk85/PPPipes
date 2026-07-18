import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SiteFloatingNav, { MAIN_CONTRACTOR_NAV } from './SiteFloatingNav'
import {
  Archive, FileText, HardHat, ClipboardList, FolderOpen,
  ClipboardCheck, CalendarDays, IndianRupee, TrendingUp, ArrowLeft,
} from 'lucide-react'

interface SiteCard {
  key: string; tag: string; label: string; description: string
  icon: React.ReactNode; buttonLabel: string
  accentColor: string; disabled?: boolean
}

const CARDS: SiteCard[] = [
  {
    key: 'projects', tag: 'MANAGEMENT', label: 'Projects',
    description: 'Track site projects, contract values, scope of work and project timelines all in one place.',
    icon: <FolderOpen size={20} />, buttonLabel: 'View Projects', accentColor: '#3b82f6',
  },
  {
    key: 'contractors', tag: 'CONTRACTORS', label: 'Contractors',
    description: 'Manage sub-contractors, rate contracts and contractor details for every site project.',
    icon: <HardHat size={20} />, buttonLabel: 'View Contractors', accentColor: '#6366f1',
  },
  {
    key: 'work-orders', tag: 'OPERATIONS', label: 'Work Orders',
    description: 'Define sub-contract scope, track assigned work and monitor progress against each order.',
    icon: <ClipboardList size={20} />, buttonLabel: 'View Work Orders', accentColor: '#0ea5e9',
  },
  {
    key: 'material-stock', tag: 'INVENTORY', label: 'Material Stock',
    description: 'Monitor site inventory levels, material receipts and consumption at each project location.',
    icon: <Archive size={20} />, buttonLabel: 'View Stock', accentColor: '#14b8a6',
  },
  {
    key: 'work-bills', tag: 'BILLING', label: 'Work Bills',
    description: 'Record and manage contractor invoices received, with GST, TDS deductions and payment tracking.',
    icon: <FileText size={20} />, buttonLabel: 'View Bills', accentColor: '#a855f7',
  },
  {
    key: 'progress-claims', tag: 'CLAIMS', label: 'Progress Claims',
    description: 'Process contractor progress claims, verify completed work and approve payments.',
    icon: <ClipboardCheck size={20} />, buttonLabel: 'View Claims', accentColor: '#f43f5e', disabled: true,
  },
  {
    key: 'daily-progress', tag: 'TRACKING', label: 'Daily Progress',
    description: 'Log daily work, labour attendance, equipment usage and site activity notes.',
    icon: <CalendarDays size={20} />, buttonLabel: 'View Progress', accentColor: '#06b6d4', disabled: true,
  },
  {
    key: 'reports/financial-summary', tag: 'REPORTS', label: 'Financial Report',
    description: 'Full picture of contractor invoices, payments made, outstanding balances and cost summary.',
    icon: <IndianRupee size={20} />, buttonLabel: 'View Report', accentColor: '#10b981', disabled: true,
  },
  {
    key: 'reports/work-bills-by-contractor', tag: 'BILLING', label: 'Contractor Ledger',
    description: 'Contractor-wise summary — subtotal, GST, TDS, net payable, paid and outstanding.',
    icon: <FileText size={20} />, buttonLabel: 'View Ledger', accentColor: '#7c3aed',
  },
  {
    key: 'reports/progress-report', tag: 'ANALYTICS', label: 'Progress Report',
    description: 'Phase-wise completion percentages, daily trends and project velocity over time.',
    icon: <TrendingUp size={20} />, buttonLabel: 'View Report', accentColor: '#8b5cf6', disabled: true,
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

export default function MainContractorPage() {
  const navigate = useNavigate()

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc' }}>
      {/* Header */}
      <div style={{
        background: 'linear-gradient(135deg, #4c1d95 0%, #5b21b6 30%, #7c3aed 65%, #8b5cf6 100%)',
        padding: '28px 48px 36px',
      }}>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
          <button
            onClick={() => navigate('/site')}
            style={{ position: 'absolute', left: 0, background: 'rgba(255,255,255,0.15)', border: 'none', borderRadius: 8, padding: '6px 8px', cursor: 'pointer', color: 'white', display: 'flex', alignItems: 'center' }}
          >
            <ArrowLeft size={16} />
          </button>
          <SiteFloatingNav inline items={MAIN_CONTRACTOR_NAV} />
        </div>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.6)', marginBottom: 6 }}>MAIN CONTRACTOR</div>
        <h1 style={{ fontSize: 26, fontWeight: 800, color: 'white', marginBottom: 4 }}>PP Pipes as Main Contractor</h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)' }}>Manage projects, sub-contractors, billing and site operations</p>
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
