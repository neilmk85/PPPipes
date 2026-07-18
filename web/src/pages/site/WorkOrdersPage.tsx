import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, X, Loader2, ClipboardList, HardHat,
  Calendar, MapPin, ChevronRight, Trash2, IndianRupee,
  CheckCircle2, Clock, FileText, Edit2, AlertCircle, ChevronDown, ArrowLeft,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { contractorApi, workOrderApi } from '@/services/api'

// ─── Types ────────────────────────────────────────────────────────────────────

type WOStatus = 'DRAFT' | 'ACTIVE' | 'COMPLETED' | 'BILLED'

interface WOItem {
  id: string
  description: string
  unit: string
  quantity: number
  rate: number
}

interface WorkOrder {
  id: number
  woNumber: string
  contractorId: number
  contractorName: string
  title: string
  location: string
  startDate: string
  endDate: string
  status: WOStatus
  items: WOItem[]
  notes: string
  createdAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UNITS = ['m', 'm²', 'm³', 'LS', 'Nos', 'MT', 'KG', 'RMT', 'Hrs']

const STATUS_CONFIG: Record<WOStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  DRAFT:     { label: 'Draft',     color: 'text-gray-500',   bg: 'bg-gray-100',    icon: <Edit2 size={11} /> },
  ACTIVE:    { label: 'Active',    color: 'text-blue-700',   bg: 'bg-blue-50',     icon: <Clock size={11} /> },
  COMPLETED: { label: 'Completed', color: 'text-green-700',  bg: 'bg-green-50',    icon: <CheckCircle2 size={11} /> },
  BILLED:    { label: 'Billed',    color: 'text-violet-700', bg: 'bg-violet-50',   icon: <FileText size={11} /> },
}

const STATUS_TABS: Array<WOStatus | 'ALL'> = ['ALL', 'DRAFT', 'ACTIVE', 'COMPLETED', 'BILLED']

const STATUS_TAB_ACTIVE: Record<string, string> = {
  ALL:       'bg-gray-800 text-white',
  DRAFT:     'bg-gray-500 text-white',
  ACTIVE:    'bg-blue-600 text-white',
  COMPLETED: 'bg-emerald-600 text-white',
  BILLED:    'bg-violet-600 text-white',
}

function fmt(n: number) { return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) }
function fmtDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  return `${day}/${m}/${y}`
}
function today() { return new Date().toISOString().split('T')[0] }

// ─── Contractor Selector ──────────────────────────────────────────────────────

