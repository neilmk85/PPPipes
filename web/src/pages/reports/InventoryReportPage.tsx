import { useState, useEffect } from 'react'
import { format, subDays } from 'date-fns'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend,
} from 'recharts'
import {
  Package, AlertTriangle, Boxes, Loader2, RefreshCw, ArrowUpDown,
  Search, TrendingUp, TrendingDown, ArrowLeftRight, History,
  ChevronLeft, ChevronRight, BarChart2, Download,
} from 'lucide-react'
import { inventoryApi, productApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { DateRangePicker } from '@/components/DateRangePicker'

const COLORS     = ['#0d9488','#3b82f6','#f59e0b','#ef4444','#14b8a6','#60a5fa','#fbbf24','#f87171','#2dd4bf','#93c5fd']
const PIE_COLORS = ['#0d9488','#3b82f6','#f59e0b','#ef4444','#14b8a6','#60a5fa','#fbbf24','#f87171']

type Tab = 'overview' | 'stock-status' | 'adjustments' | 'transfers'
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview',     label: 'Overview'      },
  { key: 'stock-status', label: 'Stock Status'  },
  { key: 'adjustments',  label: 'Adjustments'   },
  { key: 'transfers',    label: 'Transfers'     },
]

type TypeFilter = 'raw_material' | 'finished_pipe' | 'store_material'
const TYPE_TABS: { key: TypeFilter; label: string; value: string }[] = [
  { key: 'raw_material',   label: 'Raw Material',   value: 'RAW_MATERIAL'   },
  { key: 'finished_pipe',  label: 'Pipes',          value: 'FINISHED_PIPE'  },
  { key: 'store_material', label: 'Store Material', value: 'STORE_MATERIAL' },
]

type SortKey = 'name' | 'stock' | 'value'

