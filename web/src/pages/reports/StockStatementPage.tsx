import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Package, Download, Search, X, ChevronDown, Calendar, ArrowLeft } from 'lucide-react'
import { subDays } from 'date-fns'
import { reportApi } from '@/services/api'

// ── types ──────────────────────────────────────────────────────────────────────

interface StockRow {
  productId: number
  productName: string
  uom: string
  openingQty: string
  openingAmount: string
  inwardQty: string
  inwardAmount: string
  outwardQty: string
  outwardAmount: string
  closingQty: string
  closingAmount: string
}

interface LedgerRow {
  date: string
  code: string
  txType: string
  inwardQty: string
  outwardQty: string
  closingBalance: string
}

// ── helpers ────────────────────────────────────────────────────────────────────

function fmtDate(d: Date) { return d.toISOString().split('T')[0] }
function dmy(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}
function fmtQty(n: string | number) {
  const v = Number(n ?? 0)
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function fmtAmt(n: string | number) {
  const v = Number(n ?? 0)
  if (!v) return '0.00'
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function startOf(unit: 'month' | 'year') {
  const r = new Date()
  if (unit === 'month') r.setDate(1)
  else r.setMonth(0, 1)
  r.setHours(0, 0, 0, 0)
  return r
}
function startOfLastMonth() {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); d.setHours(0,0,0,0); return d
}
function endOfLastMonth() {
  const d = new Date(); d.setDate(0); d.setHours(0,0,0,0); return d
}

const PRESETS = [
  { label: 'Today',        from: () => fmtDate(new Date()),              to: () => fmtDate(new Date()) },
  { label: 'Yesterday',    from: () => fmtDate(subDays(new Date(), 1)),  to: () => fmtDate(subDays(new Date(), 1)) },
  { label: 'Last 7 Days',  from: () => fmtDate(subDays(new Date(), 6)),  to: () => fmtDate(new Date()) },
  { label: 'Last 30 Days', from: () => fmtDate(subDays(new Date(), 29)), to: () => fmtDate(new Date()) },
  { label: 'This Month',   from: () => fmtDate(startOf('month')),        to: () => fmtDate(new Date()) },
  { label: 'Last Month',   from: () => fmtDate(startOfLastMonth()),      to: () => fmtDate(endOfLastMonth()) },
  { label: 'This Year',    from: () => fmtDate(startOf('year')),         to: () => fmtDate(new Date()) },
]

// ── Date filter ────────────────────────────────────────────────────────────────

function DateFilter({ from, to, onChange }: { from: string; to: string; onChange: (f: string, t: string) => void }) {
  const [open, setOpen] = useState(false)
  const [tmpFrom, setTmpFrom] = useState(from)
  const [tmpTo,   setTmpTo]   = useState(to)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const active = PRESETS.find(p => from === p.from() && to === p.to())
  const label = active ? active.label : (from && to) ? `${dmy(from)} – ${dmy(to)}` : 'Select Range'

  return (
    <div className="relative" ref={ref}>
      <button onClick={() => { setTmpFrom(from); setTmpTo(to); setOpen(v => !v) }}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold border border-gray-200 rounded-lg bg-white text-gray-700 hover:bg-gray-50 shadow-sm transition">
        <Calendar size={14} className="text-gray-400" />
        {label}
        <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-3 w-56">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">Quick Range</p>
          <div className="space-y-0.5 mb-3">
            {PRESETS.map(p => (
              <button key={p.label} onClick={() => { onChange(p.from(), p.to()); setOpen(false) }}
                className={`w-full text-left px-3 py-1.5 text-sm rounded-lg transition-colors font-medium ${
                  from === p.from() && to === p.to() ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-50'
                }`}>
                {p.label}
              </button>
            ))}
          </div>
          <div className="border-t border-gray-100 pt-3 space-y-2">
            <input type="date" value={tmpFrom} onChange={e => setTmpFrom(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
            <button onClick={() => { if (tmpFrom && tmpTo) { onChange(tmpFrom, tmpTo); setOpen(false) } }} disabled={!tmpFrom || !tmpTo}
              className="w-full py-1.5 text-xs font-bold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-40">
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Ledger drill-down page ─────────────────────────────────────────────────────

function LedgerView({ product, from, to, onBack }: { product: StockRow; from: string; to: string; onBack: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['stock-ledger', product.productId, from, to],
    queryFn: () => reportApi.stockLedger(product.productId, from, to).then(r => r.data.data as { opening: string; rows: LedgerRow[] }),
  })

  const opening = data?.opening ?? '0'
  const rows: LedgerRow[] = data?.rows ?? []

  function exportCSV() {
    const header = ['#', 'Date', 'Code', 'Type', 'Inward', 'Outward', 'Closing Balance']
    const dataRows = rows.map((r, i) => [i + 1, dmy(r.date), r.code, r.txType, fmtQty(r.inwardQty), fmtQty(r.outwardQty), fmtQty(r.closingBalance)])
    const csv = [header, ...dataRows].map(row => row.map(c => `"${c}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = `${product.productName}-ledger-${from}-to-${to}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-6 space-y-4">
      {/* Back + title */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition font-medium">
            <ArrowLeft size={16} /> Back
          </button>
          <div className="w-px h-5 bg-gray-200" />
          <div>
            <h2 className="text-lg font-bold text-gray-900">Stock Details — {product.productName}</h2>
            <p className="text-xs text-gray-400">{dmy(from)} – {dmy(to)}</p>
          </div>
        </div>
        <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-1.5 text-xs font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 transition">
          <Download size={13} /> Export
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left w-8">#</th>
              <th className="px-4 py-3 text-left">Date</th>
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-right">Inward ({product.uom})</th>
              <th className="px-4 py-3 text-right">Outward ({product.uom})</th>
              <th className="px-4 py-3 text-right">Closing Balance ({product.uom})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {/* Opening row */}
            <tr className="bg-blue-50/40">
              <td className="px-4 py-3 text-gray-400" />
              <td className="px-4 py-3 text-gray-500 font-medium">Opening Balance</td>
              <td className="px-4 py-3" />
              <td className="px-4 py-3" />
              <td className="px-4 py-3" />
              <td className="px-4 py-3 text-right font-bold text-gray-800 tabular-nums">{fmtQty(opening)}</td>
            </tr>

            {isLoading ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={6} className="px-4 py-10 text-center text-gray-400">No transactions in this period</td></tr>
            ) : rows.map((r, i) => (
              <tr key={i} className="hover:bg-gray-50/60">
                <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                <td className="px-4 py-3 text-gray-600">{dmy(r.date)}</td>
                <td className="px-4 py-3 font-mono text-xs text-blue-700">{r.code}</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">
                  {Number(r.inwardQty) > 0 ? fmtQty(r.inwardQty) : ''}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-red-500 font-medium">
                  {Number(r.outwardQty) > 0 ? fmtQty(r.outwardQty) : ''}
                </td>
                <td className="px-4 py-3 text-right tabular-nums font-semibold text-gray-800">{fmtQty(r.closingBalance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function StockStatementPage() {
  const [from, setFrom] = useState(fmtDate(startOf('month')))
  const [to,   setTo]   = useState(fmtDate(new Date()))
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<StockRow | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['stock-statement-v2', from, to],
    queryFn: () => reportApi.stockStatement(from, to).then(r => r.data.data as StockRow[]),
    enabled: !!from && !!to,
  })

  const rows: StockRow[] = data ?? []
  const filtered = useMemo(() =>
    search.trim()
      ? rows.filter(r => r.productName.toLowerCase().includes(search.toLowerCase()))
      : rows
  , [rows, search])

  function exportCSV() {
    const header = ['#', 'Name of Stock', 'Opening Qty', 'Opening Amt', 'Purchase/Inward Qty', 'Purchase/Inward Amt', 'Outward Qty', 'Outward Amt', 'Closing Qty', 'Closing Amt']
    const dataRows = filtered.map((r, i) => [
      i + 1, r.productName,
      fmtQty(r.openingQty), fmtAmt(r.openingAmount),
      fmtQty(r.inwardQty), fmtAmt(r.inwardAmount),
      fmtQty(r.outwardQty), fmtAmt(r.outwardAmount),
      fmtQty(r.closingQty), fmtAmt(r.closingAmount),
    ])
    const csv = [header, ...dataRows].map(row => row.map(c => `"${c}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = `stock-report-${from}-to-${to}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (selected) {
    return <LedgerView product={selected} from={from} to={to} onBack={() => setSelected(null)} />
  }

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center shadow">
            <Package size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Stock Report</h1>
            <p className="text-xs text-gray-400">Opening · Inward · Outward · Closing balance per material</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <DateFilter from={from} to={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
          <button onClick={exportCSV} className="flex items-center gap-2 px-3 py-2 text-sm font-semibold border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 shadow-sm transition">
            <Download size={14} /> Export
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input type="text" value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search material…"
          className="w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-300" />
        {search && (
          <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
            <X size={13} />
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs text-gray-500 uppercase">
            <tr>
              <th className="px-4 py-3 text-left w-8">#</th>
              <th className="px-4 py-3 text-left">Name of Stock</th>
              <th className="px-4 py-3 text-right" colSpan={2}>Opening Balance</th>
              <th className="px-4 py-3 text-right" colSpan={2}>Purchase / Inward</th>
              <th className="px-4 py-3 text-right" colSpan={2}>Sales / Outward</th>
              <th className="px-4 py-3 text-right" colSpan={2}>Closing Balance</th>
            </tr>
            <tr className="bg-gray-50 border-t border-gray-100">
              <th className="px-4 py-2" />
              <th className="px-4 py-2" />
              <th className="px-4 py-2 text-right text-gray-400 font-medium">Qty</th>
              <th className="px-4 py-2 text-right text-gray-400 font-medium">Amount</th>
              <th className="px-4 py-2 text-right text-gray-400 font-medium">Qty</th>
              <th className="px-4 py-2 text-right text-gray-400 font-medium">Amount</th>
              <th className="px-4 py-2 text-right text-gray-400 font-medium">Qty</th>
              <th className="px-4 py-2 text-right text-gray-400 font-medium">Amount</th>
              <th className="px-4 py-2 text-right text-gray-400 font-medium">Qty</th>
              <th className="px-4 py-2 text-right text-gray-400 font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}><td colSpan={10} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td></tr>
              ))
            ) : filtered.length === 0 ? (
              <tr><td colSpan={10} className="px-4 py-12 text-center text-gray-400">No data for selected range</td></tr>
            ) : filtered.map((r, i) => (
              <tr key={r.productId} className="hover:bg-blue-50/30 transition-colors">
                <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                <td className="px-4 py-3">
                  <button onClick={() => setSelected(r)}
                    className="text-blue-600 hover:text-blue-800 font-medium hover:underline text-left">
                    {r.productName}
                  </button>
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-700">{fmtQty(r.openingQty)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-500">{fmtAmt(r.openingAmount)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-emerald-600 font-medium">{fmtQty(r.inwardQty)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-500">{fmtAmt(r.inwardAmount)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-red-500 font-medium">{fmtQty(r.outwardQty)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-500">{fmtAmt(r.outwardAmount)}</td>
                <td className="px-4 py-3 text-right tabular-nums font-bold text-gray-900">{fmtQty(r.closingQty)}</td>
                <td className="px-4 py-3 text-right tabular-nums text-gray-600">{fmtAmt(r.closingAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-gray-400 text-center">Click any material name to view transaction-wise details</p>
    </div>
  )
}
