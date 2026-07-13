import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, User, Users, AlertCircle, Upload, Download, FileText, FileSpreadsheet, ChevronDown, MapPin, Pencil, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { customerApi } from '@/services/api'
import { Customer } from '@/types'
import CustomerImportModal from './CustomerImportModal'

const segmentBadge: Record<string, string> = {
  REGULAR: 'bg-gray-100 text-gray-700',
  SILVER: 'bg-slate-200 text-slate-800',
  GOLD: 'bg-yellow-100 text-yellow-800',
  VIP: 'bg-purple-100 text-purple-800',
  WHOLESALE: 'bg-blue-100 text-blue-800',
}

export default function CustomersPage() {
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [searchResults, setSearchResults] = useState<Customer[] | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)
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
      const res = format === 'csv' ? await customerApi.exportCsv() : await customerApi.exportExcel()
      const ext = format === 'csv' ? 'csv' : 'xlsx'
      const mime = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const url = URL.createObjectURL(new Blob([res.data], { type: mime }))
      const a = document.createElement('a')
      a.href = url; a.download = `customers_export.${ext}`; a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported as ${ext.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['customers'],
    queryFn: () => customerApi.getAll({ page: 0, size: 100 }).then(r => r.data.data),
  })

  const toggleMut = useMutation({
    mutationFn: (id: number) => customerApi.toggleActive(id),
    onSuccess: (res) => {
      const c = res.data.data
      toast.success(`${c.name} ${c.active ? 'enabled' : 'disabled'}`)
      qc.invalidateQueries({ queryKey: ['customers'] })
    },
    onError: () => toast.error('Failed to update customer status'),
  })

  const handleSearch = async (q: string) => {
    setSearch(q)
    if (!q.trim()) { setSearchResults(null); return }
    const res = await customerApi.search(q)
    setSearchResults(res.data.data)
  }

  const customers: Customer[] = searchResults || data?.content || []

  const totalCustomers = data?.totalElements ?? customers.length
  const withDues = customers.filter(c => (c.outstandingDue ?? 0) > 0).length
  const premiumCount = customers.filter(c => c.segment === 'GOLD' || c.segment === 'VIP').length

  return (
    <>
    <div className="p-6">

      {/* ── Hero Header ── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)] mb-6">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
          <div className="absolute inset-0 opacity-[0.15]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-56 h-56 rounded-full bg-violet-300/20 blur-2xl" />
        </div>

        {/* Top row */}
        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <Users size={26} className="text-amber-300" />
            <div>
              <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Commerce</p>
              <h1 className="text-white text-2xl font-bold tracking-tight">Customers</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Export dropdown */}
            <div ref={exportRef} className="relative">
              <button
                onClick={() => setExportOpen(v => !v)}
                disabled={exporting}
                className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white px-3 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
              >
                <Download size={15} />
                {exporting ? 'Exporting…' : 'Export'}
                <ChevronDown size={13} className={`transition-transform ${exportOpen ? 'rotate-180' : ''}`} />
              </button>
              {exportOpen && (
                <div className="absolute right-0 mt-1 w-44 bg-white border rounded-xl shadow-lg z-20 py-1 overflow-hidden">
                  <button onClick={() => handleExport('csv')}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <FileText size={15} className="text-green-500" /> Export as CSV
                  </button>
                  <button onClick={() => handleExport('excel')}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                    <FileSpreadsheet size={15} className="text-emerald-600" /> Export as Excel
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={() => setShowImport(true)}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white px-3 py-2 rounded-lg font-medium text-sm transition-colors"
            >
              <Upload size={15} /> Import
            </button>
            <button
              onClick={() => navigate('/customers/new')}
              className="flex items-center gap-2 bg-white text-violet-700 hover:bg-violet-50 px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-colors"
            >
              <Plus size={16} /> Add Customer
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-4 divide-x divide-white/10">
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{totalCustomers}</p>
            <p className="text-violet-200 text-xs mt-0.5">Total Customers</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{customers.filter(c => c.segment === 'REGULAR').length}</p>
            <p className="text-violet-200 text-xs mt-0.5">Regular</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{premiumCount}</p>
            <p className="text-violet-200 text-xs mt-0.5">Gold / VIP</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className={`text-xl font-bold ${withDues > 0 ? 'text-red-300' : 'text-white'}`}>{withDues}</p>
            <p className="text-violet-200 text-xs mt-0.5">With Outstanding Dues</p>
          </div>
        </div>
      </div>

      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={(e) => handleSearch(e.target.value)}
          placeholder="Search by name, phone or email..."
          className="pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg w-full max-w-md focus:ring-2 focus:ring-primary-500 focus:outline-none text-sm"
        />
      </div>

      <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-y border-slate-200">
              <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">Customer</th>
              <th className="px-6 py-3 text-left text-[11px] font-bold text-slate-500 uppercase tracking-widest">Phone / Email</th>
              <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest">Total Spent</th>
              <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest">Due Amount</th>
              <th className="px-6 py-3 text-right text-[11px] font-bold text-slate-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">Loading...</td></tr>
            ) : customers.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-12 text-gray-400">No customers found</td></tr>
            ) : customers.map((c) => (
              <tr key={c.id} className={`hover:bg-violet-50/40 transition-colors cursor-pointer ${!c.active ? 'opacity-50' : ''}`} onClick={() => navigate(`/customers/${c.id}`)}>
                <td className="px-6 py-3">
                  <div>
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                      <p className="text-xs text-gray-400">{c.city}</p>
                      {(() => {
                        const sites = Array.isArray((c as any).siteAddresses)
                          ? (c as any).siteAddresses
                          : (() => { try { return JSON.parse((c as any).siteAddresses || '[]') } catch { return [] } })()
                        if (!sites.length) return null
                        return (
                          <div className="flex flex-wrap gap-1 mt-1">
                            {sites.map((s: any, i: number) => (
                              <span key={i} className="inline-flex items-center gap-0.5 text-[10px] text-violet-700 bg-violet-50 border border-violet-100 px-1.5 py-0.5 rounded-full">
                                <MapPin size={8} />{s.label || 'Site'}{s.city ? ` · ${s.city}` : ''}
                              </span>
                            ))}
                          </div>
                        )
                      })()}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3 text-sm text-gray-600">
                  <p>{c.phone}</p>
                  <p className="text-xs text-gray-400">{c.email}</p>
                </td>
                <td className="px-6 py-3 text-sm font-semibold text-gray-900 text-right">₹{c.totalSpent?.toLocaleString()}</td>
                <td className="px-6 py-3 text-sm text-right">
                  {c.outstandingDue > 0 ? (
                    <span className="text-red-600 font-medium flex items-center justify-end gap-1">
                      <AlertCircle size={12} />
                      ₹{c.outstandingDue}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-6 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      title="Edit customer"
                      onClick={e => { e.stopPropagation(); navigate(`/customers/${c.id}/edit`) }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors"
                    >
                      <Pencil size={15} />
                    </button>
                    <button
                      title={c.active ? 'Disable customer' : 'Enable customer'}
                      onClick={e => { e.stopPropagation(); toggleMut.mutate(c.id) }}
                      disabled={toggleMut.isPending}
                      className={`p-1.5 rounded-lg transition-colors disabled:opacity-50 ${
                        c.active
                          ? 'text-emerald-500 hover:text-red-500 hover:bg-red-50'
                          : 'text-gray-300 hover:text-emerald-500 hover:bg-emerald-50'
                      }`}
                    >
                      {c.active
                        ? <ToggleRight size={20} />
                        : <ToggleLeft size={20} />}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
    {showImport && (
      <CustomerImportModal
        onClose={() => setShowImport(false)}
        onImported={() => qc.invalidateQueries({ queryKey: ['customers'] })}
      />
    )}
    </>
  )
}
