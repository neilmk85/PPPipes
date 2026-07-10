import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers, Package, FlaskConical, ClipboardCheck,
  Wrench, Truck, Database, ArrowDownToLine,
  Trash2, Hammer, Users, PackageOpen,
  Archive, Fuel, Car, Scissors, RefreshCw, Container,
  FileBarChart2, Settings, Building2, ReceiptText,
} from 'lucide-react'

interface BusinessCard {
  key: string
  label: string
  icon: React.ReactNode
  color: string       // Tailwind bg for icon wrapper
  iconColor: string   // Tailwind text for icon
  glow: string        // CSS rgba color for hover glow shadow
}

const CARDS: BusinessCard[] = [
  { key: 'pccp',               label: 'PCCP',               icon: <Layers size={26} />,         color: 'bg-violet-50',  iconColor: 'text-violet-600',  glow: 'rgba(139,92,246,0.35)'  },
  { key: 'psc',                label: 'PSC',                icon: <Package size={26} />,        color: 'bg-blue-50',    iconColor: 'text-blue-600',    glow: 'rgba(59,130,246,0.35)'  },
  { key: 'testing-lab',        label: 'Testing Lab',        icon: <FlaskConical size={26} />,   color: 'bg-cyan-50',    iconColor: 'text-cyan-600',    glow: 'rgba(6,182,212,0.35)'   },
  { key: 'pdi',                label: 'PDI',                icon: <ClipboardCheck size={26} />, color: 'bg-emerald-50', iconColor: 'text-emerald-600', glow: 'rgba(16,185,129,0.35)'  },
  { key: 'maintenance',        label: 'Maintenance',        icon: <Wrench size={26} />,         color: 'bg-amber-50',   iconColor: 'text-amber-600',   glow: 'rgba(245,158,11,0.35)'  },
  { key: 'vehicles',           label: 'Vehicles',           icon: <Truck size={26} />,          color: 'bg-orange-50',  iconColor: 'text-orange-600',  glow: 'rgba(234,88,12,0.30)'   },
  { key: 'silo',               label: 'Silo',               icon: <Database size={26} />,       color: 'bg-teal-50',    iconColor: 'text-teal-600',    glow: 'rgba(20,184,166,0.35)'  },
  { key: 'silo-extraction',    label: 'Silo Extraction',    icon: <ArrowDownToLine size={26} />,color: 'bg-sky-50',     iconColor: 'text-sky-600',     glow: 'rgba(14,165,233,0.35)'  },
  { key: 'discard',            label: 'Discard',            icon: <Trash2 size={26} />,         color: 'bg-red-50',     iconColor: 'text-red-500',     glow: 'rgba(239,68,68,0.30)'   },
  { key: 'extra-fab',          label: 'Extra Fab',          icon: <Hammer size={26} />,         color: 'bg-yellow-50',  iconColor: 'text-yellow-600',  glow: 'rgba(234,179,8,0.35)'   },
  { key: 'labour',             label: 'Labour',             icon: <Users size={26} />,          color: 'bg-indigo-50',  iconColor: 'text-indigo-600',  glow: 'rgba(99,102,241,0.35)'  },
  { key: 'cement-bags',        label: 'Cement Bags',        icon: <PackageOpen size={26} />,    color: 'bg-stone-50',   iconColor: 'text-stone-600',   glow: 'rgba(120,113,108,0.30)' },
  { key: 'store-material',     label: 'Store Material',     icon: <Archive size={26} />,        color: 'bg-lime-50',    iconColor: 'text-lime-600',    glow: 'rgba(101,163,13,0.35)'  },
  { key: 'diesel-maintenance', label: 'Diesel Maintenance', icon: <Fuel size={26} />,           color: 'bg-rose-50',    iconColor: 'text-rose-600',    glow: 'rgba(244,63,94,0.30)'   },
  { key: 'extra-vehicles',     label: 'Extra Vehicles',     icon: <Car size={26} />,            color: 'bg-fuchsia-50', iconColor: 'text-fuchsia-600', glow: 'rgba(192,38,211,0.30)'  },
  { key: 'cutting',            label: 'Cutting',            icon: <Scissors size={26} />,       color: 'bg-pink-50',    iconColor: 'text-pink-600',    glow: 'rgba(236,72,153,0.30)'  },
  { key: 'conversion',         label: 'Conversion',         icon: <RefreshCw size={26} />,      color: 'bg-purple-50',  iconColor: 'text-purple-600',  glow: 'rgba(168,85,247,0.35)'  },
  { key: 'loading',            label: 'Loading',            icon: <Container size={26} />,      color: 'bg-teal-50',    iconColor: 'text-teal-600',    glow: 'rgba(20,184,166,0.35)'  },
  { key: 'transport-report',   label: 'Transport Report',   icon: <FileBarChart2 size={26} />,  color: 'bg-orange-50',  iconColor: 'text-orange-600',  glow: 'rgba(234,88,12,0.30)'   },
  { key: 'loading-invoice',    label: 'Loading + Invoice',  icon: <ReceiptText size={26} />,    color: 'bg-green-50',   iconColor: 'text-green-600',   glow: 'rgba(22,163,74,0.30)'   },
]

