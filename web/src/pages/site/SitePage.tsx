import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  HardHat, Building2, ClipboardList, FileText, Archive,
  IndianRupee, TrendingUp, CalendarDays, ChevronRight,
  Wrench, Receipt,
} from 'lucide-react'

const MAIN_FEATURES = [
  { icon: <Building2 size={13} />, label: 'Projects & Sites' },
  { icon: <HardHat size={13} />, label: 'Contractors & Work Orders' },
  { icon: <FileText size={13} />, label: 'Work Bills & Payments' },
  { icon: <Archive size={13} />, label: 'Material Stock' },
  { icon: <CalendarDays size={13} />, label: 'Daily Progress' },
  { icon: <IndianRupee size={13} />, label: 'Financial Reports' },
]

const SUB_FEATURES = [
  { icon: <ClipboardList size={13} />, label: 'Sub-contract Agreement' },
  { icon: <Receipt size={13} />, label: 'RA Bills to Client' },
  { icon: <CalendarDays size={13} />, label: 'Daily Progress Tracking' },
  { icon: <Archive size={13} />, label: 'Material Tracking' },
  { icon: <TrendingUp size={13} />, label: 'Progress Reports' },
  { icon: <Wrench size={13} />, label: 'Labour & Equipment' },
]

function HalfPanel({
  role, title, subtitle, features, gradient, textColor, chipBg, chipText, ctaLabel, onClick,
}: {
  role: string; title: string; subtitle: string
  features: { icon: React.ReactNode; label: string }[]
  gradient: string; textColor: string; chipBg: string; chipText: string
  ctaLabel: string; onClick: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        flex: 1,
        background: gradient,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '64px 56px',
        cursor: 'pointer',
        transition: 'filter 0.25s ease',
        filter: hovered ? 'brightness(0.97)' : 'brightness(1)',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Background decoration */}
      <div style={{
        position: 'absolute', inset: 0, opacity: 0.04,
        backgroundImage: 'radial-gradient(circle at 80% 20%, white 0%, transparent 60%)',
        pointerEvents: 'none',
      }} />

      {/* Role tag */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 6,
        fontSize: 11, fontWeight: 700, letterSpacing: '0.08em',
        color: chipText, background: chipBg,
        padding: '4px 10px', borderRadius: 20, marginBottom: 20,
        width: 'fit-content',
      }}>
        {role}
      </div>

      {/* Title */}
      <h2 style={{
        fontSize: 38, fontWeight: 800, color: textColor,
        lineHeight: 1.15, letterSpacing: '-0.5px', marginBottom: 14,
      }}>
        {title}
      </h2>

      {/* Subtitle */}
      <p style={{
        fontSize: 15, color: textColor, opacity: 0.72,
        lineHeight: 1.65, marginBottom: 36, maxWidth: 400,
      }}>
        {subtitle}
      </p>

      {/* Feature chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 44 }}>
        {features.map(f => (
          <div key={f.label} style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: chipBg, color: chipText,
            padding: '5px 11px', borderRadius: 20, fontSize: 12, fontWeight: 500,
          }}>
            {f.icon}{f.label}
          </div>
        ))}
      </div>

      {/* CTA */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        fontSize: 14, fontWeight: 700, color: textColor,
        transform: hovered ? 'translateX(6px)' : 'translateX(0)',
        transition: 'transform 0.25s ease',
      }}>
        {ctaLabel}
        <ChevronRight size={18} style={{ opacity: 0.8 }} />
      </div>
    </div>
  )
}

export default function SitePage() {
  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
      {/* Top bar */}
      <div style={{
        padding: '20px 40px', background: 'white',
        borderBottom: '1px solid #f1f5f9',
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8', letterSpacing: '0.05em' }}>SITE</div>
        <div style={{ width: 1, height: 14, background: '#e2e8f0' }} />
        <div style={{ fontSize: 14, fontWeight: 600, color: '#0f172a' }}>Select your role for this session</div>
      </div>

      {/* Split panels */}
      <div style={{ display: 'flex', flex: 1 }}>
        <HalfPanel
          role="MAIN CONTRACTOR"
          title={<>PP Pipes as<br />Main Contractor</>  as any}
          subtitle="PP Pipes is directly contracted by the project owner. Manage sub-contractors, work orders, bills, and site operations."
          features={MAIN_FEATURES}
          gradient="linear-gradient(135deg, #4c1d95 0%, #5b21b6 30%, #7c3aed 65%, #8b5cf6 100%)"
          textColor="#ffffff"
          chipBg="rgba(255,255,255,0.18)"
          chipText="rgba(255,255,255,0.92)"
          ctaLabel="Enter Main Contractor mode"
          onClick={() => navigate('/site/main-contractor')}
        />

        {/* Divider */}
        <div style={{ width: 2, background: 'white', zIndex: 1, flexShrink: 0 }} />

        <HalfPanel
          role="SUB-CONTRACTOR"
          title={<>PP Pipes as<br />Sub-contractor</>  as any}
          subtitle="PP Pipes is hired by a main contractor for pipe-laying work. Track agreements, raise RA Bills, log daily progress."
          features={SUB_FEATURES}
          gradient="linear-gradient(135deg, #134e4a 0%, #0f766e 30%, #0d9488 65%, #14b8a6 100%)"
          textColor="#ffffff"
          chipBg="rgba(255,255,255,0.18)"
          chipText="rgba(255,255,255,0.92)"
          ctaLabel="Enter Sub-contractor mode"
          onClick={() => navigate('/site/sub-contractor')}
        />
      </div>
    </div>
  )
}
