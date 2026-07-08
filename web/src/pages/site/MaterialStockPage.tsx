import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Archive, Pencil, Trash2, ChevronDown, AlertTriangle,
  ArrowLeft, X, PackagePlus, PackageMinus, TruckIcon,
  ArrowRight, Package, Loader2, CheckCircle2, InboxIcon,
} from 'lucide-react'
import { materialReceiptApi, materialIssueApi, siteProjectApi, inventoryApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import SiteFloatingNav from './SiteFloatingNav'

const UNITS = ['Nos', 'm', 'm²', 'm³', 'RMT', 'MT', 'KG', 'Bags', 'Litres', 'LS']

function fmtDate(d: string) {
  if (!d) return '—'
  const [y, m, day] = d.split('-')
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
  return `${parseInt(day)} ${months[parseInt(m)-1]} ${y}`
}

function fmt(n: any) {
  const v = Number(n)
  return isNaN(v) ? '0' : v % 1 === 0 ? v.toLocaleString('en-IN') : v.toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

// ─── Receive Panel ───────────────────────────────────────────────────────────

function ReceivePanel({ siteProjectId, editing, onClose }: {
  siteProjectId: number; editing: any | null; onClose: () => void
}) {
  const queryClient = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [sourceType, setSourceType] = useState<'PURCHASE' | 'TRANSFER'>(
    (editing?.sourceType as any) ?? 'PURCHASE'
  )
  const [form, setForm] = useState({
    materialName: editing?.materialName ?? '',
    specification: editing?.specification ?? '',
    unit: editing?.unit ?? 'Nos',
    qty: editing ? String(editing.qty) : '',
    supplierName: editing?.supplierName ?? '',
    invoiceNo: editing?.invoiceNo ?? '',
    receivedDate: editing?.receivedDate ?? today,
    receivedBy: editing?.receivedBy ?? '',
    vehicleNo: editing?.vehicleNo ?? '',
    sourceRef: editing?.sourceRef ?? '',
    notes: editing?.notes ?? '',
  })
  const [visible, setVisible] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(id) }, [])
  function handleClose() { setVisible(false); setTimeout(onClose, 280) }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const saveMutation = useMutation({
    mutationFn: (d: typeof form) => {
      const payload = { ...d, siteProjectId, sourceType, sourceRef: sourceType === 'TRANSFER' ? form.sourceRef : null }
      return editing
        ? materialReceiptApi.update(editing.id, payload)
        : materialReceiptApi.create(payload)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-material-receipts', siteProjectId] })
      queryClient.invalidateQueries({ queryKey: ['site-stock-register', siteProjectId] })
      toast.success(editing ? 'Receipt updated' : 'Receipt recorded')
      handleClose()
    },
    onError: () => toast.error('Failed to save'),
  })

  const fieldCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500'

  return (
    <>
      <div className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-280 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />
      <div className={`fixed inset-y-0 right-0 w-full max-w-md z-50 transition-transform duration-280 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'} shadow-2xl`}>
        <div className="w-full h-full bg-white flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-base font-semibold text-gray-900">
              {editing ? 'Edit Receipt' : 'Receive Material'}
            </h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Source toggle */}
            {!editing && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1.5">Source</label>
                <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                  {(['PURCHASE', 'TRANSFER'] as const).map(s => (
                    <button key={s} onClick={() => setSourceType(s)}
                      className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                        sourceType === s ? 'bg-teal-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}>
                      {s === 'PURCHASE' ? 'Purchase / Delivery' : 'Stock Transfer'}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {sourceType === 'TRANSFER' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Transfer Reference No.</label>
                <input value={form.sourceRef} onChange={e => set('sourceRef', e.target.value)}
                  placeholder="e.g. TR-001"
                  className={fieldCls} />
                <p className="text-[11px] text-gray-400 mt-1">Enter the transfer number from the Stock Transfers page</p>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Material Name</label>
              <input value={form.materialName} onChange={e => set('materialName', e.target.value)}
                placeholder="e.g. PSC Pipe 600mm dia"
                className={fieldCls} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Specification</label>
              <input value={form.specification} onChange={e => set('specification', e.target.value)}
                placeholder="e.g. IS 784, NP3"
                className={fieldCls} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Qty Received</label>
                <input type="number" step="0.001" min="0" value={form.qty}
                  onChange={e => set('qty', e.target.value)}
                  className={fieldCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                <div className="relative">
                  <select value={form.unit} onChange={e => set('unit', e.target.value)}
                    className={`${fieldCls} appearance-none pr-8`}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {sourceType === 'PURCHASE' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Supplier</label>
                  <input value={form.supplierName} onChange={e => set('supplierName', e.target.value)}
                    placeholder="Supplier name"
                    className={fieldCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Invoice No.</label>
                  <input value={form.invoiceNo} onChange={e => set('invoiceNo', e.target.value)}
                    placeholder="INV/2025/001"
                    className={fieldCls} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Received Date</label>
                <input type="date" value={form.receivedDate} onChange={e => set('receivedDate', e.target.value)}
                  className={fieldCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle No.</label>
                <input value={form.vehicleNo} onChange={e => set('vehicleNo', e.target.value)}
                  placeholder="GJ 01 AB 1234"
                  className={fieldCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Received By</label>
              <input value={form.receivedBy} onChange={e => set('receivedBy', e.target.value)}
                placeholder="Store keeper / Engineer"
                className={fieldCls} />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                rows={2} placeholder="Optional remarks"
                className={`${fieldCls} resize-none`} />
            </div>
          </div>

          <div className="px-5 py-4 border-t flex gap-3">
            <button onClick={handleClose}
              className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={() => saveMutation.mutate(form)}
              disabled={saveMutation.isPending || !form.materialName || !form.receivedDate || !form.qty}
              className="flex-1 py-2 text-sm bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50">
              {saveMutation.isPending ? 'Saving…' : editing ? 'Update' : 'Record Receipt'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Issue Panel ─────────────────────────────────────────────────────────────

function IssuePanel({ siteProjectId, stockEntries, onClose }: {
  siteProjectId: number; stockEntries: any[]; onClose: () => void
}) {
  const queryClient = useQueryClient()
  const today = new Date().toISOString().slice(0, 10)
  const [issuedTo, setIssuedTo] = useState<'SUBCONTRACTOR' | 'INHOUSE'>('SUBCONTRACTOR')
  const [form, setForm] = useState({
    materialName: '',
    unit: 'Nos',
    qty: '',
    contractorName: '',
    workOrderRef: '',
    issueDate: today,
    vehicleNo: '',
    notes: '',
  })
  const [visible, setVisible] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(id) }, [])
  function handleClose() { setVisible(false); setTimeout(onClose, 280) }

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const materialNames = stockEntries.map(e => e.materialName)

  const saveMutation = useMutation({
    mutationFn: () => materialIssueApi.create({
      siteProjectId,
      issuedTo,
      materialName: form.materialName,
      unit: form.unit,
      qty: form.qty,
      contractorName: issuedTo === 'SUBCONTRACTOR' ? form.contractorName || null : null,
      issueDate: form.issueDate,
      vehicleNo: form.vehicleNo || null,
      notes: form.notes || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-material-issues', siteProjectId] })
      queryClient.invalidateQueries({ queryKey: ['site-stock-register', siteProjectId] })
      toast.success('Material issued')
      handleClose()
    },
    onError: () => toast.error('Failed to record issue'),
  })

  const fieldCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <>
      <div className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-280 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />
      <div className={`fixed inset-y-0 right-0 w-full max-w-md z-50 transition-transform duration-280 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'} shadow-2xl`}>
        <div className="w-full h-full bg-white flex flex-col">
          <div className="flex items-center justify-between px-5 py-4 border-b">
            <h2 className="text-base font-semibold text-gray-900">Issue Material</h2>
            <button onClick={handleClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {/* Issued To toggle */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Issued To</label>
              <div className="flex rounded-lg border border-gray-200 overflow-hidden">
                {(['SUBCONTRACTOR', 'INHOUSE'] as const).map(t => (
                  <button key={t} onClick={() => setIssuedTo(t)}
                    className={`flex-1 py-2 text-xs font-semibold transition-colors ${
                      issuedTo === t ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
                    }`}>
                    {t === 'SUBCONTRACTOR' ? 'Contractor' : 'Inhouse (PP Pipes)'}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Material Name</label>
              <input value={form.materialName} onChange={e => set('materialName', e.target.value)}
                list="material-names-list"
                placeholder="e.g. PSC Pipe 600mm dia"
                className={fieldCls} />
              <datalist id="material-names-list">
                {materialNames.map(n => <option key={n} value={n} />)}
              </datalist>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Qty</label>
                <input type="number" step="0.001" min="0" value={form.qty}
                  onChange={e => set('qty', e.target.value)}
                  className={fieldCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Unit</label>
                <div className="relative">
                  <select value={form.unit} onChange={e => set('unit', e.target.value)}
                    className={`${fieldCls} appearance-none pr-8`}>
                    {UNITS.map(u => <option key={u}>{u}</option>)}
                  </select>
                  <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {issuedTo === 'SUBCONTRACTOR' && (
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Contractor Name</label>
                <input value={form.contractorName} onChange={e => set('contractorName', e.target.value)}
                  placeholder="Sub-contractor name"
                  className={fieldCls} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Issue Date</label>
                <input type="date" value={form.issueDate} onChange={e => set('issueDate', e.target.value)}
                  className={fieldCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Vehicle No.</label>
                <input value={form.vehicleNo} onChange={e => set('vehicleNo', e.target.value)}
                  placeholder="GJ 01 AB 1234"
                  className={fieldCls} />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
              <textarea value={form.notes} onChange={e => set('notes', e.target.value)}
                rows={2} placeholder="Optional remarks"
                className={`${fieldCls} resize-none`} />
            </div>
          </div>

          <div className="px-5 py-4 border-t flex gap-3">
            <button onClick={handleClose}
              className="flex-1 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50">
              Cancel
            </button>
            <button onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending || !form.materialName || !form.qty || !form.issueDate}
              className="flex-1 py-2 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50">
              {saveMutation.isPending ? 'Saving…' : 'Record Issue'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Receive Incoming Transfer Modal ─────────────────────────────────────────

function ReceiveTransferModal({ transfer, onClose, onDone }: {
  transfer: any; onClose: () => void; onDone: () => void
}) {
  const [qtys, setQtys] = useState<Record<string, string>>(() =>
    Object.fromEntries((transfer.items ?? []).map((it: any) => [it.id, String(it.requestedQuantity ?? it.shippedQuantity ?? '')]))
  )
  const [visible, setVisible] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(id) }, [])

  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => inventoryApi.receiveTransfer(transfer.id, {
      receivedItems: (transfer.items ?? []).map((it: any) => ({
        itemId: it.id,
        receivedQuantity: parseFloat(qtys[it.id] ?? '0') || 0,
      })),
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['incoming-transfers'] })
      toast.success(`Transfer ${transfer.transferNumber} received`)
      onDone()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to receive transfer'),
  })

  function handleClose() { setVisible(false); setTimeout(onClose, 250) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(0.96)', transition: 'all 250ms cubic-bezier(0.22,1,0.36,1)' }}>

        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-teal-600 to-emerald-600">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <CheckCircle2 size={17} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Confirm Receipt</h2>
              <p className="text-xs text-teal-100 mt-0.5">{transfer.transferNumber} · {transfer.fromOutlet?.name ?? `Outlet #${transfer.fromOutletId}`}</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center">
            <X size={15} className="text-white" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-xs text-gray-500">Enter the actual quantity received for each item. Leave at 0 if an item was not received.</p>
          {(transfer.items ?? []).map((it: any) => (
            <div key={it.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="w-8 h-8 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                <Package size={13} className="text-teal-600" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{it.product?.name ?? `Product #${it.productId}`}</p>
                <p className="text-xs text-gray-400">
                  Requested: <span className="font-medium text-gray-600">{it.requestedQuantity}</span>
                  {Number(it.shippedQuantity) > 0 && <> · Dispatched: <span className="font-medium text-violet-600">{it.shippedQuantity}</span></>}
                </p>
              </div>
              <div className="w-24 shrink-0">
                <input
                  type="number" min="0" step="1"
                  value={qtys[it.id] ?? ''}
                  onChange={e => setQtys(q => ({ ...q, [it.id]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm text-right border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white font-semibold"
                />
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={handleClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60">
            {mutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
            {mutation.isPending ? 'Saving…' : 'Confirm Receipt'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function MaterialStockPage() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { outletId } = useAuthStore()
  const [selectedProject, setSelectedProject] = useState('')
  const [activeTab, setActiveTab] = useState<'register' | 'receipts' | 'issues' | 'transfers'>('register')
  const [receiveOpen, setReceiveOpen] = useState(false)
  const [issueOpen, setIssueOpen] = useState(false)
  const [editingReceipt, setEditingReceipt] = useState<any | null>(null)
  const [receivingTransfer, setReceivingTransfer] = useState<any | null>(null)

  const { data: projectsData } = useQuery({
    queryKey: ['site-projects'],
    queryFn: () => siteProjectApi.getAll(),
  })
  const projects: any[] = projectsData?.data?.data ?? []
  const projectId = selectedProject ? Number(selectedProject) : 0

  const { data: stockData, isLoading: stockLoading } = useQuery({
    queryKey: ['site-stock-register', projectId],
    queryFn: () => materialReceiptApi.getStockRegister(projectId),
    enabled: !!projectId,
  })
  const { data: receiptsData, isLoading: receiptsLoading } = useQuery({
    queryKey: ['site-material-receipts', projectId],
    queryFn: () => materialReceiptApi.getByProject(projectId),
    enabled: !!projectId,
  })
  const { data: issuesData, isLoading: issuesLoading } = useQuery({
    queryKey: ['site-material-issues', projectId],
    queryFn: () => materialIssueApi.getAll({ siteProjectId: projectId }),
    enabled: !!projectId,
  })

  const { data: incomingTransfersData, isLoading: transfersLoading } = useQuery({
    queryKey: ['incoming-transfers', outletId],
    queryFn: () => inventoryApi.getTransfers(outletId!, { status: 'IN_TRANSIT', size: 100 })
      .then(r => {
        const all: any[] = r.data?.data?.content ?? r.data?.data ?? []
        // Only show transfers incoming to this outlet (not outgoing)
        return all.filter((t: any) => t.toOutletId === outletId)
      }),
    enabled: !!outletId,
  })
  const incomingTransfers: any[] = incomingTransfersData ?? []

  const stockEntries: any[] = stockData?.data?.data ?? []
  const receipts: any[] = receiptsData?.data?.data ?? []
  const issues: any[] = issuesData?.data?.data ?? []

  const deleteReceiptMutation = useMutation({
    mutationFn: materialReceiptApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-material-receipts', projectId] })
      queryClient.invalidateQueries({ queryKey: ['site-stock-register', projectId] })
      toast.success('Deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  const deleteIssueMutation = useMutation({
    mutationFn: materialIssueApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-material-issues', projectId] })
      queryClient.invalidateQueries({ queryKey: ['site-stock-register', projectId] })
      toast.success('Deleted')
    },
    onError: () => toast.error('Failed to delete'),
  })

  // Stat strip totals
  const totalReceived = stockEntries.reduce((s, e) => s + Number(e.totalReceived), 0)
  const totalIssued = stockEntries.reduce((s, e) => s + Number(e.issuedContractor) + Number(e.issuedInhouse), 0)
  const lowStockCount = stockEntries.filter(e => Number(e.balance) <= 0).length

  const TABS = [
    { key: 'register', label: 'Stock Register' },
    { key: 'receipts', label: `Receipts (${receipts.length})` },
    { key: 'issues', label: `Issues (${issues.length})` },
    { key: 'transfers', label: incomingTransfers.length > 0 ? `Receive Material (${incomingTransfers.length})` : 'Receive Material', highlight: incomingTransfers.length > 0 },
  ] as const

  return (
    <>
      {/* Header */}
      <div style={{ background: 'linear-gradient(180deg, #99f6e4 0%, #ccfbf1 35%, #f0fdfa 65%, #f8fffe 85%, #ffffff 100%)' }}>
        <div className="px-6 pt-4 pb-2 flex items-center gap-4">
          <button onClick={() => navigate('/site')} className="text-teal-600 hover:text-teal-900 transition-colors shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 flex justify-center">
            <SiteFloatingNav theme="light" inline />
          </div>
        </div>

        <div className="px-6 pt-6 pb-5 flex items-center justify-between">
          <div className="shrink-0">
            <h1 className="text-lg font-bold text-gray-900 leading-tight">Material Stock</h1>
            <p className="text-xs text-gray-500">Receipts, issues and running balance per project</p>
          </div>
          <div className="relative shrink-0">
            <select value={selectedProject} onChange={e => setSelectedProject(e.target.value)}
              className="appearance-none border border-teal-200 bg-white rounded-lg px-4 py-2 pr-8 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-teal-400 min-w-[220px] shadow-sm">
              <option value="">Select project…</option>
              {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Stat strip + action buttons */}
      {selectedProject && (
        <div className="bg-white border-b border-gray-100 px-6 py-3 flex items-center gap-3">
          <div className="flex items-center divide-x divide-gray-200 mr-auto">
            <div className="pr-6" style={{ filter: 'drop-shadow(0 2px 6px rgba(20,184,166,0.10))' }}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Materials</p>
              <p className="text-sm font-bold text-gray-900">{stockEntries.length}</p>
            </div>
            <div className="px-6" style={{ filter: 'drop-shadow(0 2px 6px rgba(20,184,166,0.10))' }}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Receipts</p>
              <p className="text-sm font-bold text-gray-900">{receipts.length}</p>
            </div>
            <div className="px-6" style={{ filter: 'drop-shadow(0 2px 6px rgba(20,184,166,0.10))' }}>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest leading-none mb-0.5">Issues</p>
              <p className="text-sm font-bold text-gray-900">{issues.length}</p>
            </div>
            {lowStockCount > 0 && (
              <div className="pl-6">
                <p className="text-[10px] font-semibold text-red-400 uppercase tracking-widest leading-none mb-0.5">Low / Negative</p>
                <p className="text-sm font-bold text-red-600 flex items-center gap-1">
                  <AlertTriangle size={12} /> {lowStockCount}
                </p>
              </div>
            )}
          </div>
          <button onClick={() => { setEditingReceipt(null); setReceiveOpen(true) }}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-teal-600 text-white text-xs font-semibold rounded-xl hover:bg-teal-700 transition-colors">
            <PackagePlus size={14} /> Receive
          </button>
          <button onClick={() => setIssueOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-500 text-white text-xs font-semibold rounded-xl hover:bg-orange-600 transition-colors">
            <PackageMinus size={14} /> Issue
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white border-b border-gray-100 px-6 py-2 flex items-center gap-1">
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === tab.key
                ? tab.key === 'transfers'
                  ? 'bg-teal-600 text-white'
                  : 'bg-gray-800 text-white'
                : tab.key === 'transfers' && (tab as any).highlight
                  ? 'text-teal-700 bg-teal-50 border border-teal-200 animate-pulse'
                  : 'text-gray-500 hover:bg-gray-100'
            }`}>
            {tab.key === 'transfers' && (tab as any).highlight && activeTab !== 'transfers' && (
              <span className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />
            )}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {activeTab === 'transfers' ? (
          /* ── Receive Material tab ── */
          <div>
            {/* Info banner */}
            <div className="mb-4 flex items-start gap-3 bg-teal-50 border border-teal-200 rounded-xl px-4 py-3">
              <TruckIcon size={15} className="text-teal-600 shrink-0 mt-0.5" />
              <p className="text-xs text-teal-800 leading-relaxed">
                These are stock transfers dispatched from the factory/warehouse that are <strong>in transit</strong> to your outlet.
                Verify the quantities received for each item and click <strong>Confirm Receipt</strong> to record the delivery.
              </p>
            </div>

            {transfersLoading ? (
              <div className="flex items-center justify-center py-20 text-gray-400">
                <Loader2 size={22} className="animate-spin mr-2" /> Loading incoming transfers…
              </div>
            ) : incomingTransfers.length === 0 ? (
              <div className="text-center py-20">
                <InboxIcon size={38} className="mx-auto text-gray-300 mb-3" />
                <p className="text-gray-500 text-sm font-medium">No pending incoming transfers</p>
                <p className="text-gray-400 text-xs mt-1">When stock is dispatched to your outlet it will appear here</p>
              </div>
            ) : (
              <div className="space-y-3">
                {incomingTransfers.map(t => (
                  <div key={t.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
                    {/* Transfer header */}
                    <div className="flex items-center gap-4 px-5 py-3 bg-gradient-to-r from-violet-50 to-blue-50 border-b border-violet-100">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gray-900">{t.transferNumber}</span>
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-700 border border-violet-200">
                            <TruckIcon size={9} /> In Transit
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-500">
                          <span className="font-medium text-gray-700">{t.fromOutlet?.name ?? `Outlet #${t.fromOutletId}`}</span>
                          <ArrowRight size={11} className="text-gray-400" />
                          <span className="font-medium text-gray-700">{t.toOutlet?.name ?? `Outlet #${t.toOutletId}`}</span>
                          <span className="text-gray-300 mx-1">·</span>
                          <span>{new Date(t.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => setReceivingTransfer(t)}
                        className="flex items-center gap-1.5 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold rounded-lg transition-colors shrink-0">
                        <CheckCircle2 size={13} /> Receive
                      </button>
                    </div>

                    {/* Items list */}
                    <div className="divide-y divide-gray-50">
                      {(t.items ?? []).map((it: any) => (
                        <div key={it.id} className="flex items-center gap-3 px-5 py-2.5">
                          <Package size={13} className="text-gray-400 shrink-0" />
                          <span className="flex-1 text-sm text-gray-700 min-w-0 truncate">{it.product?.name ?? `Product #${it.productId}`}</span>
                          <div className="text-xs text-right shrink-0">
                            <span className="font-semibold text-gray-900">{it.requestedQuantity}</span>
                            <span className="text-gray-400"> requested</span>
                            {Number(it.shippedQuantity) > 0 && (
                              <span className="ml-2 text-violet-600 font-semibold">{it.shippedQuantity} dispatched</span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {t.notes && (
                      <div className="px-5 py-2 bg-gray-50 border-t border-gray-100">
                        <p className="text-xs text-gray-500 italic">{t.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : !selectedProject ? (
          <div className="text-center py-24 text-gray-400">
            <Archive size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">Select a project to view material stock</p>
          </div>
        ) : activeTab === 'register' ? (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {stockLoading ? (
              <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
            ) : stockEntries.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <Archive size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No materials received yet</p>
                <button onClick={() => setReceiveOpen(true)} className="mt-2 text-sm text-teal-600 hover:underline">
                  + Record first receipt
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Material</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Received</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">→ Contractor</th>
                    <th className="text-right px-4 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">→ Inhouse</th>
                    <th className="text-right px-5 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {stockEntries.map((entry, i) => {
                    const bal = Number(entry.balance)
                    return (
                      <tr key={i} className={`hover:bg-gray-50/50 ${bal < 0 ? 'bg-red-50/40' : ''}`}>
                        <td className="px-5 py-3">
                          <p className="text-sm font-medium text-gray-900">{entry.materialName}</p>
                          {entry.specification && <p className="text-xs text-gray-400">{entry.specification}</p>}
                        </td>
                        <td className="px-4 py-3 text-sm text-right text-gray-900 tabular-nums">
                          {fmt(entry.totalReceived)} <span className="text-xs text-gray-400">{entry.unit}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums">
                          {Number(entry.issuedContractor) > 0
                            ? <span className="text-gray-900">{fmt(entry.issuedContractor)} <span className="text-xs text-gray-400">{entry.unit}</span></span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-right tabular-nums">
                          {Number(entry.issuedInhouse) > 0
                            ? <span className="text-gray-900">{fmt(entry.issuedInhouse)} <span className="text-xs text-gray-400">{entry.unit}</span></span>
                            : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="px-5 py-3 text-sm text-right tabular-nums font-semibold">
                          {bal < 0
                            ? <span className="text-red-600 flex items-center justify-end gap-1"><AlertTriangle size={12} />{fmt(bal)}</span>
                            : <span className="text-green-700">{fmt(bal)} <span className="text-xs font-normal text-gray-400">{entry.unit}</span></span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>
        ) : activeTab === 'receipts' ? (
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {receiptsLoading ? (
              <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
            ) : receipts.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-sm">No receipts yet</p>
                <button onClick={() => setReceiveOpen(true)} className="mt-2 text-sm text-teal-600 hover:underline">+ Record first receipt</button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Material</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Qty</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Source</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Vehicle</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {receipts.map(rec => (
                    <tr key={rec.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(rec.receivedDate)}</td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-medium text-gray-900">{rec.materialName}</p>
                        {rec.specification && <p className="text-xs text-gray-400">{rec.specification}</p>}
                      </td>
                      <td className="px-3 py-3 text-sm text-right text-gray-900 tabular-nums font-medium">
                        {fmt(rec.qty)} <span className="text-xs text-gray-400 font-normal">{rec.unit}</span>
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">
                        {rec.sourceType === 'TRANSFER'
                          ? <span className="inline-flex items-center gap-1 text-blue-600 font-medium">
                              <TruckIcon size={11} /> {rec.sourceRef ?? 'Transfer'}
                            </span>
                          : rec.supplierName
                            ? <span>{rec.supplierName}{rec.invoiceNo ? ` · ${rec.invoiceNo}` : ''}</span>
                            : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">{rec.vehicleNo ?? '—'}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button onClick={() => { setEditingReceipt(rec); setReceiveOpen(true) }}
                            className="p-1.5 text-gray-400 hover:text-blue-600 rounded transition-colors">
                            <Pencil size={13} />
                          </button>
                          <button onClick={() => window.confirm('Delete this receipt?') && deleteReceiptMutation.mutate(rec.id)}
                            className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          /* Issues tab */
          <div className="bg-white border border-gray-100 rounded-2xl shadow-sm overflow-hidden">
            {issuesLoading ? (
              <div className="text-center py-16 text-gray-400 text-sm">Loading…</div>
            ) : issues.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <p className="text-sm">No issues recorded yet</p>
                <button onClick={() => setIssueOpen(true)} className="mt-2 text-sm text-orange-500 hover:underline">+ Record first issue</button>
              </div>
            ) : (
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Date</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Material</th>
                    <th className="text-right px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Qty</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Issued To</th>
                    <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide">Vehicle</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {issues.map(issue => (
                    <tr key={issue.id} className="hover:bg-gray-50/50">
                      <td className="px-5 py-3 text-xs text-gray-500 whitespace-nowrap">{fmtDate(issue.issueDate)}</td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-medium text-gray-900">{issue.materialName}</p>
                        {issue.specification && <p className="text-xs text-gray-400">{issue.specification}</p>}
                      </td>
                      <td className="px-3 py-3 text-sm text-right text-gray-900 tabular-nums font-medium">
                        {fmt(issue.qty)} <span className="text-xs text-gray-400 font-normal">{issue.unit}</span>
                      </td>
                      <td className="px-3 py-3 text-xs">
                        {issue.issuedTo === 'SUBCONTRACTOR'
                          ? <span className="text-orange-600 font-medium">{issue.contractorName || 'Contractor'}</span>
                          : <span className="text-indigo-600 font-medium">Inhouse</span>}
                      </td>
                      <td className="px-3 py-3 text-xs text-gray-500">{issue.vehicleNo ?? '—'}</td>
                      <td className="px-3 py-3 text-right">
                        <button onClick={() => window.confirm('Delete this issue?') && deleteIssueMutation.mutate(issue.id)}
                          className="p-1.5 text-gray-400 hover:text-red-600 rounded transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {receiveOpen && (
        <ReceivePanel
          siteProjectId={projectId}
          editing={editingReceipt}
          onClose={() => { setReceiveOpen(false); setEditingReceipt(null) }}
        />
      )}
      {issueOpen && (
        <IssuePanel
          siteProjectId={projectId}
          stockEntries={stockEntries}
          onClose={() => setIssueOpen(false)}
        />
      )}
      {receivingTransfer && (
        <ReceiveTransferModal
          transfer={receivingTransfer}
          onClose={() => setReceivingTransfer(null)}
          onDone={() => setReceivingTransfer(null)}
        />
      )}
    </>
  )
}
