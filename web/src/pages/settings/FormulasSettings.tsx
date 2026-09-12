import { useState, useCallback, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Download, Check, X, Pencil } from 'lucide-react'
import { pipeConfigApi } from '@/services/api'
import toast from 'react-hot-toast'
import * as XLSX from 'xlsx'

const PRESSURE_CLASSES_ALL = [
  '4kg','5.5kg','7kg','8.5kg','10kg','11.5kg','13kg','14.5kg',
  '17kg','18.5kg','20kg','21.5kg','23kg','24kg',
]

const STAGE_ORDER = ['FABRICATION','SPINNING','WINDING','COATING']

const STAGE_COLORS: Record<string, string> = {
  FABRICATION: 'bg-blue-50 text-blue-700',
  SPINNING:    'bg-amber-50 text-amber-700',
  WINDING:     'bg-purple-50 text-purple-700',
  COATING:     'bg-green-50 text-green-700',
}

const STAGE_HEADER_COLORS: Record<string, string> = {
  FABRICATION: 'bg-blue-100 text-blue-800',
  SPINNING:    'bg-amber-100 text-amber-800',
  WINDING:     'bg-purple-100 text-purple-800',
  COATING:     'bg-green-100 text-green-800',
}

interface MaterialRow {
  stage: string
  name: string
}

interface PipeConfigWithMaterials {
  id: number
  diameterMm: number
  pressureClass: string
  lengthM: number
  materials: {
    id: number
    stageType: string
    materialProductId: number
    quantityPerPipe: number | string
    materialProduct?: { id: number; name: string }
  }[]
}

function fmtQty(v: number | string | undefined): string {
  if (v === undefined || v === null || v === '') return '—'
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (isNaN(n) || n === 0) return '0'
  if (Number.isInteger(n)) return String(n)
  return parseFloat(n.toFixed(8)).toString()
}

function buildMatRows(configs: PipeConfigWithMaterials[]): MaterialRow[] {
  const seen = new Set<string>()
  const rows: MaterialRow[] = []
  for (const stage of STAGE_ORDER) {
    for (const cfg of configs) {
      const mats = cfg.materials?.filter(m => m.stageType === stage) ?? []
      for (const m of mats) {
        const name = m.materialProduct?.name ?? `mat-${m.materialProductId}`
        const key = `${stage}::${name}`
        if (!seen.has(key)) {
          seen.add(key)
          rows.push({ stage, name })
        }
      }
    }
  }
  return rows
}

