import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SiteFloatingNav from './SiteFloatingNav'
import { Archive, FileText, HardHat, ClipboardList, FolderOpen, Truck, ClipboardCheck, CalendarDays, IndianRupee, TrendingUp } from 'lucide-react'

interface SiteCard {
  key: string
  tag: string
  label: string
  description: string
  icon: React.ReactNode
  buttonLabel: string
  accentColor: string
  lightBg: string
  lightBorder: string
  lightText: string
  disabled?: boolean
}

const CARDS: SiteCard[] = [
  {
    key: 'projects', tag: 'MANAGEMENT', label: 'Projects',
    description: 'Track site projects, contract values, scope of work and project timelines all in one place.',
    icon: <FolderOpen size={20} />, buttonLabel: 'View Projects',
    accentColor: '#3b82f6', lightBg: '#eff6ff', lightBorder: '#bfdbfe', lightText: '#1d4ed8',
  },
  {
    key: 'contractors', tag: 'CONTRACTORS', label: 'Contractors',
    description: 'Manage sub-contractors, rate contracts and contractor details for every site project.',
    icon: <HardHat size={20} />, buttonLabel: 'View Contractors',
    accentColor: '#6366f1', lightBg: '#eef2ff', lightBorder: '#c7d2fe', lightText: '#4338ca',
  },
  {
    key: 'work-orders', tag: 'OPERATIONS', label: 'Work Orders',
    description: 'Define sub-contract scope, track assigned work and monitor progress against each order.',
    icon: <ClipboardList size={20} />, buttonLabel: 'View Work Orders',
    accentColor: '#0ea5e9', lightBg: '#f0f9ff', lightBorder: '#bae6fd', lightText: '#0369a1',
  },
  {
    key: 'material-stock', tag: 'INVENTORY', label: 'Material Stock',
    description: 'Monitor site inventory levels, material receipts and consumption at each project location.',
    icon: <Archive size={20} />, buttonLabel: 'View Stock',
    accentColor: '#14b8a6', lightBg: '#f0fdfa', lightBorder: '#99f6e4', lightText: '#0f766e',
    disabled: true,
  },
  {
    key: 'work-bills', tag: 'BILLING', label: 'Work Bills',
    description: 'Record and manage contractor invoices received, with GST, TDS deductions and payment tracking.',
    icon: <FileText size={20} />, buttonLabel: 'View Bills',
    accentColor: '#a855f7', lightBg: '#faf5ff', lightBorder: '#e9d5ff', lightText: '#7e22ce',
  },
  {
    key: 'material-issues', tag: 'LOGISTICS', label: 'Material Issues',
    description: 'Record materials issued to contractors on-site with quantity, date and approval tracking.',
    icon: <Truck size={20} />, buttonLabel: 'View Issues',
    accentColor: '#22c55e', lightBg: '#f0fdf4', lightBorder: '#bbf7d0', lightText: '#15803d',
    disabled: true,
  },
  {
    key: 'progress-claims', tag: 'CLAIMS', label: 'Progress Claims',
    description: 'Process contractor progress claims, verify completed work and approve payments.',
    icon: <ClipboardCheck size={20} />, buttonLabel: 'View Claims',
    accentColor: '#f43f5e', lightBg: '#fff1f2', lightBorder: '#fecdd3', lightText: '#be123c',
    disabled: true,
  },
  {
    key: 'daily-progress', tag: 'TRACKING', label: 'Daily Progress',
    description: 'Log daily in-house work, labour attendance, equipment usage and site activity notes.',
    icon: <CalendarDays size={20} />, buttonLabel: 'View Progress',
    accentColor: '#06b6d4', lightBg: '#ecfeff', lightBorder: '#a5f3fc', lightText: '#0e7490',
    disabled: true,
  },
  {
    key: 'reports/financial-summary', tag: 'REPORTS', label: 'Financial Report',
    description: 'Get a full picture of contractor invoices received, payments made, outstanding balances and cost summary.',
    icon: <IndianRupee size={20} />, buttonLabel: 'View Report',
    accentColor: '#10b981', lightBg: '#ecfdf5', lightBorder: '#a7f3d0', lightText: '#065f46',
    disabled: true,
  },
  {
    key: 'reports/progress-report', tag: 'ANALYTICS', label: 'Progress Report',
    description: 'Analyse phase-wise completion percentages, daily trends and project velocity over time.',
    icon: <TrendingUp size={20} />, buttonLabel: 'View Report',
    accentColor: '#8b5cf6', lightBg: '#f5f3ff', lightBorder: '#ddd6fe', lightText: '#5b21b6',
    disabled: true,
  },
  {
    key: 'reports/work-bills-by-contractor', tag: 'BILLING', label: 'Bills by Contractor',
    description: 'Contractor-wise summary of invoices received — subtotal, GST, TDS, net payable, paid and outstanding.',
    icon: <FileText size={20} />, buttonLabel: 'View Report',
    accentColor: '#7c3aed', lightBg: '#f5f3ff', lightBorder: '#ddd6fe', lightText: '#5b21b6',
  },
]

function SiteCard({ card }: { card: SiteCard }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)
  const active = hovered && !card.disabled

  return (
    <div
      onClick={() => !card.disabled && navigate(`/site/${card.key}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: '#ffffff',
        borderRadius: 16,
        padding: '28px 28px 24px',
        cursor: card.disabled ? 'default' : 'pointer',
        border: `1px solid ${active ? card.lightBorder : '#e2e8f0'}`,
        boxShadow: active
          ? '0 16px 40px rgba(0,0,0,0.10), 0 4px 12px rgba(0,0,0,0.06)'
          : '0 1px 4px rgba(0,0,0,0.05)',
        transform: active ? 'translateY(-4px)' : 'translateY(0)',
        transition: 'transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease',
        opacity: card.disabled ? 0.55 : 1,
      }}
    >
      {/* Label */}
      <div style={{ fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 10, lineHeight: 1.3 }}>
        {card.label}
      </div>

      {/* Description */}
      <div style={{ color: '#64748b', lineHeight: 1.75, fontSize: 13.5, marginBottom: 22 }}>
        {card.description}
      </div>

      {/* CTA */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 5,
        color: card.disabled ? '#94a3b8' : card.accentColor, fontWeight: 600, fontSize: 13,
        transform: active ? 'translateX(4px)' : 'translateX(0)',
        transition: 'transform 0.22s ease',
      }}>
        {card.disabled ? 'Coming Soon' : `${card.buttonLabel} →`}
      </div>
    </div>
  )
}

export default function SitePage() {
  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', padding: '48px 48px 64px' }}>
      <SiteFloatingNav theme="light" />

      {/* Header */}
      <div style={{ marginBottom: 40, maxWidth: 520 }}>
        <div style={{ fontSize: 32, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
          Site Management
        </div>
        <p style={{ marginTop: 10, color: '#64748b', fontSize: 15, lineHeight: 1.6 }}>
          Manage projects, contractors, billing and daily site operations
        </p>
      </div>

      {/* Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
        gap: 20,
      }}>
        {CARDS.map(card => <SiteCard key={card.key} card={card} />)}
      </div>
    </div>
  )
}