// ─── Business Card ────────────────────────────────────────────────────────────

function BusinessCard({ card }: { card: BusinessCard }) {
  const navigate = useNavigate()
  const [hovered, setHovered] = useState(false)

  return (
    <button
      onClick={() => navigate(`/business/${card.key}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        boxShadow: hovered
          ? `0 8px 30px ${card.glow}, 0 2px 8px rgba(0,0,0,0.06)`
          : '0 2px 8px rgba(0,0,0,0.07)',
        transform: hovered ? 'translateY(-3px) scale(1.02)' : 'translateY(0) scale(1)',
        transition: 'box-shadow 0.22s ease, transform 0.18s ease',
      }}
      className="group bg-white rounded-2xl p-5 flex flex-col items-center gap-3 text-center cursor-pointer active:scale-[0.97]"
    >
      <div
        className={`w-14 h-14 flex items-center justify-center ${card.iconColor}`}
        style={{
          transform: hovered ? 'scale(1.12)' : 'scale(1)',
          transition: 'transform 0.18s ease',
        }}
      >
        {card.icon}
      </div>
      <span className="text-sm font-semibold text-gray-800 leading-tight">
        {card.label}
      </span>
    </button>
  )
}

export default function BusinessPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* ── Hero header ─────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-violet-600 to-blue-600 shadow-[0_8px_32px_rgba(109,40,217,0.25)]">
        {/* dot pattern */}
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="relative flex items-center justify-between px-8 py-6">
          {/* Left: icon + title */}
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center">
              <Building2 size={22} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-violet-200 uppercase tracking-widest mb-0.5">Operations</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Business</h1>
              <p className="text-sm text-violet-200 mt-0.5">Select a module to record or view daily data</p>
            </div>
          </div>

          {/* Right: settings button */}
          <button
            onClick={() => navigate('/business/settings')}
            className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/25 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition backdrop-blur-sm"
          >
            <Settings size={15} />
            Settings
          </button>
        </div>

        {/* stat strip */}
        <div className="relative border-t border-white/15 grid grid-cols-3 divide-x divide-white/15">
          {[
            { label: 'Modules',      value: CARDS.length,  sub: 'operational areas' },
            { label: 'Production',   value: '2',           sub: 'PCCP · PSC'         },
            { label: 'Support',      value: String(CARDS.length - 2), sub: 'logistics & admin' },
          ].map(s => (
            <div key={s.label} className="px-8 py-3.5">
              <p className="text-xl font-extrabold text-white tabular-nums leading-none">{s.value}</p>
              <p className="text-xs text-violet-200 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
        {CARDS.map(card => (
          <BusinessCard key={card.key} card={card} />
        ))}
      </div>

    </div>
  )
}
