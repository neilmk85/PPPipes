import { useState, useMemo, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeftRight, Plus, X, Search, Package, Loader2,
  ChevronDown, CheckCircle2, Truck, Archive, Clock,
  ArrowRight, Eye, ChevronRight, ChevronUp,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { inventoryApi, outletApi, productApi, siteProjectApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// ── Status config ─────────────────────────────────────────────────────────────
const STATUS: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  REQUESTED:          { label: 'Requested',          color: 'bg-amber-50 text-amber-700 border-amber-200',  icon: <Clock size={11} /> },
  APPROVED:           { label: 'Approved',            color: 'bg-blue-50 text-blue-700 border-blue-200',    icon: <CheckCircle2 size={11} /> },
  IN_TRANSIT:         { label: 'In Transit',          color: 'bg-violet-50 text-violet-700 border-violet-200', icon: <Truck size={11} /> },
  RECEIVED:           { label: 'Received',            color: 'bg-green-50 text-green-700 border-green-200', icon: <Archive size={11} /> },
  PARTIALLY_RECEIVED: { label: 'Partial',             color: 'bg-orange-50 text-orange-700 border-orange-200', icon: <Archive size={11} /> },
  CANCELLED:          { label: 'Cancelled',           color: 'bg-gray-100 text-gray-500 border-gray-200',   icon: <X size={11} /> },
}

function StatusBadge({ status }: { status: string }) {
  const s = STATUS[status] ?? STATUS.REQUESTED
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${s.color}`}>
      {s.icon}{s.label}
    </span>
  )
}

function fmtDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

// ── Product search dropdown ───────────────────────────────────────────────────
function ProductPicker({ onSelect }: { onSelect: (p: any) => void }) {
  const [q, setQ] = useState('')
  const [dq, setDq] = useState('')
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null)

  useEffect(() => { const t = setTimeout(() => setDq(q), 200); return () => clearTimeout(t) }, [q])

  const { data: results = [], isFetching } = useQuery({
    queryKey: ['product-search-transfer', dq],
    queryFn: () => dq.trim() ? productApi.search(dq.trim()).then(r => r.data.data ?? []) : Promise.resolve([]),
    enabled: dq.trim().length > 0,
  })

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h)
  }, [])

  function updatePos() {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 300) })
    }
  }
  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => { window.removeEventListener('scroll', updatePos, true); window.removeEventListener('resize', updatePos) }
  }, [open])

  const showResults = open && q.trim() && (results as any[]).length > 0
  const showEmpty   = open && q.trim() && !isFetching && (results as any[]).length === 0 && dq === q

  const dropdown = pos && (showResults || showEmpty) ? createPortal(
    <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}>
      <div className="bg-white border border-gray-200 rounded-xl shadow-2xl overflow-hidden">
        {showResults && (results as any[]).slice(0, 10).map((p: any) => (
          <button key={p.id} onMouseDown={e => { e.preventDefault(); onSelect(p); setQ(''); setOpen(false) }}
            className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-violet-50 transition-colors text-left border-b border-gray-50 last:border-0">
            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
              <Package size={12} className="text-violet-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-gray-800 truncate">{p.name}</p>
              <p className="text-[10px] text-gray-400">{p.sku} · {p.unitOfMeasure}</p>
            </div>
          </button>
        ))}
        {showEmpty && (
          <div className="px-4 py-6 text-center">
            <Package size={20} className="mx-auto text-gray-300 mb-1" />
            <p className="text-sm text-gray-400">No products found</p>
          </div>
        )}
      </div>
    </div>, document.body
  ) : null

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input ref={inputRef} value={q} onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)} placeholder="Search material / product…"
          className="w-full pl-8 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-gray-50" />
        {isFetching && <Loader2 size={12} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-violet-400" />}
      </div>
      {dropdown}
    </div>
  )
}

// ── Create Transfer Modal ─────────────────────────────────────────────────────
interface LineItem { _id: number; product: any; qty: string }
let _lid = 1
function newLine(): LineItem { return { _id: _lid++, product: null, qty: '' } }

function CreateModal({ outlets, siteProjects, outletId, onClose, onCreated }: {
  outlets: any[]; siteProjects: any[]; outletId: number; onClose: () => void; onCreated: () => void
}) {
  const [fromId, setFromId] = useState(outletId)
  // value is "site:<id>" or "outlet:<id>" to distinguish type
  const [toValue, setToValue] = useState('')
  const [notes, setNotes]   = useState('')
  const [lines, setLines]   = useState<LineItem[]>([newLine()])
  const [visible, setVisible] = useState(false)

  useEffect(() => { const id = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(id) }, [])

  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: (data: any) => inventoryApi.createTransfer(data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transfers'] }); toast.success('Transfer created'); onCreated() },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create transfer'),
  })

  function handleClose() { setVisible(false); setTimeout(onClose, 250) }

  function setLine(id: number, patch: Partial<LineItem>) {
    setLines(ls => ls.map(l => l._id === id ? { ...l, ...patch } : l))
  }

  function resolveToOutletId(): number | null {
    if (!toValue) return null
    const [type, idStr] = toValue.split(':')
    const id = Number(idStr)
    if (type === 'outlet') return id
    // site — look up outletId from the selected project
    const project = siteProjects.find(s => s.id === id)
    return project?.outletId ?? null
  }

  function submit() {
    if (!toValue) { toast.error('Select a destination site or outlet'); return }
    const toOutletId = resolveToOutletId()
    if (!toOutletId) {
      toast.error('This site does not have a warehouse outlet yet. Please deploy the backend update first.')
      return
    }
    if (fromId === toOutletId) { toast.error('Source and destination must be different'); return }
    const validLines = lines.filter(l => l.product && parseFloat(l.qty) > 0)
    if (!validLines.length) { toast.error('Add at least one item with quantity'); return }
    mutation.mutate({
      fromOutletId: fromId,
      toOutletId,
      notes: notes.trim() || null,
      items: validLines.map(l => ({ productId: l.product.id, quantity: parseFloat(l.qty) })),
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(0.96)', transition: 'all 250ms cubic-bezier(0.22,1,0.36,1)' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <ArrowLeftRight size={17} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">New Stock Transfer</h2>
              <p className="text-xs text-violet-200 mt-0.5">Move stock between outlets</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center transition-colors">
            <X size={15} className="text-white" />
          </button>
        </div>

        <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">

          {/* From → To */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-center">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">From Outlet</label>
              <select value={fromId} onChange={e => setFromId(Number(e.target.value))}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
                {outlets.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </div>
            <div className="pt-5">
              <ArrowRight size={18} className="text-violet-400" />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">To Site / Outlet</label>
              <select value={toValue} onChange={e => setToValue(e.target.value)}
                className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white">
                <option value="">Select destination…</option>
                {siteProjects.length > 0 && (
                  <optgroup label="Project Sites">
                    {siteProjects.map(s => (
                      <option key={`site-${s.id}`} value={`site:${s.id}`}>{s.name}</option>
                    ))}
                  </optgroup>
                )}
                {outlets.filter(o => o.id !== fromId && !siteProjects.some((s: any) => s.outletId === o.id)).length > 0 && (
                  <optgroup label="Other Outlets">
                    {outlets
                      .filter(o => o.id !== fromId && !siteProjects.some((s: any) => s.outletId === o.id))
                      .map(o => <option key={`outlet-${o.id}`} value={`outlet:${o.id}`}>{o.name}</option>)
                    }
                  </optgroup>
                )}
              </select>
            </div>
          </div>

          {/* Items */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-2">Items to Transfer</label>
            <div className="space-y-2">
              {lines.map((line, idx) => (
                <div key={line._id} className="flex items-center gap-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex-1">
                    {line.product ? (
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center shrink-0">
                          <Package size={12} className="text-violet-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-gray-800 truncate">{line.product.name}</p>
                          <p className="text-[10px] text-gray-400">{line.product.unitOfMeasure}</p>
                        </div>
                        <button onClick={() => setLine(line._id, { product: null, qty: '' })}
                          className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <ProductPicker onSelect={p => setLine(line._id, { product: p })} />
                    )}
                  </div>
                  <div className="w-24 shrink-0">
                    <input type="number" min="0" step="1" value={line.qty}
                      onChange={e => setLine(line._id, { qty: e.target.value })}
                      placeholder="Qty"
                      className="w-full px-3 py-2.5 text-sm text-right border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white" />
                  </div>
                  {lines.length > 1 && (
                    <button onClick={() => setLines(ls => ls.filter(l => l._id !== line._id))}
                      className="w-8 h-8 flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setLines(ls => [...ls, newLine()])}
              className="mt-2 flex items-center gap-1.5 text-xs text-violet-600 hover:text-violet-700 font-semibold px-3 py-1.5 hover:bg-violet-50 rounded-lg transition-colors">
              <Plus size={13} /> Add Item
            </button>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5">Notes <span className="normal-case font-normal text-gray-400">(optional)</span></label>
            <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Reason for transfer…"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 resize-none" />
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={handleClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={submit} disabled={mutation.isPending}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60">
            {mutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <ArrowLeftRight size={15} />}
            {mutation.isPending ? 'Creating…' : 'Create Transfer'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Receive Modal ─────────────────────────────────────────────────────────────
function ReceiveModal({ transfer, onClose, onDone }: { transfer: any; onClose: () => void; onDone: () => void }) {
  const [qtys, setQtys] = useState<Record<number, string>>(() =>
    Object.fromEntries((transfer.items ?? []).map((it: any) => [it.id, String(it.requestedQuantity)]))
  )
  const [visible, setVisible] = useState(false)
  useEffect(() => { const id = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(id) }, [])

  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: () => inventoryApi.receiveTransfer(transfer.id, {
      receivedItems: (transfer.items ?? []).map((it: any) => ({
        itemId: it.id,
        receivedQuantity: parseFloat(qtys[it.id] || '0'),
      })),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transfers'] }); toast.success('Transfer received'); onDone() },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to receive'),
  })

  function handleClose() { setVisible(false); setTimeout(onClose, 250) }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        style={{ opacity: visible ? 1 : 0, transform: visible ? 'scale(1)' : 'scale(0.96)', transition: 'all 250ms cubic-bezier(0.22,1,0.36,1)' }}>

        <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-green-600 to-emerald-600">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
              <Archive size={17} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Receive Transfer</h2>
              <p className="text-xs text-green-200 mt-0.5">{transfer.transferNumber}</p>
            </div>
          </div>
          <button onClick={handleClose} className="w-8 h-8 rounded-lg bg-white/15 hover:bg-white/25 flex items-center justify-center">
            <X size={15} className="text-white" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <p className="text-xs text-gray-500">Enter the actual quantity received for each item.</p>
          {(transfer.items ?? []).map((it: any) => (
            <div key={it.id} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-800 truncate">{it.product?.name ?? `Product #${it.productId}`}</p>
                <p className="text-xs text-gray-400">Requested: {it.requestedQuantity} · Shipped: {it.shippedQuantity}</p>
              </div>
              <div className="w-24 shrink-0">
                <input type="number" min="0" step="1" value={qtys[it.id] ?? ''}
                  onChange={e => setQtys(q => ({ ...q, [it.id]: e.target.value }))}
                  className="w-full px-3 py-2 text-sm text-right border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-300 bg-white" />
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
          <button onClick={handleClose} className="flex-1 py-2.5 text-sm font-semibold text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">Cancel</button>
          <button onClick={() => mutation.mutate()} disabled={mutation.isPending}
            className="flex-1 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-xl shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-60">
            {mutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Archive size={15} />}
            {mutation.isPending ? 'Saving…' : 'Confirm Receipt'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Transfer Row ──────────────────────────────────────────────────────────────
function TransferRow({ transfer, outletMap, onShip, onReceive, shipPending }: {
  transfer: any; outletMap: Record<number, string>
  onShip: () => void; onReceive: () => void
  shipPending: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const { status } = transfer

  return (
    <>
      <tr className="border-b border-gray-100 hover:bg-gray-50/60 transition-colors cursor-pointer" onClick={() => setExpanded(v => !v)}>
        <td className="px-5 py-3.5 w-8">
          <span className={`inline-flex items-center justify-center w-5 h-5 rounded-md transition-all ${expanded ? 'bg-violet-600 text-white' : 'bg-gray-100 text-gray-400'}`}>
            {expanded ? <ChevronUp size={11} /> : <ChevronRight size={11} />}
          </span>
        </td>
        <td className="px-4 py-3.5">
          <p className="text-sm font-bold text-gray-900">{transfer.transferNumber}</p>
          <p className="text-xs text-gray-400 mt-0.5">{fmtDate(transfer.createdAt)}</p>
        </td>
        <td className="px-4 py-3.5">
          <div className="flex items-center gap-2 text-sm text-gray-700">
            <span className="font-medium truncate max-w-[120px]">{outletMap[transfer.fromOutletId] ?? `#${transfer.fromOutletId}`}</span>
            <ArrowRight size={13} className="text-gray-400 shrink-0" />
            <span className="font-medium truncate max-w-[120px]">{outletMap[transfer.toOutletId] ?? `#${transfer.toOutletId}`}</span>
          </div>
        </td>
        <td className="px-4 py-3.5">
          <p className="text-sm text-gray-700">{(transfer.items ?? []).length} item{(transfer.items ?? []).length !== 1 ? 's' : ''}</p>
        </td>
        <td className="px-4 py-3.5">
          <StatusBadge status={status} />
        </td>
        <td className="px-4 py-3.5 text-right" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-end gap-2">
            {status === 'APPROVED' && (
              <button onClick={onShip} disabled={shipPending}
                className="text-xs font-semibold px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white rounded-lg disabled:opacity-50 transition-colors flex items-center gap-1">
                {shipPending ? <Loader2 size={11} className="animate-spin" /> : <Truck size={11} />} Mark Shipped
              </button>
            )}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr className="border-b border-violet-100">
          <td colSpan={6} className="p-0">
            <div className="bg-violet-50/40 px-8 py-4 border-b-2 border-violet-100">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-2">Items</p>
                  <div className="space-y-2">
                    {(transfer.items ?? []).map((it: any) => (
                      <div key={it.id} className="flex items-center justify-between gap-3 bg-white rounded-lg px-3 py-2 border border-violet-100">
                        <div className="flex items-center gap-2 min-w-0">
                          <Package size={13} className="text-violet-400 shrink-0" />
                          <span className="text-sm font-medium text-gray-800 truncate">{it.product?.name ?? `Product #${it.productId}`}</span>
                        </div>
                        <div className="text-xs text-gray-500 shrink-0 text-right">
                          <span className="font-semibold text-gray-800">{it.requestedQuantity}</span> req
                          {Number(it.shippedQuantity) > 0 && <> · <span className="font-semibold text-violet-700">{it.shippedQuantity}</span> shipped</>}
                          {Number(it.receivedQuantity) > 0 && <> · <span className="font-semibold text-green-700">{it.receivedQuantity}</span> rcvd</>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  {transfer.notes && (
                    <div>
                      <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1">Notes</p>
                      <p className="text-sm text-gray-600 italic">{transfer.notes}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest mb-1">Created By</p>
                    <p className="text-sm text-gray-700">{transfer.createdBy ?? '—'}</p>
                  </div>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const STATUS_TABS = [
  { key: '', label: 'All' },
  { key: 'REQUESTED', label: 'Requested' },
  { key: 'APPROVED', label: 'Approved' },
  { key: 'IN_TRANSIT', label: 'In Transit' },
  { key: 'RECEIVED', label: 'Received' },
]

function TransfersPageFull() {
  const { outletId } = useAuthStore()
  const qc = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [receiveTransfer, setReceiveTransfer] = useState<any>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [shippingId, setShippingId] = useState<number | null>(null)

  const { data: outlets = [] } = useQuery({
    queryKey: ['outlets'],
    queryFn: () => outletApi.getAll().then(r => r.data.data ?? []),
  })

  const { data: siteProjects = [] } = useQuery({
    queryKey: ['site-projects-for-transfer'],
    queryFn: () => siteProjectApi.getAll({ status: 'ACTIVE' }).then(r => r.data.data ?? []),
  })

  // Build outlet name map — prefer site project name over raw outlet name
  const outletMap = useMemo(() => {
    const map: Record<number, string> = {}
    ;(outlets as any[]).forEach((o: any) => { map[o.id] = o.name })
    // Override with human-friendly site project names
    ;(siteProjects as any[]).forEach((s: any) => { if (s.outletId) map[s.outletId] = s.name })
    return map
  }, [outlets, siteProjects])

  const { data: transfersData, isLoading } = useQuery({
    queryKey: ['transfers', outletId, statusFilter],
    queryFn: () => inventoryApi.getTransfers(outletId!, { status: statusFilter || undefined, size: 200 })
      .then(r => r.data.data ?? []),
    enabled: !!outletId,
  })

  const transfers: any[] = Array.isArray(transfersData) ? transfersData : (transfersData as any)?.content ?? []

  const shipMutation = useMutation({
    mutationFn: (id: number) => inventoryApi.shipTransfer(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['transfers'] }); toast.success('Transfer marked as shipped'); setShippingId(null) },
    onError: (e: any) => { toast.error(e.response?.data?.message ?? 'Failed to ship'); setShippingId(null) },
  })

  // Summary counts
  const counts = useMemo(() => {
    const all: any[] = Array.isArray(transfersData) ? transfersData : []
    return {
      requested: all.filter(t => t.status === 'REQUESTED').length,
      inTransit: all.filter(t => t.status === 'IN_TRANSIT').length,
      received:  all.filter(t => t.status === 'RECEIVED').length,
    }
  }, [transfersData])

  return (
    <div className="min-h-screen bg-gray-50" style={{ position: 'relative' }}>
      {/* Disabled overlay — blocks all interaction */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 9999, cursor: 'not-allowed' }} />

      {/* Hero */}
      <div className="bg-gradient-to-r from-violet-700 via-violet-600 to-blue-600 text-white overflow-hidden">
        <div className="px-6 py-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <ArrowLeftRight size={22} />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Inventory</p>
              <h1 className="text-xl font-extrabold tracking-tight">Site Stock Transfers</h1>
              <p className="text-blue-200 text-sm mt-0.5">Move stock between outlets — track request, approval, dispatch and receipt</p>
            </div>
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-white text-violet-700 px-4 py-2.5 rounded-xl text-sm font-semibold hover:bg-violet-50 transition shadow-sm shrink-0">
            <Plus size={16} /> New Transfer
          </button>
        </div>

        {/* Stat strip */}
        <div className="border-t border-white/15 grid grid-cols-3 divide-x divide-white/15">
          {[
            { label: 'Pending Approval', value: counts.requested, color: 'text-amber-300' },
            { label: 'In Transit',       value: counts.inTransit, color: 'text-violet-200' },
            { label: 'Received',         value: counts.received,  color: 'text-white' },
          ].map(s => (
            <div key={s.label} className="px-6 py-3.5">
              <p className={`text-2xl font-extrabold tabular-nums leading-none ${s.color}`}>{s.value}</p>
              <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Status tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1 pt-3">
          {STATUS_TABS.map(tab => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              className={`px-4 py-2 text-sm font-semibold rounded-t-lg transition-colors ${
                statusFilter === tab.key
                  ? 'text-violet-700 border-b-2 border-violet-600 bg-violet-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="px-6 py-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          {isLoading ? (
            <div className="flex items-center justify-center py-20 text-gray-400">
              <Loader2 size={24} className="animate-spin mr-2" /> Loading…
            </div>
          ) : transfers.length === 0 ? (
            <div className="text-center py-20">
              <ArrowLeftRight size={40} className="mx-auto text-gray-300 mb-3" />
              <p className="text-gray-500 text-sm">No transfers found</p>
              <button onClick={() => setShowCreate(true)} className="mt-3 text-violet-600 text-sm hover:underline">
                Create first transfer →
              </button>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ background: 'linear-gradient(to right, #f5f3ff, #eff6ff)', borderBottom: '1px solid #e0e7ff' }}>
                  <th className="w-8 px-5 py-3" />
                  {['Transfer #', 'Route', 'Items', 'Status', ''].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-gray-900 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {transfers.map(t => (
                  <TransferRow
                    key={t.id}
                    transfer={t}
                    outletMap={outletMap}
                    shipPending={shippingId === t.id && shipMutation.isPending}
                    onShip={() => { setShippingId(t.id); shipMutation.mutate(t.id) }}
                    onReceive={() => setReceiveTransfer(t)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCreate && outlets.length > 0 && (
        <CreateModal
          outlets={outlets as any[]}
          siteProjects={siteProjects as any[]}
          outletId={outletId!}
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)}
        />
      )}
      {receiveTransfer && (
        <ReceiveModal
          transfer={receiveTransfer}
          onClose={() => setReceiveTransfer(null)}
          onDone={() => setReceiveTransfer(null)}
        />
      )}
    </div>
  )
}

// ── missing import ────────────────────────────────────────────────────────────
function Trash2({ size, className }: { size: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <polyline points="3 6 5 6 21 6"/>
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
      <path d="M10 11v6M14 11v6"/>
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
    </svg>
  )
}

export default function TransfersPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-4">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-2xl bg-indigo-100 flex items-center justify-center mx-auto mb-6">
          <svg className="w-10 h-10 text-indigo-500" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 21 3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5" />
          </svg>
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">Coming Soon</h1>
        <p className="text-sm text-gray-500">Site Stock Transfers is being prepared and will be available shortly.</p>
      </div>
    </div>
  )
}

// The full implementation is preserved in TransfersPageFull above — swap the default export to restore it.
