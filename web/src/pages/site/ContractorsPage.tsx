import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import SiteFloatingNav from './SiteFloatingNav'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, HardHat, X, Loader2, Phone, Mail,
  MapPin, Building2, FileText, Edit2, Trash2, ChevronDown, ArrowLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { contractorApi } from '@/services/api'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

const STATES = [
  'Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat',
  'Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh',
  'Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan',
  'Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal',
  'Delhi','Jammu & Kashmir','Ladakh','Puducherry',
]

// ─── Create / Edit Panel ──────────────────────────────────────────────────────

function ContractorPanel({ contractor, onClose, onSaved }: {
  contractor?: any
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!contractor
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name: '',
    contactPerson: '',
    phone: '',
    email: '',
    gstin: '',
    pan: '',
    address: '',
    city: '',
    state: '',
    pincode: '',
    tradeType: '',
    notes: '',
  })

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  useEffect(() => {
    if (contractor) {
      setForm({
        name: contractor.name ?? '',
        contactPerson: contractor.contactPerson ?? '',
        phone: contractor.phone ?? '',
        email: contractor.email ?? '',
        gstin: contractor.gstin ?? '',
        pan: contractor.pan ?? '',
        address: contractor.address ?? '',
        city: contractor.city ?? '',
        state: contractor.state ?? '',
        pincode: contractor.pincode ?? '',
        tradeType: contractor.tradeType ?? '',
        notes: contractor.notes ?? '',
      })
    }
  }, [contractor])

  function handleClose() {
    setVisible(false)
    setTimeout(onClose, 300)
  }

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }))
  }

  async function handleSave() {
    if (!form.name.trim()) { toast.error('Contractor name is required'); return }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        contactPerson: form.contactPerson || undefined,
        phone: form.phone || undefined,
        email: form.email || undefined,
        gstin: form.gstin || undefined,
        pan: form.pan || undefined,
        address: form.address || undefined,
        city: form.city || undefined,
        state: form.state || undefined,
        pincode: form.pincode || undefined,
        tradeType: form.tradeType || undefined,
        notes: form.notes || undefined,
      }
      if (isEdit) {
        await contractorApi.update(contractor.id, payload)
        toast.success('Contractor updated')
      } else {
        await contractorApi.create(payload)
        toast.success('Contractor added')
      }
      onSaved()
      handleClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save contractor')
    } finally {
      setSaving(false)
    }
  }

  const field = (label: string, key: keyof typeof form, opts?: { placeholder?: string; type?: string }) => (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{label}</label>
      <input
        type={opts?.type ?? 'text'}
        value={form[key]}
        onChange={e => set(key, e.target.value)}
        placeholder={opts?.placeholder ?? ''}
        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-colors"
      />
    </div>
  )

  return (
    <>
      <div className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />
      <div className={`fixed inset-y-0 right-0 w-[70vw] z-50 transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="w-full h-full bg-[#f8f9fb] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center shrink-0">
                <HardHat size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 leading-none">
                  {isEdit ? `Edit · ${contractor.name}` : 'New Contractor'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isEdit ? 'Update contractor details' : 'Add a sub-contractor for site work'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleClose} className="px-3.5 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors font-semibold shadow-sm">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <HardHat size={13} />}
                {isEdit ? 'Update' : 'Save Contractor'}
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-8 py-6 space-y-5">

              {/* Basic Info */}
              <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Basic Information</p>
                <div className="grid grid-cols-2 gap-4">
                  {field('Contractor Name *', 'name', { placeholder: 'e.g. Ramesh Civil Works' })}
                  {field('Contact Person', 'contactPerson', { placeholder: 'e.g. Ramesh Kumar' })}
                  {field('Phone', 'phone', { placeholder: '9876543210', type: 'tel' })}
                  {field('Email', 'email', { placeholder: 'contractor@example.com', type: 'email' })}
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Trade / Specialisation</label>
                  <select
                    value={form.tradeType}
                    onChange={e => set('tradeType', e.target.value)}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-colors bg-white"
                  >
                    <option value="">Select trade type</option>
                    <option value="CIVIL">Civil</option>
                    <option value="PIPE_LAYING">Pipe Laying</option>
                    <option value="CONCRETE">Concrete</option>
                    <option value="FABRICATION">Fabrication (MS Specials)</option>
                    <option value="ELECTRICAL">Electrical</option>
                    <option value="SURVEY">Survey</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>
              </div>

              {/* GST & PAN */}
              <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Tax Details</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">GSTIN</label>
                    <input
                      type="text"
                      value={form.gstin}
                      onChange={e => set('gstin', e.target.value.toUpperCase())}
                      placeholder="22AAAAA0000A1Z5"
                      maxLength={15}
                      className="w-full px-3 py-2.5 text-sm font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">PAN</label>
                    <input
                      type="text"
                      value={form.pan}
                      onChange={e => set('pan', e.target.value.toUpperCase())}
                      placeholder="AAAAA0000A"
                      maxLength={10}
                      className="w-full px-3 py-2.5 text-sm font-mono border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="bg-white rounded-xl shadow-md p-6 space-y-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Address</p>
                <div>
                  <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Street Address</label>
                  <textarea
                    value={form.address}
                    onChange={e => set('address', e.target.value)}
                    rows={2}
                    placeholder="Building, Street, Area…"
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-colors resize-none"
                  />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  {field('City', 'city', { placeholder: 'City' })}
                  <div>
                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">State</label>
                    <select
                      value={form.state}
                      onChange={e => set('state', e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-colors bg-white"
                    >
                      <option value="">Select State</option>
                      {STATES.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                  {field('Pincode', 'pincode', { placeholder: '560001' })}
                </div>
              </div>

              {/* Notes */}
              <div className="bg-white rounded-xl shadow-md p-6">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  rows={3}
                  placeholder="Specialisation, rate contract details, any remarks…"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 transition-colors resize-none"
                />
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-3.5 bg-white border-t border-gray-200 flex items-center justify-end gap-2.5 shrink-0">
            <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors font-semibold shadow-sm">
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              {isEdit ? 'Update Contractor' : 'Save Contractor'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Contractor Card ──────────────────────────────────────────────────────────

function ContractorCard({ contractor, onEdit, onDelete }: {
  contractor: any
  onEdit: (c: any) => void
  onDelete: (c: any) => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start gap-4">
        {/* Avatar */}
        <div className="w-11 h-11 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
          <span className="text-sm font-bold text-blue-700">{initials(contractor.name)}</span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-sm font-bold text-gray-900">{contractor.name}</p>
              {contractor.contactPerson && (
                <p className="text-xs text-gray-500 mt-0.5">{contractor.contactPerson}</p>
              )}
            </div>

            {/* Menu */}
            <div className="relative shrink-0" ref={menuRef}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <ChevronDown size={14} />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden z-10 min-w-[130px]">
                  <button
                    onClick={() => { onEdit(contractor); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <Edit2 size={13} /> Edit
                  </button>
                  <button
                    onClick={() => { onDelete(contractor); setMenuOpen(false) }}
                    className="w-full flex items-center gap-2 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Contact chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            {contractor.phone && (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">
                <Phone size={11} /> {contractor.phone}
              </span>
            )}
            {contractor.email && (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">
                <Mail size={11} /> {contractor.email}
              </span>
            )}
            {(contractor.city || contractor.state) && (
              <span className="inline-flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1 rounded-full">
                <MapPin size={11} /> {[contractor.city, contractor.state].filter(Boolean).join(', ')}
              </span>
            )}
          </div>

          {/* GST / PAN */}
          <div className="flex gap-3 mt-3">
            {contractor.gstin && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase">GST</span>
                <span className="text-xs font-mono text-gray-700 bg-blue-50 px-2 py-0.5 rounded-lg">{contractor.gstin}</span>
              </div>
            )}
            {contractor.pan && (
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-bold text-gray-400 uppercase">PAN</span>
                <span className="text-xs font-mono text-gray-700 bg-gray-50 px-2 py-0.5 rounded-lg">{contractor.pan}</span>
              </div>
            )}
          </div>

          {contractor.notes && (
            <p className="text-xs text-gray-400 mt-2 italic truncate">{contractor.notes}</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ContractorsPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [showPanel, setShowPanel] = useState(false)
  const [editContractor, setEditContractor] = useState<any>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['site-contractors'],
    queryFn: () => contractorApi.getAll().then(r => r.data.data ?? []),
  })

  const contractors: any[] = (data ?? []).filter((c: any) =>
    !search || c.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.contactPerson?.toLowerCase().includes(search.toLowerCase()) ||
    c.phone?.includes(search)
  )

  async function handleDelete(c: any) {
    if (!window.confirm(`Delete "${c.name}"? This cannot be undone.`)) return
    try {
      await contractorApi.delete(c.id)
      toast.success('Contractor deleted')
      qc.invalidateQueries({ queryKey: ['site-contractors'] })
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to delete')
    }
  }

  function openCreate() { setEditContractor(null); setShowPanel(true) }
  function openEdit(c: any) { setEditContractor(c); setShowPanel(true) }

  return (
    <>
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-5 flex items-center gap-4"
        style={{ background: 'linear-gradient(135deg, #c2d8f0 0%, #eaedf5 100%)' }}>
        <div className="flex items-center gap-3 shrink-0">
          <button onClick={() => navigate('/site/main-contractor')}
            className="text-blue-700 hover:text-blue-900 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Contractors</h1>
            <p className="text-xs text-gray-500">Sub-contractors for site work</p>
          </div>
        </div>
        <div className="flex-1 flex justify-center">
          <SiteFloatingNav theme="light" inline />
        </div>
        <button
          onClick={openCreate}
          className="shrink-0 active:scale-95"
          style={{
            width: 36, height: 36, borderRadius: '50%',
            background: 'rgba(255,255,255,0.95)',
            border: 'none',
            color: '#3b82f6',
            fontSize: 22, fontWeight: 300,
            fontFamily: '"Roboto", sans-serif',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', lineHeight: 1,
            boxShadow: '0 2px 8px rgba(0,0,0,0.10)',
          }}
        >
          +
        </button>
      </div>

      {/* Search + count bar */}
      <div className="px-6 py-4 bg-white border-b border-gray-100 flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm px-3 py-2 border border-gray-200 rounded-xl bg-gray-50 focus-within:bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-400/20 transition-all">
          <Search size={14} className="text-gray-400 shrink-0" />
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, contact, phone…"
            className="flex-1 text-sm bg-transparent outline-none text-gray-700 placeholder-gray-400"
          />
          {search && (
            <button onClick={() => setSearch('')} className="text-gray-400 hover:text-gray-600">
              <X size={13} />
            </button>
          )}
        </div>
        <span className="text-sm text-gray-400 font-medium">
          {contractors.length} contractor{contractors.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Content */}
      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : contractors.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4">
              <HardHat size={28} className="text-blue-300" />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">
              {search ? 'No contractors found' : 'No contractors yet'}
            </p>
            <p className="text-sm text-gray-400 mb-6">
              {search ? 'Try a different search term' : 'Add your first sub-contractor to get started'}
            </p>
            {!search && (
              <button onClick={openCreate}
                className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                <Plus size={15} /> Add Contractor
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {contractors.map(c => (
              <ContractorCard key={c.id} contractor={c} onEdit={openEdit} onDelete={handleDelete} />
            ))}
          </div>
        )}
      </div>

      {/* Slide-in Panel */}
      {showPanel && (
        <ContractorPanel
          contractor={editContractor}
          onClose={() => { setShowPanel(false); setEditContractor(null) }}
          onSaved={() => qc.invalidateQueries({ queryKey: ['site-contractors'] })}
        />
      )}
    </>
  )
}
