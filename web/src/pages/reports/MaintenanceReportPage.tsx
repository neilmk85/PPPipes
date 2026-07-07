import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format, startOfMonth } from 'date-fns'
import { Download, Search, X, Wrench, ArrowUpDown } from 'lucide-react'
import { maintenanceApi, MaintenanceEntry } from '@/services/businessApi'
import { DateRangePicker } from '@/components/DateRangePicker'

function dmy(iso: string) { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }

function inr(v: string | number) {
  const n = Number(v)
  return isNaN(n) ? '—' : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function exportCsv(rows: MaintenanceEntry[], from: string, to: string) {
  const header = 'Date,Process,Vendor,Amount,Notes\n'
  const body = rows.map(r =>
    `${r.date},"${r.process}","${r.vendor}",${r.amount},"${(r.notes ?? '').replace(/"/g, '""')}"`
  ).join('\n')
  const url = URL.createObjectURL(new Blob(['﻿' + header + body], { type: 'text/csv' }))
  const a = document.createElement('a'); a.href = url; a.download = `Maintenance_Report_${from}_${to}.csv`; a.click()
  URL.revokeObjectURL(url)
}

export default function MaintenanceReportPage() {
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to,   setTo]   = useState(format(new Date(), 'yyyy-MM-dd'))
  const [search, setSearch]   = useState('')
  const [sortKey, setSortKey] = useState('date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc')

  const { data: rows = [], isFetching } = useQuery({
    queryKey: ['biz-maintenance-report', from, to],
    queryFn:  () => maintenanceApi.list(from, to),
    staleTime: 0,
  })

  const filtered = useMemo(() => {
    if (!search.trim()) return rows
    const q = search.toLowerCase()
    return rows.filter(r =>
      r.process.toLowerCase().includes(q) ||
      r.vendor.toLowerCase().includes(q) ||
      (r.notes ?? '').toLowerCase().includes(q)
    )
  }, [rows, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const av = (a as any)[sortKey] ?? ''
      const bv = (b as any)[sortKey] ?? ''
      const na = Number(av), nb = Number(bv)
      const cmp = isNaN(na) || isNaN(nb) ? String(av).localeCompare(String(bv)) : na - nb
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  function toggleSort(col: string) {
    if (col === sortKey) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(col); setSortDir('asc') }
  }

  function Th({ col, label, right }: { col: string; label: string; right?: boolean }) {
    const active = col === sortKey
    return (
      <th onClick={() => toggleSort(col)} className={`px-3 py-2.5 cursor-pointer select-none whitespace-nowrap ${right ? 'text-right' : 'text-left'} hover:bg-amber-50 transition-colors`}>
        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide ${active ? 'text-amber-700' : 'text-gray-500'}`}>
          {label}<ArrowUpDown size={9} className={active ? 'text-amber-500' : 'text-gray-300'} />
        </span>
      </th>
    )
  }

  // ── Summary totals ──────────────────────────────────────────────────────────
  const totalSpend = rows.reduce((s, r) => s + Number(r.amount || 0), 0)
  const vendors    = [...new Set(rows.map(r => r.vendor).filter(Boolean))]
  const processes  = [...new Set(rows.map(r => r.process).filter(Boolean))]

  // Vendor breakdown
  const byVendor = useMemo(() => {
    const map: Record<string, number> = {}
    rows.forEach(r => { map[r.vendor] = (map[r.vendor] || 0) + Number(r.amount || 0) })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [rows])

  // Process breakdown
  const byProcess = useMemo(() => {
    const map: Record<string, number> = {}
    rows.forEach(r => { map[r.process] = (map[r.process] || 0) + Number(r.amount || 0) })
    return Object.entries(map).sort((a, b) => b[1] - a[1])
  }, [rows])

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-amber-600 via-orange-500 to-red-500 rounded-2xl shadow-[0_8px_40px_rgba(217,119,6,0.30)] overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-start justify-between gap-4 mb-5">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center shrink-0">
                <Wrench size={24} className="text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Maintenance Report</h1>
                <p className="text-sm text-white/60 mt-0.5">Equipment & process maintenance costs by vendor</p>
              </div>
            </div>
            <button
              onClick={() => exportCsv(rows, from, to)}
              disabled={rows.length === 0}
              className="flex items-center gap-1.5 bg-white/15 hover:bg-white/25 border border-white/20 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-50 transition-all"
            >
              <Download size={11} /> Export CSV
            </button>
          </div>

          <DateRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        </div>

        {/* Stats strip */}
        <div className={`grid grid-cols-4 divide-x divide-white/10 border-t border-white/10 mt-2 ${isFetching ? 'animate-pulse' : ''}`}>
          {[
            { label: 'Total Records', value: rows.length },
            { label: 'Total Spend',   value: inr(totalSpend) },
            { label: 'Vendors',       value: vendors.length },
            { label: 'Processes',     value: processes.length },
          ].map((c, i) => (
            <div key={i} className="px-4 py-3 text-center">
              <p className="text-sm font-bold text-white">{isFetching ? '…' : c.value}</p>
              <p className="text-[10px] text-white/50 mt-0.5">{c.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Breakdown cards ─────────────────────────────────────────────────── */}
      {!isFetching && rows.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {/* By Vendor */}
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">By Vendor</h3>
            <div className="space-y-2">
              {byVendor.map(([vendor, amt]) => {
                const pct = totalSpend > 0 ? (amt / totalSpend) * 100 : 0
                return (
                  <div key={vendor}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-gray-700 truncate max-w-[180px]">{vendor || '—'}</span>
                      <span className="text-xs font-semibold text-gray-900 tabular-nums">{inr(amt)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-amber-400 to-orange-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          {/* By Process */}
          <div className="bg-white rounded-2xl border shadow-sm p-4">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">By Process</h3>
            <div className="space-y-2">
              {byProcess.map(([proc, amt]) => {
                const pct = totalSpend > 0 ? (amt / totalSpend) * 100 : 0
                return (
                  <div key={proc}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs text-gray-700 truncate max-w-[180px]">{proc || '—'}</span>
                      <span className="text-xs font-semibold text-gray-900 tabular-nums">{inr(amt)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-gradient-to-r from-red-400 to-rose-500" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Filter + Table ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border shadow-sm overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b">
          <div className="relative flex-1 max-w-xs">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search process, vendor…" value={search} onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-7 py-1.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-300" />
            {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400"><X size={12} /></button>}
          </div>
          <span className="ml-auto text-xs text-amber-700 font-medium bg-amber-50 px-2.5 py-1 rounded-lg">
            {sorted.length} record{sorted.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <Th col="date"    label="Date" />
                <Th col="process" label="Process" />
                <Th col="vendor"  label="Vendor" />
                <Th col="amount"  label="Amount" right />
                <th className="px-3 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wide text-gray-500">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isFetching ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 5 }).map((_, j) => (
                      <td key={j} className="px-3 py-3"><div className="h-4 bg-gray-100 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : sorted.length === 0 ? (
                <tr><td colSpan={5} className="px-4 py-16 text-center text-gray-400 text-sm">No maintenance data for this period</td></tr>
              ) : (
                <>
                  {sorted.map(r => (
                    <tr key={r.id} className="hover:bg-amber-50/30 transition-colors">
                      <td className="px-3 py-2.5 text-gray-600 font-mono text-xs">{dmy(r.date)}</td>
                      <td className="px-3 py-2.5 font-medium text-gray-800">{r.process}</td>
                      <td className="px-3 py-2.5 text-gray-700">{r.vendor}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900 tabular-nums">{inr(r.amount)}</td>
                      <td className="px-3 py-2.5 text-gray-500 text-xs max-w-[200px] truncate">{r.notes || '—'}</td>
                    </tr>
                  ))}
                  <tr className="bg-amber-50/60 border-t-2 border-amber-100 font-semibold text-sm">
                    <td className="px-3 py-3 text-amber-700" colSpan={3}>Grand Total</td>
                    <td className="px-3 py-3 text-right tabular-nums text-gray-900">
                      {inr(sorted.reduce((s, r) => s + Number(r.amount || 0), 0))}
                    </td>
                    <td />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
