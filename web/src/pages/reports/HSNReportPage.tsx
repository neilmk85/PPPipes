import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import { Download, Search, X, Hash, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react'
import toast from 'react-hot-toast'
import { gstApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { DateRangePicker } from '@/components/DateRangePicker'

type Tab = 'sale' | 'purchase'

function dmy(iso: string) {
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

function n(v: any, dec = 2) {
  const x = Number(v)
  return isNaN(x) ? '—' : x.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec })
}

type SortKey = string
type SortDir = 'asc' | 'desc'

function useSortable(data: any[], defaultKey: string) {
  const [key, setKey] = useState<SortKey>(defaultKey)
  const [dir, setDir] = useState<SortDir>('asc')

  const sorted = useMemo(() => {
    return [...data].sort((a, b) => {
      const av = a[key] ?? 0
      const bv = b[key] ?? 0
      const na = Number(av), nb = Number(bv)
      const cmp = isNaN(na) || isNaN(nb) ? String(av).localeCompare(String(bv)) : na - nb
      return dir === 'asc' ? cmp : -cmp
    })
  }, [data, key, dir])

  function toggle(k: SortKey) {
    if (k === key) setDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setKey(k); setDir('asc') }
  }

  function Th({ col, label, right }: { col: string; label: string; right?: boolean }) {
    const active = col === key
    return (
      <th
        className={`px-3 py-2.5 cursor-pointer select-none whitespace-nowrap ${right ? 'text-right' : 'text-left'} hover:bg-gray-100 transition-colors`}
        onClick={() => toggle(col)}
      >
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${active ? 'text-indigo-600' : 'text-gray-500'}`}>
          {label}
          <ArrowUpDown size={9} className={active ? 'text-indigo-500' : 'text-gray-300'} />
        </span>
      </th>
    )
  }

  return { sorted, Th, sortKey: key, sortDir: dir }
}

export default function HSNReportPage() {
  const { outletId } = useAuthStore()
  const [tab, setTab]       = useState<Tab>('sale')
  const [from, setFrom]     = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to,   setTo]       = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))
  const [search, setSearch] = useState('')
  const [exporting, setExporting] = useState(false)

  const saleQuery = useQuery({
    queryKey: ['hsn-sale', outletId, from, to],
    queryFn:  () => gstApi.getHsnSummary(outletId!, from, to),
    enabled:  !!outletId && !!from && !!to,
    staleTime: 0,
  })

  const purchaseQuery = useQuery({
    queryKey: ['hsn-purchase', outletId, from, to],
    queryFn:  () => gstApi.getHsnPurchaseSummary(outletId!, from, to),
    enabled:  !!outletId && !!from && !!to,
    staleTime: 0,
  })

  const saleRows:     any[] = (saleQuery.data     as any)?.data?.data ?? []
  const purchaseRows: any[] = (purchaseQuery.data  as any)?.data?.data ?? []

  const rows = tab === 'sale' ? saleRows : purchaseRows

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter((r: any) =>
      String(r.hsnCode ?? '').toLowerCase().includes(q) ||
      String(r.description ?? '').toLowerCase().includes(q)
    )
  }, [rows, search])

  const { sorted, Th } = useSortable(filtered, 'hsnCode')

  async function exportCsv() {
    if (!outletId) return
    setExporting(true)
    try {
      const promise = tab === 'sale'
        ? gstApi.exportHsnCsv(outletId, from, to)
        : gstApi.exportHsnPurchaseCsv(outletId, from, to)
      const res = await promise
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a = document.createElement('a')
      a.href = url
      a.download = `HSN_${tab === 'sale' ? 'Sale' : 'Purchase'}_${from}_${to}.csv`
      a.click()
      URL.revokeObjectURL(url)
      toast.success('Downloaded')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const loading = tab === 'sale' ? saleQuery.isFetching : purchaseQuery.isFetching

  // ── Summary totals ───────────────────────────────────────────────────────────
  const totTaxable = rows.reduce((s: number, r: any) => s + Number(r.taxableValue ?? 0), 0)
  const totCgst    = rows.reduce((s: number, r: any) => s + Number(r.cgst ?? 0), 0)
  const totSgst    = rows.reduce((s: number, r: any) => s + Number(r.sgst ?? 0), 0)
  const totTax     = rows.reduce((s: number, r: any) => s + Number(r.totalTax ?? 0), 0)
  const totValue   = rows.reduce((s: number, r: any) => s + Number(r.totalValue ?? 0), 0)
  const totQty     = tab === 'sale'
    ? rows.reduce((s: number, r: any) => s + Number(r.totalQuantity ?? 0), 0)
    : rows.reduce((s: number, r: any) => s + Number(r.totalOrderedQty ?? 0), 0)

  const cards = tab === 'sale' ? [
    { label: 'HSN Codes',     value: rows.length,        sub: 'distinct codes',    color: 'bg-indigo-500' },
    { label: 'Total Qty',     value: n(totQty, 2),       sub: 'units sold',        color: 'bg-blue-500' },
    { label: 'Total Value',   value: `₹${n(totValue)}`,  sub: 'incl. tax',         color: 'bg-violet-500' },
    { label: 'Taxable Value', value: `₹${n(totTaxable)}`,sub: 'excl. tax',         color: 'bg-slate-600' },
    { label: 'CGST',          value: `₹${n(totCgst)}`,   sub: 'central tax',       color: 'bg-sky-500' },
    { label: 'SGST',          value: `₹${n(totSgst)}`,   sub: 'state tax',         color: 'bg-cyan-600' },
    { label: 'Total Tax',     value: `₹${n(totTax)}`,    sub: 'CGST + SGST + IGST',color: 'bg-indigo-700' },
  ] : [
    { label: 'HSN Codes',     value: rows.length,        sub: 'distinct codes',    color: 'bg-emerald-600' },
    { label: 'Ordered Qty',   value: n(totQty, 2),       sub: 'units ordered',     color: 'bg-teal-500' },
    { label: 'Total Value',   value: `₹${n(totValue)}`,  sub: 'incl. tax',         color: 'bg-green-600' },
    { label: 'Taxable Value', value: `₹${n(totTaxable)}`,sub: 'excl. tax',         color: 'bg-slate-600' },
    { label: 'CGST',          value: `₹${n(totCgst)}`,   sub: 'central tax',       color: 'bg-sky-500' },
    { label: 'SGST',          value: `₹${n(totSgst)}`,   sub: 'state tax',         color: 'bg-cyan-600' },
    { label: 'Total Tax',     value: `₹${n(totTax)}`,    sub: 'input tax',         color: 'bg-emerald-800' },
  ]

  const gradFrom = tab === 'sale' ? 'from-indigo-700 via-indigo-600 to-blue-600' : 'from-emerald-700 via-emerald-600 to-teal-600'
  const tabRing  = tab === 'sale' ? 'focus:ring-indigo-400' : 'focus:ring-emerald-400'
  const badgeCol = tab === 'sale' ? 'text-indigo-600 bg-indigo-50' : 'text-emerald-600 bg-emerald-50'

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* ── Hero header ─────────────────────────────────────────────────────── */}
      <div className={`bg-gradient-to-br ${gradFrom} rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] overflow-hidden`}>
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-4">
              <div className={`w-12 h-12 rounded-2xl ${tab === 'sale' ? 'bg-blue-400/20 border-blue-400/30' : 'bg-teal-400/20 border-teal-400/30'} border flex items-center justify-center shrink-0`}>
                {tab === 'sale' ? <TrendingUp size={24} className="text-blue-200" /> : <TrendingDown size={24} className="text-teal-200" />}
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">HSN Reports</h1>
                <p className="text-sm text-white/60 mt-0.5">
                  {tab === 'sale' ? 'Sale — tax summary grouped by HSN/SAC code' : 'Purchase — input tax credit grouped by HSN/SAC code'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={exportCsv}
                disabled={exporting || rows.length === 0}
                className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-amber-900 px-3.5 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-60 transition-all shadow-sm"
              >
                <Download size={11} className={exporting ? 'animate-bounce' : ''} />
                {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
          </div>

          {/* Tabs + date presets */}
          <div className="flex items-center justify-between gap-3">
            <div className="bg-white/10 rounded-xl p-1 backdrop-blur-sm flex items-center gap-1">
              {(['sale', 'purchase'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setSearch('') }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    tab === t ? 'bg-white text-gray-800 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {t === 'sale' ? 'HSN Sale' : 'HSN Purchase'}
                </button>
              ))}
            </div>

            <DateRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
          </div>
        </div>

        {/* Stats strip */}
        <div className={`grid grid-cols-7 divide-x divide-white/10 border-t border-white/10 mt-2 ${loading ? 'animate-pulse' : ''}`}>
          {cards.map((c, i) => (
            <div key={i} className="px-3 py-3 text-center">
              <p className="text-sm font-bold text-white truncate">{loading ? '…' : c.value}</p>
              <p className="text-[10px] text-white/50 mt-0.5 truncate">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search HSN code or description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className={`w-full pl-8 pr-8 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 ${tabRing} text-gray-800`}
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={12} />
            </button>
          )}
        </div>
        {search && (
          <span className={`text-xs font-medium px-2 py-1 rounded-lg ${badgeCol}`}>
            {sorted.length} result{sorted.length !== 1 ? 's' : ''}
          </span>
        )}
        <span className="ml-auto text-xs text-gray-400">
          Period: <span className="font-medium text-gray-600">{dmy(from)} – {dmy(to)}</span>
        </span>
      </div>

      {/* ── Table ───────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className={`px-4 py-3 border-b flex items-center gap-2 ${tab === 'sale' ? 'bg-indigo-50/60' : 'bg-emerald-50/60'}`}>
          <Hash size={14} className={tab === 'sale' ? 'text-indigo-400' : 'text-emerald-400'} />
          <span className={`text-sm font-semibold ${tab === 'sale' ? 'text-indigo-700' : 'text-emerald-700'}`}>
            {tab === 'sale' ? 'HSN / SAC Sale Summary' : 'HSN / SAC Purchase Summary'}
          </span>
          <span className={`ml-auto text-xs px-2 py-0.5 rounded-full font-medium ${badgeCol}`}>
            {sorted.length} HSN code{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>

        <div className="overflow-x-auto">
          {tab === 'sale' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <Th col="hsnCode"      label="HSN / SAC Code" />
                  <Th col="description"  label="Description" />
                  <Th col="uom"          label="UOM" />
                  <Th col="totalQuantity" label="Total Qty"      right />
                  <Th col="totalValue"   label="Total Value"     right />
                  <Th col="taxableValue" label="Taxable Value"   right />
                  <Th col="cgst"         label="CGST"            right />
                  <Th col="sgst"         label="SGST"            right />
                  <Th col="igst"         label="IGST"            right />
                  <Th col="totalTax"     label="Total Tax"       right />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center text-gray-400 text-sm">
                      No HSN sale data for this period
                    </td>
                  </tr>
                ) : (
                  <>
                    {sorted.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-indigo-50/30 transition-colors">
                        <td className="px-3 py-2.5 font-mono font-semibold text-gray-800">{row.hsnCode}</td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[180px] truncate" title={row.description}>{row.description}</td>
                        <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{row.uom}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{n(row.totalQuantity)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{n(row.totalValue)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium">{n(row.taxableValue)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-blue-700">{n(row.cgst)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-green-700">{n(row.sgst)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-purple-700">{n(row.igst)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900">{n(row.totalTax)}</td>
                      </tr>
                    ))}
                    {/* Grand total */}
                    <tr className="bg-indigo-50/60 border-t-2 border-indigo-100 font-semibold text-sm">
                      <td className="px-3 py-3 text-indigo-700" colSpan={3}>Grand Total</td>
                      <td className="px-3 py-3 text-right tabular-nums">{n(sorted.reduce((s: number, r: any) => s + Number(r.totalQuantity ?? 0), 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{n(sorted.reduce((s: number, r: any) => s + Number(r.totalValue ?? 0), 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{n(sorted.reduce((s: number, r: any) => s + Number(r.taxableValue ?? 0), 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-blue-700">{n(sorted.reduce((s: number, r: any) => s + Number(r.cgst ?? 0), 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-green-700">{n(sorted.reduce((s: number, r: any) => s + Number(r.sgst ?? 0), 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-purple-700">{n(sorted.reduce((s: number, r: any) => s + Number(r.igst ?? 0), 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-900">{n(sorted.reduce((s: number, r: any) => s + Number(r.totalTax ?? 0), 0))}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <Th col="hsnCode"          label="HSN / SAC Code" />
                  <Th col="description"      label="Description" />
                  <Th col="uom"              label="UOM" />
                  <Th col="totalOrderedQty"  label="Ordered Qty"    right />
                  <Th col="totalReceivedQty" label="Received Qty"   right />
                  <Th col="totalValue"       label="Total Value"    right />
                  <Th col="taxableValue"     label="Taxable Value"  right />
                  <Th col="cgst"             label="CGST"           right />
                  <Th col="sgst"             label="SGST"           right />
                  <Th col="totalTax"         label="Total Tax"      right />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 10 }).map((_, j) => (
                        <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : sorted.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="px-4 py-16 text-center text-gray-400 text-sm">
                      No HSN purchase data for this period
                    </td>
                  </tr>
                ) : (
                  <>
                    {sorted.map((row: any, i: number) => (
                      <tr key={i} className="hover:bg-emerald-50/30 transition-colors">
                        <td className="px-3 py-2.5 font-mono font-semibold text-gray-800">{row.hsnCode}</td>
                        <td className="px-3 py-2.5 text-gray-600 max-w-[180px] truncate" title={row.description}>{row.description}</td>
                        <td className="px-3 py-2.5 text-gray-500 font-mono text-xs">{row.uom}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{n(row.totalOrderedQty)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums">{n(row.totalReceivedQty)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-gray-700">{n(row.totalValue)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-medium">{n(row.taxableValue)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-blue-700">{n(row.cgst)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-green-700">{n(row.sgst)}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-900">{n(row.totalTax)}</td>
                      </tr>
                    ))}
                    {/* Grand total */}
                    <tr className="bg-emerald-50/60 border-t-2 border-emerald-100 font-semibold text-sm">
                      <td className="px-3 py-3 text-emerald-700" colSpan={3}>Grand Total</td>
                      <td className="px-3 py-3 text-right tabular-nums">{n(sorted.reduce((s: number, r: any) => s + Number(r.totalOrderedQty ?? 0), 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{n(sorted.reduce((s: number, r: any) => s + Number(r.totalReceivedQty ?? 0), 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{n(sorted.reduce((s: number, r: any) => s + Number(r.totalValue ?? 0), 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums">{n(sorted.reduce((s: number, r: any) => s + Number(r.taxableValue ?? 0), 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-blue-700">{n(sorted.reduce((s: number, r: any) => s + Number(r.cgst ?? 0), 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-green-700">{n(sorted.reduce((s: number, r: any) => s + Number(r.sgst ?? 0), 0))}</td>
                      <td className="px-3 py-3 text-right tabular-nums text-gray-900">{n(sorted.reduce((s: number, r: any) => s + Number(r.totalTax ?? 0), 0))}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
