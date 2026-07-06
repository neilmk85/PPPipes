import { useState, useEffect, useRef, useMemo } from 'react'
import { useQuery, useQueries, useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import {
  Save, Info, Hammer, FlaskConical, Box, RotateCw,
  PackageOpen, Clock, Wind, Paintbrush, CheckCircle2,
  Search, X, PenLine, ListChecks, Layers,
  CalendarDays, AlarmClock, AlertTriangle,
  BarChart3, ClipboardCheck, Truck, Cylinder,
} from 'lucide-react'
import { productionOrderApi, productionEntryApi, loadingRecordApi, pdiApi, inventoryApi, pipeConfigApi } from '@/services/api'
import { siloFillsApi } from '@/services/businessApi'
import { PROD_STAGES, MATERIAL_STAGES, BED_TYPES, PriorStageInfo } from '@/types'

interface MaterialInput {
  pipeConfigMaterialId?: number
  materialProductId: number
  name: string
  qtyPerPipe: number
  expectedQty: number
  actualQty: string
  uom: string
}

interface OrderEntryData {
  pipesProcessed: string
  pipesCompleted: string
  entryDate: string
  notes: string
  bedType: string
  shiftName: string
  materialInputs: MaterialInput[]
}

const defaultEntryData = (): OrderEntryData => ({
  pipesProcessed: '',
  pipesCompleted: '',
  entryDate: new Date().toISOString().split('T')[0],
  notes: '',
  bedType: '',
  shiftName: '',
  materialInputs: [],
})

// ── Stage meta ────────────────────────────────────────────────────────────────

const STAGE_META: Record<string, {
  icon: React.ElementType; accent: string; bg: string
  border: string; hoverBg: string; hoverShadow: string; activeShadow: string
}> = {
  FABRICATION:         { icon: Hammer,       accent: 'text-orange-600',  bg: 'bg-orange-50',  border: 'border-indigo-300',  hoverBg: 'hover:bg-orange-50/60',  hoverShadow: 'hover:shadow-orange-100',  activeShadow: 'shadow-orange-300/40'  },
  FABRICATION_TESTING: { icon: FlaskConical, accent: 'text-pink-600',    bg: 'bg-pink-50',    border: 'border-indigo-300',  hoverBg: 'hover:bg-pink-50/60',    hoverShadow: 'hover:shadow-pink-100',    activeShadow: 'shadow-pink-300/40'    },
  MOULDING:            { icon: Box,          accent: 'text-amber-600',   bg: 'bg-amber-50',   border: 'border-indigo-300',  hoverBg: 'hover:bg-amber-50/60',   hoverShadow: 'hover:shadow-amber-100',   activeShadow: 'shadow-amber-300/40'   },
  SPINNING:            { icon: RotateCw,     accent: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-indigo-300',  hoverBg: 'hover:bg-blue-50/60',    hoverShadow: 'hover:shadow-blue-100',    activeShadow: 'shadow-blue-300/40'    },
  DEMOULDING:          { icon: PackageOpen,  accent: 'text-teal-600',    bg: 'bg-teal-50',    border: 'border-indigo-300',  hoverBg: 'hover:bg-teal-50/60',    hoverShadow: 'hover:shadow-teal-100',    activeShadow: 'shadow-teal-300/40'    },
  CURING_1:            { icon: Clock,        accent: 'text-cyan-600',    bg: 'bg-cyan-50',    border: 'border-indigo-300',  hoverBg: 'hover:bg-cyan-50/60',    hoverShadow: 'hover:shadow-cyan-100',    activeShadow: 'shadow-cyan-300/40'    },
  CURING_2:            { icon: Clock,        accent: 'text-sky-600',     bg: 'bg-sky-50',     border: 'border-indigo-300',  hoverBg: 'hover:bg-sky-50/60',     hoverShadow: 'hover:shadow-sky-100',     activeShadow: 'shadow-sky-300/40'     },
  WINDING:             { icon: Wind,         accent: 'text-indigo-600',  bg: 'bg-indigo-50',  border: 'border-indigo-300',  hoverBg: 'hover:bg-indigo-50/60',  hoverShadow: 'hover:shadow-indigo-100',  activeShadow: 'shadow-indigo-300/40'  },
  COATING:             { icon: Paintbrush,   accent: 'text-violet-600',  bg: 'bg-violet-50',  border: 'border-indigo-300',  hoverBg: 'hover:bg-violet-50/60',  hoverShadow: 'hover:shadow-violet-100',  activeShadow: 'shadow-violet-300/40'  },
  FINAL_TESTING:       { icon: CheckCircle2, accent: 'text-green-600',   bg: 'bg-green-50',   border: 'border-indigo-300',  hoverBg: 'hover:bg-green-50/60',   hoverShadow: 'hover:shadow-green-100',   activeShadow: 'shadow-green-300/40'   },
}

// ── Delivery stages ───────────────────────────────────────────────────────────

const DELIVERY_STAGES: { key: string; label: string; sub: string }[] = [
  { key: 'PDI',     label: 'PDI',     sub: 'Pre-Delivery Inspection' },
  { key: 'LOADING', label: 'Loading', sub: 'Pipe Loading & Dispatch'  },
]

const DELIVERY_STAGE_META: Record<string, {
  icon: React.ElementType; accent: string; bg: string
  border: string; hoverBg: string
}> = {
  PDI:     { icon: ClipboardCheck, accent: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-300', hoverBg: 'hover:bg-emerald-50/60' },
  LOADING: { icon: Truck,          accent: 'text-blue-600',    bg: 'bg-blue-50',    border: 'border-blue-300',    hoverBg: 'hover:bg-blue-50/60'    },
}

// ── Stage columns for the overview table ─────────────────────────────────────

const STAGE_COLS: { key: string; label: string; field: string; accent: string }[] = [
  { key: 'FABRICATION',         label: 'Fabrication',  field: 'fabrication',        accent: 'text-orange-600'  },
  { key: 'FABRICATION_TESTING', label: 'Fab. Test',    field: 'fabricationTesting', accent: 'text-pink-600'    },
  { key: 'MOULDING',            label: 'Moulding',     field: 'moulding',           accent: 'text-amber-600'   },
  { key: 'SPINNING',            label: 'Spinning',     field: 'spinning',           accent: 'text-blue-600'    },
  { key: 'DEMOULDING',          label: 'Demoulding',   field: 'demoulding',         accent: 'text-teal-600'    },
  { key: 'CURING_1',            label: 'Curing 1',     field: 'curing1',            accent: 'text-cyan-600'    },
  { key: 'WINDING',             label: 'Winding',      field: 'winding',            accent: 'text-indigo-600'  },
  { key: 'COATING',             label: 'Coating',      field: 'coating',            accent: 'text-violet-600'  },
  { key: 'CURING_2',            label: 'Curing 2',     field: 'curing2',            accent: 'text-sky-600'     },
  { key: 'FINAL_TESTING',       label: 'Final Test',   field: 'finalTesting',       accent: 'text-green-600'   },
]

// ── Production Stage Overview Table ──────────────────────────────────────────

function ProductionStageTable({ selectedStage }: { selectedStage: string }) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ['production-stage-overview'],
    queryFn: () => productionOrderApi.getStageOverview().then(r => r.data.data ?? []),
  })

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.07)] ring-1 ring-gray-100 overflow-hidden">
        <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
          <BarChart3 size={18} className="text-white" />
          <h2 className="text-sm font-bold text-white">Production Stage Overview</h2>
        </div>
        <div className="flex items-center justify-center py-10 text-sm text-gray-400">Loading…</div>
      </div>
    )
  }

  if (rows.length === 0) return null

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.07)] ring-1 ring-gray-100 overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-3 px-6 py-4 bg-gradient-to-r from-violet-600 to-blue-600">
        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
          <BarChart3 size={16} className="text-white" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white">Production Stage Overview</h2>
          <p className="text-xs text-blue-100 mt-0.5">Completed ✓ and due at each stage for all active pipe orders</p>
        </div>
      </div>

      {/* Scrollable table */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              {/* sticky pipe name col */}
              <th className="sticky left-0 z-10 bg-gray-50 text-left px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[160px]">
                Pipe
              </th>
              <th className="text-center px-4 py-3 text-[11px] font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap min-w-[70px]">
                Planned
              </th>
              {STAGE_COLS.map(s => (
                <th
                  key={s.key}
                  className={`text-center px-3 py-3 text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap min-w-[80px] ${
                    selectedStage === s.key ? 'bg-violet-50 text-violet-600' : 'text-gray-500'
                  }`}
                >
                  {s.label}
                  {selectedStage === s.key && (
                    <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-violet-500 align-middle" />
                  )}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row: any, idx: number) => {
              const planned = row.totalPlanned ?? 0
              return (
                <tr
                  key={row.pipeConfigId}
                  className={`border-t border-gray-50 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-violet-50/20`}
                >
                  {/* Pipe name — sticky */}
                  <td className={`sticky left-0 z-10 px-4 py-3 ${idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'} hover:bg-violet-50/20`}>
                    <p className="font-semibold text-gray-800 text-xs leading-tight">{row.pipeName}</p>
                    {(row.diameterMm > 0 || row.pressureClass) && (
                      <p className="text-[10px] text-gray-400 mt-0.5">
                        {row.diameterMm > 0 && `${row.diameterMm}mm`}
                        {row.diameterMm > 0 && row.pressureClass && ' · '}
                        {row.pressureClass}
                      </p>
                    )}
                  </td>

                  {/* Planned qty */}
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-gray-700 tabular-nums">{planned}</span>
                  </td>

                  {/* Per-stage cells */}
                  {STAGE_COLS.map(s => {
                    const done = (row[s.field] as number) ?? 0
                    const due  = Math.max(0, planned - done)
                    const isActiveStage = selectedStage === s.key
                    return (
                      <td
                        key={s.key}
                        className={`px-3 py-3 text-center ${isActiveStage ? 'bg-violet-50/40' : ''}`}
                      >
                        <div className="flex flex-col items-center gap-0.5">
                          {/* Completed */}
                          <span className={`tabular-nums font-semibold ${done > 0 ? 'text-green-600' : 'text-gray-200'}`}>
                            {done > 0 ? `${done} ✓` : '—'}
                          </span>
                          {/* Due */}
                          <span className={`tabular-nums text-[10px] font-medium ${
                            due === 0
                              ? 'text-gray-300'
                              : due === planned
                                ? 'text-red-500'
                                : 'text-amber-600'
                          }`}>
                            {due === 0 ? 'done' : `${due} due`}
                          </span>
                        </div>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>

          {/* Totals footer */}
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-gray-50">
              <td className="sticky left-0 z-10 bg-gray-50 px-4 py-3 text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                Total
              </td>
              <td className="px-4 py-3 text-center font-bold text-gray-700 tabular-nums">
                {rows.reduce((s: number, r: any) => s + (r.totalPlanned ?? 0), 0)}
              </td>
              {STAGE_COLS.map(s => {
                const totalDone = rows.reduce((sum: number, r: any) => sum + ((r[s.field] as number) ?? 0), 0)
                const totalPlanned = rows.reduce((sum: number, r: any) => sum + (r.totalPlanned ?? 0), 0)
                const totalDue = Math.max(0, totalPlanned - totalDone)
                const isActiveStage = selectedStage === s.key
                return (
                  <td key={s.key} className={`px-3 py-3 text-center ${isActiveStage ? 'bg-violet-50/60' : ''}`}>
                    <div className="flex flex-col items-center gap-0.5">
                      <span className={`tabular-nums font-bold ${totalDone > 0 ? 'text-green-700' : 'text-gray-300'}`}>
                        {totalDone > 0 ? `${totalDone} ✓` : '—'}
                      </span>
                      <span className={`tabular-nums text-[10px] font-semibold ${
                        totalDue === 0 ? 'text-gray-300' : 'text-amber-700'
                      }`}>
                        {totalDue === 0 ? 'done' : `${totalDue} due`}
                      </span>
                    </div>
                  </td>
                )
              })}
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}

// ── Multi-select Order Combobox ───────────────────────────────────────────────

interface MultiOrderComboboxProps {
  orders: any[]
  selectedIds: number[]
  onToggle: (id: number) => void
  onRemove: (id: number) => void
}

function MultiOrderCombobox({ orders, selectedIds, onToggle, onRemove }: MultiOrderComboboxProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen]   = useState(false)
  const ref               = useRef<HTMLDivElement>(null)
  const inputRef          = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  const filtered = orders.filter(o => {
    if (!query) return true
    const q = query.toLowerCase()
    return (
      o.poNumber?.toLowerCase().includes(q) ||
      (o.pipeConfigName ?? '').toLowerCase().includes(q)
    )
  })

  const selectedOrders = selectedIds.map(id => orders.find(o => o.id === id)).filter(Boolean)

  return (
    <div className="space-y-2" ref={ref}>
      {/* Selected chips */}
      {selectedOrders.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedOrders.map(o => (
            <span
              key={o.id}
              className="inline-flex items-center gap-1.5 bg-violet-50 border border-violet-200 text-violet-800 text-xs font-medium px-2.5 py-1.5 rounded-lg"
            >
              <span className="font-semibold">{o.pipeConfigName ?? `Config #${o.pipeConfigId}`}</span>
              <span className="text-violet-400">{o.poNumber}</span>
              <button
                type="button"
                onClick={() => onRemove(o.id)}
                className="ml-0.5 text-violet-400 hover:text-violet-700"
              >
                <X size={12} />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search input */}
      <div className={`flex items-center border rounded-lg px-3 py-2 gap-2 bg-white transition-all ${
        open ? 'border-violet-500 ring-2 ring-violet-200' : 'border-gray-300 hover:border-gray-400'
      }`}>
        <Search size={14} className="text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          className="flex-1 text-sm outline-none bg-transparent placeholder:text-gray-400"
          placeholder={selectedIds.length ? 'Add another pipe…' : 'Search by pipe name or PO number…'}
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
        />
        {query && (
          <button type="button" onClick={() => setQuery('')} className="text-gray-400 hover:text-gray-600">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-sm text-gray-400">No orders match "{query}"</div>
          ) : (
            filtered.map(o => {
              const isSelected = selectedIds.includes(o.id)
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => { onToggle(o.id); setQuery(''); inputRef.current?.focus() }}
                  className={`w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                    isSelected ? 'bg-violet-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                      isSelected ? 'bg-violet-600 border-violet-600' : 'border-gray-300'
                    }`}>
                      {isSelected && <CheckCircle2 size={10} className="text-white" />}
                    </div>
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {o.pipeConfigName ?? `Config #${o.pipeConfigId}`}
                    </span>
                    {o.diameterMm > 0 && (
                      <span className="text-xs text-gray-400 shrink-0">
                        {o.diameterMm}mm · {o.pressureClass} · {o.lengthM ?? 5.25}m
                      </span>
                    )}
                    <span className="shrink-0 text-[10px] font-semibold bg-amber-50 text-amber-700 px-1.5 py-0.5 rounded-full border border-amber-100">
                      {Math.max(0, o.plannedQty - o.finishedPipes)} due
                    </span>
                  </div>
                  <span className={`text-xs font-mono shrink-0 ${isSelected ? 'text-violet-600 font-semibold' : 'text-gray-400'}`}>
                    {o.poNumber}
                  </span>
                </button>
              )
            })
          )}
        </div>
      )}
    </div>
  )
}

// ── Per-order Entry Card ──────────────────────────────────────────────────────

interface OrderEntryCardProps {
  order: any
  stage: string
  data: OrderEntryData
  onChange: (data: OrderEntryData) => void
  onRemove: () => void
  // ready=false means data is still loading — parent must block submit
  onStockUpdate: (orderId: number, issues: StockIssue[], ready: boolean) => void
  index: number
  totalOrders: number
  showValidation: boolean   // true after first Save attempt — reveals inline errors
  coatingSandType?: 'plaster' | 'crushedDust'
}

export interface StockIssue {
  materialName: string
  required: number
  available: number
  shortfall: number
  uom: string
  source: 'inventory' | 'silo'
  siloLabel?: string
}

function OrderEntryCard({ order, stage, data, onChange, onRemove, onStockUpdate, index, totalOrders, showValidation, coatingSandType }: OrderEntryCardProps) {
  const pipesRejected = Math.max(
    0, (Number(data.pipesProcessed) || 0) - (Number(data.pipesCompleted) || 0)
  )

  const dueQty = Math.max(0, (order.plannedQty ?? 0) - (order.finishedPipes ?? 0))

  // ── Inline field validation (shown after first Save attempt) ──────────────
  const processedVal = data.pipesProcessed
  const completedVal = data.pipesCompleted
  const processedNum = Number(processedVal)
  const completedNum = Number(completedVal)

  const processedError: string | null = !showValidation ? null
    : processedVal === '' || processedVal === undefined ? 'Pipes processed is required'
    : processedNum === 0 ? 'Processed qty cannot be 0'
    : processedNum < 0   ? 'Must be a positive number'
    : null

  const completedError: string | null = !showValidation ? null
    : completedVal === '' || completedVal === undefined ? 'Pipes completed is required'
    : completedNum < 0   ? 'Must be a positive number'
    : completedNum > processedNum ? 'Cannot exceed processed qty'
    : null

  // Prior stage data
  const { data: priorStageData } = useQuery({
    queryKey: ['prior-stage', order.id, stage],
    queryFn: () => productionEntryApi.getPriorStageCompleted(order.id, stage)
      .then(r => r.data.data as PriorStageInfo),
    enabled: Boolean(order.id) && Boolean(stage),
  })

  // Pipe config for material inputs
  const { data: configData } = useQuery({
    queryKey: ['pipe-config-detail', order.pipeConfigId],
    queryFn: () => pipeConfigApi.getById(order.pipeConfigId).then((r: any) => r.data.data),
    enabled: Boolean(order.pipeConfigId) && MATERIAL_STAGES.includes(stage),
  })

  const priorCompleted = priorStageData?.pipesCompleted ?? 0
  const priorLabel = priorStageData
    ? PROD_STAGES.find(s => s.key === priorStageData.stageType)?.label ?? priorStageData.stageType
    : null

  // Stage materials for this stage only
  const stageMaterials: any[] = MATERIAL_STAGES.includes(stage) && configData?.materials
    ? configData.materials.filter((m: any) => m.stageType === stage)
    : []

  // Fetch inventory for each material (at the order's outlet)
  const inventoryResults = useQueries({
    queries: stageMaterials.map((mat: any) => ({
      queryKey: ['inventory-stock', mat.materialProductId, order.outletId],
      queryFn: () =>
        inventoryApi.getStock(mat.materialProductId, order.outletId)
          .then((r: any) => r.data.data)
          .catch(() => ({ quantityOnHand: 0 })),   // treat missing inventory as zero stock
      enabled: Boolean(mat.materialProductId) && Boolean(order.outletId),
      staleTime: 30_000,
      retry: false,   // show warning immediately, don't wait for retries
    })),
  })

  // Compute per-material inventory warnings
  interface MatStockInfo {
    name: string
    uom: string
    qtyPerPipe: number
    available: number
    maxPipes: number
    required: number
    shortfall: number
    ok: boolean
  }
  const pipesEntered = Number(data.pipesProcessed) || 0
  const matStockInfos: MatStockInfo[] = stageMaterials.map((mat: any, idx: number) => {
    const inv = inventoryResults[idx]?.data
    const available = parseFloat(String(inv?.quantityOnHand ?? 0))
    const qtyPerPipe = parseFloat(String(mat.quantityPerPipe)) || 0
    const maxPipes = qtyPerPipe > 0 ? Math.max(0, Math.floor(available / qtyPerPipe)) : Infinity
    const required = qtyPerPipe * pipesEntered
    return {
      name: mat.materialProduct?.name ?? `Material #${mat.materialProductId}`,
      uom: mat.uom,
      qtyPerPipe,
      available,
      maxPipes: isFinite(maxPipes) ? maxPipes : 9999,
      required,
      shortfall: Math.max(0, required - available),
      ok: required <= available + 0.0001,
    }
  })
  const limitingMat = matStockInfos.length > 0
    ? matStockInfos.reduce((min, m) => m.maxPipes < min.maxPipes ? m : min, matStockInfos[0])
    : null
  const hasStockWarning = matStockInfos.some(m => !m.ok) && pipesEntered > 0

  // True once configData is loaded AND materials are populated AND no inventory query is in-flight.
  // fetchStatus === 'idle' covers: settled (success/error) AND disabled queries (outletId null).
  // This makes the warning appear immediately — no waiting for queries that can never fire.
  const needsMaterialCheck = MATERIAL_STAGES.includes(stage)
  const inventorySettled   = stageMaterials.length > 0
    ? inventoryResults.every(r => r.fetchStatus === 'idle')
    : false   // configData not yet loaded
  const stockDataReady     = !needsMaterialCheck || (!!configData && stageMaterials.length > 0 && inventorySettled)

  // ── Silo balance check (SPINNING → Silo 1+2, COATING → Silo 3) ───────────
  const isSiloStage = stage === 'SPINNING' || stage === 'COATING'
  const { data: siloSummary } = useQuery({
    queryKey: ['silo-summary'],
    queryFn:  () => siloFillsApi.summary(),
    enabled:  isSiloStage,
    staleTime: 30_000,
  })

  // Find cement material for this stage (to get quantityPerPipe in kg)
  const cementMat = stageMaterials.find((m: any) =>
    (m.materialProduct?.name ?? '').toLowerCase().includes('cement')
  )
  const cementKgPerPipe = cementMat ? parseFloat(String(cementMat.quantityPerPipe)) || 0 : 0
  // Convert to MT (consumptions stored in kg)
  const cementMTPerPipe = cementMat
    ? (cementMat.uom?.toUpperCase() === 'MT' ? cementKgPerPipe : cementKgPerPipe / 1000)
    : 0

  const siloBalanceMT: number = (() => {
    if (!siloSummary || !isSiloStage) return Infinity
    if (stage === 'SPINNING') {
      // Combined Silo 1 + Silo 2 balance
      return (siloSummary.silos[0]?.balanceMt ?? 0) + (siloSummary.silos[1]?.balanceMt ?? 0)
    }
    // COATING → Silo 3
    return siloSummary.silos[2]?.balanceMt ?? 0
  })()

  const siloLabel    = stage === 'SPINNING' ? 'Silo 1 + Silo 2' : 'Silo 3'
  const siloMaxPipes = cementMTPerPipe > 0 && isFinite(siloBalanceMT)
    ? Math.floor(siloBalanceMT / cementMTPerPipe)
    : null
  const siloRequired = cementMTPerPipe * pipesEntered
  const siloShortfall = Math.max(0, siloRequired - siloBalanceMT)
  const hasSiloWarning = isSiloStage && cementMTPerPipe > 0 && pipesEntered > 0 && siloBalanceMT < siloRequired

  // Single consolidated effect — reports ready+issues to parent once ALL data has settled
  useEffect(() => {
    if (!stockDataReady) {
      // Data still loading — tell parent this order isn't ready yet
      onStockUpdate(order.id, [], false)
      return
    }
    if (pipesEntered === 0) {
      onStockUpdate(order.id, [], true)
      return
    }
    const inventoryIssues: StockIssue[] = matStockInfos.filter(m => !m.ok).map(m => ({
      materialName: m.name, required: m.required, available: m.available,
      shortfall: m.shortfall, uom: m.uom, source: 'inventory' as const,
    }))
    const siloIssues: StockIssue[] = hasSiloWarning && cementMTPerPipe > 0 ? [{
      materialName: 'Silo Cement',
      required:     siloRequired,
      available:    Math.max(0, siloBalanceMT),
      shortfall:    siloShortfall,
      uom:          'MT',
      source:       'silo' as const,
      siloLabel:    siloLabel,
    }] : []
    onStockUpdate(order.id, [...inventoryIssues, ...siloIssues], true)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stockDataReady, hasStockWarning, hasSiloWarning, pipesEntered, order.id])

  // Sync material inputs when stage/config/pipesCompleted/sandType changes
  useEffect(() => {
    if (!MATERIAL_STAGES.includes(stage) || !configData?.materials) {
      onChange({ ...data, materialInputs: [] })
      return
    }
    let stageMatsList = configData.materials.filter((m: any) => m.stageType === stage)
    // For COATING, filter to only the selected sand material
    if (stage === 'COATING' && coatingSandType) {
      const sandName = coatingSandType === 'plaster' ? 'plaster sand' : 'crushed sand'
      const sandMats = stageMatsList.filter((m: any) =>
        (m.materialProduct?.name ?? '').toLowerCase().includes(sandName)
      )
      if (sandMats.length > 0) stageMatsList = sandMats
    }
    const completed = Number(data.pipesCompleted) || 0
    const inputs: MaterialInput[] = stageMatsList.map((mat: any) => {
      const rate = parseFloat(String(mat.quantityPerPipe)) || 0
      // Keep existing actualQty if the user already edited it, otherwise blank
      const existing = data.materialInputs.find(
        mi => mi.materialProductId === mat.materialProductId
      )
      return {
        pipeConfigMaterialId: mat.id,
        materialProductId: mat.materialProductId,
        name: mat.materialProduct?.name ?? `Material #${mat.materialProductId}`,
        qtyPerPipe: rate,
        expectedQty: rate * completed,
        actualQty: existing?.actualQty ?? '',   // blank by default — operator must enter real qty
        uom: mat.uom,
      }
    })
    onChange({ ...data, materialInputs: inputs })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, configData, data.pipesCompleted, coatingSandType])

  function set(field: keyof OrderEntryData, value: string) {
    onChange({ ...data, [field]: value })
  }

  const meta = STAGE_META[stage]

  const StageIcon = meta?.icon

  return (
    <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(109,40,217,0.10)] ring-1 ring-violet-100 overflow-hidden">
      {/* Card header */}
      <div className="relative flex items-center justify-between px-5 py-4 bg-gradient-to-r from-violet-600 to-blue-600 overflow-hidden">
        {/* subtle dot grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.06]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '18px 18px' }} />
        <div className="relative flex items-center gap-3">
          {/* index badge */}
          <span className="w-7 h-7 rounded-xl bg-white/15 border border-white/25 text-white text-xs font-bold flex items-center justify-center shrink-0">
            {index + 1}
          </span>
          {/* stage icon pill */}
          {StageIcon && (
            <span className="w-7 h-7 rounded-xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
              <StageIcon size={14} className="text-white/90" />
            </span>
          )}
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <Layers size={13} className="text-white/70 shrink-0" />
              <p className="text-[11px] font-semibold text-white/70 tracking-wide">
                Entry Data · {totalOrders} order{totalOrders !== 1 ? 's' : ''}
              </p>
            </div>
            <p className="text-xs text-blue-100 mt-0.5 flex items-center gap-1.5">
              {order.diameterMm > 0 && <span>{order.diameterMm}mm</span>}
              {order.diameterMm > 0 && order.pressureClass && <span className="opacity-50">·</span>}
              {order.pressureClass && <span>{order.pressureClass}</span>}
              <span className="opacity-50">·</span>
              <span className="font-mono">{order.poNumber}</span>
              <span className="ml-1 bg-amber-400/20 border border-amber-300/30 text-amber-200 font-semibold px-1.5 py-0.5 rounded-full text-[10px]">
                {Math.max(0, order.plannedQty - order.finishedPipes)} due
              </span>
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onRemove}
          className="relative text-white/50 hover:text-white transition-colors p-1.5 rounded-lg hover:bg-white/15"
        >
          <X size={15} />
        </button>
      </div>

      {/* ── Prior stage banner ───────────────────────────────────────── */}
      {priorStageData && stage && (
        <div className={`flex items-center gap-3 px-5 py-3 border-b ${
          priorCompleted > 0
            ? 'bg-blue-50/60 border-blue-100'
            : 'bg-amber-50/60 border-amber-100'
        }`}>
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${
            priorCompleted > 0 ? 'bg-blue-100' : 'bg-amber-100'
          }`}>
            <Info size={13} className={priorCompleted > 0 ? 'text-blue-600' : 'text-amber-600'} />
          </div>
          <div className="flex-1 min-w-0">
            <span className={`text-xs font-semibold ${priorCompleted > 0 ? 'text-blue-700' : 'text-amber-700'}`}>
              Previous stage ({priorLabel}):&nbsp;
              <span className="text-sm font-extrabold tabular-nums">{priorCompleted}</span> pipes completed
            </span>
            {priorStageData.lastEntryDate && (
              <span className={`ml-2 text-[11px] opacity-60 ${priorCompleted > 0 ? 'text-blue-600' : 'text-amber-600'}`}>
                · last logged {new Date(priorStageData.lastEntryDate).toLocaleDateString('en-IN')}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Material Stock Warning Banner ─────────────────────────────── */}
      {MATERIAL_STAGES.includes(stage) && stageMaterials.length > 0 && limitingMat && (
        <div className={`mx-5 mt-3 rounded-xl border px-4 py-3 ${
          hasStockWarning
            ? 'bg-red-50 border-red-200'
            : pipesEntered === 0
              ? 'bg-gray-50 border-gray-100'
              : 'bg-emerald-50 border-emerald-200'
        }`}>
          {/* Header row */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertTriangle size={13} className={hasStockWarning ? 'text-red-500' : pipesEntered === 0 ? 'text-gray-400' : 'text-emerald-600'} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${
                hasStockWarning ? 'text-red-600' : pipesEntered === 0 ? 'text-gray-400' : 'text-emerald-700'
              }`}>
                {hasStockWarning ? 'Insufficient Raw Material' : pipesEntered === 0 ? 'Raw Material Stock' : 'Stock OK'}
              </span>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
              hasStockWarning
                ? 'bg-red-100 text-red-700'
                : pipesEntered === 0
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-emerald-100 text-emerald-700'
            }`}>
              {limitingMat.maxPipes >= 9999 ? '∞' : limitingMat.maxPipes} pipes possible
            </span>
          </div>
          {/* Per-material rows */}
          <div className="space-y-1.5">
            {matStockInfos.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-2 text-xs">
                <span className={`font-semibold truncate flex-1 ${m.ok || pipesEntered === 0 ? 'text-gray-700' : 'text-red-700'}`}>
                  {m.name}
                </span>
                <span className="text-gray-400 tabular-nums shrink-0">
                  avail:&nbsp;
                  <span className={`font-bold ${m.available <= 0 ? 'text-red-500' : 'text-gray-700'}`}>
                    {Math.max(0, m.available).toFixed(2)}
                  </span>
                  &nbsp;{m.uom}
                </span>
                {pipesEntered > 0 && (
                  <span className={`tabular-nums shrink-0 font-semibold ${m.ok ? 'text-emerald-600' : 'text-red-600'}`}>
                    {m.ok
                      ? `Required: ${m.required.toFixed(2)} ${m.uom} ✓`
                      : `Required: ${m.required.toFixed(2)} ${m.uom} · Short: ${m.shortfall.toFixed(2)} ${m.uom}`
                    }
                  </span>
                )}
                {m.qtyPerPipe > 0 && (
                  <span className="text-gray-400 tabular-nums shrink-0 text-[11px]">
                    {m.qtyPerPipe.toFixed(4)}&nbsp;{m.uom}/pipe · max&nbsp;
                    <span className="font-bold text-gray-600">{m.maxPipes}</span>&nbsp;pipes
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Silo Balance Warning Banner ──────────────────────────────── */}
      {isSiloStage && cementMTPerPipe > 0 && siloSummary && (
        <div className={`mx-5 mt-3 rounded-xl border px-4 py-3 ${
          hasSiloWarning
            ? 'bg-orange-50 border-orange-300'
            : pipesEntered === 0
              ? 'bg-gray-50 border-gray-100'
              : 'bg-emerald-50 border-emerald-200'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Cylinder size={13} className={hasSiloWarning ? 'text-orange-500' : pipesEntered === 0 ? 'text-gray-400' : 'text-emerald-600'} />
              <span className={`text-[10px] font-bold uppercase tracking-widest ${
                hasSiloWarning ? 'text-orange-700' : pipesEntered === 0 ? 'text-gray-400' : 'text-emerald-700'
              }`}>
                {hasSiloWarning ? `${siloLabel} — Insufficient Cement` : pipesEntered === 0 ? `${siloLabel} — Silo Balance` : `${siloLabel} — Cement OK`}
              </span>
            </div>
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full tabular-nums ${
              hasSiloWarning
                ? 'bg-orange-100 text-orange-700'
                : pipesEntered === 0
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-emerald-100 text-emerald-700'
            }`}>
              {siloMaxPipes !== null ? `${siloMaxPipes} pipes possible` : 'balance unknown'}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="text-gray-500">
              Balance:&nbsp;
              <span className={`font-bold tabular-nums ${siloBalanceMT < 0 ? 'text-red-600' : 'text-gray-700'}`}>
                {siloBalanceMT.toFixed(3)} MT
              </span>
            </span>
            {pipesEntered > 0 && (
              <>
                <span className="text-gray-400">·</span>
                <span className="text-gray-500">
                  Needs:&nbsp;
                  <span className="font-bold tabular-nums text-gray-700">{siloRequired.toFixed(3)} MT</span>
                </span>
                {hasSiloWarning && (
                  <>
                    <span className="text-gray-400">·</span>
                    <span className="font-semibold text-orange-600 tabular-nums">
                      Short by {siloShortfall.toFixed(3)} MT
                    </span>
                  </>
                )}
              </>
            )}
            {pipesEntered === 0 && cementMTPerPipe > 0 && (
              <span className="text-gray-400 tabular-nums">
                {cementMTPerPipe.toFixed(4)} MT/pipe
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Single-row: Pipe Counts + Schedule + Bed Type ─────────────── */}
      <div className="px-5 py-4 flex items-end gap-3 flex-wrap">

        {/* Processed */}
        <div className="flex flex-col gap-1 min-w-[96px]">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">
            Processed
            <span className="normal-case font-normal ml-1 text-gray-300">
              max {priorCompleted > 0 ? Math.min(dueQty, priorCompleted) : dueQty}
            </span>
            {limitingMat && stageMaterials.length > 0 && limitingMat.maxPipes < 9999 && (
              <span className={`ml-1.5 font-semibold ${limitingMat.maxPipes === 0 ? 'text-red-400' : 'text-amber-500'}`}>
                · stock: {limitingMat.maxPipes}
              </span>
            )}
            {isSiloStage && siloMaxPipes !== null && (
              <span className={`ml-1.5 font-semibold ${siloMaxPipes === 0 ? 'text-orange-500' : 'text-orange-400'}`}>
                · silo: {siloMaxPipes}
              </span>
            )}
          </label>
          <input
            type="number" min="0"
            max={priorCompleted > 0 ? Math.min(dueQty, priorCompleted) : dueQty}
            value={data.pipesProcessed}
            onChange={e => {
              const raw = Number(e.target.value)
              const maxAllowed = priorCompleted > 0 ? Math.min(dueQty, priorCompleted) : dueQty
              const capped = maxAllowed > 0 ? Math.min(raw, maxAllowed) : raw
              const val = e.target.value === '' ? '' : String(capped)
              onChange({ ...data, pipesProcessed: val, pipesCompleted: val })
            }}
            placeholder="0"
            className={`bg-white border rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 tabular-nums w-full transition-colors ${
              processedError
                ? 'border-red-400 ring-1 ring-red-200 text-red-700 focus:ring-red-400'
                : hasStockWarning || hasSiloWarning
                  ? 'border-red-300 ring-1 ring-red-200 text-red-700 focus:ring-red-400'
                  : 'border-gray-200 text-gray-800 focus:ring-violet-400'
            }`}
          />
          {processedError && (
            <p className="text-[11px] font-semibold text-red-500 mt-0.5 flex items-center gap-1">
              <AlertTriangle size={10} className="shrink-0" />
              {processedError}
            </p>
          )}
        </div>

        {/* Completed */}
        <div className="flex flex-col gap-1 w-20">
          <label className="text-[10px] font-semibold text-green-500 uppercase tracking-wide">Done ✓</label>
          <input
            type="number" min="0"
            value={data.pipesCompleted}
            onChange={e => {
              if (e.target.value === '') { onChange({ ...data, pipesCompleted: '' }); return }
              const maxProcessed = Number(data.pipesProcessed) || 0
              const maxAllowed   = priorCompleted > 0 ? Math.min(maxProcessed, priorCompleted, dueQty) : Math.min(maxProcessed, dueQty)
              const val = String(Math.min(Number(e.target.value), maxAllowed || Number(e.target.value)))
              onChange({ ...data, pipesCompleted: val })
            }}
            placeholder="0"
            className={`bg-white border rounded-lg px-2 py-2 text-sm font-semibold focus:outline-none focus:ring-2 tabular-nums w-full transition-colors ${
              completedError
                ? 'border-red-400 ring-1 ring-red-200 text-red-700 focus:ring-red-400'
                : 'border-green-200 text-green-700 focus:ring-green-400'
            }`}
          />
          {completedError && (
            <p className="text-[11px] font-semibold text-red-500 mt-0.5 flex items-center gap-1">
              <AlertTriangle size={10} className="shrink-0" />
              {completedError}
            </p>
          )}
        </div>

        {/* Rejected — computed */}
        <div className="flex flex-col gap-1 min-w-[80px]">
          <label className={`text-[10px] font-semibold uppercase tracking-wide ${pipesRejected > 0 ? 'text-red-400' : 'text-gray-400'}`}>
            Rejected {pipesRejected > 0 && '⚠'}
          </label>
          <div className={`text-sm font-extrabold tabular-nums px-3 py-2 rounded-lg border ${
            pipesRejected > 0
              ? 'bg-red-50 border-red-200 text-red-600'
              : 'bg-gray-50 border-gray-200 text-gray-300'
          }`}>
            {pipesRejected || '—'}
          </div>
        </div>

        {/* Separator */}
        <div className="self-stretch w-px bg-gray-100 mx-1" />

        {/* Date */}
        <div className="flex flex-col gap-1 min-w-[130px]">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Date *</label>
          <input
            type="date"
            value={data.entryDate}
            onChange={e => set('entryDate', e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 w-full"
          />
        </div>

        {/* Shift */}
        <div className="flex flex-col gap-1 min-w-[110px]">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Shift</label>
          <select
            value={data.shiftName}
            onChange={e => set('shiftName', e.target.value)}
            className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 w-full"
          >
            <option value="">— Select —</option>
            <option value="A">Shift A</option>
            <option value="B">Shift B</option>
            <option value="C">Shift C</option>
          </select>
        </div>

        {/* Bed Type — DEMOULDING (required) or SPINNING (optional) */}
        {(stage === 'DEMOULDING' || stage === 'SPINNING') && (
          <>
            <div className="self-stretch w-px bg-gray-100 mx-1" />
            <div className="flex flex-col gap-1">
              <label className={`text-[10px] font-semibold uppercase tracking-wide ${
                stage === 'DEMOULDING' ? 'text-teal-500' : 'text-blue-500'
              }`}>
                Bed Type {stage === 'DEMOULDING' ? '*' : '(optional)'}
              </label>
              <div className="flex gap-2 flex-wrap">
                {stage === 'SPINNING' && (
                  <label
                    className={`flex items-center gap-1.5 cursor-pointer px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      !data.bedType
                        ? 'bg-gray-200 border-gray-300 text-gray-700'
                        : 'bg-white border-gray-200 text-gray-400 hover:border-gray-300'
                    }`}
                  >
                    <input type="radio" name={`bedType-${order.id}`} value=""
                      checked={!data.bedType}
                      onChange={() => set('bedType', '')}
                      className="sr-only"
                    />
                    None
                  </label>
                )}
                {BED_TYPES.map(bt => (
                  <label key={bt.key}
                    className={`flex items-center gap-1.5 cursor-pointer px-3 py-2 rounded-lg border text-sm font-medium transition-all ${
                      data.bedType === bt.key
                        ? stage === 'DEMOULDING'
                          ? 'bg-teal-600 border-teal-600 text-white'
                          : 'bg-blue-600 border-blue-600 text-white'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-blue-300'
                    }`}
                  >
                    <input type="radio" name={`bedType-${order.id}`} value={bt.key}
                      checked={data.bedType === bt.key}
                      onChange={() => set('bedType', bt.key)}
                      className="sr-only"
                    />
                    {bt.label}
                  </label>
                ))}
              </div>
            </div>
          </>
        )}

        {/* Separator */}
        <div className="self-stretch w-px bg-gray-100 mx-1" />

        {/* Notes — inline, flex-1 */}
        <div className="flex flex-col gap-1 flex-1 min-w-[140px]">
          <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Notes</label>
          <textarea
            value={data.notes}
            onChange={e => set('notes', e.target.value)}
            rows={1}
            placeholder="Optional notes…"
            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400 resize-none placeholder:text-gray-300"
          />
        </div>
      </div>

    </div>
  )
}

// ── PDI Entry Form ────────────────────────────────────────────────────────────

interface PDIFormData {
  pipeName:      string
  quantity:      string
  thirdParty:    string
  finishing:     boolean
  colour:        boolean
  numbering:     boolean
  ghola:         boolean
  qualityCheck:  boolean
  diameterCheck: boolean
  notes:         string
}

const emptyPDIForm = (): PDIFormData => ({
  pipeName:      '',
  quantity:      '',
  thirdParty:    '',
  finishing:     false,
  colour:        false,
  numbering:     false,
  ghola:         false,
  qualityCheck:  false,
  diameterCheck: false,
  notes:         '',
})

function PDIEntryForm({ onSaved }: { onSaved: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<PDIFormData>(emptyPDIForm())

  // Fetch all orders summarised by FINAL_TESTING completions — no active-order filter
  // so fully-completed orders are still visible here
  const { data: finalTestedOrders = [] } = useQuery({
    queryKey: ['production-orders-final-tested'],
    queryFn: () => productionOrderApi.getSummaries('FINAL_TESTING').then(r => r.data.data ?? []),
  })

  // Aggregate by pipe config name; only show configs with at least 1 final-tested pipe
  const pipeOptions = (finalTestedOrders as any[])
    .filter((o: any) => (o.finishedPipes ?? 0) > 0)
    .reduce<{ name: string; finishedPipes: number }[]>((acc, o: any) => {
      const name = o.pipeConfigName ?? `Config #${o.pipeConfigId}`
      const existing = acc.find(p => p.name === name)
      if (existing) {
        existing.finishedPipes += o.finishedPipes ?? 0
      } else {
        acc.push({ name, finishedPipes: o.finishedPipes ?? 0 })
      }
      return acc
    }, [])
    .sort((a, b) => a.name.localeCompare(b.name))

  const selectedPipe = pipeOptions.find(p => p.name === form.pipeName)
  const todayStr = new Date().toISOString().split('T')[0]

  const mut = useMutation({
    mutationFn: (data: any) => pdiApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pdi-records'] })
      toast.success('PDI record saved')
      setForm(emptyPDIForm())
      onSaved()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to save PDI record'),
  })

  function toggle(k: keyof PDIFormData) {
    setForm(prev => ({ ...prev, [k]: !prev[k] }))
  }
  function set(k: keyof PDIFormData, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.pipeName) { toast.error('Select a pipe'); return }
    if (!form.quantity)  { toast.error('Enter quantity'); return }
    mut.mutate({
      pipeName:      form.pipeName,
      quantity:      String(parseInt(form.quantity)),
      thirdParty:    form.thirdParty,
      finishing:     form.finishing,
      colour:        form.colour,
      numbering:     form.numbering,
      ghola:         form.ghola,
      qualityCheck:  form.qualityCheck,
      diameterCheck: form.diameterCheck,
      notes:         form.notes,
      date:          todayStr,
    })
  }

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 transition'
  const labelCls = 'block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5'

  const checkItems: { key: keyof PDIFormData; label: string }[] = [
    { key: 'finishing',     label: 'Finishing'      },
    { key: 'colour',        label: 'Colour'         },
    { key: 'numbering',     label: 'Numbering'      },
    { key: 'ghola',         label: 'Ghola'          },
    { key: 'qualityCheck',  label: 'Quality Check'  },
    { key: 'diameterCheck', label: 'Diameter Check' },
  ]

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Main Card ── */}
      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.07)] ring-1 ring-gray-100 overflow-hidden">

        {/* Card header */}
        <div className="relative overflow-hidden flex items-center justify-between px-6 py-4 bg-gradient-to-r from-emerald-600 to-teal-500">
          <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <ClipboardCheck size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Pre-Delivery Inspection</h2>
              <p className="text-xs text-emerald-100 mt-0.5">
                {pipeOptions.length === 0
                  ? 'No final-tested pipes available'
                  : `${pipeOptions.length} pipe type${pipeOptions.length !== 1 ? 's' : ''} ready for PDI`}
              </p>
            </div>
          </div>
          <div className="relative text-right">
            <p className="text-white text-sm font-semibold">
              {new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
            <p className="text-emerald-200 text-[10px] mt-0.5">Today's date</p>
          </div>
        </div>

        {pipeOptions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-gray-400 gap-3">
            <ClipboardCheck size={36} className="opacity-20" />
            <p className="text-sm font-medium">No pipes have completed Final Testing yet</p>
            <p className="text-xs text-gray-300">Complete the Final Testing stage first to enable PDI</p>
          </div>
        ) : (
          <div className="p-6 space-y-5">

            {/* Row 1 — Pipe Name + Quantity + Third Party Inspector */}
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelCls}>Pipe Name *</label>
                <select value={form.pipeName} onChange={e => set('pipeName', e.target.value)} className={inputCls} required>
                  <option value="">— Select pipe —</option>
                  {pipeOptions.map(p => (
                    <option key={p.name} value={p.name}>
                      {p.name} ({p.finishedPipes} available)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>
                  Quantity *{selectedPipe && (
                    <span className="normal-case font-normal ml-1 text-gray-300">
                      max {selectedPipe.finishedPipes}
                    </span>
                  )}
                </label>
                <input
                  type="number" min="1"
                  max={selectedPipe?.finishedPipes}
                  value={form.quantity}
                  onChange={e => set('quantity', e.target.value)}
                  placeholder="0"
                  className={inputCls}
                  required
                />
              </div>
              <div>
                <label className={labelCls}>Third Party Inspector</label>
                <input
                  type="text"
                  value={form.thirdParty}
                  onChange={e => set('thirdParty', e.target.value)}
                  placeholder="Inspector / agency name"
                  className={inputCls}
                />
              </div>
            </div>

            {/* Checklist */}
            <div>
              <label className={`${labelCls} mb-3`}>Inspection Checklist</label>
              <div className="grid grid-cols-3 gap-3">
                {checkItems.map(item => (
                  <label
                    key={item.key}
                    className={`flex items-center gap-2.5 cursor-pointer px-4 py-3 rounded-xl border-2 text-sm font-medium transition-all select-none ${
                      form[item.key]
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                        : 'bg-white border-gray-200 text-gray-500 hover:border-emerald-200'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 border-2 transition-all ${
                      form[item.key]
                        ? 'bg-emerald-500 border-emerald-500'
                        : 'border-gray-300'
                    }`}>
                      {form[item.key] && (
                        <svg viewBox="0 0 10 8" className="w-3 h-3 fill-white">
                          <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      )}
                    </div>
                    <input type="checkbox" className="sr-only"
                      checked={!!form[item.key]}
                      onChange={() => toggle(item.key)}
                    />
                    {item.label}
                  </label>
                ))}
              </div>
              {/* Checklist summary */}
              <p className="mt-2 text-xs text-gray-400">
                {checkItems.filter(i => form[i.key]).length} / {checkItems.length} checks passed
              </p>
            </div>

            {/* Notes */}
            <div>
              <label className={labelCls}>Notes (optional)</label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                placeholder="Any inspection remarks…"
                rows={2}
                className={`${inputCls} resize-none`}
              />
            </div>
          </div>
        )}

        {/* Footer / Submit */}
        {pipeOptions.length > 0 && (
          <div className="flex items-center justify-between px-6 py-4 bg-gray-50/60 border-t border-gray-100">
            <div className="text-xs text-gray-400">
              {checkItems.filter(i => form[i.key]).length === checkItems.length
                ? <span className="text-emerald-600 font-semibold">✓ All checks passed</span>
                : <span>{checkItems.filter(i => form[i.key]).length}/{checkItems.length} checks completed</span>}
            </div>
            <button
              type="submit"
              disabled={mut.isPending}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-700 hover:to-teal-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold shadow-md shadow-emerald-200 transition-all"
            >
              <Save size={15} />
              {mut.isPending ? 'Saving…' : 'Save PDI Record'}
            </button>
          </div>
        )}
      </div>
    </form>
  )
}

