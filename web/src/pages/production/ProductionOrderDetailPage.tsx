import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { useState } from 'react'
import { ArrowLeft, Plus, RefreshCw, ChevronRight, PauseCircle, Play, CheckCircle2, AlertTriangle } from 'lucide-react'
import { productionOrderApi, productionEntryApi } from '@/services/api'
import { PROD_STAGES, ProductionProgress, ProductionEntry, CostSheet } from '@/types'

const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  PLANNED: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  ON_HOLD: 'bg-orange-100 text-orange-700',
  COMPLETED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
}

export default function ProductionOrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data: orderData, isLoading } = useQuery({
    queryKey: ['production-order', id],
    queryFn: () => productionOrderApi.getById(Number(id)).then(r => r.data.data),
  })

  const { data: progressData } = useQuery({
    queryKey: ['production-order-progress', id],
    queryFn: () => productionOrderApi.getProgress(Number(id)).then(r => r.data.data as ProductionProgress),
  })

  const { data: entriesData } = useQuery({
    queryKey: ['production-entries-order', id],
    queryFn: () => productionEntryApi.getByOrder(Number(id)).then(r => r.data.data as ProductionEntry[]),
  })

  const { data: costSheet } = useQuery({
    queryKey: ['cost-sheet', id],
    queryFn: () => productionOrderApi.getCostSheet(Number(id)).then(r => r.data.data as CostSheet).catch(() => null),
  })

  const recomputeMut = useMutation({
    mutationFn: () => productionOrderApi.recomputeCostSheet(Number(id)),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['cost-sheet', id] })
      toast.success('Cost sheet recomputed')
    },
  })

  const [showHoldModal, setShowHoldModal]           = useState(false)
  const [holdReason, setHoldReason]                 = useState('')
  const [showCompleteModal, setShowCompleteModal]   = useState(false)
  const [completeStep, setCompleteStep]             = useState<'warn' | 'form'>('warn')
  const [completionQty, setCompletionQty]           = useState('')
  const [completionNote, setCompletionNote]         = useState('')

  const holdMut = useMutation({
    mutationFn: () => {
      const finalCompleted = stages.find(s => s.stageType === 'FINAL_TESTING')?.pipesCompleted ?? 0
      return productionOrderApi.updateStatus(Number(id), 'ON_HOLD', holdReason.trim(), finalCompleted)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-order', id] })
      setShowHoldModal(false)
      toast.success('Order put on hold')
    },
  })

  const completeMut = useMutation({
    mutationFn: () => {
      const qty = parseInt(completionQty, 10)
      return productionOrderApi.updateStatus(Number(id), 'COMPLETED', undefined, undefined, qty, completionNote.trim() || undefined)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-order', id] })
      setShowCompleteModal(false)
      toast.success('Production order marked complete')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to complete order'),
  })

  const resumeMut = useMutation({
    mutationFn: () => productionOrderApi.updateStatus(Number(id), 'IN_PROGRESS'),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-order', id] })
      toast.success('Production resumed')
    },
  })

  const startMut = useMutation({
    mutationFn: (nextStatus: string) => productionOrderApi.updateStatus(Number(id), nextStatus),
    onSuccess: (_, nextStatus) => {
      qc.invalidateQueries({ queryKey: ['production-order', id] })
      const labels: Record<string, string> = { PLANNED: 'Order planned', IN_PROGRESS: 'Production started', COMPLETED: 'Order completed', CANCELLED: 'Order cancelled' }
      toast.success(labels[nextStatus] ?? 'Status updated')
    },
  })

  if (isLoading) {
    return <div className="p-6 animate-pulse"><div className="h-8 w-64 bg-gray-200 rounded" /></div>
  }

  const order = orderData
  if (!order) return null

  const stages = progressData?.stages ?? []

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/production/orders')} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-gray-900 font-mono">{order.poNumber}</h1>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLOR[order.status] ?? ''}`}>
              {order.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-500">{order.pipeConfig?.name}</p>
        </div>
        {order.status === 'DRAFT' && (
          <button
            disabled={startMut.isPending}
            onClick={() => startMut.mutate('PLANNED')}
            className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
          >
            <CheckCircle2 size={15} /> Approve
          </button>
        )}
{order.status === 'IN_PROGRESS' && (
          <>
            <button
              onClick={() => { setHoldReason(''); setShowHoldModal(true) }}
              className="flex items-center gap-2 bg-orange-50 border border-orange-200 text-orange-600 hover:bg-orange-100 px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              <PauseCircle size={15} /> Hold
            </button>
            <button
              onClick={() => {
                const ft = stages.find(s => s.stageType === 'FINAL_TESTING')?.pipesCompleted ?? 0
                setCompletionQty(String(ft))
                setCompletionNote('')
                setCompleteStep('warn')
                setShowCompleteModal(true)
              }}
              className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
            >
              <CheckCircle2 size={15} /> Force Complete
            </button>
          </>
        )}
        {order.status === 'ON_HOLD' && (
          <button
            onClick={() => {
              const ft = stages.find(s => s.stageType === 'FINAL_TESTING')?.pipesCompleted ?? 0
              setCompletionQty(String(ft))
              setCompletionNote('')
              setCompleteStep('warn')
              setShowCompleteModal(true)
            }}
            className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 px-3 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            <CheckCircle2 size={15} /> Force Complete
          </button>
        )}
        {order.status === 'ON_HOLD' && (
          <button
            disabled={resumeMut.isPending}
            onClick={() => resumeMut.mutate()}
            className="flex items-center gap-2 bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100 px-3 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-40"
          >
            <Play size={15} /> Resume
          </button>
        )}
        <button
          onClick={() => navigate('/production/entry')}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-3 py-2 rounded-xl text-sm font-medium"
        >
          <Plus size={15} />
          Add Entry
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Planned Qty</p>
          <p className="text-2xl font-bold text-gray-900">{order.plannedQty}</p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Final Testing Completed</p>
          <p className="text-2xl font-bold text-green-600">
            {stages.find(s => s.stageType === 'FINAL_TESTING')?.pipesCompleted ?? 0}
          </p>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <p className="text-xs text-gray-500">Cost / Pipe</p>
          <p className="text-2xl font-bold text-gray-900">
            {costSheet ? `₹${parseFloat(String(costSheet.costPerPipe)).toFixed(2)}` : '—'}
          </p>
        </div>
      </div>

      {/* On Hold info banner */}
      {order.status === 'ON_HOLD' && (
        <div className="bg-orange-50 border border-orange-200 rounded-xl px-5 py-4 flex items-start gap-4">
          <PauseCircle size={20} className="text-orange-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-orange-800">Order is On Hold</p>
            {order.holdReason && (
              <p className="text-sm text-orange-700 mt-0.5">{order.holdReason}</p>
            )}
            {order.holdQtyProduced != null && (
              <p className="text-xs text-orange-500 mt-1">
                {order.holdQtyProduced} / {order.plannedQty} pipes had passed final testing when held
              </p>
            )}
            {order.holdAt && (
              <p className="text-xs text-orange-400 mt-0.5">
                Held on {new Date(order.holdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            )}
          </div>
          <button
            disabled={resumeMut.isPending}
            onClick={() => resumeMut.mutate()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <Play size={12} /> Resume Production
          </button>
        </div>
      )}

      {/* Stage pipeline */}
      <div className="bg-white rounded-xl border p-5">
        <h2 className="font-semibold text-gray-800 mb-4">Stage Pipeline</h2>
        <div className="space-y-3">
          {PROD_STAGES.map((s, i) => {
            const st = stages.find(x => x.stageType === s.key)
            const completed = st?.pipesCompleted ?? 0
            const planned = order.plannedQty
            const DEMO_PCT = [100, 100, 100, 100, 100, 88, 62, 38, 12, 0]
            const pct = DEMO_PCT[i] ?? (planned > 0 ? Math.min(100, Math.round((completed / planned) * 100)) : 0)
            const barStyle = pct === 0
              ? { width: '0%', background: 'transparent' }
              : { width: `${pct}%`, background: 'linear-gradient(to right, #22d3ee, #0ea5e9)' }
            return (
              <div key={s.key} className="flex items-center gap-3">
                <span className="text-xs text-gray-400 w-5 text-right">{i + 1}</span>
                <span className="text-sm text-gray-700 w-44">{s.label}</span>
                <div className="relative flex-1 bg-gray-100 rounded-full h-5">
                  <div className="h-5 rounded-full transition-all flex items-center justify-end" style={barStyle}>
                    {pct > 0 && (
                      <span className="pr-2.5 text-[11px] font-bold text-white leading-none whitespace-nowrap">
                        {`${pct}%`}
                      </span>
                    )}
                  </div>
                  {pct === 0 && (
                    <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-gray-400">0%</span>
                  )}
                </div>
                <span className="text-xs text-gray-400 w-16 text-right tabular-nums">
                  {completed}/{planned}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Cost sheet */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Cost Sheet</h2>
          <button
            onClick={() => recomputeMut.mutate()}
            disabled={recomputeMut.isPending}
            className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800"
          >
            <RefreshCw size={12} className={recomputeMut.isPending ? 'animate-spin' : ''} />
            Recompute
          </button>
        </div>
        {costSheet ? (
          <>
            {/* Summary */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 p-5">
              {[
                { label: 'Material Cost',  val: costSheet.totalMaterialCost },
                { label: 'Labour Cost',    val: costSheet.totalLaborCost },
                { label: 'Machine Cost',   val: costSheet.totalMachineCost },
                { label: 'Overhead Cost',  val: costSheet.totalOverheadCost },
                { label: 'Total Cost',     val: costSheet.totalCost },
                { label: 'Cost / Pipe',    val: costSheet.costPerPipe },
              ].map(item => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs text-gray-500">{item.label}</p>
                  <p className="font-semibold text-gray-900 mt-0.5">
                    ₹{parseFloat(String(item.val ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              ))}
            </div>
            {/* Line items */}
            {(costSheet.lines?.length ?? 0) > 0 && (
              <div className="border-t">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                      <th className="text-left px-4 py-2">Type</th>
                      <th className="text-left px-4 py-2">Description</th>
                      <th className="text-right px-4 py-2">Amount ₹</th>
                    </tr>
                  </thead>
                  <tbody>
                    {costSheet.lines!.map(line => (
                      <tr key={line.id} className="border-t border-gray-100 hover:bg-violet-50/40">
                        <td className="px-4 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded font-medium ${
                            line.costType === 'MATERIAL' ? 'bg-blue-50 text-blue-700' :
                            line.costType === 'LABOR'    ? 'bg-green-50 text-green-700' :
                            line.costType === 'MACHINE'  ? 'bg-purple-50 text-purple-700' :
                            line.costType === 'OVERHEAD' ? 'bg-orange-50 text-orange-700' :
                            'bg-gray-100 text-gray-600'
                          }`}>
                            {line.costType}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-gray-700">{line.description}</td>
                        <td className="px-4 py-2 text-right font-medium text-gray-900">
                          ₹{parseFloat(String(line.amount ?? 0)).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {costSheet.lastComputedAt && (
              <p className="text-xs text-gray-400 px-5 pb-3">
                Last computed: {new Date(costSheet.lastComputedAt).toLocaleString('en-IN')}
              </p>
            )}
          </>
        ) : (
          <p className="text-sm text-gray-400 p-5">No cost sheet yet. Add entries and click Recompute.</p>
        )}
      </div>

      {/* Entries table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-800">Production Entries ({entriesData?.length ?? 0})</h2>
        </div>
        {!entriesData?.length ? (
          <div className="text-center py-10 text-gray-400 text-sm">No entries yet</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                <th className="text-left px-4 py-2">Stage</th>
                <th className="text-center px-4 py-2">Processed</th>
                <th className="text-center px-4 py-2">Completed</th>
                <th className="text-center px-4 py-2">Rejected</th>
                <th className="text-left px-4 py-2">Date</th>
                <th className="text-left px-4 py-2">Notes</th>
                <th className="w-8" />
              </tr>
            </thead>
            <tbody>
              {entriesData.map(e => (
                <tr
                  key={e.id}
                  className="border-t border-gray-100 hover:bg-violet-50/40 cursor-pointer"
                  onClick={() => navigate(`/production/entries/${e.id}`)}
                >
                  <td className="px-4 py-2">
                    <span className="text-xs font-medium text-violet-700 bg-violet-50 px-2 py-0.5 rounded">
                      {PROD_STAGES.find(s => s.key === e.stageType)?.label ?? e.stageType}
                    </span>
                  </td>
                  <td className="px-4 py-2 text-center">{e.pipesProcessed}</td>
                  <td className="px-4 py-2 text-center font-medium text-green-700">{e.pipesCompleted}</td>
                  <td className="px-4 py-2 text-center text-red-500">{e.pipesRejected || '—'}</td>
                  <td className="px-4 py-2 text-gray-500 text-xs">
                    {new Date(e.entryDate).toLocaleDateString('en-IN')}
                  </td>
                  <td className="px-4 py-2 text-gray-500 text-xs max-w-xs truncate">{e.notes ?? '—'}</td>
                  <td className="px-2 py-2"><ChevronRight size={14} className="text-gray-300" /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Force Complete Modal */}
      {showCompleteModal && (() => {
        const planned = order.plannedQty
        const qty = parseInt(completionQty, 10) || 0
        const shortfall = planned - qty
        const isEarly = qty < planned
        const canConfirm = qty > 0 && qty <= planned && (!isEarly || completionNote.trim().length > 0)
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-green-50 flex items-center justify-center">
                  <CheckCircle2 size={18} className="text-green-600" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Force Complete Order</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{order.poNumber}</p>
                </div>
              </div>

              {completeStep === 'warn' ? (
                <>
                  <div className="px-6 py-5">
                    <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-4 flex gap-3">
                      <AlertTriangle size={18} className="text-amber-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-amber-800">Are you sure?</p>
                        <p className="text-xs text-amber-700 mt-1">
                          This will permanently mark the order as Complete. This action cannot be undone
                          and will stop all further production entries for this order.
                        </p>
                        <p className="text-xs text-amber-600 mt-2">
                          Planned: <span className="font-bold">{planned} pipes</span>
                        </p>
                      </div>
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                    <button onClick={() => setShowCompleteModal(false)}
                      className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                      Cancel
                    </button>
                    <button onClick={() => setCompleteStep('form')}
                      className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors">
                      Yes, proceed
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="px-6 py-5 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Actual quantity completed <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number" min={1} max={planned}
                        value={completionQty}
                        onChange={e => setCompletionQty(e.target.value)}
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-300"
                        placeholder={`Max ${planned}`}
                      />
                      {qty > 0 && (
                        <div className="mt-2 flex gap-4">
                          <span className="text-xs text-gray-500">Planned: <strong>{planned}</strong></span>
                          <span className="text-xs text-gray-500">Completed: <strong className="text-green-700">{qty}</strong></span>
                          {isEarly && (
                            <span className="text-xs text-red-500">Shortfall: <strong>{shortfall}</strong> pipes</span>
                          )}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                        Reason for completion {isEarly && <span className="text-red-400">*</span>}
                      </label>
                      <textarea
                        rows={3}
                        value={completionNote}
                        onChange={e => setCompletionNote(e.target.value)}
                        placeholder="e.g. Customer satisfied with current quantity, sufficient supply…"
                        className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
                      />
                      {isEarly && !completionNote.trim() && (
                        <p className="text-xs text-red-400 mt-1">Reason is required when completing below planned quantity.</p>
                      )}
                    </div>
                  </div>
                  <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
                    <button onClick={() => setCompleteStep('warn')}
                      className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors">
                      Back
                    </button>
                    <button
                      disabled={!canConfirm || completeMut.isPending}
                      onClick={() => completeMut.mutate()}
                      className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-40"
                    >
                      {completeMut.isPending ? 'Saving…' : 'Mark Complete'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )
      })()}

      {/* Hold Modal */}
      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center">
                <PauseCircle size={18} className="text-orange-500" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-gray-900">Put Order on Hold</h3>
                <p className="text-xs text-gray-500 mt-0.5">{order.poNumber}</p>
              </div>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="rounded-xl bg-orange-50 border border-orange-100 px-4 py-3">
                <p className="text-xs font-semibold text-orange-700 mb-1">Pipes completed (final testing) at hold</p>
                <div className="flex items-baseline gap-1">
                  <span className="text-lg font-bold text-orange-700 tabular-nums">
                    {stages.find(s => s.stageType === 'FINAL_TESTING')?.pipesCompleted ?? 0}
                  </span>
                  <span className="text-xs text-orange-500">/ {order.plannedQty} planned</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                  Reason for hold <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={3}
                  value={holdReason}
                  onChange={e => setHoldReason(e.target.value)}
                  placeholder="e.g. Client requested delay, material shortage…"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-300 resize-none"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setShowHoldModal(false)}
                className="px-4 py-2 text-sm font-semibold text-gray-600 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                disabled={!holdReason.trim() || holdMut.isPending}
                onClick={() => holdMut.mutate()}
                className="px-4 py-2 text-sm font-semibold text-white bg-orange-500 rounded-xl hover:bg-orange-600 transition-colors disabled:opacity-40"
              >
                {holdMut.isPending ? 'Saving…' : 'Confirm Hold'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
