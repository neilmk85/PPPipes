import { useState, useMemo, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Search, ArrowUpDown, ArrowRight, Truck, Package, ShoppingBag, ChevronLeft, ChevronRight, Calendar, ChevronDown, X, Download } from 'lucide-react'
import { inventoryApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import AdjustStockModal from './AdjustStockModal'
import { Link } from 'react-router-dom'

// ── Date helpers ──────────────────────────────────────────────────────────────
function isoDate(d: Date) { return d.toISOString().split('T')[0] }
function nAgo(n: number)  { const d = new Date(); d.setDate(d.getDate() - n); return isoDate(d) }
function startOf(unit: 'month' | 'quarter' | 'year', d = new Date()) {
  const r = new Date(d)
  if      (unit === 'month')   r.setDate(1)
  else if (unit === 'quarter') r.setMonth(Math.floor(r.getMonth() / 3) * 3, 1)
  else                         r.setMonth(0, 1)
  r.setHours(0, 0, 0, 0)
  return r
}
function dmy(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

const PRESETS = [
  { label: 'Today',        from: () => isoDate(new Date()),           to: () => isoDate(new Date()) },
  { label: 'Last 7d',      from: () => nAgo(6),                       to: () => isoDate(new Date()) },
  { label: 'Last 30d',     from: () => nAgo(29),                      to: () => isoDate(new Date()) },
  { label: 'This Month',   from: () => isoDate(startOf('month')),     to: () => isoDate(new Date()) },
  { label: 'This Quarter', from: () => isoDate(startOf('quarter')),   to: () => isoDate(new Date()) },
  { label: 'This Year',    from: () => isoDate(startOf('year')),      to: () => isoDate(new Date()) },
]

function CustomRangePicker({ fromDate, toDate, onChange }: {
  fromDate: string; toDate: string; onChange: (f: string, t: string) => void
}) {
  const [open, setOpen]       = useState(false)
  const [tmpFrom, setTmpFrom] = useState(fromDate)
  const [tmpTo,   setTmpTo]   = useState(toDate)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  const presetActive = PRESETS.some(p => fromDate === p.from() && toDate === p.to())
  const customActive = !presetActive && !!(fromDate || toDate)

  function openPicker() { setTmpFrom(fromDate); setTmpTo(toDate); setOpen(true) }
  function apply()      { onChange(tmpFrom, tmpTo); setOpen(false) }
  function clear()      { setTmpFrom(''); setTmpTo(''); onChange('', ''); setOpen(false) }

  return (
    <div className="relative" ref={ref}>
      <button onClick={openPicker}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-xl border transition-colors ${
          customActive
            ? 'bg-white text-violet-700 border-white shadow-sm'
            : 'border-white/30 text-white/80 hover:text-white hover:bg-white/10'
        }`}>
        <Calendar size={12} />
        {customActive ? `${dmy(fromDate)} – ${dmy(toDate)}` : 'Custom'}
        {customActive
          ? <X size={11} className="ml-0.5 opacity-70 hover:opacity-100" onClick={e => { e.stopPropagation(); clear() }} />
          : <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        }
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 p-4 w-64">
          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-3">Custom Range</p>
          <div className="space-y-3">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">From</label>
              <input type="date" value={tmpFrom} onChange={e => setTmpFrom(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800" />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">To</label>
              <input type="date" value={tmpTo} onChange={e => setTmpTo(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400 text-gray-800" />
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <button onClick={clear}
              className="flex-1 py-1.5 text-xs font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Clear
            </button>
            <button onClick={apply} disabled={!tmpFrom && !tmpTo}
              className="flex-1 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-violet-600 to-blue-600 rounded-xl hover:from-violet-700 hover:to-blue-700 disabled:opacity-40 transition-all">
              Apply
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function fmt(n: any, d = 4) {
  const v = parseFloat(String(n ?? 0))
  if (isNaN(v) || v === 0) return '0'
  return v % 1 === 0 ? v.toLocaleString() : parseFloat(v.toFixed(d)).toLocaleString()
}

function fmt2(n: number) {
  if (Number.isInteger(n)) return n.toLocaleString('en-IN')
  return n.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

// Show stock in both purchase unit (primary) and base unit (secondary)
function fmtN(n: number) {
  const r = Math.round(n * 10) / 10
  return r % 1 === 0 ? r.toLocaleString('en-IN') : r.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

// Returns display info for any inventory record
function getConvInfo(product: any) {
  const baseUom     = product?.unitOfMeasure ?? 'pcs'
  const purchaseUom = product?.purchaseUom   ?? null
  const pFactor     = parseFloat(product?.purchaseFactor ?? 1)
  const saleUom     = product?.saleUom       ?? null
  const sFactor     = parseFloat(product?.saleFactor ?? 1)

  // Case A: stored in derived unit (e.g. kg), purchased in whole unit (e.g. bag)
  //   purchaseUom = bag, purchaseFactor = 50 → qty/50 bags / qty kg
  const hasPurchaseConv = !!purchaseUom && pFactor > 1 && purchaseUom !== baseUom

  // Case B: stored in count (e.g. nos), weight derived via saleFactor
  //   unitOfMeasure = nos, saleUom = kg, saleFactor = 50 → qty nos / qty×50 kg
  const hasWeightConv   = !!saleUom && sFactor > 1 && saleUom !== baseUom && !hasPurchaseConv

  return { baseUom, purchaseUom, pFactor, saleUom, sFactor, hasPurchaseConv, hasWeightConv }
}

function StockDisplay({ inv }: { inv: any }) {
  const product = inv.product
  const qty     = parseFloat(inv.quantityOnHand ?? 0)
  const { baseUom, purchaseUom, pFactor, saleUom, sFactor, hasPurchaseConv, hasWeightConv } = getConvInfo(product)

  // Case A: e.g. stored in kg, purchase unit = bag → show bags / kg
  if (hasPurchaseConv) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-sm font-bold text-gray-900">
          {fmtN(qty / pFactor)}{' '}
          <span className="text-xs font-semibold text-indigo-600">{purchaseUom}</span>
        </span>
        <span className="text-xs text-gray-400 font-medium">{fmt2(qty)} {baseUom}</span>
      </div>
    )
  }

  // Case B: e.g. stored in nos, weight per unit via saleFactor → show nos / kg
  if (hasWeightConv) {
    return (
      <div className="flex flex-col items-end gap-0.5">
        <span className="text-sm font-bold text-gray-900">
          {fmtN(qty)}{' '}
          <span className="text-xs font-semibold text-indigo-600">{baseUom}</span>
        </span>
        <span className="text-xs text-gray-400 font-medium">{fmt2(qty * sFactor)} {saleUom}</span>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-end">
      <span className="text-sm font-bold text-gray-900">
        {fmt2(qty)} <span className="text-xs font-normal text-gray-500">{baseUom}</span>
      </span>
    </div>
  )
}

type TabKey = 'raw_material' | 'finished_pipe' | 'store_material' | 'low'

export default function InventoryPage() {
  const { outletId: authOutletId } = useAuthStore()
  const outletId = authOutletId ?? 1
  const qc = useQueryClient()
  const [search,    setSearch]    = useState('')
  const [tab,       setTab]       = useState<TabKey>('raw_material')
  const [adjusting, setAdjusting] = useState<any>(null)
  const [page,      setPage]      = useState(0)
  const [pageSize,  setPageSize]  = useState(20)
  const [from,      setFrom]      = useState('')
  const [to,        setTo]        = useState('')
  const [exporting, setExporting] = useState(false)

  const toArr = (d: any): any[] =>
    Array.isArray(d) ? d : (d?.content ?? d?.items ?? [])

  const { data: allInventory, isLoading: allLoading, refetch: refetchAll } = useQuery({
    queryKey: ['inventory', 'all', outletId],
    queryFn: () => inventoryApi.getAllByOutlet(outletId, undefined, 0, 500).then(r => toArr(r.data.data)),
  })

  const { data: rawMaterials, refetch: refetchRaw } = useQuery({
    queryKey: ['inventory', 'RAW_MATERIAL', outletId],
    queryFn: () => inventoryApi.getAllByOutlet(outletId, 'RAW_MATERIAL', 0, 500).then(r => toArr(r.data.data)),
  })

  const { data: finishedPipes, refetch: refetchPipes } = useQuery({
    queryKey: ['inventory', 'FINISHED_PIPE', outletId],
    queryFn: () => inventoryApi.getAllByOutlet(outletId, 'FINISHED_PIPE', 0, 500).then(r => toArr(r.data.data)),
  })

  const { data: storeMaterials, refetch: refetchStore } = useQuery({
    queryKey: ['inventory', 'STORE_MATERIAL', outletId],
    queryFn: () => inventoryApi.getAllByOutlet(outletId, 'STORE_MATERIAL', 0, 500).then(r => toArr(r.data.data)),
  })

  const { data: lowStock, refetch: refetchLow } = useQuery({
    queryKey: ['inventory', 'low-stock', outletId],
    queryFn: () => inventoryApi.getLowStock(outletId).then(r => toArr(r.data.data)),
  })

  const filtered = useMemo(() => {
    let source: any[]
    if      (tab === 'raw_material')   source = rawMaterials   ?? []
    else if (tab === 'finished_pipe')  source = finishedPipes  ?? []
    else if (tab === 'store_material') source = storeMaterials ?? []
    else                               source = lowStock        ?? []
    const sortByStock = (arr: any[]) => [...arr].sort((a, b) => {
      const aQty = Number(a.quantityOnHand ?? 0)
      const bQty = Number(b.quantityOnHand ?? 0)
      if ((aQty > 0) !== (bQty > 0)) return aQty > 0 ? -1 : 1
      return 0
    })
    if (!search.trim()) return tab === 'finished_pipe' ? sortByStock(source) : source
    const q = search.toLowerCase()
    const result = source.filter((inv: any) =>
      inv.product?.name?.toLowerCase().includes(q) ||
      inv.product?.sku?.toLowerCase().includes(q)
    )
    return tab === 'finished_pipe' ? sortByStock(result) : result
  }, [tab, allInventory, rawMaterials, finishedPipes, storeMaterials, lowStock, search])

  const totalPages   = Math.ceil(filtered.length / pageSize)
  const displayItems = filtered.slice(page * pageSize, (page + 1) * pageSize)

  const handleExport = () => {
    setExporting(true)
    try {
      const headers = ['Product', 'SKU', 'Category', 'On Hand', 'Unit', 'Purchase UoM', 'Purchase Qty', 'Reorder Level', 'Status']
      const rows = filtered.map((inv: any) => {
        const product  = inv.product
        const qty      = parseFloat(inv.quantityOnHand ?? 0)
        const baseUom  = product?.unitOfMeasure ?? 'pcs'
        const purUom   = product?.purchaseUom ?? ''
        const factor   = parseFloat(product?.purchaseFactor ?? 1)
        const purQty   = purUom && factor > 1 && purUom !== baseUom ? (qty / factor).toFixed(2) : ''
        const reorder  = product?.reorderLevel ?? 10
        const status   = qty <= reorder ? 'Low Stock' : 'OK'
        return [
          product?.name ?? '',
          product?.sku ?? '',
          product?.category ?? '',
          qty,
          baseUom,
          purUom,
          purQty,
          reorder,
          status,
        ]
      })
      const csv = [headers, ...rows]
        .map(r => r.map(v => { const s = String(v ?? ''); return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s }).join(','))
        .join('\n')
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }))
      const a = document.createElement('a'); a.href = url; a.download = `inventory_${new Date().toISOString().slice(0,10)}.csv`; a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  // Stats
  const totalProducts    = allInventory?.length ?? 0
  const rawMatCount      = rawMaterials?.length ?? 0
  const pipesCount       = finishedPipes?.length ?? 0
  const storeMatCount    = storeMaterials?.length ?? 0
  const lowStockCount    = lowStock?.length ?? 0
  const withConversion = useMemo(() =>
    (allInventory ?? []).filter((i: any) => {
      const { hasPurchaseConv, hasWeightConv } = getConvInfo(i.product)
      return hasPurchaseConv || hasWeightConv
    }).length
  , [allInventory])

  return (
    <div className="min-h-full bg-gray-50/60 p-6 space-y-6">

      {/* ── Hero Header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 shadow-[0_8px_40px_rgba(109,40,217,0.30)]">

        {/* Title row */}
        <div className="relative flex items-center justify-between gap-4 px-8 py-5">
          <div className="flex items-center gap-5 shrink-0">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <Package size={22} className="text-amber-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Stock</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Inventory</h1>
              <p className="text-sm text-blue-200 mt-0.5">Real-time stock levels · base units with purchase-unit equivalent</p>
            </div>
          </div>
          <div className="flex items-center gap-2 min-w-0">
            {/* Search */}
            <div className="relative w-56">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50 pointer-events-none" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(0) }}
                placeholder="Search products…"
                className="w-full pl-8 pr-7 py-2 text-xs bg-white/15 border border-white/25 rounded-xl text-white placeholder-white/50 focus:outline-none focus:bg-white/20 transition-colors"
              />
              {search && (
                <button onClick={() => { setSearch(''); setPage(0) }} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors">
                  <X size={12} />
                </button>
              )}
            </div>
            {/* Export CSV */}
            <button onClick={handleExport} disabled={exporting || filtered.length === 0}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-amber-900 px-3.5 py-2 rounded-xl text-xs font-semibold disabled:opacity-60 transition-all shadow-sm whitespace-nowrap">
              <Download size={13} />
              {exporting ? 'Exporting…' : 'Export CSV'}
            </button>
            {/* Bulk Purchase */}
            <Link
              to="/inventory/bulk-purchase"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 border border-white/25 text-white text-xs font-semibold rounded-xl backdrop-blur-sm hover:bg-white/25 transition-all whitespace-nowrap"
            >
              <ShoppingBag size={14} />
              Bulk Purchase
            </Link>
          </div>
        </div>

        {/* Tabs + date filter strip */}
        <div className="relative flex items-center justify-between gap-3 px-6 pb-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-white/10 rounded-xl p-1 backdrop-blur-sm">
            {([
              { key: 'raw_material',   label: `Raw Materials (${rawMatCount})`   },
              { key: 'finished_pipe',  label: `Pipes (${pipesCount})`            },
              { key: 'store_material', label: `Store Material (${storeMatCount})` },
              { key: 'low',            label: `Low Stock (${lowStockCount})`     },
            ] as { key: TabKey; label: string }[]).map(t => (
              <button key={t.key} onClick={() => { setTab(t.key); setPage(0) }}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  tab === t.key
                    ? 'bg-white text-violet-700 shadow-sm'
                    : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Date filters */}
          <div className="flex items-center gap-1 bg-white/10 rounded-xl p-1 backdrop-blur-sm">
            {PRESETS.map(p => {
              const active = from === p.from() && to === p.to()
              return (
                <button key={p.label} onClick={() => { setFrom(p.from()); setTo(p.to()) }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    active ? 'bg-white text-violet-700 shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'
                  }`}>
                  {p.label}
                </button>
              )
            })}
            <CustomRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative border-t border-white/10 grid grid-cols-4 divide-x divide-white/10">
          {[
            { label: 'Raw Materials',  value: rawMatCount,    sub: 'input materials',  warn: false },
            { label: 'PCCP Pipes',     value: pipesCount,     sub: 'finished goods',   warn: false },
            { label: 'Store Material', value: storeMatCount,  sub: 'store items',  warn: false },
            { label: 'Low Stock',      value: lowStockCount,  sub: 'need reorder', warn: true  },
          ].map(s => (
            <div key={s.label} className="px-5 py-3.5">
              <p className={`text-xl font-extrabold tabular-nums leading-none ${s.warn && s.value > 0 ? 'text-amber-300' : 'text-white'}`}>{s.value}</p>
              <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      <div>
        {/* Table */}
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
                <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Product</th>
                <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Unit Config</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">On Hand</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Reorder Level</th>
                <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Status</th>
                <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {allLoading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-gray-400">Loading inventory…</td>
                </tr>
              ) : displayItems.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <Package size={28} className="text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">No items found</p>
                  </td>
                </tr>
              ) : displayItems.map((inv: any) => {
                const product  = inv.product
                const qty      = parseFloat(inv.quantityOnHand ?? 0)
                const reorder  = product?.reorderLevel ?? 10
                const isLow    = qty <= reorder
                const { baseUom, purchaseUom, pFactor, saleUom, sFactor, hasPurchaseConv, hasWeightConv } = getConvInfo(product)
                const hasConv  = hasPurchaseConv || hasWeightConv

                return (
                  <tr key={inv.id} className={`hover:bg-violet-50/40 transition-colors ${tab === 'low' && isLow ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-sm text-gray-900">{product?.name}</p>
                      <p className="text-xs text-gray-400">{product?.sku}</p>
                    </td>

                    {/* Unit config */}
                    <td className="px-4 py-3">
                      {hasPurchaseConv ? (
                        // e.g. bag → kg (purchase in bag, stock in kg)
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <span className="text-[11px] bg-blue-50 text-blue-700 font-semibold px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Truck size={9} /> {purchaseUom}
                          </span>
                          <ArrowRight size={10} className="text-gray-300" />
                          <span className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-md">
                            {baseUom}
                          </span>
                        </div>
                      ) : hasWeightConv ? (
                        // e.g. nos with weight → nos + kg equivalent
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          <span className="text-[11px] bg-indigo-50 text-indigo-700 font-semibold px-2 py-0.5 rounded-md">
                            1 {baseUom}
                          </span>
                          <ArrowRight size={10} className="text-gray-300" />
                          <span className="text-[11px] bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-md">
                            {sFactor} {saleUom}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-400 block text-center">—</span>
                      )}
                    </td>

                    {/* On hand - dual units */}
                    <td className="px-4 py-3 text-right">
                      <StockDisplay inv={inv} />
                    </td>

                    <td className="px-4 py-3 text-right">
                      {hasPurchaseConv ? (
                        // e.g. reorder = 500 kg → 10 bag / 500 kg
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-semibold text-gray-700">
                            {fmtN(reorder / pFactor)}{' '}
                            <span className="text-xs font-normal text-indigo-500">{purchaseUom}</span>
                          </span>
                          <span className="text-xs text-gray-400">{fmt2(reorder)} {baseUom}</span>
                        </div>
                      ) : hasWeightConv ? (
                        // e.g. reorder = 10 nos → 10 nos / 500 kg
                        <div className="flex flex-col items-end gap-0.5">
                          <span className="text-sm font-semibold text-gray-700">
                            {fmtN(reorder)}{' '}
                            <span className="text-xs font-normal text-indigo-500">{baseUom}</span>
                          </span>
                          <span className="text-xs text-gray-400">{fmt2(reorder * sFactor)} {saleUom}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-600">
                          {reorder} <span className="text-xs text-gray-400">{baseUom}</span>
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-center">
                      {isLow ? (
                        <span className="inline-flex items-center gap-1 text-xs text-red-600 bg-red-50 px-2 py-1 rounded-full font-medium">
                          <AlertTriangle size={10} /> Low Stock
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full font-medium">
                          OK
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setAdjusting(inv)}
                        className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center gap-1 ml-auto bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                        <ArrowUpDown size={12} /> Adjust
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {filtered.length > 0 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
              <div className="flex items-center gap-2">
                <p className="text-xs text-gray-500">
                  {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length} items
                </p>
                <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}
                  className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300">
                  {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
                </select>
              </div>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(0, Math.min(page - 2, totalPages - 5))
                    const p = start + i
                    return (
                      <button key={p} onClick={() => setPage(p)}
                        className={`w-7 h-7 rounded-lg text-xs font-medium transition-colors ${
                          p === page ? 'bg-indigo-600 text-white' : 'border border-gray-200 text-gray-600 hover:bg-white'
                        }`}>
                        {p + 1}
                      </button>
                    )
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Legend */}
        {withConversion > 0 && (
          <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
            <span className="font-medium text-gray-600">Legend:</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-400"></span> Purchase unit</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-indigo-400"></span> Base / stock unit</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400"></span> Sale unit</span>
          </div>
        )}
      </div>

      {adjusting && (
        <AdjustStockModal
          inventory={adjusting}
          onClose={() => setAdjusting(null)}
          onSaved={(newReorderLevel?: number) => {
            setAdjusting(null)

            if (newReorderLevel !== undefined) {
              // Reorder level changed — patch the cache directly so the table updates instantly
              const invId = adjusting.id
              // patch product.reorderLevel — that is the single source of truth
              const patch = (list: any[] | undefined) =>
                list?.map(inv => inv.id === invId
                  ? { ...inv, reorderLevel: newReorderLevel, product: { ...inv.product, reorderLevel: newReorderLevel } }
                  : inv
                )

              qc.setQueryData(['inventory', 'all',           outletId], patch)
              qc.setQueryData(['inventory', 'RAW_MATERIAL',  outletId], patch)
              qc.setQueryData(['inventory', 'FINISHED_PIPE', outletId], patch)
              qc.setQueryData(['inventory', 'low-stock',     outletId], patch)
            } else {
              // Stock quantity changed — refetch everything
              refetchAll()
              refetchRaw()
              refetchPipes()
              refetchStore()
              refetchLow()
            }
          }}
        />
      )}
    </div>
  )
}