// ── Loading Entry Form ────────────────────────────────────────────────────────

interface LoadingFormData {
  pipeName:        string
  quantity:        string
  vehicleNo:       string
  transportName:   string   // vendor / transport company or person
  transportContact: string  // contact number of transport company
  driverName:      string
  driverContact:   string
  customerName:    string
  siteAddress:     string
  notes:           string
}

const emptyLoadingForm = (): LoadingFormData => ({
  pipeName:         '',
  quantity:         '',
  vehicleNo:        '',
  transportName:    '',
  transportContact: '',
  driverName:       '',
  driverContact:    '',
  customerName:     '',
  siteAddress:      '',
  notes:            '',
})

function LoadingEntryForm({ orders, onSaved }: { orders: any[]; onSaved: () => void }) {
  const qc = useQueryClient()
  const [form, setForm]       = useState<LoadingFormData>(emptyLoadingForm())
  const [now, setNow]         = useState(new Date())

  // Live clock — tick every second
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const todayStr = now.toISOString().split('T')[0]
  const timeStr  = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const dateDisplay = now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  // Pipe options — only pipes that have completed PDI
  const { data: pdiData } = useQuery({
    queryKey: ['pdi-records-for-loading'],
    queryFn:  () => pdiApi.getAll().then(r => r.data.data ?? []),
  })
  const pdiRecords: any[] = Array.isArray(pdiData) ? pdiData : (pdiData as any)?.content ?? []
  const pipeOptions = pdiRecords
    .reduce<{ name: string; quantity: number }[]>((acc, rec) => {
      const existing = acc.find(p => p.name === rec.pipeName)
      if (existing) existing.quantity += Number(rec.quantity ?? 0)
      else if (rec.pipeName) acc.push({ name: rec.pipeName, quantity: Number(rec.quantity ?? 0) })
      return acc
    }, [])
    .filter(p => p.quantity > 0)
    .sort((a, b) => a.name.localeCompare(b.name))

  const mut = useMutation({
    mutationFn: (data: any) => loadingRecordApi.create(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loading-records'] })
      toast.success('Loading record saved')
      setForm(emptyLoadingForm())
      onSaved()
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to save loading record'),
  })

  function set(k: keyof LoadingFormData, v: string) {
    setForm(prev => ({ ...prev, [k]: v }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.pipeName)  { toast.error('Select a pipe');        return }
    if (!form.quantity)  { toast.error('Enter quantity');        return }
    if (!form.vehicleNo) { toast.error('Enter vehicle number');  return }
    mut.mutate({
      pipeName:      form.pipeName,
      quantity:      parseInt(form.quantity),
      vehicleNo:     form.vehicleNo,
      vendor:        form.transportName,
      vendorContact: form.transportContact,
      driverName:    form.driverName,
      driverContact: form.driverContact,
      customerName:  form.customerName,
      siteAddress:   form.siteAddress,
      notes:         form.notes,
      date:          todayStr,
    })
  }

  const inputCls = 'w-full bg-white border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 transition'
  const labelCls = 'block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5'

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* ── Main Card ── */}
      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.07)] ring-1 ring-gray-100 overflow-hidden">

        {/* Card header — with live date/time merged in */}
        <div className="relative overflow-hidden flex items-center justify-between px-6 py-4 bg-gradient-to-r from-blue-600 to-cyan-500">
          <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          <div className="relative flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center flex-shrink-0">
              <Truck size={16} className="text-white" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Loading Record</h2>
              <p className="text-xs text-blue-100 mt-0.5">{dateDisplay}</p>
            </div>
          </div>
          <div className="relative text-right">
            <p className="text-white text-2xl font-bold tabular-nums tracking-tight leading-none">{timeStr}</p>
            <p className="text-blue-200 text-[10px] mt-0.5 font-medium">Auto-recorded on save</p>
          </div>
        </div>

        <div className="p-6 space-y-4">

          {/* ── Section 1: Pipe Details ── */}
          <div className="rounded-xl ring-1 ring-emerald-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-emerald-50 to-teal-50 border-b border-emerald-100">
              <PackageOpen size={14} className="text-emerald-600" />
              <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">Pipe Details</span>
            </div>
            <div className="p-4 grid grid-cols-2 gap-4">
              <div>
                <label className={labelCls}>Pipe Name *</label>
                <select value={form.pipeName} onChange={e => set('pipeName', e.target.value)} className={inputCls} required>
                  <option value="">— Select pipe —</option>
                  {pipeOptions.map(p => (
                    <option key={p.name} value={p.name}>{p.name} ({p.quantity} PDI'd)</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelCls}>Quantity (Pipes) *</label>
                <input
                  type="number" min="1"
                  value={form.quantity}
                  onChange={e => set('quantity', e.target.value)}
                  placeholder="0"
                  className={inputCls}
                  required
                />
              </div>
            </div>
          </div>

          {/* ── Section 2: Vehicle & Transport ── */}
          <div className="rounded-xl ring-1 ring-blue-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-blue-50 to-cyan-50 border-b border-blue-100">
              <Truck size={14} className="text-blue-600" />
              <span className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">Vehicle &amp; Transport</span>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Vehicle Number *</label>
                  <input
                    type="text"
                    value={form.vehicleNo}
                    onChange={e => set('vehicleNo', e.target.value)}
                    placeholder="e.g. MH 12 AB 1234"
                    className={`${inputCls} uppercase placeholder:normal-case`}
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Transport Contact Number</label>
                  <input
                    type="tel"
                    value={form.transportContact}
                    onChange={e => set('transportContact', e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    className={inputCls}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Transport Company / Person Name</label>
                <input
                  type="text"
                  value={form.transportName}
                  onChange={e => set('transportName', e.target.value)}
                  placeholder="Company name or transporter's name"
                  className={inputCls}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Driver's Name</label>
                  <input
                    type="text"
                    value={form.driverName}
                    onChange={e => set('driverName', e.target.value)}
                    placeholder="Full name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Driver's Contact Number</label>
                  <input
                    type="tel"
                    value={form.driverContact}
                    onChange={e => set('driverContact', e.target.value)}
                    placeholder="+91 XXXXX XXXXX"
                    className={inputCls}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* ── Section 3: Customer Details ── */}
          <div className="rounded-xl ring-1 ring-violet-100 overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-violet-50 to-purple-50 border-b border-violet-100">
              <PenLine size={14} className="text-violet-600" />
              <span className="text-[10px] font-bold text-violet-700 uppercase tracking-widest">Customer Details</span>
            </div>
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Customer Name</label>
                  <input
                    type="text"
                    value={form.customerName}
                    onChange={e => set('customerName', e.target.value)}
                    placeholder="Customer / project name"
                    className={inputCls}
                  />
                </div>
                <div>
                  <label className={labelCls}>Customer Site Address</label>
                  <textarea
                    value={form.siteAddress}
                    onChange={e => set('siteAddress', e.target.value)}
                    placeholder="Delivery site address"
                    rows={2}
                    className={`${inputCls} resize-none`}
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>Notes (optional)</label>
                <textarea
                  value={form.notes}
                  onChange={e => set('notes', e.target.value)}
                  placeholder="Any additional notes…"
                  rows={2}
                  className={`${inputCls} resize-none`}
                />
              </div>
            </div>
          </div>

        </div>

        {/* Footer / Submit */}
        <div className="flex items-center justify-between px-6 py-4 bg-gray-50/60 border-t border-gray-100">
          <div className="text-xs text-gray-400">
            <span className="font-semibold text-gray-600">Date:</span> {dateDisplay}
            <span className="mx-2 text-gray-200">|</span>
            <span className="font-semibold text-gray-600">Time:</span> {timeStr}
          </div>
          <button
            type="submit"
            disabled={mut.isPending}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-700 hover:to-cyan-600 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold shadow-md shadow-blue-200 transition-all"
          >
            <Save size={15} />
            {mut.isPending ? 'Saving…' : 'Save Loading Record'}
          </button>
        </div>
      </div>
    </form>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

// ── Centered Stock Error Modal ────────────────────────────────────────────────

function StockErrorModal({ issues, onClose }: { issues: StockIssue[]; onClose: () => void }) {
  const invIssues  = issues.filter(i => i.source === 'inventory')
  const siloIssues = issues.filter(i => i.source === 'silo')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      {/* Dialog */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 bg-gradient-to-r from-red-600 to-rose-500">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Cannot Save — Insufficient Stock</h3>
            <p className="text-sm text-red-100 mt-0.5">Add raw materials to inventory before saving this entry</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-3">
          {invIssues.length > 0 && (
            <>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Raw Material Shortage</p>
              {invIssues.map((issue, i) => (
                <div key={i} className="flex items-center justify-between gap-4 px-4 py-3 bg-red-50 rounded-xl border border-red-100">
                  <span className="font-semibold text-red-800 text-sm">{issue.materialName}</span>
                  <div className="text-right shrink-0 space-y-0.5">
                    <div className="text-xs text-gray-500">
                      Available: <span className="font-bold text-red-600">{issue.available.toFixed(2)} {issue.uom}</span>
                    </div>
                    <div className="text-xs text-gray-500">
                      Required: <span className="font-bold text-gray-800">{issue.required.toFixed(2)} {issue.uom}</span>
                    </div>
                    <div className="text-xs font-bold text-red-700 bg-red-100 px-2 py-0.5 rounded-full text-center">
                      Short by {issue.shortfall.toFixed(2)} {issue.uom}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}
          {siloIssues.map((issue, i) => (
            <div key={i} className="flex items-center justify-between gap-4 px-4 py-3 bg-orange-50 rounded-xl border border-orange-200">
              <div>
                <p className="text-[11px] font-bold text-orange-500 uppercase tracking-widest mb-0.5">Silo Cement</p>
                <span className="font-semibold text-orange-800 text-sm">{issue.siloLabel}</span>
              </div>
              <div className="text-right shrink-0 space-y-0.5">
                <div className="text-xs text-gray-500">
                  Balance: <span className="font-bold text-orange-600">{issue.available.toFixed(3)} MT</span>
                </div>
                <div className="text-xs text-gray-500">
                  Required: <span className="font-bold text-gray-800">{issue.required.toFixed(3)} MT</span>
                </div>
                <div className="text-xs font-bold text-orange-700 bg-orange-100 px-2 py-0.5 rounded-full text-center">
                  Short by {issue.shortfall.toFixed(3)} MT
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-red-200"
          >
            OK — I'll update the stock first
          </button>
        </div>
      </div>
    </div>
  )
}

// ── General Error Modal ───────────────────────────────────────────────────────

function ErrorModal({ message, onClose }: { message: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-5 bg-gradient-to-r from-red-600 to-rose-500">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
            <AlertTriangle size={20} className="text-white" />
          </div>
          <div>
            <h3 className="font-bold text-white text-base">Cannot Save Entry</h3>
            <p className="text-sm text-red-100 mt-0.5">Please fix the issue and try again</p>
          </div>
        </div>
        {/* Body */}
        <div className="px-6 py-5">
          <p className="text-sm text-gray-700 leading-relaxed">{message}</p>
        </div>
        {/* Footer */}
        <div className="px-6 pb-5">
          <button
            onClick={onClose}
            className="w-full py-3 bg-red-600 hover:bg-red-700 active:bg-red-800 text-white rounded-xl font-semibold text-sm transition-colors shadow-lg shadow-red-200"
          >
            OK, Got It
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ProductionEntryPage() {
  const qc = useQueryClient()
  const [selectedStage, setSelectedStage]               = useState('')
  const [selectedDeliveryStage, setSelectedDeliveryStage] = useState('')
  const [selectedIds, setSelectedIds]                   = useState<number[]>([])
  const [entryDataMap, setEntryDataMap]                 = useState<Record<number, OrderEntryData>>({})
  const [stockIssuesMap, setStockIssuesMap]             = useState<Record<number, StockIssue[]>>({})
  const [stockReadyMap, setStockReadyMap]               = useState<Record<number, boolean>>({})
  const [stockErrorModal, setStockErrorModal]           = useState<StockIssue[] | null>(null)
  const [errorModal, setErrorModal]                     = useState<string | null>(null)
  const [showValidation, setShowValidation]             = useState(false)
  const [coatingSandType, setCoatingSandType]           = useState<'plaster' | 'crushedDust'>('plaster')

  const { data: allOrdersData } = useQuery({
    queryKey: ['production-orders-for-entry', selectedStage],
    queryFn: () => productionOrderApi.getSummaries(selectedStage || undefined).then(r => r.data.data ?? []),
  })

  const orders: any[] = allOrdersData ?? []
  const activeOrders = orders.filter(
    o => o.status !== 'CANCELLED' && o.finishedPipes < o.plannedQty
  )

  function toggleOrder(id: number) {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      setEntryDataMap(m => ({ ...m, [id]: defaultEntryData() }))
      return [...prev, id]
    })
  }

  function removeOrder(id: number) {
    setSelectedIds(prev => prev.filter(x => x !== id))
    setEntryDataMap(prev => { const m = { ...prev }; delete m[id]; return m })
    setStockIssuesMap(prev => { const m = { ...prev }; delete m[id]; return m })
    setStockReadyMap(prev => { const m = { ...prev }; delete m[id]; return m })
  }

  const createMut = useMutation({
    mutationFn: (entries: any[]) =>
      Promise.all(entries.map(e => productionEntryApi.create(e))),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['production-orders-for-entry'] })
      qc.invalidateQueries({ queryKey: ['production-pipe-summary'] })
      qc.invalidateQueries({ queryKey: ['production-pipe-summary-table'] })
      qc.invalidateQueries({ queryKey: ['production-stage-overview'] })
      qc.invalidateQueries({ queryKey: ['intermediate-stock'] })
      qc.invalidateQueries({ queryKey: ['all-stages-stock'] })
      toast.success(`${selectedIds.length} entr${selectedIds.length === 1 ? 'y' : 'ies'} saved`)
      setSelectedIds([])
      setEntryDataMap({})
      setShowValidation(false)
    },
    onError: (e: any) => setErrorModal(e.response?.data?.message ?? 'Failed to save entries. Please try again.'),
  })

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!selectedStage) { toast.error('Select a process stage'); return }
    if (selectedIds.length === 0) { toast.error('Select at least one production order'); return }

    // Trigger inline validation on all cards
    setShowValidation(true)

    // Check each order's fields using the same rules as the inline errors
    for (const id of selectedIds) {
      const d = entryDataMap[id]
      const pVal = d?.pipesProcessed ?? ''
      const cVal = d?.pipesCompleted ?? ''
      const pNum = Number(pVal)
      const cNum = Number(cVal)

      if (pVal === '') { toast.error('Pipes processed is required — see highlighted field'); return }
      if (pNum === 0)  { toast.error('Processed qty cannot be 0 — enter the actual count'); return }
      if (pNum < 0)    { toast.error('Processed qty must be a positive number'); return }
      if (cVal === '') { toast.error('Pipes completed is required — see highlighted field'); return }
      if (cNum < 0)    { toast.error('Completed qty must be a positive number'); return }
      if (cNum > pNum) { toast.error('Completed qty cannot exceed processed qty'); return }
    }

    // Block if stock data hasn't finished loading for any material-stage order
    if (MATERIAL_STAGES.includes(selectedStage)) {
      const notReady = selectedIds.filter(id => !stockReadyMap[id])
      if (notReady.length > 0) {
        toast.error('Stock data is still loading — please wait a moment and try again.')
        return
      }
    }

    // Block if any order has insufficient stock — show centered modal
    const allIssues = selectedIds.flatMap(id => stockIssuesMap[id] ?? [])
    if (allIssues.length > 0) {
      setStockErrorModal(allIssues)
      return
    }

    const entries = selectedIds.map(id => {
      const d = entryDataMap[id]
      const processed = Number(d.pipesProcessed) || 0
      const completed = Number(d.pipesCompleted) || 0
      const rejected  = Math.max(0, processed - completed)

      return {
        productionOrderId: id,
        stageType:         selectedStage,
        pipesProcessed:    processed,
        pipesCompleted:    completed,
        pipesRejected:     rejected > 0 ? rejected : undefined,
        entryDate:         d.entryDate ? new Date(d.entryDate) : undefined,
        notes:             d.notes || undefined,
        bedType:           selectedStage === 'DEMOULDING' ? d.bedType || undefined : undefined,
        shiftName:         d.shiftName || undefined,
        consumptions:      d.materialInputs.length > 0
          ? d.materialInputs.map(m => ({
              pipeConfigMaterialId: m.pipeConfigMaterialId,
              materialProductId:    m.materialProductId,
              consumedQty:          parseFloat(m.actualQty) || 0,
              uom:                  m.uom,
            }))
          : undefined,
      }
    })

    createMut.mutate(entries)
  }

  const today = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* ── Centered stock error modal ────────────────────────────────── */}
      {stockErrorModal && (
        <StockErrorModal
          issues={stockErrorModal}
          onClose={() => setStockErrorModal(null)}
        />
      )}

      {/* ── General backend / validation error modal ─────────────────── */}
      {errorModal && (
        <ErrorModal
          message={errorModal}
          onClose={() => setErrorModal(null)}
        />
      )}

      {/* ── Hero header ──────────────────────────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 shadow-[0_8px_40px_rgba(109,40,217,0.30)]">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
        <div className="pointer-events-none absolute bottom-0 left-1/4 w-64 h-28 rounded-full bg-blue-400/10 blur-3xl" />
        {/* Dot grid */}
        <div className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />

        <div className="relative flex items-center justify-between px-8 py-4">
          {/* Left: icon + title */}
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <PenLine size={18} className="text-amber-300" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-blue-200 uppercase tracking-widest">Production</p>
              <h1 className="text-lg font-extrabold text-white tracking-tight leading-tight">Process Entry</h1>
            </div>
          </div>

          {/* Right: stat chips + stage badge + date */}
          <div className="flex items-center gap-2">
            {selectedStage && (
              <div className="flex items-center gap-2">
                <span className="text-base font-semibold text-white">Selected —</span>
                {(() => { const Icon = STAGE_META[selectedStage]?.icon; return Icon ? <Icon size={16} className="text-amber-300" /> : null })()}
                <span className="text-base font-extrabold text-amber-300">{PROD_STAGES.find(s => s.key === selectedStage)?.label}</span>
              </div>
            )}
            <div className="flex flex-col items-end bg-white/10 border border-white/15 rounded-xl px-4 py-2 min-w-[90px]">
              <p className="text-base font-extrabold tabular-nums leading-none text-white">{activeOrders.length}</p>
              <p className="text-[10px] text-blue-200 mt-0.5 whitespace-nowrap">Active Orders</p>
            </div>
            <div className="flex flex-col items-end bg-white/10 border border-white/15 rounded-xl px-4 py-2 min-w-[90px]">
              <p className={`text-base font-extrabold tabular-nums leading-none ${selectedIds.length > 0 ? 'text-amber-300' : 'text-white'}`}>{selectedIds.length}</p>
              <p className="text-[10px] text-blue-200 mt-0.5 whitespace-nowrap">Orders Queued</p>
            </div>
            <div className="ml-2 border-l border-white/15 pl-4">
              <p className="text-[11px] text-blue-200 font-medium whitespace-nowrap">{today}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Stage Pipeline ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Production Pipeline — Select a Stage</p>

        {/* Track container */}
        <div className="relative">
          <div className="flex items-center overflow-x-auto pb-3 pt-2 px-2 -mx-2 gap-0">
            {PROD_STAGES.map((s, i) => {
              const meta   = STAGE_META[s.key]
              const Icon   = meta.icon
              const isActive = selectedStage === s.key
              const isLast   = i === PROD_STAGES.length - 1

              const isFabrication = s.key === 'FABRICATION'
              const bgImageMap: Record<string, string> = {
                FABRICATION:         '/images/fabrication-bg.png',
                FABRICATION_TESTING: '/images/fab-testing.webp',
                MOULDING:            '/images/moulding.jpg',
                SPINNING:            '/images/spinning.jpg',
                DEMOULDING:          '/images/demoulding.avif',
                CURING_1:            '/images/curing1.jpeg',
                WINDING:             '/images/winding.jpg',
                COATING:             '/images/coating.avif',
                CURING_2:            '/images/curing2.jpg',
                FINAL_TESTING:       '/images/final-testing.webp',
              }
              const hasBgImage = s.key in bgImageMap

              return (
                <div key={s.key} className="flex items-end flex-none group/wrap">
                  <div className="flex flex-col items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setSelectedStage(isActive ? '' : s.key); setSelectedDeliveryStage('') }}
                    className={`
                      group/card relative flex-none w-[130px] rounded-2xl text-left
                      transition-all duration-200 flex flex-col overflow-hidden
                      ${isActive
                        ? `shadow-[0_8px_32px_rgba(109,40,217,0.50)] scale-[1.07] border-2 border-violet-400`
                        : `border-2 ${meta.border} shadow-[0_2px_10px_rgba(0,0,0,0.07)]
                           hover:scale-[1.04] hover:shadow-[0_6px_20px_rgba(0,0,0,0.13)]`
                      }
                      ${hasBgImage ? '' : isActive ? 'bg-gradient-to-br from-violet-600 to-blue-600 text-white' : `bg-white ${meta.hoverBg}`}
                    `}
                  >
                    {/* ── Photo background card (FABRICATION / FAB TESTING) ── */}
                    {hasBgImage ? (
                      <>
                        {/* bg image */}
                        <div
                          className="absolute inset-0 bg-cover bg-center"
                          style={{ backgroundImage: `url(${bgImageMap[s.key]})` }}
                        />
                        {/* active violet tint — only when selected */}
                        {isActive && (
                          <div className="absolute inset-0 bg-violet-600/30" />
                        )}
                        {/* bottom gradient for text legibility */}
                        <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />
                        {/* content */}
                        <div className="relative flex flex-col justify-end h-full p-3.5" style={{ minHeight: 110 }}>
                          {isActive && (
                            <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                          )}
                          {/* bottom: label */}
                          <div>
                            <p className="text-sm font-light text-white leading-snug tracking-wide">{s.label}</p>
                          </div>
                        </div>
                      </>
                    ) : (  /* non-photo cards */
                      <>
                        {/* Coloured top accent strip (inactive only) */}
                        {!isActive && (
                          <div className={`h-1 w-full ${meta.bg} opacity-80`} />
                        )}

                        <div className="p-3.5 flex flex-col gap-3">
                          {/* Icon circle */}
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover/card:scale-110 ${
                            isActive ? 'bg-white/20' : meta.bg
                          }`}>
                            <Icon size={20} className={isActive ? 'text-white' : meta.accent} />
                          </div>

                          {/* Label */}
                          <div>
                            <p className={`text-[11px] font-bold leading-snug ${isActive ? 'text-white' : 'text-gray-800'}`}>
                              {s.label}
                            </p>
                          </div>
                        </div>

                        {/* Active glow dot */}
                        {isActive && (
                          <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                        )}
                      </>
                    )}
                  </button>

                  <p className={`tracking-wide transition-all ${isActive ? 'text-violet-600 font-bold text-sm' : 'text-gray-400 font-light text-[10px]'}`}>
                    Step {i + 1}
                  </p>
                  </div>

                  {/* Arrow connector */}
                  {!isLast && (
                    <div className="flex items-center shrink-0 px-1 mb-5">
                      <div className="w-4 h-[2px] bg-gradient-to-r from-gray-300 to-gray-400" />
                      <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[7px] border-l-gray-400" />
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      </div>

      {/* ── Delivery Stage ─────────────────────────────────────────── */}
      <div className="space-y-3">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest">Delivery Stage</p>

        <div className="flex items-center gap-0">
          {DELIVERY_STAGES.map((s, i) => {
            const meta    = DELIVERY_STAGE_META[s.key]
            const Icon    = meta.icon
            const isActive = selectedDeliveryStage === s.key
            const isLast   = i === DELIVERY_STAGES.length - 1

            const deliveryBgMap: Record<string, string> = {
              PDI:     '/images/pdi.avif',
              LOADING: '/images/loading.jpg',
            }
            const hasDlvBg = s.key in deliveryBgMap

            return (
              <div key={s.key} className="flex items-end flex-none">
                <div className="flex flex-col items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDeliveryStage(isActive ? '' : s.key)
                    setSelectedStage('')
                  }}
                  className={`
                    group/card relative flex-none w-[130px] rounded-2xl text-left
                    transition-all duration-200 flex flex-col overflow-hidden
                    ${isActive
                      ? `shadow-[0_8px_32px_rgba(16,185,129,0.45)] scale-[1.07] border-2 border-emerald-400`
                      : `border-2 ${meta.border} shadow-[0_2px_10px_rgba(0,0,0,0.07)]
                         hover:scale-[1.04] hover:shadow-[0_6px_20px_rgba(0,0,0,0.13)]`
                    }
                    ${hasDlvBg ? '' : isActive ? 'bg-gradient-to-br from-emerald-500 to-teal-600 text-white' : `bg-white ${meta.hoverBg}`}
                  `}
                >
                  {hasDlvBg ? (
                    <>
                      <div className="absolute inset-0 bg-cover bg-center"
                        style={{ backgroundImage: `url(${deliveryBgMap[s.key]})` }} />
                      {isActive && <div className="absolute inset-0 bg-emerald-600/30" />}
                      <div className="absolute bottom-0 inset-x-0 h-16 bg-gradient-to-t from-black/90 via-black/60 to-transparent" />
                      <div className="relative flex flex-col justify-end h-full p-3.5" style={{ minHeight: 110 }}>
                        {isActive && (
                          <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white/90 shadow-[0_0_8px_rgba(255,255,255,0.9)]" />
                        )}
                        <p className="text-sm font-light text-white leading-snug tracking-wide">{s.label}</p>
                      </div>
                    </>
                  ) : (
                    <>
                      {!isActive && <div className={`h-1 w-full ${meta.bg} opacity-80`} />}
                      <div className="p-3.5 flex flex-col gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover/card:scale-110 ${
                          isActive ? 'bg-white/20' : meta.bg
                        }`}>
                          <Icon size={20} className={isActive ? 'text-white' : meta.accent} />
                        </div>
                        <div>
                          <p className={`text-[11px] font-bold leading-snug ${isActive ? 'text-white' : 'text-gray-800'}`}>{s.label}</p>
                          <p className={`text-[10px] mt-0.5 font-medium ${isActive ? 'text-white/60' : 'text-gray-400'}`}>{s.sub}</p>
                        </div>
                      </div>
                      {isActive && <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.9)]" />}
                    </>
                  )}
                </button>
                <p className={`tracking-wide transition-all ${isActive ? 'text-emerald-600 font-bold text-sm' : 'text-gray-400 font-light text-[10px]'}`}>
                  {s.sub}
                </p>
                </div>

                {!isLast && (
                  <div className="flex items-center shrink-0 px-1">
                    <div className="w-4 h-[2px] bg-gradient-to-r from-gray-300 to-gray-400" />
                    <div className="w-0 h-0 border-y-[5px] border-y-transparent border-l-[7px] border-l-gray-400" />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {selectedDeliveryStage && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Selected:</span>
            <span className="inline-flex items-center gap-1.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 text-emerald-700 text-xs font-semibold px-3 py-1 rounded-full">
              {(() => { const Icon = DELIVERY_STAGE_META[selectedDeliveryStage]?.icon; return Icon ? <Icon size={11} /> : null })()}
              {DELIVERY_STAGES.find(s => s.key === selectedDeliveryStage)?.label} — {DELIVERY_STAGES.find(s => s.key === selectedDeliveryStage)?.sub}
            </span>
          </div>
        )}
      </div>

      {/* ── PDI Entry Form (PDI delivery stage) ─────────────────── */}
      {selectedDeliveryStage === 'PDI' && (
        <PDIEntryForm
          onSaved={() => setSelectedDeliveryStage('')}
        />
      )}

      {/* ── Loading Entry Form (LOADING delivery stage) ────────── */}
      {selectedDeliveryStage === 'LOADING' && (
        <LoadingEntryForm
          orders={orders}
          onSaved={() => setSelectedDeliveryStage('')}
        />
      )}

      {/* ── Order selection + Entry Data (side by side) ──────────── */}
      {selectedDeliveryStage !== 'LOADING' && selectedDeliveryStage !== 'PDI' && (
      <div className="flex items-start gap-6">

        {/* Left: Select Production Orders (fixed width) */}
        <div className="w-[460px] shrink-0">
          <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.07)] ring-1 ring-gray-100">
            <div className="flex items-center justify-between px-5 py-3 bg-gradient-to-r from-violet-600 to-blue-600 rounded-t-2xl">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-lg bg-white/10 flex items-center justify-center flex-shrink-0">
                  <ListChecks size={14} className="text-white" />
                </div>
                <h2 className="text-xs font-bold text-white tracking-wide">Select Production Orders</h2>
              </div>
              <span className="text-[11px] font-semibold text-blue-100">
                {activeOrders.length} active order{activeOrders.length !== 1 ? 's' : ''} available
              </span>
            </div>
            <div className="p-5 relative">
              <MultiOrderCombobox
                orders={activeOrders}
                selectedIds={selectedIds}
                onToggle={toggleOrder}
                onRemove={removeOrder}
              />
            </div>
          </div>
        </div>

        {/* Right: Entry Data (fills remaining width) */}
        <form onSubmit={handleSubmit} className="flex-1 min-w-0 space-y-5">

          {/* ── Coating sand mix toggle ── */}
          {selectedStage === 'COATING' && (
            <div className="inline-flex items-center gap-4 bg-white rounded-2xl px-5 py-3 shadow-[0_8px_32px_rgba(0,0,0,0.18)]">
              <span className="text-sm font-bold text-gray-900 shrink-0">Sand Mix</span>
              <div className="flex gap-1.5 bg-gray-100/80 rounded-2xl p-1.5">
                <button
                  type="button"
                  onClick={() => setCoatingSandType('plaster')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                    coatingSandType === 'plaster'
                      ? 'bg-gray-900 text-white shadow-md'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-white/80'
                  }`}
                >
                  Plaster Sand
                </button>
                <button
                  type="button"
                  onClick={() => setCoatingSandType('crushedDust')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-150 ${
                    coatingSandType === 'crushedDust'
                      ? 'bg-gray-900 text-white shadow-md'
                      : 'text-gray-700 hover:text-gray-900 hover:bg-white/80'
                  }`}
                >
                  Crushed Sand &amp; Dust
                </button>
              </div>
            </div>
          )}

          {/* Entry cards — one per selected order */}
          {selectedIds.length > 0 && selectedStage && (
            <div className="space-y-4">
              {selectedIds.map((id, index) => {
                const order = orders.find(o => o.id === id)
                if (!order) return null
                return (
                  <OrderEntryCard
                    key={id}
                    order={order}
                    stage={selectedStage}
                    data={entryDataMap[id] ?? defaultEntryData()}
                    onChange={d => setEntryDataMap(prev => ({ ...prev, [id]: d }))}
                    onRemove={() => {
                      removeOrder(id)
                      setStockIssuesMap(prev => { const m = { ...prev }; delete m[id]; return m })
                    }}
                    onStockUpdate={(orderId, issues, ready) => {
                      setStockIssuesMap(prev => ({ ...prev, [orderId]: issues }))
                      setStockReadyMap(prev => ({ ...prev, [orderId]: ready }))
                    }}
                    index={index}
                    totalOrders={selectedIds.length}
                    showValidation={showValidation}
                    coatingSandType={selectedStage === 'COATING' ? coatingSandType : undefined}
                  />
                )
              })}
            </div>
          )}

          {selectedIds.length > 0 && !selectedStage && (
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4">
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Info size={15} className="text-amber-600" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-800">Stage not selected</p>
                <p className="text-xs text-amber-600 mt-0.5">Select a process stage from the pipeline above to fill in entry data.</p>
              </div>
            </div>
          )}

          {selectedIds.length === 0 && (
            <div className="flex items-center justify-center h-32 rounded-2xl border-2 border-dashed border-gray-200 text-gray-400 text-sm">
              Select orders on the left to begin
            </div>
          )}

          {/* Submit */}
          {selectedIds.length > 0 && selectedStage && (
            <div className="flex items-center justify-between bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.06)] ring-1 ring-gray-100 px-6 py-4">
              <div>
                <p className="text-sm font-semibold text-gray-800">
                  {selectedIds.length} order{selectedIds.length !== 1 ? 's' : ''} ready
                </p>
                <p className="text-xs text-gray-400 mt-0.5">
                  Stage: <span className="text-violet-600 font-medium">{PROD_STAGES.find(s => s.key === selectedStage)?.label}</span>
                </p>
              </div>
              <button
                type="submit"
                disabled={createMut.isPending}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white px-6 py-2.5 rounded-xl font-semibold shadow-md shadow-violet-200 transition-all"
              >
                <Save size={16} />
                {createMut.isPending ? 'Saving…' : `Save ${selectedIds.length} Entr${selectedIds.length !== 1 ? 'ies' : 'y'}`}
              </button>
            </div>
          )}
        </form>
      </div>

      )}

      {/* ── Stage Overview Table ───────────────────────────────────── */}
      <ProductionStageTable selectedStage={selectedStage} />
    </div>
  )
}
