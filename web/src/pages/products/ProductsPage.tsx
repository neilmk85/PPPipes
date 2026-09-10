import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { Plus, Search, Edit, Trash2, Package, Upload, Download, FileSpreadsheet, FileText, ChevronDown, X, Barcode, ChevronLeft, ChevronRight, Eye } from 'lucide-react'
import toast from 'react-hot-toast'
import { productApi } from '@/services/api'
import { Product } from '@/types'
import ProductImportModal from './ProductImportModal'
import BarcodePrintModal from './BarcodePrintModal'

type ItemTypeTab = 'all' | 'RAW_MATERIAL' | 'FINISHED_PIPE' | 'STORE_MATERIAL'

const ITEM_TYPE_TABS: { key: ItemTypeTab; label: string; color: string; activeColor: string }[] = [
  { key: 'all',            label: 'All',             color: 'text-gray-500',   activeColor: 'bg-gray-900 text-white'    },
  { key: 'RAW_MATERIAL',   label: 'Raw Materials',   color: 'text-amber-600',  activeColor: 'bg-amber-500 text-white'   },
  { key: 'FINISHED_PIPE',  label: 'PCCP Pipes',      color: 'text-violet-600', activeColor: 'bg-violet-600 text-white'  },
  { key: 'STORE_MATERIAL', label: 'Store Materials', color: 'text-teal-600',   activeColor: 'bg-teal-600 text-white'    },
]