export default function InventoryReportPage() {
  const { outletId } = useAuthStore()
  const oid = outletId ?? 1

  const [tab, setTab]         = useState<Tab>('overview')
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('raw_material')
  const [from, setFrom] = useState(format(subDays(new Date(), 29), 'yyyy-MM-dd'))
  const [to, setTo]     = useState(format(new Date(), 'yyyy-MM-dd'))
  const [loading, setLoading]     = useState(false)
  const [exporting, setExporting] = useState(false)

  const [products, setProducts]       = useState<any[]>([])
  const [lowStock, setLowStock]       = useState<any[]>([])
  const [adjustments, setAdjustments] = useState<any[]>([])
  const [adjTotal, setAdjTotal]       = useState(0)
  const [adjPage, setAdjPage]         = useState(0)
  const [adjTotalPages, setAdjTotalPages] = useState(0)
  const [transfers, setTransfers]     = useState<any[]>([])
  const [txPage, setTxPage]           = useState(0)
  const [txTotalPages, setTxTotalPages] = useState(0)

  const [search, setSearch]             = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'in-stock' | 'low' | 'out'>('all')
  const [sortKey, setSortKey]           = useState<SortKey>('stock')
  const [sortAsc, setSortAsc]           = useState(true)

  const PAGE_SIZE = 20

  // ── Data fetchers ────────────────────────────────────────────────────────────

  const fetchOverview = async () => {
    setLoading(true)
    try {
      const [prodRes, lowRes] = await Promise.all([
        productApi.getAll({ limit: 500 }),
        inventoryApi.getLowStock(oid),
      ])
      setProducts(prodRes.data.data?.content ?? prodRes.data.data ?? [])
      setLowStock(lowRes.data.data ?? [])
    } catch { toast.error('Failed to load inventory') }
    finally { setLoading(false) }
  }

  const fetchAdjustments = async (page = 0) => {
    setLoading(true)
    try {
      const res = await inventoryApi.getAdjustments(oid, { page, size: PAGE_SIZE, from, to })
      const d = res.data.data
      setAdjustments(d?.content ?? d ?? [])
      setAdjTotal(d?.totalElements ?? (Array.isArray(d) ? d.length : 0))
      setAdjTotalPages(d?.totalPages ?? 1)
    } catch { toast.error('Failed to load adjustments') }
    finally { setLoading(false) }
  }

  const fetchTransfers = async (page = 0) => {
    setLoading(true)
    try {
      const res = await inventoryApi.getTransfers(oid, { page, size: PAGE_SIZE })
      const d = res.data.data
      setTransfers(d?.content ?? d ?? [])
      setTxTotalPages(d?.totalPages ?? 1)
    } catch { toast.error('Failed to load transfers') }
    finally { setLoading(false) }
  }

  const load = () => {
    if (tab === 'overview' || tab === 'stock-status') fetchOverview()
    else if (tab === 'adjustments') { setAdjPage(0); fetchAdjustments(0) }
    else if (tab === 'transfers')   { setTxPage(0); fetchTransfers(0) }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      // Build CSV from current products data
      const rows = [
        ['Product', 'SKU', 'Category', 'Stock Qty', 'Reorder At', 'Cost Price', 'Selling Price', 'Stock Value', 'Status'],
        ...typeFilteredProducts.map(p => {
          const qty = p.stockQuantity ?? 0
          const val = qty * (p.costPrice ?? p.sellingPrice ?? 0)
          const status = qty <= 0 ? 'Out of Stock' : qty <= (p.reorderPoint ?? 5) ? 'Low Stock' : 'In Stock'
          return [
            p.name ?? '',
            p.sku ?? '',
            p.category?.name ?? '',
            qty,
            p.reorderPoint ?? 5,
            p.costPrice ?? 0,
            p.sellingPrice ?? 0,
            val.toFixed(0),
            status,
          ]
        }),
      ]
      const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
      const a = document.createElement('a'); a.href = url; a.download = `inventory_${from}_${to}.csv`; a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded')
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  useEffect(() => { load() }, [oid, tab, from, to])
  useEffect(() => { if (tab === 'adjustments') fetchAdjustments(adjPage) }, [adjPage])
  useEffect(() => { if (tab === 'transfers')   fetchTransfers(txPage)    }, [txPage])

  // ── Type-filtered products ───────────────────────────────────────────────────

  const activeTypeValue = TYPE_TABS.find(t => t.key === typeFilter)?.value ?? 'RAW_MATERIAL'
  const typeFilteredProducts = products.filter(p =>
    (p.itemType ?? p.productType ?? p.type) === activeTypeValue
  )

  // ── Derived stats ────────────────────────────────────────────────────────────

  const totalProducts  = typeFilteredProducts.length
  const outOfStock     = typeFilteredProducts.filter(p => (p.stockQuantity ?? 0) <= 0).length
  const lowStockCount  = lowStock.length
  const inStockCount   = typeFilteredProducts.filter(p => (p.stockQuantity ?? 0) > (p.reorderPoint ?? 5)).length
  const totalValue     = typeFilteredProducts.reduce((s, p) => s + ((p.stockQuantity ?? 0) * (p.costPrice ?? p.sellingPrice ?? 0)), 0)
  const totalRetail    = typeFilteredProducts.reduce((s, p) => s + ((p.stockQuantity ?? 0) * (p.sellingPrice ?? 0)), 0)
  const potentialProfit = totalRetail - totalValue

  // Category chart
  const catMap: Record<string, number> = {}
  typeFilteredProducts.forEach(p => {
    const cat = p.category?.name ?? 'Uncategorized'
    catMap[cat] = (catMap[cat] ?? 0) + ((p.stockQuantity ?? 0) * (p.costPrice ?? p.sellingPrice ?? 0))
  })
  const catChartData = Object.entries(catMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  // Health pie
  const stockPie = [
    { name: 'In Stock',    value: inStockCount,  color: '#0d9488' },
    { name: 'Low Stock',   value: lowStockCount, color: '#fbbf24' },
    { name: 'Out of Stock',value: outOfStock,    color: '#f87171' },
  ].filter(d => d.value > 0)

  // Top by value
  const topByValue = [...typeFilteredProducts]
    .map(p => ({ name: p.name, value: (p.stockQuantity ?? 0) * (p.costPrice ?? p.sellingPrice ?? 0) }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10)

  // Filtered + sorted stock list
  const filteredProducts = [...typeFilteredProducts]
    .filter(p => {
      if (search && !p.name?.toLowerCase().includes(search.toLowerCase())
        && !p.sku?.toLowerCase().includes(search.toLowerCase())) return false
      const q = p.stockQuantity ?? 0
      if (statusFilter === 'out')      return q <= 0
      if (statusFilter === 'low')      return q > 0 && q <= (p.reorderPoint ?? 5)
      if (statusFilter === 'in-stock') return q > (p.reorderPoint ?? 5)
      return true
    })
    .sort((a, b) => {
      let va: any, vb: any
      if (sortKey === 'name')  { va = a.name ?? '';  vb = b.name ?? '' }
      if (sortKey === 'stock') { va = a.stockQuantity ?? 0;  vb = b.stockQuantity ?? 0 }
      if (sortKey === 'value') { va = (a.stockQuantity ?? 0) * (a.costPrice ?? 0); vb = (b.stockQuantity ?? 0) * (b.costPrice ?? 0) }
      return sortAsc ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0)
    })

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(v => !v)
    else { setSortKey(key); setSortAsc(true) }
  }

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <button onClick={() => toggleSort(k)} className="flex items-center gap-1 hover:text-gray-700 group">
      {label}
      <ArrowUpDown size={12} className={`${sortKey === k ? 'text-primary-500' : 'text-gray-300 group-hover:text-gray-400'}`} />
    </button>
  )

  const fmt = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`


  // ── Render ───────────────────────────────────────────────────────────────────

  const statStrip = [
    { label: 'Total Products',   value: totalProducts.toString(),        sub: 'all SKUs' },
    { label: 'In Stock',         value: inStockCount.toString(),         sub: 'above reorder' },
    { label: 'Low Stock',        value: lowStockCount.toString(),        sub: 'needs reorder',  warn: lowStockCount > 0 },
    { label: 'Out of Stock',     value: outOfStock.toString(),           sub: 'zero qty',       warn: outOfStock > 0 },
    { label: 'Stock Cost Value', value: fmt(totalValue),                 sub: 'at cost price' },
    { label: 'Retail Value',     value: fmt(totalRetail),                sub: 'at selling price' },
    { label: 'Potential Profit', value: fmt(potentialProfit),            sub: 'retail − cost' },
    { label: 'Categories',       value: catChartData.length.toString(),  sub: 'product groups' },
  ]

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* ── Hero header ── */}
      <div className="bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)] overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                <BarChart2 size={24} className="text-amber-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">Inventory Report</h1>
                <p className="text-sm text-white/60 mt-0.5">Stock · Adjustments · Transfers</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={load} disabled={loading}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 disabled:opacity-50 transition-colors">
                {loading
                  ? <Loader2 size={14} className="animate-spin text-white" />
                  : <RefreshCw size={14} className="text-white" />}
              </button>
              <button onClick={handleExport} disabled={exporting || typeFilteredProducts.length === 0}
                className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-amber-900 px-3.5 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-60 transition-all shadow-sm">
                <Download size={11} className={exporting ? 'animate-bounce' : ''} />
                {exporting ? 'Exporting…' : 'Export CSV'}
              </button>
            </div>
          </div>

          {/* Material type tabs */}
          <div className="bg-white/10 rounded-xl p-1 backdrop-blur-sm flex items-center gap-1 mb-3">
            {TYPE_TABS.map(t => (
              <button key={t.key} onClick={() => setTypeFilter(t.key)}
                className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  typeFilter === t.key
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}>
                {t.label}
              </button>
            ))}
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

            {/* Date range picker */}
            <DateRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-8 divide-x divide-white/10 border-t border-white/10 mt-2">
          {statStrip.map(s => (
            <div key={s.label} className="px-3 py-3 text-center">
              <p className={`text-sm font-bold truncate ${s.warn ? 'text-amber-300' : 'text-white'}`}>
                {loading ? <span className="inline-block w-10 h-3.5 bg-white/20 rounded animate-pulse" /> : s.value}
              </p>
              <p className="text-[11px] text-white/50 mt-0.5 truncate">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ══════════════════════ OVERVIEW TAB ══════════════════════ */}
      {tab === 'overview' && (
        <>
          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-r from-violet-400 to-blue-400">
                <h2 className="text-sm font-semibold text-white">Stock Value by Category</h2>
              </div>
              <div className="p-5">
              {catChartData.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-gray-200"><Boxes size={40} /></div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={catChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false}
                      tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                      formatter={(v: any) => [`₹${Number(v).toLocaleString('en-IN')}`, 'Stock Value']} />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {catChartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-lg overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-r from-violet-400 to-blue-400 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">Stock Health Distribution</h2>
                {stockPie.length > 0 && (
                  <span className="text-xs text-blue-100">
                    {stockPie.reduce((s, d) => s + d.value, 0)} products
                  </span>
                )}
              </div>
              <div className="p-5">
              {stockPie.length === 0 ? (
                <div className="flex items-center justify-center h-52 text-gray-200"><Package size={40} /></div>
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <PieChart>
                    <Pie data={stockPie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                      labelLine={{ stroke: '#d1d5db', strokeWidth: 1 }}
                      label={({ cx, cy, midAngle, name, percent }: any) => {
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
                      {stockPie.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                      formatter={(v: any, name: string) => [v + ' products', name]} />
                    <Legend content={({ payload }) => {
                      const pieTotal = stockPie.reduce((s, d) => s + d.value, 0)
                      return (
                        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 20px', marginTop: 8, borderTop: '1px solid #f3f4f6', paddingTop: 12 }}>
                          {(payload ?? []).map((entry: any, i: number) => {
                            const pct = pieTotal > 0 ? ((entry.payload.value / pieTotal) * 100).toFixed(0) : '0'
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
          </div>

          {/* Top by value */}
          {topByValue.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-5 py-3 bg-gradient-to-r from-violet-400 to-blue-400">
                <h2 className="text-sm font-semibold text-white">Top 10 Products by Stock Value</h2>
              </div>
              <div className="p-5">
              {(() => {
                const maxVal = Math.max(...topByValue.map(r => r.value))
                return (
                  <div className="space-y-3">
                    {topByValue.map((r, i) => {
                      const pct = maxVal > 0 ? (r.value / maxVal) * 100 : 0
                      return (
                        <div key={i} className="flex items-center gap-3">
                          <span className="w-5 text-xs font-bold text-gray-400 shrink-0 text-right">{i + 1}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-gray-800 truncate pr-2">{r.name}</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-gray-900 shrink-0 w-24 text-right">
                            {fmt(r.value)}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
              </div>
            </div>
          )}

          {/* Low stock alerts */}
          {lowStock.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-violet-400 to-blue-400">
                <div className="flex items-center gap-2">
                  <AlertTriangle size={14} className="text-amber-200" />
                  <h2 className="text-sm font-semibold text-white">Low Stock Alerts</h2>
                </div>
                <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full font-medium">{lowStockCount}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-100 text-[11px] text-gray-600 uppercase tracking-wide shadow-[0_2px_6px_rgba(0,0,0,0.08)]">
                    <tr>
                      <th className="px-4 py-3 text-left">Product</th>
                      <th className="px-4 py-3 text-left">Category</th>
                      <th className="px-4 py-3 text-right">Stock Qty</th>
                      <th className="px-4 py-3 text-right">Reorder At</th>
                      <th className="px-4 py-3 text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {lowStock.map((item: any, i) => {
                      const qty = item.stockQuantity ?? item.quantity ?? 0
                      return (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{item.productName ?? item.name ?? 'Product'}</p>
                            {(item.sku ?? item.barcode) && <p className="text-xs text-gray-400">{item.sku ?? item.barcode}</p>}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-500">{item.categoryName ?? '—'}</td>
                          <td className={`px-4 py-3 text-right text-sm font-bold ${qty <= 0 ? 'text-red-600' : 'text-amber-600'}`}>{qty}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-400">{item.reorderPoint ?? 5}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${qty <= 0 ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-700'}`}>
                              {qty <= 0 ? 'Out of Stock' : 'Low Stock'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════ STOCK STATUS TAB ══════════════════════ */}
      {tab === 'stock-status' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border overflow-hidden shadow-lg">
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-violet-400 to-blue-400 rounded-t-xl flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-semibold text-white">All Products — Stock Status</h2>
                <p className="text-xs text-blue-100 mt-0.5">{filteredProducts.length} of {products.length} products</p>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {(['all', 'in-stock', 'low', 'out'] as const).map(s => (
                  <button key={s} onClick={() => setStatusFilter(s)}
                    className={`px-2.5 py-1 text-xs rounded-lg border font-medium transition-all ${
                      statusFilter === s
                        ? 'bg-white text-violet-700 border-transparent'
                        : 'border-white/30 text-white/80 hover:bg-white/10 hover:text-white'
                    }`}>
                    {s === 'all' ? 'All' : s === 'in-stock' ? 'In Stock' : s === 'low' ? 'Low Stock' : 'Out of Stock'}
                  </button>
                ))}
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/60" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search product, SKU…"
                    className="pl-8 pr-3 py-1.5 text-xs bg-white/15 border border-white/25 text-white placeholder:text-white/50 rounded-lg w-48 focus:outline-none focus:ring-2 focus:ring-white/30 backdrop-blur-sm" />
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-100 text-[11px] text-gray-600 uppercase tracking-wide shadow-[0_2px_6px_rgba(0,0,0,0.08)]">
                  <tr>
                    <th className="px-4 py-3 text-left"><SortBtn k="name" label="Product" /></th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-right"><SortBtn k="stock" label="Stock Qty" /></th>
                    <th className="px-4 py-3 text-right">Reorder At</th>
                    <th className="px-4 py-3 text-right">Cost Price</th>
                    <th className="px-4 py-3 text-right">Selling Price</th>
                    <th className="px-4 py-3 text-right"><SortBtn k="value" label="Stock Value" /></th>
                    <th className="px-4 py-3 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 text-sm">
                  {loading ? (
                    <tr><td colSpan={8} className="text-center py-12"><Loader2 size={20} className="animate-spin mx-auto text-gray-300" /></td></tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr><td colSpan={8} className="text-center py-16 text-sm text-gray-400">No products found</td></tr>
                  ) : filteredProducts.map((p, i) => {
                    const qty = p.stockQuantity ?? 0
                    const val = qty * (p.costPrice ?? p.sellingPrice ?? 0)
                    const status = qty <= 0
                      ? { label: 'Out of Stock', cls: 'bg-red-100 text-red-600' }
                      : qty <= (p.reorderPoint ?? 5)
                        ? { label: 'Low Stock',   cls: 'bg-amber-100 text-amber-700' }
                        : { label: 'In Stock',    cls: 'bg-emerald-100 text-emerald-700' }
                    return (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 truncate max-w-[200px]">{p.name}</p>
                          {p.sku && <p className="text-xs text-gray-400">{p.sku}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.category?.name ?? '—'}</span>
                        </td>
                        <td className={`px-4 py-3 text-right font-bold ${qty <= 0 ? 'text-red-600' : qty <= (p.reorderPoint ?? 5) ? 'text-amber-600' : 'text-gray-900'}`}>{qty}</td>
                        <td className="px-4 py-3 text-right text-gray-400">{p.reorderPoint ?? 5}</td>
                        <td className="px-4 py-3 text-right text-gray-600">₹{Number(p.costPrice ?? 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right text-gray-700">₹{Number(p.sellingPrice ?? 0).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-3 text-right font-medium text-gray-900">₹{val.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${status.cls}`}>{status.label}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {filteredProducts.length > 0 && (
                  <tfoot>
                    <tr className="bg-gray-50 font-semibold border-t">
                      <td className="px-4 py-3 text-sm" colSpan={6}>Total Stock Value</td>
                      <td className="px-4 py-3 text-right text-sm text-indigo-700">
                        ₹{filteredProducts.reduce((s, p) => s + ((p.stockQuantity ?? 0) * (p.costPrice ?? p.sellingPrice ?? 0)), 0)
                          .toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════ ADJUSTMENTS TAB ══════════════════════ */}
      {tab === 'adjustments' && (
        <div className="space-y-5">
          {adjustments.length > 0 && (() => {
            const addQty = adjustments.filter(a => (a.quantity ?? 0) > 0).reduce((s, a) => s + (a.quantity ?? 0), 0)
            const subQty = adjustments.filter(a => (a.quantity ?? 0) < 0).reduce((s, a) => s + Math.abs(a.quantity ?? 0), 0)
            return (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: 'Total Adjustments', value: adjTotal.toString(),                                      color: '#3b82f6', icon: <History size={18} />      },
                  { label: 'Stock Added',        value: `+${addQty}`,                                             color: '#10b981', icon: <TrendingUp size={18} />   },
                  { label: 'Stock Reduced',      value: `-${subQty}`,                                             color: '#f43f5e', icon: <TrendingDown size={18} /> },
                  { label: 'Net Change',         value: (addQty - subQty) >= 0 ? `+${addQty - subQty}` : `${addQty - subQty}`, color: '#f59e0b', icon: <Boxes size={18} /> },
                ].map((c, i) => (
                  <div key={i} className="bg-white rounded-xl p-5 shadow-[0_2px_16px_0_rgba(0,0,0,0.07)] border border-gray-100">
                    <div className="flex items-start justify-between mb-4">
                      <div className="inline-flex p-2.5 rounded-xl" style={{ backgroundColor: c.color + '1a', color: c.color }}>{c.icon}</div>
                    </div>
                    <p className="text-2xl font-bold text-gray-900">{c.value}</p>
                    <p className="text-sm font-medium text-gray-600 mt-0.5">{c.label}</p>
                  </div>
                ))}
              </div>
            )
          })()}

          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-violet-400 to-blue-400 rounded-t-xl">
              <h2 className="text-sm font-semibold text-white">Stock Adjustment History</h2>
              {adjTotal > 0 && <p className="text-xs text-blue-100 mt-0.5">{adjTotal} adjustments in this period</p>}
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
            ) : adjustments.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-300 gap-2">
                <History size={36} /><p className="text-sm text-gray-400">No adjustments in this period</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 text-[11px] text-gray-600 uppercase tracking-wide shadow-[0_2px_6px_rgba(0,0,0,0.08)]">
                      <tr>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">Product</th>
                        <th className="px-4 py-3 text-center">Type</th>
                        <th className="px-4 py-3 text-right">Qty Change</th>
                        <th className="px-4 py-3 text-right">New Stock</th>
                        <th className="px-4 py-3 text-left">Reason</th>
                        <th className="px-4 py-3 text-left">By</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {adjustments.map((adj: any, i) => {
                        const qty = adj.quantity ?? adj.quantityChange ?? 0
                        return (
                          <tr key={i} className="hover:bg-gray-50">
                            <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                              {adj.createdAt ? new Date(adj.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                            </td>
                            <td className="px-4 py-3">
                              <p className="text-sm font-medium text-gray-900">{adj.productName ?? adj.product?.name ?? '—'}</p>
                              {(adj.sku ?? adj.product?.sku) && <p className="text-xs text-gray-400">{adj.sku ?? adj.product?.sku}</p>}
                            </td>
                            <td className="px-4 py-3 text-center">
                              <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                                qty > 0 ? 'bg-emerald-100 text-emerald-700' : qty < 0 ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'
                              }`}>
                                {adj.adjustmentType ?? (qty > 0 ? 'STOCK IN' : qty < 0 ? 'STOCK OUT' : 'ADJUST')}
                              </span>
                            </td>
                            <td className={`px-4 py-3 text-right text-sm font-bold ${qty > 0 ? 'text-emerald-600' : qty < 0 ? 'text-red-600' : 'text-gray-500'}`}>
                              {qty > 0 ? `+${qty}` : qty}
                            </td>
                            <td className="px-4 py-3 text-right text-sm text-gray-700">{adj.newQuantity ?? adj.stockAfter ?? '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500 max-w-[160px] truncate">{adj.reason ?? adj.notes ?? '—'}</td>
                            <td className="px-4 py-3 text-sm text-gray-500">{adj.adjustedBy ?? adj.createdBy?.name ?? '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                {adjTotalPages > 1 && (
                  <div className="flex items-center justify-between px-5 py-3 border-t bg-gray-50">
                    <p className="text-xs text-gray-500">Page {adjPage + 1} of {adjTotalPages}</p>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setAdjPage(p => Math.max(0, p - 1))} disabled={adjPage === 0}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40"><ChevronLeft size={14} /></button>
                      <button onClick={() => setAdjPage(p => Math.min(adjTotalPages - 1, p + 1))} disabled={adjPage >= adjTotalPages - 1}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40"><ChevronRight size={14} /></button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════ TRANSFERS TAB ══════════════════════ */}
      {tab === 'transfers' && (
        <div className="space-y-5">
          <div className="bg-white rounded-xl border overflow-hidden">
            <div className="px-5 py-3 bg-gradient-to-r from-violet-400 to-blue-400 rounded-t-xl">
              <h2 className="text-sm font-semibold text-white">Stock Transfers</h2>
              {transfers.length > 0 && <p className="text-xs text-blue-100 mt-0.5">{transfers.length} transfers</p>}
            </div>
            {loading ? (
              <div className="flex items-center justify-center h-48"><Loader2 size={24} className="animate-spin text-gray-300" /></div>
            ) : transfers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-gray-300 gap-2">
                <ArrowLeftRight size={36} /><p className="text-sm text-gray-400">No transfers found</p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-100 text-[11px] text-gray-600 uppercase tracking-wide shadow-[0_2px_6px_rgba(0,0,0,0.08)]">
                      <tr>
                        <th className="px-4 py-3 text-left">Date</th>
                        <th className="px-4 py-3 text-left">From Outlet</th>
                        <th className="px-4 py-3 text-left">To Outlet</th>
                        <th className="px-4 py-3 text-center">Items</th>
                        <th className="px-4 py-3 text-center">Status</th>
                        <th className="px-4 py-3 text-left">Notes</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {transfers.map((t: any, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                            {t.createdAt ? new Date(t.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700">{t.fromOutlet?.name ?? t.fromOutletId ?? '—'}</td>
                          <td className="px-4 py-3 text-sm text-gray-700">{t.toOutlet?.name ?? t.toOutletId ?? '—'}</td>
                          <td className="px-4 py-3 text-center text-sm text-gray-700">{t.items?.length ?? 0}</td>
                          <td className="px-4 py-3 text-center">
                            <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                              t.status === 'COMPLETED' || t.status === 'RECEIVED' ? 'bg-emerald-100 text-emerald-700' :
                              t.status === 'PENDING'    ? 'bg-amber-100 text-amber-700' :
                              t.status === 'IN_TRANSIT' ? 'bg-blue-100 text-blue-700'  :
                              'bg-gray-100 text-gray-500'
                            }`}>
                              {t.status ?? 'PENDING'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400 max-w-[160px] truncate">{t.notes ?? '—'}</td>
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
                      <button onClick={() => setTxPage(p => Math.min(txTotalPages - 1, p + 1))} disabled={txPage >= txTotalPages - 1}
                        className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40"><ChevronRight size={14} /></button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
