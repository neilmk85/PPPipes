import { useState, useEffect } from 'react'
import { format, subDays } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from 'recharts'
import {
  CreditCard, IndianRupee, Banknote, Smartphone, Loader2,
  RefreshCw, Download, Search, ChevronLeft, ChevronRight, Hash,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { reportApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import OrderDetailModal from './OrderDetailModal'
import { DateRangePicker } from '@/components/DateRangePicker'

const METHOD_META: Record<string, { label: string; icon: React.ReactNode; gradient: string; color: string }> = {
  CASH:          { label: 'Cash',          icon: <Banknote size={18} />,    gradient: 'from-emerald-500 to-teal-600',   color: '#10b981' },
  CARD:          { label: 'Card',          icon: <CreditCard size={18} />,  gradient: 'from-blue-500 to-indigo-600',    color: '#3b82f6' },
  UPI:           { label: 'UPI',           icon: <Smartphone size={18} />,  gradient: 'from-violet-500 to-purple-600',  color: '#8b5cf6' },
  NET_BANKING:   { label: 'Net Banking',   icon: <IndianRupee size={18} />, gradient: 'from-sky-500 to-cyan-600',       color: '#06b6d4' },
  CREDIT_NOTE:   { label: 'Credit Note',   icon: <Hash size={18} />,        gradient: 'from-orange-400 to-amber-500',   color: '#f59e0b' },
  LOYALTY_POINTS:{ label: 'Loyalty Pts',  icon: <Hash size={18} />,        gradient: 'from-pink-500 to-rose-500',      color: '#ec4899' },
  CREDIT_SALE:   { label: 'Credit Sale',   icon: <Hash size={18} />,        gradient: 'from-red-400 to-red-600',        color: '#ef4444' },
  ADVANCE:       { label: 'Advance',       icon: <Hash size={18} />,        gradient: 'from-amber-500 to-orange-600',   color: '#f97316' },
}

const PIE_COLORS = ['#10b981','#3b82f6','#8b5cf6','#06b6d4','#f59e0b','#ec4899','#ef4444','#f97316']

type Tab = 'summary' | 'trend' | 'transactions'
const TABS: { key: Tab; label: string }[] = [
  { key: 'summary',      label: 'Summary' },
  { key: 'trend',        label: 'Daily Trend' },
  { key: 'transactions', label: 'Transactions' },
]

const fmt  = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const fmt2 = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const PAGE_SIZE = 15

export default function PaymentReportPage() {
  const { outletId } = useAuthStore()
  const oid = outletId ?? 1

  const [tab, setTab]     = useState<Tab>('summary')
  const [from, setFrom]   = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [to, setTo]       = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading]     = useState(false)
  const [exporting, setExporting] = useState(false)

  const [summary, setSummary]         = useState<any[]>([])
  const [dailyTrend, setDailyTrend]   = useState<any[]>([])
  const [allMethods, setAllMethods]   = useState<string[]>([])
  const [grandTotal, setGrandTotal]   = useState(0)
  const [transactions, setTransactions] = useState<any[]>([])

  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(0)
  const [methodTab, setMethodTab]   = useState<string>('ALL')
  const [selectedOrder, setSelectedOrder] = useState<any>(null)
  const [hoveredMethod, setHoveredMethod] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const res = await reportApi.getPaymentMethodReport(oid, from, to)
      const d = res.data.data
      setSummary(d.summary ?? [])
      setDailyTrend(d.dailyTrend ?? [])
      setAllMethods(d.allMethods ?? [])
      setGrandTotal(Number(d.grandTotal ?? 0))
      setTransactions(d.transactions ?? [])
      setPage(0)
      setMethodTab('ALL')
    } catch { toast.error('Failed to load payment report') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [from, to, oid])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await reportApi.exportPaymentCsv(oid, from, to)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a = document.createElement('a'); a.href = url; a.download = `payments_${from}_${to}.csv`; a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded')
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  const filtered = transactions.filter(t => {
    const matchMethod = methodTab === 'ALL' || t.method === methodTab
    const matchSearch = !search ||
      t.orderNumber?.toLowerCase().includes(search.toLowerCase()) ||
      t.customerName?.toLowerCase().includes(search.toLowerCase()) ||
      t.reference?.toLowerCase().includes(search.toLowerCase())
    return matchMethod && matchSearch
  })
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated  = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const pieData = summary.map(s => ({
    name: METHOD_META[s.method]?.label ?? s.method,
    value: Number(s.totalAmount),
  }))

  const kpiCards = summary.slice(0, 8).map(s => ({
    label:    METHOD_META[s.method]?.label ?? s.method,
    icon:     METHOD_META[s.method]?.icon ?? <Hash size={18} />,
    gradient: METHOD_META[s.method]?.gradient ?? 'from-gray-400 to-gray-600',
    value:    fmt(Number(s.totalAmount)),
    sub:      `${s.txCount} txn${s.txCount !== 1 ? 's' : ''} · avg ${fmt(Number(s.avgAmount))}`,
    share:    Number(s.share),
  }))

  const totalTxns = summary.reduce((s, r) => s + Number(r.txCount), 0)
  const cashRow   = summary.find(r => r.method === 'CASH')
  const cardRow   = summary.find(r => r.method === 'CARD')
  const upiRow    = summary.find(r => r.method === 'UPI')
  const topMethod = summary.length > 0 ? summary.reduce((a, b) => Number(a.totalAmount) > Number(b.totalAmount) ? a : b) : null
  const avgTxn    = totalTxns > 0 ? grandTotal / totalTxns : 0

  const statStrip = [
    { label: 'Grand Total',    value: grandTotal > 0 ? fmt(grandTotal) : '—',                            sub: 'all methods' },
    { label: 'Transactions',   value: totalTxns > 0 ? String(totalTxns) : '—',                           sub: 'total count' },
    { label: 'Cash',           value: cashRow ? fmt(Number(cashRow.totalAmount)) : '—',                   sub: cashRow ? `${cashRow.txCount} txns` : 'no data' },
    { label: 'Card',           value: cardRow ? fmt(Number(cardRow.totalAmount)) : '—',                   sub: cardRow ? `${cardRow.txCount} txns` : 'no data' },
    { label: 'UPI',            value: upiRow  ? fmt(Number(upiRow.totalAmount))  : '—',                   sub: upiRow  ? `${upiRow.txCount} txns`  : 'no data' },
    { label: 'Avg Transaction',value: avgTxn > 0 ? fmt(avgTxn) : '—',                                    sub: 'per payment' },
    { label: 'Top Method',     value: topMethod ? (METHOD_META[topMethod.method]?.label ?? topMethod.method) : '—', sub: topMethod ? `${topMethod.share}% share` : '' },
    { label: 'Methods Used',   value: summary.length > 0 ? String(summary.length) : '—',                 sub: 'payment types' },
  ]

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">
      {/* ── Gradient hero header ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)] overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                <CreditCard size={24} className="text-amber-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">Payment Report</h1>
                <p className="text-sm text-white/60 mt-0.5">Cash · Card · UPI · Net Banking</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={load} disabled={loading}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 disabled:opacity-50 transition-colors">
                {loading ? <Loader2 size={14} className="animate-spin text-white" /> : <RefreshCw size={14} className="text-white" />}
              </button>
              <button onClick={handleExport} disabled={exporting}
                className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-amber-900 px-3.5 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-60 transition-all shadow-sm">
                <Download size={11} className={exporting ? 'animate-bounce' : ''} />
                {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
          </div>

          {/* Tab switcher + date filters — separate strips */}
          <div className="flex items-center justify-between gap-3">
            <div className="bg-white/10 rounded-xl p-1 backdrop-blur-sm flex items-center gap-1">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tab === t.key ? 'bg-white text-violet-700 shadow-sm' : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            <DateRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-8 divide-x divide-white/10 border-t border-white/10 mt-2">
          {statStrip.map((s, i) => (
            <div key={i} className="px-3 py-3 text-center">
              <p className={`text-sm font-bold truncate text-white ${loading ? 'animate-pulse' : ''}`}>{s.value}</p>
              <p className="text-[11px] text-white/50 mt-0.5 truncate">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div>
      {/* ── Summary Tab ── */}
      {tab === 'summary' && (
        <>
          {/* KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            {loading ? Array(8).fill(0).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-gray-200 shrink-0" />
                <div className="flex-1">
                  <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
                  <div className="h-5 bg-gray-200 rounded w-3/4 mb-1" />
                  <div className="h-3 bg-gray-100 rounded w-2/3" />
                </div>
              </div>
            )) : kpiCards.length === 0 ? (
              <div className="col-span-4 py-10 text-center text-sm text-gray-400">No payment data for this period</div>
            ) : kpiCards.map((c, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center gap-3 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${c.gradient} flex items-center justify-center text-white shrink-0 shadow-sm`}>
                  {c.icon}
                </div>
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium">{c.label}</p>
                  <p className="text-xl font-bold text-gray-900">{c.value}</p>
                  <p className="text-[11px] text-gray-400 truncate">{c.sub} · {c.share}%</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pie chart */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-violet-400 to-blue-400">
              <span className="text-sm font-semibold text-white">Collection Breakdown</span>
              {grandTotal > 0 && <span className="text-xs text-blue-100">Total: {fmt2(grandTotal)}</span>}
            </div>
            <div className="p-5">
            {loading ? (
              <div className="flex items-center justify-center h-52"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
            ) : pieData.length === 0 ? (
              <div className="flex items-center justify-center h-52 text-sm text-gray-400">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={340}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                    labelLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                    label={({ cx, cy, midAngle, name, percent }) => {
                      const RADIAN = Math.PI / 180
                      const radius = 90 + 48
                      const x = cx + radius * Math.cos(-midAngle * RADIAN)
                      const y = cy + radius * Math.sin(-midAngle * RADIAN)
                      return (
                        <text x={x} y={y} fill="#9ca3af" fontSize={11}
                          textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central">
                          {`${name} ${(percent * 100).toFixed(0)}%`}
                        </text>
                      )
                    }}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v: any) => fmt2(Number(v))} />
                  <Legend content={({ payload }) => {
                    const total = pieData.reduce((s, d) => s + d.value, 0)
                    return (
                      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 20px', marginTop: 8, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                        {(payload ?? []).map((entry: any, i: number) => {
                          const pct = total > 0 ? ((entry.payload.value / total) * 100).toFixed(0) : '0'
                          return (
                            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: entry.color, flexShrink: 0 }} />
                              <span style={{ color: '#6b7280', fontSize: 12 }}>{entry.value}</span>
                              <span style={{ color: '#374151', fontSize: 12, fontWeight: 600 }}>{pct}%</span>
                            </div>
                          )
                        })}
                      </div>
                    )
                  }} />
                </PieChart>
              </ResponsiveContainer>
            )}
            </div>
          </div>

          {/* Summary table */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden mt-5">
            <div className="px-5 py-3.5 bg-gradient-to-r from-violet-400 to-blue-400">
              <h2 className="text-sm font-semibold text-white">Method-wise Summary</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Method</th>
                    <th className="px-4 py-3 text-right">Transactions</th>
                    <th className="px-4 py-3 text-right">Avg Amount</th>
                    <th className="px-4 py-3 text-right">Total Amount</th>
                    <th className="px-4 py-3 text-right">Share</th>
                    <th className="px-4 py-3 text-left w-40">Distribution</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? Array(4).fill(0).map((_, i) => (
                    <tr key={i}>{Array(6).fill(0).map((_, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                    ))}</tr>
                  )) : summary.map((row, i) => {
                    const meta = METHOD_META[row.method]
                    return (
                      <tr key={i} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-gray-400">{meta?.icon ?? <Hash size={14} />}</span>
                            <span className="text-sm font-medium text-gray-900">{meta?.label ?? row.method}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">{row.txCount}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-600">{fmt2(Number(row.avgAmount))}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmt2(Number(row.totalAmount))}</td>
                        <td className="px-4 py-3 text-right text-sm text-gray-500">{Number(row.share)}%</td>
                        <td className="px-4 py-3">
                          <div className="w-full bg-gray-100 rounded-full h-2">
                            <div className="h-2 rounded-full" style={{ width: `${Number(row.share)}%`, background: meta?.color ?? '#94a3b8' }} />
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                  {summary.length > 0 && (
                    <tr className="bg-gray-50 font-semibold text-sm">
                      <td className="px-4 py-3 text-gray-700">Total</td>
                      <td className="px-4 py-3 text-right">{summary.reduce((s, r) => s + r.txCount, 0)}</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right">{fmt2(grandTotal)}</td>
                      <td className="px-4 py-3 text-right">100%</td>
                      <td className="px-4 py-3" />
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Daily Trend Tab ── */}
      {tab === 'trend' && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-5 py-3 bg-gradient-to-r from-violet-400 to-blue-400">
            <h2 className="text-sm font-semibold text-white">Daily Collection by Method</h2>
          </div>
          <div className="p-5">
          {loading ? (
            <div className="flex items-center justify-center h-72"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
          ) : dailyTrend.length === 0 ? (
            <div className="flex items-center justify-center h-72 text-sm text-gray-400">No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.max(320, dailyTrend.length * 44)}>
              <BarChart data={dailyTrend} layout="vertical" margin={{ left: 16, right: 24, top: 4, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                <YAxis dataKey="date" type="category" width={54} tick={{ fontSize: 10 }}
                  tickFormatter={d => format(new Date(d), 'dd MMM')} />
                <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  labelFormatter={d => format(new Date(d), 'dd MMM yyyy')}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null
                    const entry = hoveredMethod ? payload.find((p: any) => p.dataKey === hoveredMethod) : null
                    if (!entry) return null
                    return (
                      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                        <p style={{ color: '#6b7280', marginBottom: 4 }}>{format(new Date(label), 'dd MMM yyyy')}</p>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: entry.color, flexShrink: 0 }} />
                          <span style={{ color: '#374151', fontWeight: 600 }}>{METHOD_META[entry.dataKey as string]?.label ?? entry.dataKey}</span>
                          <span style={{ color: '#111827', fontWeight: 700 }}>{fmt2(Number(entry.value))}</span>
                        </div>
                      </div>
                    )
                  }} />
                <Legend content={({ payload }) => (
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 20px', marginTop: 8 }}>
                    {(payload ?? []).map((entry: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 10, height: 10, borderRadius: '50%', backgroundColor: entry.color, flexShrink: 0 }} />
                        <span style={{ color: '#6b7280', fontSize: 12 }}>{METHOD_META[entry.dataKey]?.label ?? entry.dataKey}</span>
                      </div>
                    ))}
                  </div>
                )} />
                {allMethods.map((m, i) => (
                  <Bar key={m} dataKey={m} stackId="a" fill={METHOD_META[m]?.color ?? PIE_COLORS[i % PIE_COLORS.length]}
                    radius={i === allMethods.length - 1 ? [0, 4, 4, 0] : [0, 0, 0, 0]}
                    onMouseEnter={() => setHoveredMethod(m)}
                    onMouseLeave={() => setHoveredMethod(null)} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          )}
          </div>
        </div>
      )}

      {/* ── Transactions Tab ── */}
      {tab === 'transactions' && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          {/* Method sub-tabs */}
          <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-violet-400 to-blue-400 flex-wrap gap-3">
            <div className="flex items-center gap-1 flex-wrap">
              {/* All tab */}
              <button
                onClick={() => { setMethodTab('ALL'); setPage(0) }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                  methodTab === 'ALL'
                    ? 'bg-white text-violet-700 border-white shadow-sm'
                    : 'bg-white/15 text-white border-white/25 hover:bg-white/25'
                }`}>
                All
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${methodTab === 'ALL' ? 'bg-violet-100 text-violet-700' : 'bg-white/20 text-white'}`}>
                  {transactions.length}
                </span>
              </button>

              {/* One tab per payment method — always shown, count is 0 if none */}
              {Object.keys(METHOD_META).map(m => {
                const meta  = METHOD_META[m]
                const count = transactions.filter(t => t.method === m).length
                const active = methodTab === m
                return (
                  <button
                    key={m}
                    onClick={() => { setMethodTab(m); setPage(0) }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      active ? 'bg-white border-white shadow-sm' : 'bg-white/15 text-white border-white/25 hover:bg-white/25'
                    }`}
                    style={active ? { color: meta?.color ?? '#64748b' } : {}}>
                    {meta?.icon && <span style={active ? { color: meta?.color } : {}} className={active ? '' : 'text-white/70'}>{meta.icon}</span>}
                    {meta?.label ?? m}
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${active ? 'bg-white/30' : 'bg-white/20 text-white'}`}
                      style={active ? { color: meta?.color } : {}}>
                      {count}
                    </span>
                  </button>
                )
              })}
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/50" />
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="Search order / customer / ref..."
                className="pl-8 pr-3 py-1.5 text-xs border border-white/25 rounded-lg w-56 bg-white/15 text-white placeholder:text-white/40 focus:outline-none focus:bg-white/20" />
            </div>
          </div>

          {/* Row count */}
          <div className="px-5 py-2 border-b bg-white">
            <p className="text-xs text-gray-400">
              {filtered.length} transaction{filtered.length !== 1 ? 's' : ''}
              {methodTab !== 'ALL' && <span> · {METHOD_META[methodTab]?.label ?? methodTab}</span>}
              {filtered.length > 0 && <span> · Total: <span className="font-semibold text-gray-700">{fmt2(filtered.reduce((s, t) => s + Number(t.amount), 0))}</span></span>}
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Time</th>
                  <th className="px-4 py-3 text-left">Order #</th>
                  <th className="px-4 py-3 text-left">Customer</th>
                  {methodTab === 'ALL' && <th className="px-4 py-3 text-center">Method</th>}
                  <th className="px-4 py-3 text-left">Reference</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? Array(8).fill(0).map((_, i) => (
                  <tr key={i}>{Array(7).fill(0).map((_, j) => (
                    <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                  ))}</tr>
                )) : paginated.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-400">No transactions found</td></tr>
                ) : paginated.map((t: any, i: number) => {
                  const meta = METHOD_META[t.method]
                  return (
                    <tr key={i} className="hover:bg-gray-50 transition-colors"
                      style={methodTab !== 'ALL' ? { borderLeft: `3px solid ${meta?.color ?? '#94a3b8'}` } : {}}>
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{t.date}</td>
                      <td className="px-4 py-3 text-xs text-gray-400">{t.time}</td>
                      <td className="px-4 py-3">
                        <button onClick={() => setSelectedOrder({ id: t.orderId, orderNumber: t.orderNumber })}
                          className="font-mono text-sm font-medium text-primary-600 hover:text-primary-800 hover:underline transition-colors">
                          {t.orderNumber}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700">{t.customerName || <span className="text-gray-300">—</span>}</td>
                      {methodTab === 'ALL' && (
                        <td className="px-4 py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full"
                            style={{ background: `${meta?.color ?? '#94a3b8'}18`, color: meta?.color ?? '#64748b' }}>
                            {meta?.label ?? t.method}
                          </span>
                        </td>
                      )}
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono">{t.reference || '—'}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmt2(Number(t.amount))}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50">
              <p className="text-xs text-gray-500">Page {page + 1} of {totalPages}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40">
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pg = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i
                  return (
                    <button key={pg} onClick={() => setPage(pg)}
                      className={`w-7 h-7 text-xs rounded-lg border transition-colors ${pg === page ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-white'}`}>
                      {pg + 1}
                    </button>
                  )
                })}
                <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40">
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
      </div>{/* end p-6 */}
      {selectedOrder && (
        <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
      )}
    </div>
  )
}