function getQty(cfg: PipeConfigWithMaterials | undefined, stage: string, matName: string): number | string {
  if (!cfg) return ''
  const m = cfg.materials?.find(
    x => x.stageType === stage && (x.materialProduct?.name ?? `mat-${x.materialProductId}`) === matName
  )
  if (!m) return ''
  const v = typeof m.quantityPerPipe === 'string' ? parseFloat(m.quantityPerPipe) : m.quantityPerPipe
  return isNaN(v) ? '' : v
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function FormulasSettings() {
  const [lengthTab, setLengthTab] = useState<'5.25' | '6.46'>('5.25')
  const [activeDia, setActiveDia] = useState<number | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const sectionRefs = useRef<Record<number, HTMLDivElement | null>>({})

  const { data, isLoading } = useQuery({
    queryKey: ['pipe-configs-formulas', lengthTab],
    queryFn: () =>
      pipeConfigApi.getAll({ lengthM: parseFloat(lengthTab), active: true, size: 1000 }).then(r => {
        return (r.data.data?.content ?? []) as PipeConfigWithMaterials[]
      }),
    staleTime: 30_000,
  })

  const configs = data ?? []
  const diameters = [...new Set(configs.map(c => c.diameterMm))].sort((a, b) => a - b)

  // Track which section is in view for sidebar highlight
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return
    const onScroll = () => {
      for (const dia of [...diameters].reverse()) {
        const el = sectionRefs.current[dia]
        if (el && el.getBoundingClientRect().top <= container.getBoundingClientRect().top + 80) {
          setActiveDia(dia)
          return
        }
      }
      if (diameters.length > 0) setActiveDia(diameters[0])
    }
    container.addEventListener('scroll', onScroll, { passive: true })
    return () => container.removeEventListener('scroll', onScroll)
  }, [diameters.join(',')])

  // Set first diameter as active when data loads
  useEffect(() => {
    if (diameters.length > 0 && activeDia === null) setActiveDia(diameters[0])
  }, [diameters.join(',')])

  function handleLengthTab(l: '5.25' | '6.46') {
    setLengthTab(l)
    setActiveDia(null)
    if (scrollRef.current) scrollRef.current.scrollTop = 0
  }

  function jumpToDia(dia: number) {
    const el = sectionRefs.current[dia]
    const container = scrollRef.current
    if (el && container) {
      container.scrollTo({ top: el.offsetTop - 8, behavior: 'smooth' })
    }
    setActiveDia(dia)
  }

  // Download handler for all configs
  const handleDownload = useCallback(() => {
    const length = parseFloat(lengthTab)
    const wb = XLSX.utils.book_new()
    const sheetName = lengthTab === '5.25' ? '5.25' : '6.46'
    const configsByDia: Record<number, Record<string, PipeConfigWithMaterials>> = {}
    for (const cfg of configs) {
      if (!configsByDia[cfg.diameterMm]) configsByDia[cfg.diameterMm] = {}
      configsByDia[cfg.diameterMm][cfg.pressureClass] = cfg
    }
    const dias = Object.keys(configsByDia).map(Number).sort((a, b) => a - b)
    const rows: any[][] = []
    rows.push(['', 'Material', ...PRESSURE_CLASSES_ALL])
    rows.push([])
    for (const d of dias) {
      rows.push([`${d}mm`, '', ...PRESSURE_CLASSES_ALL.map(() => '')])
      const dCfgs = configsByDia[d] ?? {}
      const diaMatRows = buildMatRows(Object.values(dCfgs))
      for (const row of diaMatRows) {
        rows.push([
          row.stage,
          row.name,
          ...PRESSURE_CLASSES_ALL.map(pc => {
            const cfg = dCfgs[pc]
            const v = getQty(cfg, row.stage, row.name)
            if (v === '' || v === undefined) return ''
            const n = typeof v === 'string' ? parseFloat(v) : v
            return isNaN(n) ? '' : n
          }),
        ])
      }
      rows.push([])
    }
    const ws = XLSX.utils.aoa_to_sheet(rows)
    ws['!cols'] = [{ wch: 14 }, { wch: 30 }, ...PRESSURE_CLASSES_ALL.map(() => ({ wch: 10 }))]
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    XLSX.writeFile(wb, `pccp_formulas_${sheetName}m.xlsx`)
    toast.success(`Downloaded pccp_formulas_${sheetName}m.xlsx`)
  }, [configs, lengthTab])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20 text-gray-400">
        <Loader2 size={22} className="animate-spin mr-2" /> Loading formulas…
      </div>
    )
  }

  return (
    <div className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
      {/* Top bar: sub-tabs + download */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2 p-1 bg-gray-100 rounded-xl w-fit">
          {(['5.25', '6.46'] as const).map(l => (
            <button key={l} onClick={() => handleLengthTab(l)}
              className={`px-5 py-2 text-sm font-semibold rounded-lg transition-all ${
                lengthTab === l
                  ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}>
              {l}m
            </button>
          ))}
        </div>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 text-xs font-semibold text-violet-700 bg-violet-50 border border-violet-200 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors">
          <Download size={13} /> Download Excel
        </button>
      </div>

      <div className="flex gap-4 flex-1 min-h-0">
        {/* ── Diameter sidebar (jump nav) ── */}
        <div className="w-28 shrink-0 border border-gray-200 rounded-xl overflow-y-auto bg-white">
          <div className="px-3 py-2 border-b border-gray-100 sticky top-0 bg-white z-10">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Diameter</p>
          </div>
          {diameters.map(d => (
            <button key={d} onClick={() => jumpToDia(d)}
              className={`w-full text-left px-3 py-2 text-xs font-medium border-b border-gray-50 last:border-0 transition-colors ${
                activeDia === d
                  ? 'bg-violet-600 text-white'
                  : 'text-gray-600 hover:bg-gray-50'
              }`}>
              {d}mm
            </button>
          ))}
        </div>

        {/* ── All diameter sections ── */}
        <div ref={scrollRef} className="flex-1 min-w-0 overflow-y-auto space-y-6 pr-1">
          {diameters.map(dia => {
            const diaConfigs: Record<string, PipeConfigWithMaterials> = {}
            for (const cfg of configs) {
              if (cfg.diameterMm === dia) diaConfigs[cfg.pressureClass] = cfg
            }
            const presentPcs = PRESSURE_CLASSES_ALL.filter(pc => diaConfigs[pc] !== undefined)
            const matRows = buildMatRows(Object.values(diaConfigs))

            return (
              <DiameterSection
                key={dia}
                dia={dia}
                lengthTab={lengthTab}
                diaConfigs={diaConfigs}
                matRows={matRows}
                presentPcs={presentPcs}
                sectionRef={el => { sectionRefs.current[dia] = el }}
              />
            )
          })}
        </div>
      </div>
    </div>
  )
}

// ── Diameter Section (with edit-mode toggle) ──────────────────────────────────

function DiameterSection({
  dia, lengthTab, diaConfigs, matRows, presentPcs, sectionRef,
}: {
  dia: number
  lengthTab: string
  diaConfigs: Record<string, PipeConfigWithMaterials>
  matRows: MaterialRow[]
  presentPcs: string[]
  sectionRef: (el: HTMLDivElement | null) => void
}) {
  const [editMode, setEditMode] = useState(false)

  return (
    <div ref={sectionRef}>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-800">{dia}mm — {lengthTab}m</h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-400 font-medium">{presentPcs.length} pressure classes</span>
          <button
            onClick={() => setEditMode(v => !v)}
            title={editMode ? 'Exit edit mode' : 'Edit formulas'}
            className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-md border transition-colors ${
              editMode
                ? 'bg-violet-600 text-white border-violet-600'
                : 'text-gray-500 border-gray-200 hover:border-violet-400 hover:text-violet-600 bg-white'
            }`}>
            <Pencil size={10} />
            {editMode ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>
      <DiameterTable
        diaConfigs={diaConfigs}
        matRows={matRows}
        pcs={presentPcs}
        dia={dia}
        lengthTab={lengthTab}
        editMode={editMode}
        onExitEdit={() => setEditMode(false)}
      />
    </div>
  )
}

// ── Per-diameter Table ────────────────────────────────────────────────────────

interface EditingCell {
  configId: number
  stage: string
  matName: string
  value: string
}

function DiameterTable({
  diaConfigs,
  matRows,
  pcs,
  dia,
  lengthTab,
  editMode,
  onExitEdit,
}: {
  diaConfigs: Record<string, PipeConfigWithMaterials>
  matRows: MaterialRow[]
  pcs: string[]
  dia: number
  lengthTab: string
  editMode: boolean
  onExitEdit: () => void
}) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<EditingCell | null>(null)

  useEffect(() => {
    if (!editMode) setEditing(null)
  }, [editMode])

  const saveMut = useMutation({
    mutationFn: async ({ configId, stage, matName, qty }: { configId: number; stage: string; matName: string; qty: number }) => {
      const cfg = Object.values(diaConfigs).find(c => c.id === configId)!
      const newMaterials = (cfg.materials ?? []).map(m => {
        const name = m.materialProduct?.name ?? `mat-${m.materialProductId}`
        if (m.stageType === stage && name === matName) {
          return { ...m, quantityPerPipe: qty }
        }
        return m
      })
      const payload = newMaterials.map(m => ({
        materialProductId: m.materialProductId,
        stageType: m.stageType,
        quantityPerPipe: m.quantityPerPipe,
        uom: (m as any).uom ?? 'kg',
        scrapPercent: (m as any).scrapPercent ?? 0,
      }))
      await pipeConfigApi.upsertMaterials(configId, payload)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipe-configs-formulas'] })
      toast.success('Saved')
      setEditing(null)
    },
    onError: () => toast.error('Failed to save'),
  })

  function startEdit(configId: number, stage: string, matName: string, currentVal: number | string) {
    setEditing({ configId, stage, matName, value: String(currentVal === '' ? '' : currentVal) })
  }

  function commitEdit() {
    if (!editing) return
    const qty = parseFloat(editing.value)
    if (isNaN(qty)) { toast.error('Invalid number'); return }
    saveMut.mutate({ configId: editing.configId, stage: editing.stage, matName: editing.matName, qty })
  }

  const isEditing = (configId: number, stage: string, matName: string) =>
    editing?.configId === configId && editing.stage === stage && editing.matName === matName

  const stages = STAGE_ORDER.filter(s => matRows.some(r => r.stage === s))

  if (matRows.length === 0) {
    return (
      <div className="border border-gray-200 rounded-xl bg-white px-4 py-6 text-center text-xs text-gray-400">
        No formula data
      </div>
    )
  }

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-xl bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="bg-gray-50 border-b border-gray-200">
            <th className="text-left px-3 py-2 font-semibold text-gray-500 w-28 sticky left-0 bg-gray-50 border-r border-gray-200">Stage</th>
            <th className="text-left px-3 py-2 font-semibold text-gray-500 w-44 sticky left-28 bg-gray-50 border-r border-gray-200" style={{ left: '7rem' }}>Material</th>
            {pcs.map(pc => (
              <th key={pc} className="text-center px-2 py-2 font-semibold text-gray-600 whitespace-nowrap min-w-[72px]">{pc}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {stages.map(stage => {
            const rows = matRows.filter(r => r.stage === stage)
            return rows.map((row, ri) => (
              <tr key={`${stage}-${row.name}`} className="border-b border-gray-100 hover:bg-gray-50/50 group">
                {ri === 0 ? (
                  <td rowSpan={rows.length}
                    className={`px-2 py-1 text-center font-bold text-[10px] uppercase tracking-wide align-middle border-r border-gray-200 sticky left-0 ${STAGE_HEADER_COLORS[stage]}`}>
                    {stage}
                  </td>
                ) : null}
                <td className={`px-3 py-1.5 font-medium border-r border-gray-100 sticky ${STAGE_COLORS[stage] ?? 'bg-white'}`}
                  style={{ left: '7rem' }}>
                  {row.name}
                </td>
                {pcs.map(pc => {
                  const cfg = diaConfigs[pc]
                  if (!cfg) return <td key={pc} className="text-center px-2 py-1.5 text-gray-300">—</td>
                  const raw = getQty(cfg, stage, row.name)
                  const cellEditing = editMode && isEditing(cfg.id, stage, row.name)
                  const isSaving = saveMut.isPending && editing?.configId === cfg.id && editing.stage === stage && editing.matName === row.name

                  return (
                    <td key={pc} className="text-center px-1 py-1 tabular-nums">
                      {cellEditing ? (
                        <div className="flex items-center gap-1">
                          <input
                            autoFocus
                            value={editing!.value}
                            onChange={e => setEditing(prev => prev ? { ...prev, value: e.target.value } : null)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') commitEdit()
                              if (e.key === 'Escape') setEditing(null)
                            }}
                            className="w-full border border-violet-400 rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-violet-400"
                          />
                          {isSaving ? (
                            <Loader2 size={12} className="animate-spin text-violet-500 shrink-0" />
                          ) : (
                            <>
                              <button onClick={commitEdit} className="text-green-600 hover:text-green-700 shrink-0"><Check size={12} /></button>
                              <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 shrink-0"><X size={12} /></button>
                            </>
                          )}
                        </div>
                      ) : editMode ? (
                        <button
                          onClick={() => startEdit(cfg.id, stage, row.name, raw)}
                          className="w-full px-1 py-0.5 rounded bg-violet-50/60 hover:bg-violet-100 hover:text-violet-700 transition-colors text-gray-700 ring-1 ring-violet-200">
                          {fmtQty(raw === '' ? undefined : raw as number)}
                        </button>
                      ) : (
                        <span className="text-gray-700 px-1">
                          {fmtQty(raw === '' ? undefined : raw as number)}
                        </span>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))
          })}
        </tbody>
      </table>
    </div>
  )
}
