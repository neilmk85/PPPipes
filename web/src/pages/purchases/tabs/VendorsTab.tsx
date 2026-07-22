import { useState, useRef, useEffect } from 'react'
import { Plus, Search, Phone, Mail, MapPin, Building2, Pencil, Trash2, Loader2, X, Upload, Download, FileText, FileSpreadsheet, ChevronDown } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import api, { vendorApi } from '@/services/api'
import VendorImportModal from './VendorImportModal'

// ─── Vendor Form ─────────────────────────────────────────────────────────────
function VendorField({ label, name, type = 'text', form, setForm, error, ...props }: any) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input type={type} value={form[name] ?? ''}
        onChange={e => setForm({ ...form, [name]: e.target.value })}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:outline-none ${error ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-primary-500'}`}
        {...props} />
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

const emptyForm = {
  name: '', contactPerson: '', phone: '', email: '',
  gstin: '', address: '', city: '', state: '', pincode: '',
  paymentTerms: 30, notes: '',
}

function VendorModal({ vendor, onClose, onSaved }: { vendor?: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState(vendor ? { ...emptyForm, ...vendor } : { ...emptyForm })
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const validate = () => {
    const e: Record<string, string> = {}
    if (!form.name.trim()) e.name = 'Vendor name is required'
    if (form.phone && !/^\+?\d{7,15}$/.test(form.phone.replace(/\s/g, ''))) e.phone = 'Invalid phone number'
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Invalid email'
    if (form.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(form.gstin.toUpperCase())) e.gstin = 'Invalid GSTIN'
    setErrors(e)
    return Object.keys(e).length === 0
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setLoading(true)
    try {
      const payload = { ...form, paymentTerms: parseInt(String(form.paymentTerms)) || 0 }
      if (vendor) {
        await api.put(`/vendors/${vendor.id}`, payload)
        toast.success('Vendor updated')
      } else {
        await api.post('/vendors', payload)
        toast.success('Vendor created')
      }
      onSaved()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save vendor')
    } finally {
      setLoading(false)
    }
  }

  const f = { form, setForm }
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold">{vendor ? 'Edit Vendor' : 'New Vendor'}</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>
        <form onSubmit={submit} noValidate className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2"><VendorField label="Vendor / Company Name *" name="name" error={errors.name} {...f} /></div>
            <VendorField label="Contact Person" name="contactPerson" {...f} />
            <VendorField label="Phone" name="phone" error={errors.phone} {...f} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <VendorField label="Email" name="email" type="email" error={errors.email} {...f} />
            <VendorField label="GSTIN" name="gstin" placeholder="27AABCU9603R1ZX" error={errors.gstin} {...f} />
          </div>
          <VendorField label="Address" name="address" {...f} />
          <div className="grid grid-cols-3 gap-4">
            <VendorField label="City" name="city" {...f} />
            <VendorField label="State" name="state" {...f} />
            <VendorField label="Pincode" name="pincode" {...f} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <VendorField label="Payment Terms (days)" name="paymentTerms" type="number" min="0" {...f} />
            <div />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
              rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 border border-gray-300 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {vendor ? 'Update' : 'Create'} Vendor
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Vendors Tab ─────────────────────────────────────────────────────────────
export default function VendorsTab() {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<{ open: boolean; vendor?: any }>({ open: false })
  const [showImport, setShowImport] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [exporting, setExporting] = useState(false)
  const exportRef = useRef<HTMLDivElement>(null)

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
      const res = format === 'csv' ? await vendorApi.exportCsv() : await vendorApi.exportExcel()
      const ext = format === 'csv' ? 'csv' : 'xlsx'
      const mime = format === 'csv' ? 'text/csv' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      const url = URL.createObjectURL(new Blob([res.data], { type: mime }))
      const a = document.createElement('a')
      a.href = url; a.download = `vendors_export.${ext}`; a.click()
      URL.revokeObjectURL(url)
      toast.success(`Exported as ${ext.toUpperCase()}`)
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const { data: vendors = [], isLoading } = useQuery({
    queryKey: ['vendors'],
    queryFn: () => api.get('/vendors').then(r => r.data.data?.content ?? r.data.data ?? []),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.delete(`/vendors/${id}`),
    onSuccess: () => { toast.success('Vendor deleted'); qc.invalidateQueries({ queryKey: ['vendors'] }) },
    onError: () => toast.error('Failed to delete vendor'),
  })

  const filtered = vendors.filter((v: any) =>
    v.name?.toLowerCase().includes(search.toLowerCase()) ||
    v.phone?.includes(search) ||
    v.gstin?.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          {/* Export dropdown */}
          <div ref={exportRef} className="relative">
            <button
              onClick={() => setExportOpen(v => !v)}
              disabled={exporting}
              className="flex items-center gap-1.5 border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 py-2 rounded-lg font-medium text-sm transition-colors disabled:opacity-50"
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
            className="flex items-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg font-medium text-sm transition-colors"
          >
            <Upload size={15} /> Import
          </button>
          <button onClick={() => setModal({ open: true })}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={16} /> New Vendor
          </button>
        </div>
      </div>

      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search by name, phone or GSTIN..."
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin text-primary-600" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Building2 size={40} className="mx-auto mb-3 opacity-30" />
          <p>{search ? 'No vendors match your search' : 'No vendors yet. Add your first vendor.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((v: any) => (
            <div key={v.id} className="border border-gray-200 rounded-xl px-4 py-3 flex items-start gap-4 bg-white hover:shadow-sm transition-shadow">
              <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                <Building2 size={18} className="text-primary-600" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-gray-900">{v.name}</span>
                  {v.gstin && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono">GST: {v.gstin}</span>}
                  {!v.active && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded">Inactive</span>}
                </div>
                <div className="flex gap-4 mt-1 flex-wrap">
                  {v.contactPerson && <span className="text-xs text-gray-500">{v.contactPerson}</span>}
                  {v.phone && <span className="flex items-center gap-1 text-xs text-gray-500"><Phone size={11} />{v.phone}</span>}
                  {v.email && <span className="flex items-center gap-1 text-xs text-gray-500"><Mail size={11} />{v.email}</span>}
                  {(v.city || v.state) && <span className="flex items-center gap-1 text-xs text-gray-500"><MapPin size={11} />{[v.city, v.state].filter(Boolean).join(', ')}</span>}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {v.paymentTerms && (
                  <span className="text-xs text-gray-500 mr-2">Net {v.paymentTerms}d</span>
                )}
                <button onClick={() => setModal({ open: true, vendor: v })}
                  className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                  <Pencil size={15} />
                </button>
                <button onClick={() => deleteMut.mutate(v.id)}
                  className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal.open && (
        <VendorModal
          vendor={modal.vendor}
          onClose={() => setModal({ open: false })}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['vendors'] }); setModal({ open: false }) }}
        />
      )}
      {showImport && (
        <VendorImportModal
          onClose={() => setShowImport(false)}
          onImported={() => qc.invalidateQueries({ queryKey: ['vendors'] })}
        />
      )}
    </div>
  )
}