export default function ProductsPage() {
  const [search, setSearch] = useState('')
  const [tab, setTab] = useState<ItemTypeTab>('all')
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(20)
  const [showImport, setShowImport] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [printProduct, setPrintProduct] = useState<Product | null>(null)
  const exportRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()
  const qc = useQueryClient()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) setExportOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleExport(format: 'csv' | 'excel') {
    setExportOpen(false)
    setExporting(true)
    try {
      const res = format === 'csv' ? await productApi.exportCsv() : await productApi.exportExcel()
      const ext = format === 'csv' ? 'csv' : 'xlsx'
      const mime = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const url = URL.createObjectURL(new Blob([res.data], { type: mime }))
      const a = document.createElement('a')
      a.href = url
      a.download = `products_export.${ext}`
      a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported as ${ext.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['products'],
    queryFn: () => productApi.getAll({ page: 0, size: 2000 }).then(r => r.data.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => productApi.delete(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['products'] }); toast.success('Product deleted') },
  })

  const products: Product[] = (data?.content || []).filter((p: Product) => p.active)
  const filtered = products.filter(p => {
    const matchesSearch =
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.sku?.includes(search) ||
      p.barcode?.includes(search)
    const matchesTab =
      tab === 'all' ||
      (tab === 'RAW_MATERIAL'   && p.itemType === 'RAW_MATERIAL')   ||
      (tab === 'FINISHED_PIPE'  && p.itemType === 'FINISHED_PIPE')  ||
      (tab === 'STORE_MATERIAL' && p.itemType === 'STORE_MATERIAL')
    return matchesSearch && matchesTab
  })

  const tabCounts = {
    all:            products.length,
    RAW_MATERIAL:   products.filter(p => p.itemType === 'RAW_MATERIAL').length,
    FINISHED_PIPE:  products.filter(p => p.itemType === 'FINISHED_PIPE').length,
    STORE_MATERIAL: products.filter(p => p.itemType === 'STORE_MATERIAL').length,
  }
  const totalPages = Math.ceil(filtered.length / pageSize)
  const paginated = filtered.slice(page * pageSize, (page + 1) * pageSize)

  return (
    <>
      <div className="min-h-full bg-gray-50/60 p-6 space-y-6">

        {/* ── Hero Header ── */}
        <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)]">
          <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
            <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
            <div className="absolute bottom-0 left-1/4 w-64 h-28 rounded-full bg-blue-400/10 blur-3xl" />
            <div className="absolute inset-0 opacity-[0.07]"
              style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          </div>

          <div className="relative flex items-center justify-between px-8 py-6">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
                <Package size={26} className="text-amber-300" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Catalogue</p>
                <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Products</h1>
                <p className="text-sm text-blue-200 mt-0.5">{isLoading ? 'Loading…' : `${filtered.length} of ${products.length} products`}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60 pointer-events-none" />
                <input
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(0) }}
                  placeholder="Search by name, SKU or barcode…"
                  className="pl-9 pr-8 py-2 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-white/40 focus:bg-white/20 focus:border-white/40 focus:outline-none transition-colors w-64"
                />
                {search && (
                  <button onClick={() => { setSearch(''); setPage(0) }}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/60 hover:text-white">
                    <X size={13} />
                  </button>
                )}
              </div>
              <div ref={exportRef} className="relative">
                <button
                  onClick={() => setExportOpen(v => !v)}
                  disabled={exporting}
                  className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium rounded-xl border bg-white/10 border-white/20 text-white/90 hover:bg-white/20 hover:border-white/40 backdrop-blur-sm transition-all disabled:opacity-50"
                >
                  <Download size={14} />
                  {exporting ? 'Exporting…' : 'Export'}
                  <ChevronDown size={12} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
                </button>
                {exportOpen && (
                  <div className="absolute right-0 top-full mt-2 z-50 bg-white rounded-2xl shadow-xl border border-gray-100 w-44 py-1 overflow-hidden">
                    <button onClick={() => handleExport('csv')}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <FileText size={14} className="text-green-500" /> Export as CSV
                    </button>
                    <button onClick={() => handleExport('excel')}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                      <FileSpreadsheet size={14} className="text-emerald-600" /> Export as Excel
                    </button>
                  </div>
                )}
              </div>
              <button
                onClick={() => setShowImport(true)}
                className="inline-flex items-center gap-2 px-3.5 py-2 bg-white/10 border border-white/20 text-white text-sm font-medium rounded-xl backdrop-blur-sm hover:bg-white/20 transition-all"
              >
                <Upload size={14} /> Import
              </button>
              <button
                onClick={() => navigate('/products/new')}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 border border-white/25 text-white text-sm font-semibold rounded-xl backdrop-blur-sm hover:bg-white/25 transition-all"
              >
                <Plus size={16} /> Add Product
              </button>
            </div>
          </div>

          {/* ── Tabs strip embedded in header ── */}
          <div className="relative border-t border-white/10 flex">
            {[
              { key: 'all'            as ItemTypeTab, label: 'All Products',   sub: 'all items',     value: tabCounts.all,            accent: 'bg-white text-gray-900'    },
              { key: 'RAW_MATERIAL'   as ItemTypeTab, label: 'Raw Materials',  sub: 'input stock',   value: tabCounts.RAW_MATERIAL,   accent: 'bg-amber-400 text-amber-900' },
              { key: 'FINISHED_PIPE'  as ItemTypeTab, label: 'PCCP Pipes',     sub: 'finished goods',value: tabCounts.FINISHED_PIPE,  accent: 'bg-violet-300 text-violet-900' },
              { key: 'STORE_MATERIAL' as ItemTypeTab, label: 'Store Materials',sub: 'consumables',   value: tabCounts.STORE_MATERIAL, accent: 'bg-teal-300 text-teal-900'   },
            ].map((t, i, arr) => (
              <button
                key={t.key}
                onClick={() => { setTab(t.key); setPage(0) }}
                className={`relative flex-1 flex items-center gap-4 px-6 py-4 text-left transition-all group
                  ${i < arr.length - 1 ? 'border-r border-white/10' : ''}
                  ${tab === t.key ? 'bg-white/15' : 'hover:bg-white/8'}`}
              >
                {/* active indicator bar at top */}
                {tab === t.key && (
                  <span className="absolute inset-x-0 top-0 h-0.5 bg-white/80 rounded-b" />
                )}
                <div>
                  <p className={`text-2xl font-extrabold tabular-nums leading-none transition-colors ${tab === t.key ? 'text-white' : 'text-white/70 group-hover:text-white/90'}`}>
                    {t.value}
                  </p>
                  <p className={`text-sm font-semibold mt-0.5 transition-colors ${tab === t.key ? 'text-white' : 'text-white/60 group-hover:text-white/80'}`}>
                    {t.label}
                  </p>
                  <p className={`text-[11px] mt-0.5 transition-colors ${tab === t.key ? 'text-blue-200' : 'text-white/35 group-hover:text-white/50'}`}>
                    {t.sub}
                  </p>
                </div>
                {tab === t.key && (
                  <span className={`ml-auto text-xs font-bold px-2 py-1 rounded-lg ${t.accent}`}>
                    active
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Table ── */}
        <div>
          <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
            <table className="w-full">
              <thead>
                <tr style={{ background: 'linear-gradient(to right, #eff6ff 0%, #eef2ff 100%)', borderBottom: '1px solid #dbeafe' }}>
                  <th className="px-6 py-3 text-left   text-[11px] font-bold uppercase tracking-widest" style={{color:'#1f2937'}}>Product</th>
                  <th className="px-6 py-3 text-left   text-[11px] font-bold uppercase tracking-widest" style={{color:'#1f2937'}}>SKU / Barcode</th>
                  <th className="px-6 py-3 text-left   text-[11px] font-bold uppercase tracking-widest" style={{color:'#1f2937'}}>Category</th>
                  <th className="px-6 py-3 text-right  text-[11px] font-bold uppercase tracking-widest" style={{color:'#1f2937'}}>Sell Price</th>
                  <th className="px-6 py-3 text-right  text-[11px] font-bold uppercase tracking-widest" style={{color:'#1f2937'}}>Cost</th>
                  <th className="px-6 py-3 text-center text-[11px] font-bold uppercase tracking-widest" style={{color:'#1f2937'}}>Status</th>
                  <th className="px-6 py-3 text-right  text-[11px] font-bold uppercase tracking-widest" style={{color:'#1f2937'}}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i} className="border-b border-gray-50 animate-pulse">
                      <td className="px-4 py-3.5">
                        <div className="space-y-1.5">
                          <div className="h-3 bg-gray-200 rounded w-32" />
                          <div className="h-2.5 bg-gray-100 rounded w-16" />
                        </div>
                      </td>
                      {[...Array(5)].map((_, j) => (
                        <td key={j} className="px-5 py-3.5">
                          <div className="h-3 bg-gray-100 rounded w-20 ml-auto" />
                        </td>
                      ))}
                      <td />
                    </tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      <div className="flex flex-col items-center justify-center py-20 text-gray-400">
                        <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                          <Package size={26} className="text-gray-300" />
                        </div>
                        <p className="font-semibold text-gray-500">No products found</p>
                        <p className="text-sm mt-1">
                          {search
                            ? 'Try a different search term'
                            : tab === 'RAW_MATERIAL'   ? 'No raw materials added yet'
                            : tab === 'FINISHED_PIPE'  ? 'No PCCP pipes added yet'
                            : tab === 'STORE_MATERIAL' ? 'No store materials added yet'
                            : 'Add your first product to get started'}
                        </p>
                      </div>
                    </td>
                  </tr>
                ) : paginated.map((product, idx) => (
                  <tr
                    key={product.id}
                    onClick={() => navigate(`/products/${product.id}/edit`)}
                    className={`group cursor-pointer hover:bg-gray-50/80 transition-colors ${idx < paginated.length - 1 ? 'border-b border-gray-50' : ''}`}
                  >
                    {/* Product */}
                    <td className="px-4 py-3.5">
                      <p className="text-sm font-semibold text-gray-800 leading-tight">{product.name}</p>
                      {product.unitOfMeasure && (
                        <p className="text-xs text-gray-400 mt-0.5">{product.unitOfMeasure}</p>
                      )}
                    </td>

                    {/* SKU / Barcode */}
                    <td className="px-4 py-3.5">
                      {product.sku
                        ? <p className="text-xs font-mono font-medium text-gray-600">{product.sku}</p>
                        : <p className="text-xs text-gray-300">—</p>
                      }
                      {product.barcode && (
                        <p className="text-xs font-mono text-gray-400 mt-0.5">{product.barcode}</p>
                      )}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3.5">
                      {product.itemType === 'RAW_MATERIAL'   && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-amber-50 text-amber-700">Raw Material</span>}
                      {product.itemType === 'FINISHED_PIPE'  && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-violet-50 text-violet-700">PCCP Pipes</span>}
                      {product.itemType === 'STORE_MATERIAL' && <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-teal-50 text-teal-700">Store Material</span>}
                      {(!product.itemType || product.itemType === 'GENERAL') && <span className="text-xs text-gray-300">No Category</span>}
                    </td>

                    {/* Sell Price */}
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm font-bold text-gray-900">₹{product.sellingPrice}</span>
                    </td>

                    {/* Cost */}
                    <td className="px-4 py-3.5 text-right">
                      <span className="text-sm text-gray-400">
                        {product.costPrice ? `₹${product.costPrice}` : '—'}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full
                        ${product.active
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-gray-100 text-gray-400'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${product.active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {product.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => navigate(`/products/${product.id}`)}
                          className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          title="View"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          onClick={() => setPrintProduct(product)}
                          className="p-1.5 text-gray-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors"
                          title="Print Barcode"
                        >
                          <Barcode size={14} />
                        </button>
                        <button
                          onClick={() => navigate(`/products/${product.id}/edit`)}
                          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <Edit size={14} />
                        </button>
                        <button
                          onClick={() => deleteMut.mutate(product.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length > 0 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-gray-100 bg-gray-50">
                <div className="flex items-center gap-2">
                  <p className="text-xs text-gray-500">
                    {page * pageSize + 1}–{Math.min((page + 1) * pageSize, filtered.length)} of {filtered.length} products
                  </p>
                  <select value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(0) }}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1 text-gray-600 bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/30">
                    {[10, 20, 50, 100].map(s => <option key={s} value={s}>{s} / page</option>)}
                  </select>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 transition-colors">
                    <ChevronLeft size={14} />
                  </button>
                  {totalPages > 1 && Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const pg = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i
                    return (
                      <button key={pg} onClick={() => setPage(pg)}
                        className={`w-7 h-7 text-xs rounded-lg border transition-colors ${pg === page ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white border-transparent' : 'border-gray-200 text-gray-600 hover:bg-white'}`}>
                        {pg + 1}
                      </button>
                    )
                  })}
                  <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                    className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 transition-colors">
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {showImport && (
        <ProductImportModal
          onClose={() => setShowImport(false)}
          onImported={() => qc.invalidateQueries({ queryKey: ['products'] })}
        />
      )}

      {printProduct && (
        <BarcodePrintModal
          product={printProduct}
          onClose={() => setPrintProduct(null)}
        />
      )}
    </>
  )
}
