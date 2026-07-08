import { useState, useEffect, useRef } from 'react'
import { Calendar, ChevronDown, X } from 'lucide-react'

function isoDate(d: Date) { return d.toISOString().split('T')[0] }

function startOf(unit: 'week' | 'month' | 'quarter' | 'year', d = new Date()) {
  const r = new Date(d)
  if (unit === 'week') { const day = r.getDay() || 7; r.setDate(r.getDate() - day + 1) }
  else if (unit === 'month') r.setDate(1)
  else if (unit === 'quarter') r.setMonth(Math.floor(r.getMonth() / 3) * 3, 1)
  else r.setMonth(0, 1)
  r.setHours(0, 0, 0, 0); return r
}

type PresetKey = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'this_quarter' | 'this_year'

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: 'today',        label: 'Today' },
  { key: 'yesterday',    label: 'Yesterday' },
  { key: 'this_week',    label: 'This Week' },
  { key: 'last_week',    label: 'Last Week' },
  { key: 'this_month',   label: 'This Month' },
  { key: 'last_month',   label: 'Last Month' },
  { key: 'this_quarter', label: 'This Quarter' },
  { key: 'this_year',    label: 'This Year' },
]

function resolvePreset(key: PresetKey): { from: string; to: string } {
  const today = new Date(); const to = isoDate(today)
  switch (key) {
    case 'today':        return { from: to, to }
    case 'yesterday':  { const y = new Date(today); y.setDate(y.getDate() - 1); const d = isoDate(y); return { from: d, to: d } }
    case 'this_week':    return { from: isoDate(startOf('week')), to }
    case 'last_week':  { const end = new Date(startOf('week')); end.setDate(end.getDate() - 1); const start = new Date(end); start.setDate(start.getDate() - 6); return { from: isoDate(start), to: isoDate(end) } }
    case 'this_month':   return { from: isoDate(startOf('month')), to }
    case 'last_month': { const end = new Date(startOf('month')); end.setDate(end.getDate() - 1); return { from: isoDate(startOf('month', end)), to: isoDate(end) } }
    case 'this_quarter': return { from: isoDate(startOf('quarter')), to }
    case 'this_year':    return { from: isoDate(startOf('year')), to }
  }
}

interface DateRangePickerProps {
  fromDate: string
  toDate: string
  onChange: (from: string, to: string) => void
}

export function DateRangePicker({ fromDate, toDate, onChange }: DateRangePickerProps) {
  const [open, setOpen]             = useState(false)
  const [preset, setPreset]         = useState<PresetKey | ''>('')
  const [customFrom, setCustomFrom] = useState(fromDate)
  const [customTo, setCustomTo]     = useState(toDate)
  const [pos, setPos]               = useState({ top: 0, right: 0 })
  const btnRef = useRef<HTMLButtonElement>(null)
  const ref    = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node) &&
          btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  function handleOpen() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 8, right: window.innerWidth - r.right })
    }
    setOpen(v => !v)
  }

  function selectPreset(key: PresetKey) {
    setPreset(key)
    const { from, to } = resolvePreset(key)
    setCustomFrom(from); setCustomTo(to)
    onChange(from, to); setOpen(false)
  }

  function applyCustom() { onChange(customFrom, customTo); setOpen(false) }

  function clear() { setPreset(''); setCustomFrom(''); setCustomTo(''); onChange('', '') }

  const hasDate = fromDate || toDate
  const activeLabel = preset
    ? PRESETS.find(p => p.key === preset)?.label
    : hasDate ? `${fromDate || '…'} → ${toDate || '…'}` : null

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={handleOpen}
        className={`inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border transition-all ${
          hasDate
            ? 'bg-white/20 border-white/40 text-white backdrop-blur-sm'
            : 'bg-white/10 border-white/20 text-white/90 hover:bg-white/20 hover:border-white/40 backdrop-blur-sm'
        }`}
      >
        <Calendar size={14} />
        <span>{activeLabel ?? 'Filter by Date'}</span>
        {hasDate
          ? <X size={13} onClick={e => { e.stopPropagation(); clear() }} className="ml-1 opacity-70 hover:opacity-100" />
          : <ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        }
      </button>

      {open && (
        <div
          ref={ref}
          style={{ position: 'fixed', top: pos.top, right: pos.right, zIndex: 9999 }}
          className="bg-white rounded-2xl shadow-xl border border-gray-100 w-72"
        >
          <div className="p-2">
            {PRESETS.map(p => (
              <button
                key={p.key}
                onClick={() => selectPreset(p.key)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                  preset === p.key ? 'bg-violet-50 text-violet-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                {p.label}
                {preset === p.key && (
                  <span className="float-right text-xs text-violet-400 tabular-nums">{fromDate} → {toDate}</span>
                )}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 mx-3" />
          <div className="p-3 space-y-2">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Custom Range</p>
            <div className="grid grid-cols-2 gap-2">
              {([['From', customFrom, setCustomFrom], ['To', customTo, setCustomTo]] as const).map(([lbl, val, set]) => (
                <div key={lbl}>
                  <label className="text-xs text-gray-500 mb-0.5 block">{lbl}</label>
                  <input
                    type="date"
                    value={val}
                    onChange={e => { set(e.target.value); setPreset('') }}
                    className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400"
                  />
                </div>
              ))}
            </div>
            <button
              onClick={applyCustom}
              disabled={!customFrom && !customTo}
              className="w-full py-1.5 text-sm font-medium bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg disabled:opacity-40 hover:from-violet-700 hover:to-blue-700"
            >
              Apply Range
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
