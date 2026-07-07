import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Package, Download, Search, AlertTriangle, TrendingUp, Boxes, X, BarChart2 } from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, ResponsiveContainer } from 'recharts'
import { reportApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { DateRangePicker } from '@/components/DateRangePicker'

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockRow {
  productId: number
  productName: string
  category: string
  uom: string
  openingQty: string
  inwardQty: string
  outwardQty: string
  closingQty: string
  avgCost: string
  closingValue: string
  reorderLevel: number
  isLow: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoDate(d: Date) {
  return d.toISOString().slice(0, 10)
}
function startOf(unit: 'month' | 'year', d = new Date()) {
  const r = new Date(d)
  if (unit === 'month')   { r.setDate(1); r.setHours(0,0,0,0); return r }
  if (unit === 'year')    { r.setMonth(0, 1); r.setHours(0,0,0,0); return r }
  return r
}

function fmtQty(n: string | number): string {
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (isNaN(v)) return '0'
  return v % 1 === 0 ? v.toLocaleString('en-IN') : v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtVal(n: string | number): string {
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (!v || isNaN(v)) return '—'
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseNum(s: string): number { return parseFloat(s) || 0 }

function stockStatus(row: StockRow): 'out' | 'low' | 'ok' {
  const q = parseNum(row.closingQty)
  if (q <= 0) return 'out'
  if (row.isLow) return 'low'
  return 'ok'
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function StockStatementPage() {
  const { outletId } = useAuthStore()
  const [from, setFrom] = useState(isoDate(startOf('month')))
  const [to,   setTo]   = useState(isoDate(new Date()))
  const [search, setSearch]       = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL')
  const [statusFilter, setStatusFilter]     = useState<'ALL' | 'ok' | 'low' | 'out'>('ALL')
  const [sortCol, setSortCol]     = useState<'name' | 'closing' | 'value' | 'inward' | 'outward'>('name')
  const [sortAsc, setSortAsc]     = useState(true)
  const [showChart, setShowChart] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['stock-statement', outletId, from, to],
    queryFn: () => reportApi.getStockStatement(outletId!, from, to),
    enabled: !!outletId,
  })

  const rows: StockRow[] = (data as any)?.data?.data ?? []

  // Categories
  const categories = useMemo(() => {
    const s = new Set(rows.map(r => r.category).filter(Boolean))
    return ['ALL', ...Array.from(s).sort()]
  }, [rows])

  // Filter + sort
  const filtered = useMemo(() => {
    let list = rows.filter(r => {
      if (search.trim()) {
        const q = search.toLowerCase()
        if (!r.productName.toLowerCase().includes(q) && !r.category.toLowerCase().includes(q)) return false
      }
      if (categoryFilter !== 'ALL' && r.category !== categoryFilter) return false
      if (statusFilter !== 'ALL' && stockStatus(r) !== statusFilter) return false
      return true
    })
    list = [...list].sort((a, b) => {
      let cmp = 0
      switch (sortCol) {
        case 'name':    cmp = a.productName.localeCompare(b.productName); break
        case 'closing': cmp = parseNum(a.closingQty) - parseNum(b.closingQty); break
        case 'value':   cmp = parseNum(a.closingValue) - parseNum(b.closingValue); break
        case 'inward':  cmp = parseNum(a.inwardQty) - parseNum(b.inwardQty); break
        case 'outward': cmp = parseNum(a.outwardQty) - parseNum(b.outwardQty); break
      }
      return sortAsc ? cmp : -cmp
    })
    return list
  }, [rows, search, categoryFilter, statusFilter, sortCol, sortAsc])

  // Summary totals
  const totalItems    = filtered.length
  const totalValue    = filtered.reduce((s, r) => s + parseNum(r.closingValue), 0)
  const totalInward   = filtered.reduce((s, r) => s + parseNum(r.inwardQty), 0)
  const totalOutward  = filtered.reduce((s, r) => s + parseNum(r.outwardQty), 0)
  const lowCount      = filtered.filter(r => stockStatus(r) === 'low').length
  const outCount      = filtered.filter(r => stockStatus(r) === 'out').length

  function toggleSort(col: typeof sortCol) {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(true) }
  }

  function SortBtn({ col, children }: { col: typeof sortCol; children: React.ReactNode }) {
    const active = sortCol === col
    return (
      <button onClick={() => toggleSort(col)}
        className={`flex items-center gap-1 text-xs font-semibold uppercase tracking-wide transition-colors ${
          active ? 'text-teal-600' : 'text-gray-400 hover:text-gray-600'
        }`}>
        {children}
        <span className="text-[10px]">{active ? (sortAsc ? '▲' : '▼') : ''}</span>
      </button>
    )
  }

  function exportCSV() {
    const header = ['Product', 'Category', 'UOM', 'Opening Qty', 'Inward Qty', 'Outward Qty', 'Closing Qty', 'Avg Cost (₹)', 'Stock Value (₹)', 'Status']
    const rowsData = filtered.map(r => [
      r.productName, r.category, r.uom,
      fmtQty(r.openingQty), fmtQty(r.inwardQty), fmtQty(r.outwardQty), fmtQty(r.closingQty),
      parseNum(r.avgCost).toFixed(2), parseNum(r.closingValue).toFixed(2),
      stockStatus(r) === 'out' ? 'Out of Stock' : r.isLow ? 'Low Stock' : 'In Stock'
    ])
    const csv = [header, ...rowsData].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
    const a = document.createElement('a'); a.href = url; a.download = `stock-statement-${from}-to-${to}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  const STATUS_BADGE: Record<string, string> = {
    ok:  'bg-emerald-50 text-emerald-700 border-emerald-200',
    low: 'bg-amber-50 text-amber-700 border-amber-200',
    out: 'bg-red-50 text-red-700 border-red-200',
  }
  const STATUS_LABEL: Record<string, string> = { ok: 'In Stock', low: 'Low', out: 'Out' }

  return (
    <div className="min-h-screen bg-gray-50 font-inter">

      {/* ── Header ── */}
      <div className="bg-gradient-to-br from-teal-700 via-teal-600 to-emerald-600 px-6 pt-8 pb-6">

          {/* Title + Export */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                <Package size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Stock Statement</h1>
                <p className="text-teal-200 text-sm mt-0.5">Opening · Inward · Outward · Closing balance</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DateRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
              <button onClick={() => setShowChart(v => !v)}
                className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 text-white text-sm font-semibold rounded-xl transition-all">
                <BarChart2 size={15} />{showChart ? 'Hide Chart' : 'Show Chart'}
              </button>
              <button onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 text-white text-sm font-semibold rounded-xl transition-all">
                <Download size={15} />Export CSV
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-white/15 backdrop-blur rounded-2xl border border-white/20 p-4">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-1">Total Items</p>
              <p className="text-white text-xl font-bold">{totalItems}</p>
              <p className="text-white/50 text-xs mt-1">in filtered view</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl border border-white/20 p-4">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-1">Stock Value</p>
              <p className="text-white text-xl font-bold">{fmtVal(totalValue)}</p>
              <p className="text-white/50 text-xs mt-1">closing × avg cost</p>
            </div>
            <div className="bg-amber-400/20 backdrop-blur rounded-2xl border border-amber-300/30 p-4">
              <p className="text-amber-200 text-xs font-semibold uppercase tracking-wide mb-1">Low Stock</p>
              <p className="text-white text-xl font-bold">{lowCount}</p>
              <p className="text-amber-200/70 text-xs mt-1">below reorder level</p>
            </div>
            <div className="bg-red-400/20 backdrop-blur rounded-2xl border border-red-300/30 p-4">
              <p className="text-red-200 text-xs font-semibold uppercase tracking-wide mb-1">Out of Stock</p>
              <p className="text-white text-xl font-bold">{outCount}</p>
              <p className="text-red-200/70 text-xs mt-1">zero or negative qty</p>
            </div>
          </div>
      </div>

      {/* ── Filters + Table ── */}
      <div className="px-6 py-6">

        {showChart && filtered.length > 0 && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 mb-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Stock Levels — Closing Qty by Product</h3>
            <ResponsiveContainer width="100%" height={Math.max(200, Math.min(filtered.slice(0,20).length * 28, 520))}>
              <BarChart
                layout="vertical"
                data={filtered.slice(0, 20).map(r => ({
                  name: r.productName.length > 28 ? r.productName.slice(0, 28) + '…' : r.productName,
                  closing: parseNum(r.closingQty),
                  reorder: r.reorderLevel || 0,
                  status: stockStatus(r),
                }))}
                margin={{ top: 4, right: 40, left: 160, bottom: 4 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={155} />
                <Tooltip formatter={(val: any) => [Number(val).toLocaleString('en-IN'), '']} />
                <Bar dataKey="closing" name="Closing Qty" radius={[0,4,4,0]}>
                  {filtered.slice(0, 20).map((r, i) => (
                    <Cell key={i} fill={stockStatus(r) === 'out' ? '#ef4444' : stockStatus(r) === 'low' ? '#f59e0b' : '#10b981'} />
                  ))}
                </Bar>
                <Bar dataKey="reorder" name="Reorder Level" fill="#e5e7eb" radius={[0,4,4,0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-emerald-500 inline-block"/>&nbsp;In Stock</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-amber-400 inline-block"/>&nbsp;Low Stock</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-red-500 inline-block"/>&nbsp;Out of Stock</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm bg-gray-200 inline-block"/>&nbsp;Reorder Level</span>
            </div>
          </div>
        )}

        {/* Filter bar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-5">
          <div className="flex flex-wrap items-center gap-3">

            {/* Search */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search product or category…"
                className="pl-9 pr-9 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-teal-200 focus:border-teal-400 focus:outline-none w-64" />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="h-5 w-px bg-gray-200" />

            {/* Category */}
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none bg-white">
              {categories.map(c => (
                <option key={c} value={c}>{c === 'ALL' ? 'All Categories' : c}</option>
              ))}
            </select>

            <div className="h-5 w-px bg-gray-200" />

            {/* Status filter */}
            {(['ALL', 'ok', 'low', 'out'] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  statusFilter === s ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
                }`}>
                {s === 'ALL' ? 'All Status' : s === 'ok' ? 'In Stock' : s === 'low' ? 'Low Stock' : 'Out of Stock'}
              </button>
            ))}

            <div className="ml-auto flex items-center gap-2 text-xs text-gray-400">
              <TrendingUp size={13} className="text-teal-500" />
              <span>In: <span className="font-semibold text-teal-600">{fmtQty(totalInward)}</span></span>
              <span className="text-gray-300">|</span>
              <span>Out: <span className="font-semibold text-rose-500">{fmtQty(totalOutward)}</span></span>
            </div>
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[2fr_1fr_64px_100px_100px_100px_110px_110px_120px_88px] px-4 py-2 mb-1 gap-2">
          <SortBtn col="name">Product</SortBtn>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Category</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">UOM</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Opening</span>
          <SortBtn col="inward"><span className="ml-auto">Inward</span></SortBtn>
          <SortBtn col="outward"><span className="ml-auto">Outward</span></SortBtn>
          <SortBtn col="closing"><span className="ml-auto">Closing</span></SortBtn>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-right">Avg Cost</span>
          <SortBtn col="value"><span className="ml-auto">Stock Value</span></SortBtn>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide text-center">Status</span>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <div className="w-8 h-8 border-2 border-teal-200 border-t-teal-500 rounded-full animate-spin mr-3" />
            Loading stock data…
          </div>
        )}

        {/* Empty */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <Boxes size={40} className="mb-3 opacity-30" />
            <p className="font-semibold text-gray-500">No products found</p>
            <p className="text-sm mt-1">Try adjusting your filters or date range</p>
          </div>
        )}

        {/* Rows */}
        {!isLoading && (
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            {filtered.map((row, i) => {
              const st = stockStatus(row)
              return (
                <div key={row.productId}
                  className={`grid grid-cols-[2fr_1fr_64px_100px_100px_100px_110px_110px_120px_88px] px-4 py-3 gap-2 items-center transition-colors hover:bg-gray-50/70 ${
                    i < filtered.length - 1 ? 'border-b border-gray-100' : ''
                  } ${st === 'out' ? 'bg-red-50/30' : st === 'low' ? 'bg-amber-50/20' : ''}`}>

                  {/* Product name */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-800 truncate">{row.productName}</p>
                  </div>

                  {/* Category */}
                  <div>
                    {row.category
                      ? <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{row.category}</span>
                      : <span className="text-xs text-gray-300">—</span>
                    }
                  </div>

                  {/* UOM */}
                  <div className="text-center">
                    <span className="text-xs font-mono text-gray-500 uppercase">{row.uom}</span>
                  </div>

                  {/* Opening */}
                  <div className="text-right">
                    <span className="text-sm text-gray-500 font-mono">{fmtQty(row.openingQty)}</span>
                  </div>

                  {/* Inward */}
                  <div className="text-right">
                    {parseNum(row.inwardQty) > 0
                      ? <span className="text-sm font-semibold text-teal-600 font-mono">+{fmtQty(row.inwardQty)}</span>
                      : <span className="text-gray-300 text-sm">—</span>
                    }
                  </div>

                  {/* Outward */}
                  <div className="text-right">
                    {parseNum(row.outwardQty) > 0
                      ? <span className="text-sm font-semibold text-rose-500 font-mono">−{fmtQty(row.outwardQty)}</span>
                      : <span className="text-gray-300 text-sm">—</span>
                    }
                  </div>

                  {/* Closing */}
                  <div className="text-right">
                    <span className={`text-sm font-bold font-mono ${
                      st === 'out' ? 'text-red-600' : st === 'low' ? 'text-amber-600' : 'text-gray-800'
                    }`}>{fmtQty(row.closingQty)}</span>
                  </div>

                  {/* Avg cost */}
                  <div className="text-right">
                    {parseNum(row.avgCost) > 0
                      ? <span className="text-xs text-gray-500">₹{parseNum(row.avgCost).toLocaleString('en-IN', { maximumFractionDigits: 2 })}</span>
                      : <span className="text-gray-300 text-xs">—</span>
                    }
                  </div>

                  {/* Closing value */}
                  <div className="text-right">
                    {parseNum(row.closingValue) > 0
                      ? <span className="text-sm font-semibold text-gray-700">{fmtVal(row.closingValue)}</span>
                      : <span className="text-gray-300 text-sm">—</span>
                    }
                  </div>

                  {/* Status */}
                  <div className="flex justify-center">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-xs font-semibold ${STATUS_BADGE[st]}`}>
                      {st === 'low' && <AlertTriangle size={10} />}
                      {STATUS_LABEL[st]}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Totals footer */}
        {!isLoading && filtered.length > 0 && (
          <div className="mt-4 grid grid-cols-[2fr_1fr_64px_100px_100px_100px_110px_110px_120px_88px] px-4 py-3 gap-2 items-center bg-gray-50 border border-gray-200 rounded-xl">
            <div className="col-span-3 flex items-center gap-2">
              <span className="text-sm font-bold text-gray-700">Totals</span>
              <span className="text-xs text-gray-400">({filtered.length} items)</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-gray-500 font-mono">{fmtQty(filtered.reduce((s, r) => s + parseNum(r.openingQty), 0))}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-teal-600 font-mono">+{fmtQty(totalInward)}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-rose-500 font-mono">−{fmtQty(totalOutward)}</span>
            </div>
            <div className="text-right">
              <span className="text-sm font-bold text-gray-800 font-mono">{fmtQty(filtered.reduce((s, r) => s + parseNum(r.closingQty), 0))}</span>
            </div>
            <div />
            <div className="text-right">
              <span className="text-sm font-bold text-gray-700">{fmtVal(totalValue)}</span>
            </div>
            <div />
          </div>
        )}
      </div>
    </div>
  )
}