function ContractorSelector({ value, onSelect }: {
  value: { id: number; name: string } | null
  onSelect: (c: { id: number; name: string } | null) => void
}) {
  const [search, setSearch] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: vendors = [] } = useQuery({
    queryKey: ['site-contractors'],
    queryFn: () => contractorApi.getAll().then(r => r.data.data ?? []),
  })

  const filtered = vendors.filter((v: any) =>
    !search || v.name.toLowerCase().includes(search.toLowerCase()) || v.contactPerson?.toLowerCase().includes(search.toLowerCase())
  )

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [])

  if (value) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="w-8 h-8 rounded-lg bg-amber-200 flex items-center justify-center shrink-0">
          <HardHat size={14} className="text-amber-700" />
        </div>
        <span className="text-sm font-semibold text-amber-800 flex-1">{value.name}</span>
        <button onClick={() => onSelect(null)} className="text-amber-400 hover:text-amber-600 transition-colors">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div ref={ref} className="relative">
      <div className="flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20 transition-all bg-white">
        <Search size={14} className="text-gray-400 shrink-0" />
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          placeholder="Search contractor…"
          className="flex-1 text-sm outline-none text-gray-700 placeholder-gray-400"
        />
      </div>
      {open && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 max-h-48 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">No contractors found</div>
          ) : filtered.map((v: any) => (
            <button key={v.id} type="button"
              onClick={() => { onSelect({ id: v.id, name: v.name }); setSearch(''); setOpen(false) }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-indigo-50 text-left transition-colors border-b border-gray-50 last:border-0">
              <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                <HardHat size={12} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-800">{v.name}</p>
                {v.contactPerson && <p className="text-xs text-gray-400">{v.contactPerson}</p>}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Work Order Panel ─────────────────────────────────────────────────────────

function WorkOrderPanel({ order, onClose, onSaved }: {
  order?: WorkOrder
  onClose: () => void
  onSaved: () => void
}) {
  const isEdit = !!order
  const [visible, setVisible] = useState(false)
  const [saving, setSaving] = useState(false)
  const queryClient = useQueryClient()

  const [contractor, setContractor] = useState<{ id: number; name: string } | null>(
    order ? { id: order.contractorId, name: order.contractorName } : null
  )
  const [title, setTitle] = useState(order?.title ?? '')
  const [location, setLocation] = useState(order?.location ?? '')
  const [startDate, setStartDate] = useState(order?.startDate ?? today())
  const [endDate, setEndDate] = useState(order?.endDate ?? '')
  const [notes, setNotes] = useState(order?.notes ?? '')
  const [items, setItems] = useState<WOItem[]>(
    order?.items ?? [{ id: crypto.randomUUID(), description: '', unit: 'm', quantity: 0, rate: 0 }]
  )

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function handleClose() { setVisible(false); setTimeout(onClose, 300) }

  function addItem() {
    setItems(prev => [...prev, { id: crypto.randomUUID(), description: '', unit: 'm', quantity: 0, rate: 0 }])
  }
  function updateItem(id: string, field: keyof WOItem, value: any) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }
  function removeItem(id: string) {
    setItems(prev => prev.filter(it => it.id !== id))
  }

  const subtotal = items.reduce((s, it) => s + it.quantity * it.rate, 0)

  async function handleSave() {
    if (!contractor) { toast.error('Select a contractor'); return }
    if (!title.trim()) { toast.error('Enter a work order title'); return }
    if (items.some(it => !it.description.trim())) { toast.error('Fill in all service descriptions'); return }
    if (items.some(it => it.quantity <= 0 || it.rate <= 0)) { toast.error('All quantities and rates must be > 0'); return }

    setSaving(true)
    try {
      const payload = {
        contractorId: contractor.id,
        contractorName: contractor.name,
        title: title.trim(),
        location: location.trim(),
        startDate,
        endDate,
        notes: notes.trim(),
        items,
      }

      if (isEdit) {
        await workOrderApi.update(order!.id, payload)
        toast.success('Work order updated')
      } else {
        const res = await workOrderApi.create(payload)
        const woNumber = res.data.data?.woNumber ?? ''
        toast.success(`Work order ${woNumber} created`)
      }

      await queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      onSaved()
      handleClose()
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to save work order')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400 transition-colors'

  return (
    <>
      <div className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />
      <div className={`fixed inset-y-0 right-0 w-[70vw] z-50 transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="w-full h-full bg-[#f8f9fb] flex flex-col overflow-hidden">

          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
                <ClipboardList size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 leading-none">
                  {isEdit ? `Edit · ${order!.woNumber}` : 'New Work Order'}
                </h2>
                <p className="text-xs text-gray-400 mt-0.5">
                  {isEdit ? 'Update work order details' : 'Define scope and assign to contractor'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleClose} className="px-3.5 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors font-semibold shadow-sm">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />}
                {isEdit ? 'Update' : 'Create Work Order'}
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto">
            <div className="px-8 py-6 space-y-5">

              {/* Contractor + Meta */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow-md p-5 space-y-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Contractor</p>
                  <ContractorSelector value={contractor} onSelect={setContractor} />
                </div>
                <div className="bg-white rounded-xl shadow-md p-5 space-y-3">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Work Order No.</p>
                  <p className="text-sm text-gray-400 italic font-mono">
                    {isEdit ? order!.woNumber : 'Auto-assigned on save'}
                  </p>
                </div>
              </div>

              {/* Title + Location + Dates */}
              <div className="bg-white rounded-xl shadow-md p-5 space-y-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Work Details</p>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 mb-1.5">Work Title <span className="text-red-400">*</span></label>
                  <input value={title} onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Excavation & Pipe Laying – Phase 1, Sector A"
                    className={inputCls} />
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-1">
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      <MapPin size={11} className="inline mr-1" />Location / Section
                    </label>
                    <input value={location} onChange={e => setLocation(e.target.value)}
                      placeholder="e.g. Sector B, CH 0+500"
                      className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      <Calendar size={11} className="inline mr-1" />Start Date
                    </label>
                    <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-500 mb-1.5">
                      <Calendar size={11} className="inline mr-1" />Expected End
                    </label>
                    <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className={inputCls} />
                  </div>
                </div>
              </div>

              {/* Service Line Items */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Scope of Work</p>
                  <button onClick={addItem}
                    className="flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors">
                    <Plus size={12} /> Add Service
                  </button>
                </div>

                {/* Table header */}
                <div className="grid text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100"
                  style={{ gridTemplateColumns: '2.5fr 90px 100px 130px 130px 36px' }}>
                  <div className="px-5 py-3">Service / Description</div>
                  <div className="px-3 py-3 text-center">Unit</div>
                  <div className="px-3 py-3 text-right">Qty</div>
                  <div className="px-3 py-3 text-right">Rate (₹)</div>
                  <div className="px-3 py-3 text-right">Amount (₹)</div>
                  <div />
                </div>

                {/* Rows */}
                {items.map((it, idx) => (
                  <div key={it.id}
                    className={`grid items-center border-b border-gray-100 last:border-0 ${idx % 2 === 1 ? 'bg-gray-50/50' : ''}`}
                    style={{ gridTemplateColumns: '2.5fr 90px 100px 130px 130px 36px' }}>
                    <div className="px-5 py-2.5">
                      <input value={it.description} onChange={e => updateItem(it.id, 'description', e.target.value)}
                        placeholder="e.g. Excavation in hard rock"
                        className="w-full text-sm text-gray-800 placeholder-gray-300 border-0 bg-transparent outline-none focus:bg-indigo-50/50 rounded px-1 py-0.5 transition-colors" />
                    </div>
                    <div className="px-2 py-2">
                      <select value={it.unit} onChange={e => updateItem(it.id, 'unit', e.target.value)}
                        className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white text-center">
                        {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                      </select>
                    </div>
                    <div className="px-2 py-2">
                      <input type="number" min="0" step="0.01" value={it.quantity || ''}
                        onChange={e => updateItem(it.id, 'quantity', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                    </div>
                    <div className="px-2 py-2">
                      <div className="relative">
                        <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-300">₹</span>
                        <input type="number" min="0" step="0.01" value={it.rate || ''}
                          onChange={e => updateItem(it.id, 'rate', parseFloat(e.target.value) || 0)}
                          className="w-full pl-5 pr-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" />
                      </div>
                    </div>
                    <div className="px-3 py-2 text-right">
                      <p className="text-sm font-bold text-gray-800 tabular-nums">
                        {it.quantity > 0 && it.rate > 0 ? `₹${fmt(it.quantity * it.rate)}` : '—'}
                      </p>
                    </div>
                    <div className="pr-2 flex items-center justify-center">
                      {items.length > 1 && (
                        <button onClick={() => removeItem(it.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}

                {/* Subtotal */}
                {subtotal > 0 && (
                  <div className="border-t border-gray-100 bg-indigo-50/50 px-5 py-3 flex justify-end">
                    <span className="text-sm font-bold text-indigo-800">
                      Contract Value: ₹{fmt(subtotal)}
                    </span>
                  </div>
                )}
              </div>

              {/* Notes */}
              <div className="bg-white rounded-xl shadow-md p-5">
                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3}
                  placeholder="Special instructions, site conditions, payment terms…"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-400/40 focus:border-indigo-400 transition-colors resize-none" />
              </div>

            </div>
          </div>

          {/* Footer */}
          <div className="px-8 py-3.5 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
            <p className="text-xs text-gray-400 tabular-nums">
              {items.length} service{items.length !== 1 ? 's' : ''}
              {subtotal > 0 ? ` · Contract value ₹${fmt(subtotal)}` : ''}
            </p>
            <div className="flex gap-2">
              <button onClick={handleClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving}
                className="flex items-center gap-1.5 px-5 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg transition-colors font-semibold shadow-sm">
                {saving ? <Loader2 size={13} className="animate-spin" /> : null}
                {isEdit ? 'Update Work Order' : 'Create Work Order'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Work Order Detail Panel ──────────────────────────────────────────────────

function WorkOrderDetail({ order, onClose, onStatusChange, onEdit, onGenerateBill }: {
  order: WorkOrder
  onClose: () => void
  onStatusChange: (id: number, status: WOStatus) => void
  onEdit: (o: WorkOrder) => void
  onGenerateBill: (o: WorkOrder) => void
}) {
  const [visible, setVisible] = useState(false)
  const cfg = STATUS_CONFIG[order.status]
  const subtotal = order.items.reduce((s, it) => s + it.quantity * it.rate, 0)

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function handleClose() { setVisible(false); setTimeout(onClose, 300) }

  const NEXT_STATUS: Partial<Record<WOStatus, { status: WOStatus; label: string; color: string }>> = {
    DRAFT:     { status: 'ACTIVE',    label: 'Mark Active',    color: 'bg-blue-600 hover:bg-blue-700' },
    ACTIVE:    { status: 'COMPLETED', label: 'Mark Completed', color: 'bg-green-600 hover:bg-green-700' },
  }
  const next = NEXT_STATUS[order.status]

  return (
    <>
      <div className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />
      <div className={`fixed inset-y-0 right-0 w-[70vw] z-50 transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="w-full h-full bg-[#f8f9fb] flex flex-col overflow-hidden shadow-2xl">

          {/* Header */}
          <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-[15px] font-bold text-gray-900">{order.woNumber}</h2>
                <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                  {cfg.icon} {cfg.label}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5 truncate max-w-xs">{order.title}</p>
            </div>
            <div className="flex items-center gap-2">
              {order.status !== 'BILLED' && (
                <button onClick={() => { onEdit(order); handleClose() }}
                  className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                  <Edit2 size={15} />
                </button>
              )}
              <button onClick={handleClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

            {/* Contractor + dates */}
            <div className="bg-white rounded-xl shadow-sm p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                  <HardHat size={16} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-bold text-gray-900">{order.contractorName}</p>
                  <p className="text-xs text-gray-400">Contractor</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 pt-1">
                {order.location && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Location</p>
                    <p className="text-xs font-medium text-gray-700">{order.location}</p>
                  </div>
                )}
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">Start</p>
                  <p className="text-xs font-medium text-gray-700">{fmtDate(order.startDate)}</p>
                </div>
                {order.endDate && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">End</p>
                    <p className="text-xs font-medium text-gray-700">{fmtDate(order.endDate)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Scope of work */}
            <div className="bg-white rounded-xl shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Scope of Work</p>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
                  <tr>
                    <th className="px-4 py-2.5 text-left">Service</th>
                    <th className="px-3 py-2.5 text-center">Unit</th>
                    <th className="px-3 py-2.5 text-right">Qty</th>
                    <th className="px-3 py-2.5 text-right">Rate</th>
                    <th className="px-3 py-2.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {order.items.map(it => (
                    <tr key={it.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 text-gray-800 font-medium">{it.description}</td>
                      <td className="px-3 py-2.5 text-center text-gray-500 text-xs">{it.unit}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">{it.quantity.toLocaleString('en-IN')}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">₹{fmt(it.rate)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-800">₹{fmt(it.quantity * it.rate)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-indigo-50 border-t border-indigo-100">
                    <td colSpan={4} className="px-4 py-3 text-sm font-bold text-indigo-700">Contract Value</td>
                    <td className="px-3 py-3 text-right text-sm font-bold text-indigo-700 tabular-nums">₹{fmt(subtotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Notes */}
            {order.notes && (
              <div className="bg-white rounded-xl shadow-sm p-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</p>
                <p className="text-sm text-gray-600 leading-relaxed">{order.notes}</p>
              </div>
            )}
          </div>

          {/* Footer actions */}
          <div className="px-6 py-4 bg-white border-t border-gray-100 space-y-2.5 shrink-0">
            {next && (
              <button onClick={() => { onStatusChange(order.id, next.status); handleClose() }}
                className={`w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white rounded-xl transition-colors ${next.color}`}>
                <CheckCircle2 size={15} /> {next.label}
              </button>
            )}
            {order.status === 'COMPLETED' && (
              <button
                onClick={() => { onGenerateBill(order); handleClose() }}
                className="w-full flex items-center justify-center gap-2 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-xl transition-colors">
                <FileText size={15} /> Generate Work Bill
              </button>
            )}
            <button onClick={handleClose}
              className="w-full py-2.5 text-sm font-medium text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Work Order Row ───────────────────────────────────────────────────────────

function WorkOrderRow({ order, onClick }: { order: WorkOrder; onClick: () => void }) {
  const cfg = STATUS_CONFIG[order.status]
  const subtotal = order.items.reduce((s, it) => s + it.quantity * it.rate, 0)
  const serviceList = order.items.map(it => it.description).filter(Boolean).join(', ')

  return (
    <button onClick={onClick}
      className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all p-5 text-left group">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 mb-1">
            <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-lg">{order.woNumber}</span>
            <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
              {cfg.icon} {cfg.label}
            </span>
          </div>
          <p className="text-sm font-bold text-gray-900 truncate">{order.title}</p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <HardHat size={11} /> {order.contractorName}
            </span>
            {order.location && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <MapPin size={11} /> {order.location}
              </span>
            )}
            <span className="flex items-center gap-1 text-xs text-gray-400">
              <Calendar size={11} /> {fmtDate(order.startDate)}
            </span>
          </div>
          {serviceList && (
            <p className="text-xs text-gray-400 mt-1.5 truncate">{serviceList}</p>
          )}
        </div>
        <div className="shrink-0 text-right">
          <p className="text-base font-bold text-gray-900 tabular-nums">₹{fmt(subtotal)}</p>
          <p className="text-[11px] text-gray-400 mt-0.5">{order.items.length} service{order.items.length !== 1 ? 's' : ''}</p>
          <ChevronRight size={16} className="text-gray-300 group-hover:text-indigo-400 transition-colors ml-auto mt-2" />
        </div>
      </div>
    </button>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function WorkOrdersPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<WOStatus | 'ALL'>('ALL')
  const [showPanel, setShowPanel] = useState(false)
  const [editOrder, setEditOrder] = useState<WorkOrder | undefined>()
  const [detailOrder, setDetailOrder] = useState<WorkOrder | undefined>()

  const { data: orders = [] } = useQuery<WorkOrder[]>({
    queryKey: ['work-orders'],
    queryFn: () => workOrderApi.getAll().then(r => r.data.data ?? []),
  })

  async function handleStatusChange(id: number, status: WOStatus) {
    try {
      await workOrderApi.updateStatus(id, status)
      toast.success(`Marked as ${STATUS_CONFIG[status].label}`)
      await queryClient.invalidateQueries({ queryKey: ['work-orders'] })
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to update status')
    }
  }

  async function handleDelete(id: number) {
    if (!window.confirm('Delete this work order?')) return
    try {
      await workOrderApi.delete(id)
      toast.success('Work order deleted')
      await queryClient.invalidateQueries({ queryKey: ['work-orders'] })
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? 'Failed to delete work order')
    }
  }

  const filtered = orders.filter(o => {
    if (activeTab !== 'ALL' && o.status !== activeTab) return false
    if (search) {
      const q = search.toLowerCase()
      return o.title.toLowerCase().includes(q) ||
        o.contractorName.toLowerCase().includes(q) ||
        o.woNumber.toLowerCase().includes(q) ||
        o.location?.toLowerCase().includes(q)
    }
    return true
  })

  const counts = STATUS_TABS.reduce((acc, t) => {
    acc[t] = t === 'ALL' ? orders.length : orders.filter(o => o.status === t).length
    return acc
  }, {} as Record<string, number>)

  return (
    <>
      {/* Header */}
      <div className="border-b border-gray-200 px-6 py-5 flex items-center justify-between"
        style={{ background: 'linear-gradient(135deg, #c2d8f0 0%, #eaedf5 100%)' }}>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/site/main-contractor')}
            className="text-blue-700 hover:text-blue-900 transition-colors">
            <ArrowLeft size={18} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Work Orders</h1>
            <p className="text-xs text-gray-500">Sub-contract work assigned to contractors</p>
          </div>
        </div>
        <button onClick={() => { setEditOrder(undefined); setShowPanel(true) }}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all active:scale-95 shadow-sm">
          <Plus size={16} /> New Work Order
        </button>
      </div>

      {/* Status Tabs */}
      <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-2 overflow-x-auto">
        {STATUS_TABS.map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
              activeTab === tab
                ? STATUS_TAB_ACTIVE[tab]
                : 'text-gray-500 hover:bg-gray-100'
            }`}>
            {tab === 'ALL' ? 'All' : STATUS_CONFIG[tab as WOStatus].label}
            {counts[tab] > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeTab === tab ? 'bg-white/25 text-white' : 'bg-gray-100 text-gray-500'
              }`}>{counts[tab]}</span>
            )}
          </button>
        ))}

        {/* Search */}
        <div className="ml-auto flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-xl bg-gray-50 focus-within:bg-white focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/20 transition-all min-w-[200px]">
          <Search size={13} className="text-gray-400 shrink-0" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search work orders…"
            className="flex-1 text-xs bg-transparent outline-none text-gray-700 placeholder-gray-400" />
          {search && <button onClick={() => setSearch('')}><X size={12} className="text-gray-400 hover:text-gray-600" /></button>}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
              <ClipboardList size={28} className="text-indigo-300" />
            </div>
            <p className="text-base font-semibold text-gray-700 mb-1">
              {search || activeTab !== 'ALL' ? 'No work orders found' : 'No work orders yet'}
            </p>
            <p className="text-sm text-gray-400 mb-6">
              {search || activeTab !== 'ALL' ? 'Try changing your filters' : 'Create your first work order to get started'}
            </p>
            {!search && activeTab === 'ALL' && (
              <button onClick={() => { setEditOrder(undefined); setShowPanel(true) }}
                className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                <Plus size={15} /> New Work Order
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(o => (
              <WorkOrderRow key={o.id} order={o} onClick={() => setDetailOrder(o)} />
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Panel */}
      {showPanel && (
        <WorkOrderPanel
          order={editOrder}
          onClose={() => { setShowPanel(false); setEditOrder(undefined) }}
          onSaved={() => {}}
        />
      )}

      {/* Detail Panel */}
      {detailOrder && (
        <WorkOrderDetail
          order={detailOrder}
          onClose={() => setDetailOrder(undefined)}
          onStatusChange={(id, status) => { handleStatusChange(id, status); setDetailOrder(undefined) }}
          onEdit={o => { setDetailOrder(undefined); setEditOrder(o); setShowPanel(true) }}
          onGenerateBill={o => { setDetailOrder(undefined); navigate(`/site/work-bills?woId=${o.id}`) }}
        />
      )}
    </>
  )
}
