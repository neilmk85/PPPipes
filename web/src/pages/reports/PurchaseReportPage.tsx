import { useState, useEffect } from 'react'
import { format, subDays } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import {
  ShoppingBag, Loader2, RefreshCw,
  Building2, PackageCheck, Search,
  ChevronLeft, ChevronRight, Download,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { reportApi, purchaseOrderApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { DateRangePicker } from '@/components/DateRangePicker'

const STATUS_COLORS: Record<string, string> = {
  DRAFT:    'bg-gray-100 text-gray-600',
  SENT:     'bg-blue-50 text-blue-700',
  PARTIAL:  'bg-yellow-50 text-yellow-700',
  RECEIVED: 'bg-green-50 text-green-700',
  CANCELLED:'bg-red-50 text-red-500',
}

const BAR_COLORS  = ['#0d9488','#3b82f6','#f59e0b','#ef4444','#14b8a6','#60a5fa','#fbbf24','#f87171']
const PIE_COLORS  = ['#0d9488','#3b82f6','#f59e0b','#ef4444','#14b8a6','#60a5fa','#fbbf24','#f87171']

type Tab = 'summary' | 'transactions' | 'by-supplier' | 'outstanding'
const TABS: { key: Tab; label: string }[] = [
  { key: 'summary',      label: 'Summary' },
  { key: 'transactions', label: 'Transactions' },
  { key: 'by-supplier',  label: 'By Supplier' },
  { key: 'outstanding',  label: 'Outstanding' },
]

export default function PurchaseReportPage() {
  const { outletId } = useAuthStore()
  const oid = outletId ?? 1
  const [tab, setTab]   = useState<Tab>('summary')
  const [from, setFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [to, setTo]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading]     = useState(false)
  const [exporting, setExporting] = useState(false)

  const [summary, setSummary]   = useState<any>(null)
  const [supChart, setSupChart] = useState<any[]>([])

  const [orders, setOrders]             = useState<any[]>([])
  const [txPage, setTxPage]             = useState(0)
  const [txTotalPages, setTxTotalPages] = useState(0)
  const [txTotal, setTxTotal]           = useState(0)
  const [txSearch, setTxSearch]         = useState('')
  const [txLoading, setTxLoading]       = useState(false)
  const PAGE_SIZE = 10

  const [supData, setSupData]     = useState<any[]>([])
  const [supSearch, setSupSearch] = useState('')
  const [outData, setOutData]     = useState<any[]>([])
  const [outSearch, setOutSearch] = useState('')

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  const fetchSummary = async () => {
    setLoading(true)
    try {
      const [s, sup] = await Promise.all([
        reportApi.getPurchaseSummary(oid, from, to),
        reportApi.getPurchaseBySupplier(oid, from, to),
      ])
      setSummary(s.data.data)
      const supList: any[] = sup.data.data ?? []
      setSupChart(supList.slice(0, 8).map(r => ({ name: r.supplierName, total: Number(r.totalValue ?? 0) })))
    } catch { toast.error('Failed to load summary') }
    finally { setLoading(false) }
  }

  const fetchOrders = async (page = 0) => {
    setTxLoading(true)
    try {
      const res = await purchaseOrderApi.getByOutlet(oid, { from, to, page, size: PAGE_SIZE })
      const d = res.data.data
      setOrders(d?.content ?? [])
      setTxTotal(d?.totalElements ?? 0)
      setTxTotalPages(Math.ceil((d?.totalElements ?? 0) / PAGE_SIZE))
    } catch { setOrders([]) }
    finally { setTxLoading(false) }
  }

  const fetchSupplier = async () => {
    setLoading(true)
    try {
      const res = await reportApi.getPurchaseBySupplier(oid, from, to)
      setSupData(res.data.data ?? [])
    } catch { toast.error('Failed to load supplier report') }
    finally { setLoading(false) }
  }

  const fetchOutstanding = async () => {
    setLoading(true)
    try {
      const res = await reportApi.getOutstandingPOs(oid, from, to)
      setOutData(res.data.data ?? [])
    } catch { toast.error('Failed to load outstanding POs') }
    finally { setLoading(false) }
  }

  const load = () => {
    if (tab === 'summary')           fetchSummary()
    else if (tab === 'transactions') { setTxPage(0); fetchOrders(0) }
    else if (tab === 'by-supplier')  fetchSupplier()
    else if (tab === 'outstanding')  fetchOutstanding()
  }

  useEffect(() => { load() }, [from, to, oid, tab])
  useEffect(() => { if (tab === 'transactions') fetchOrders(txPage) }, [txPage])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await reportApi.exportPurchaseCsv(oid, from, to)
      const url = URL.createObjectURL(new Blob([res.data], { type: 'text/csv' }))
      const a = document.createElement('a'); a.href = url; a.download = `purchases_${from}_${to}.csv`; a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded')
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  const supTotalValue = supData.reduce((s, r) => s + Number(r.totalValue ?? 0), 0)
  const outTotalValue = outData.reduce((s, r) => s + Number(r.totalAmount ?? 0), 0)

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">
      {/* ── Gradient Hero ── */}
      <div className="bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)] overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                <ShoppingBag size={24} className="text-amber-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">Purchase Report</h1>
                <p className="text-sm text-white/60 mt-0.5">Orders · Suppliers · Outstanding · Receivables</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={load} disabled={loading || txLoading}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 disabled:opacity-50 transition-colors">
                {loading || txLoading
                  ? <Loader2 size={14} className="animate-spin text-white" />
                  : <RefreshCw size={14} className="text-white" />}
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
            {/* Tabs */}
            <div className="bg-white/10 rounded-xl p-1 backdrop-blur-sm flex items-center gap-1">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tab === t.key
                      ? 'bg-white text-violet-700 shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
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
          {[
            { label: 'Total PO Value',    value: summary ? fmt(summary.totalValue ?? 0)              : '—' },
            { label: 'Orders',            value: summary ? String(summary.totalOrders ?? 0)          : '—' },
            { label: 'Received',          value: summary ? String(summary.received ?? 0)             : '—' },
            { label: 'Pending',           value: summary ? String(summary.pending ?? 0)              : '—', cls: (summary?.pending ?? 0) > 0 ? 'text-amber-300' : undefined },
            { label: 'Outstanding',       value: summary ? fmt(summary.outstanding ?? 0)             : '—', cls: (summary?.outstanding ?? 0) > 0 ? 'text-amber-300' : undefined },
            { label: 'Avg PO Value',      value: summary ? fmt(summary.avgPoValue ?? 0)              : '—' },
            { label: 'Suppliers',         value: summary ? String(summary.uniqueSuppliers ?? 0)      : '—' },
            { label: 'Cancelled',         value: summary ? String(summary.cancelled ?? 0)            : '—', cls: (summary?.cancelled ?? 0) > 0 ? 'text-amber-300' : undefined },
          ].map(st => (
            <div key={st.label} className="px-3 py-3 text-center">
              <p className={`text-sm font-bold truncate ${st.cls ?? 'text-white'}`}>{st.value}</p>
              <p className="text-[11px] text-white/50 mt-0.5 truncate">{st.label}</p>
            </div>
          ))}
        </div>
      </div>

      {tab === 'summary' && (
        <>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5" style={{background:'linear-gradient(to right,#eff6ff 0%,#eef2ff 100%)',borderBottom:'1px solid #dbeafe'}}>
              <h2 className="text-sm font-semibold" style={{color:'#1f2937'}}>Purchases by Supplier</h2>
            </div>
            <div className="p-5">
            {supChart.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-gray-300 gap-2">
                <Building2 size={36} /><p className="text-sm text-gray-400">No purchase data for this period</p>
              </div>
            ) : (() => {
              const maxVal = Math.max(...supChart.map(r => r.total))
              return (
                <div className="space-y-3">
                  {supChart.map((r, i) => {
                    const pct = maxVal > 0 ? (r.total / maxVal) * 100 : 0
                    return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="w-5 text-xs font-bold text-gray-400 shrink-0 text-right">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-gray-800 truncate pr-2">{r.name}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${pct}%`, backgroundColor: BAR_COLORS[i % BAR_COLORS.length] }} />
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-900 shrink-0 w-24 text-right">
                          ₹{r.total.toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </span>
                      </div>
                    )
                  })}
                </div>
              )
            })()}
            </div>
          </div>
        </>
      )}

      {tab === 'transactions' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 flex items-center justify-between" style={{background:'linear-gradient(to right,#eff6ff 0%,#eef2ff 100%)',borderBottom:'1px solid #dbeafe'}}>
            <div>
              <h2 className="text-sm font-semibold" style={{color:'#1f2937'}}>Purchase Orders</h2>
              {txTotal > 0 && <p className="text-xs mt-0.5" style={{color:'#6b7280'}}>{txTotal} orders in this period</p>}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={txSearch} onChange={e => setTxSearch(e.target.value)} placeholder="Search PO #..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-blue-200 rounded-xl text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 w-44" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-[11px] uppercase tracking-wide" >
                <tr style={{background:'linear-gradient(to right,#eff6ff 0%,#eef2ff 100%)',borderBottom:'1px solid #dbeafe',color:'#1f2937'}}>
                  <th className="px-4 py-3 text-left">PO Number</th>
                  <th className="px-4 py-3 text-left">Date</th>
                  <th className="px-4 py-3 text-left">Supplier</th>
                  <th className="px-4 py-3 text-center">Items</th>
                  <th className="px-4 py-3 text-left">Expected</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {txLoading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}>{Array(7).fill(0).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                )) : orders.length === 0 ? (
                  <tr><td colSpan={7} className="px-4 py-12 text-center">
                    <ShoppingBag size={32} className="mx-auto text-gray-200 mb-2" />
                    <p className="text-sm text-gray-400">No purchase orders in this period</p>
                  </td></tr>
                ) : orders
                    .filter(o => !txSearch || o.poNumber?.toLowerCase().includes(txSearch.toLowerCase()))
                    .map((o: any) => (
                      <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-4 py-3"><span className="text-sm font-mono font-medium text-primary-600">{o.poNumber}</span></td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{o.createdAt ? format(new Date(o.createdAt), 'dd MMM yyyy') : '—'}</td>
                        <td className="px-4 py-3">
                          {o.supplier ? <div><p className="text-sm text-gray-900">{o.supplier.name}</p><p className="text-xs text-gray-400">{o.supplier.phone}</p></div>
                            : <span className="text-xs text-gray-400">—</span>}
                        </td>
                        <td className="px-4 py-3 text-center text-sm text-gray-700">{o.items?.length ?? 0}</td>
                        <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{o.expectedDate ? format(new Date(o.expectedDate), 'dd MMM yyyy') : '—'}</td>
                        <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmt(Number(o.totalAmount ?? 0))}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[o.status] ?? 'bg-gray-100 text-gray-500'}`}>{o.status ?? '—'}</span>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
          {txTotalPages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50">
              <p className="text-xs text-gray-500">Page {txPage + 1} of {txTotalPages}</p>
              <div className="flex items-center gap-1">
                <button onClick={() => setTxPage(p => Math.max(0, p - 1))} disabled={txPage === 0}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40"><ChevronLeft size={14} /></button>
                {Array.from({ length: Math.min(5, txTotalPages) }, (_, i) => {
                  const page = txTotalPages <= 5 ? i : Math.max(0, Math.min(txPage - 2, txTotalPages - 5)) + i
                  return (
                    <button key={page} onClick={() => setTxPage(page)}
                      className={`w-7 h-7 text-xs rounded-lg border transition-colors ${page === txPage ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-white'}`}>
                      {page + 1}
                    </button>
                  )
                })}
                <button onClick={() => setTxPage(p => Math.min(txTotalPages - 1, p + 1))} disabled={txPage >= txTotalPages - 1}
                  className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40"><ChevronRight size={14} /></button>
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'by-supplier' && (
        <div className="space-y-5">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 flex items-center justify-between" style={{background:'linear-gradient(to right,#eff6ff 0%,#eef2ff 100%)',borderBottom:'1px solid #dbeafe'}}>
              <h2 className="text-sm font-semibold" style={{color:'#1f2937'}}>Supplier Analysis</h2>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={supSearch} onChange={e => setSupSearch(e.target.value)} placeholder="Search supplier..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-blue-200 rounded-xl text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 w-44" />
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
            ) : supData.length === 0 ? (
              <div className="py-12 text-center text-sm text-gray-400">No supplier data for this period</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="text-[11px] uppercase tracking-wide" >
                    <tr style={{background:'linear-gradient(to right,#eff6ff 0%,#eef2ff 100%)',borderBottom:'1px solid #dbeafe',color:'#1f2937'}}>
                      <th className="px-4 py-3 text-left">#</th>
                      <th className="px-4 py-3 text-left">Supplier</th>
                      <th className="px-4 py-3 text-center">Orders</th>
                      <th className="px-4 py-3 text-center">Received</th>
                      <th className="px-4 py-3 text-center">Pending</th>
                      <th className="px-4 py-3 text-right">Avg PO Value</th>
                      <th className="px-4 py-3 text-right">Total Value</th>
                      <th className="px-4 py-3 text-right">Outstanding</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {supData
                      .filter(r => !supSearch || r.supplierName?.toLowerCase().includes(supSearch.toLowerCase()))
                      .map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{row.supplierName}</p>
                            {row.phone && <p className="text-xs text-gray-400">{row.phone}</p>}
                          </td>
                          <td className="px-4 py-3 text-center text-sm text-gray-700">{row.orderCount}</td>
                          <td className="px-4 py-3 text-center"><span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{row.received}</span></td>
                          <td className="px-4 py-3 text-center"><span className="text-xs bg-yellow-50 text-yellow-700 px-2 py-0.5 rounded-full">{row.pending}</span></td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">{fmt(Number(row.avgPoValue ?? 0))}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmt(Number(row.totalValue ?? 0))}</td>
                          <td className="px-4 py-3 text-right text-sm text-yellow-600 font-medium">{fmt(Number(row.outstanding ?? 0))}</td>
                        </tr>
                      ))}
                    <tr className="bg-gray-50 font-semibold">
                      <td className="px-4 py-3 text-sm" colSpan={2}>Total</td>
                      <td className="px-4 py-3 text-center text-sm">{supData.reduce((s, r) => s + Number(r.orderCount ?? 0), 0)}</td>
                      <td className="px-4 py-3 text-center text-sm">{supData.reduce((s, r) => s + Number(r.received ?? 0), 0)}</td>
                      <td className="px-4 py-3 text-center text-sm">{supData.reduce((s, r) => s + Number(r.pending ?? 0), 0)}</td>
                      <td className="px-4 py-3" />
                      <td className="px-4 py-3 text-right text-sm">{fmt(supTotalValue)}</td>
                      <td className="px-4 py-3 text-right text-sm text-yellow-600">{fmt(supData.reduce((s, r) => s + Number(r.outstanding ?? 0), 0))}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'outstanding' && (
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 flex items-center justify-between" style={{background:'linear-gradient(to right,#eff6ff 0%,#eef2ff 100%)',borderBottom:'1px solid #dbeafe'}}>
              <div>
                <h2 className="text-sm font-semibold" style={{color:'#1f2937'}}>Outstanding Purchase Orders</h2>
                <p className="text-xs mt-0.5" style={{color:'#6b7280'}}>Draft, Sent, and Partially received orders</p>
              </div>
              <div className="relative">
                <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={outSearch} onChange={e => setOutSearch(e.target.value)} placeholder="Search PO / supplier..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-blue-200 rounded-xl text-gray-700 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 w-52" />
              </div>
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-40"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
            ) : outData.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-300 gap-2">
                <PackageCheck size={36} /><p className="text-sm text-gray-400">No outstanding POs for this period</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="text-[11px] uppercase tracking-wide" >
                    <tr style={{background:'linear-gradient(to right,#eff6ff 0%,#eef2ff 100%)',borderBottom:'1px solid #dbeafe',color:'#1f2937'}}>
                      <th className="px-4 py-3 text-left">PO Number</th>
                      <th className="px-4 py-3 text-left">Supplier</th>
                      <th className="px-4 py-3 text-center">Status</th>
                      <th className="px-4 py-3 text-center">Items</th>
                      <th className="px-4 py-3 text-left">Order Date</th>
                      <th className="px-4 py-3 text-left">Expected</th>
                      <th className="px-4 py-3 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {outData
                      .filter(r => !outSearch || r.poNumber?.toLowerCase().includes(outSearch.toLowerCase()) || r.supplierName?.toLowerCase().includes(outSearch.toLowerCase()))
                      .map((row, i) => {
                        const isOverdue = row.expectedDate && new Date(row.expectedDate) < new Date()
                        return (
                          <tr key={i} className={`hover:bg-gray-50 transition-colors ${isOverdue ? 'bg-red-50/30' : ''}`}>
                            <td className="px-4 py-3"><span className="text-sm font-mono font-medium text-primary-600">{row.poNumber}</span></td>
                            <td className="px-4 py-3">
                              <p className="text-sm text-gray-900">{row.supplierName}</p>
                              {row.supplierPhone && <p className="text-xs text-gray-400">{row.supplierPhone}</p>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[row.status] ?? 'bg-gray-100 text-gray-500'}`}>{row.status}</span>
                            </td>
                            <td className="px-4 py-3 text-center text-sm text-gray-700">{row.itemCount}</td>
                            <td className="px-4 py-3 text-xs text-gray-500">{row.orderDate}</td>
                            <td className="px-4 py-3 text-xs">
                              <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}>
                                {row.expectedDate || '—'}{isOverdue && ' ⚠'}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">{fmt(Number(row.totalAmount ?? 0))}</td>
                          </tr>
                        )
                      })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
