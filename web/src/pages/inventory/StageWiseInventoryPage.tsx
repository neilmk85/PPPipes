import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { inventoryApi } from '@/services/api'
import { Loader2, Layers, Calendar, X } from 'lucide-react'

const STAGES = [
  { key: 'FABRICATION',         label: 'Fabrication' },
  { key: 'FABRICATION_TESTING', label: 'Fab. Testing' },
  { key: 'MOULDING',            label: 'Moulding' },
  { key: 'SPINNING',            label: 'Spinning' },
  { key: 'DEMOULDING',          label: 'Demoulding' },
  { key: 'CURING_1',            label: 'Curing 1' },
  { key: 'WINDING',             label: 'Winding' },
  { key: 'COATING',             label: 'Coating' },
  { key: 'WINDING_2',           label: 'Winding 2' },
  { key: 'COATING_2',           label: 'Coating 2' },
  { key: 'CURING_2',            label: 'Curing 2' },
  { key: 'FINAL_TESTING',       label: 'Final Testing' },
]

interface Row {
  pipeConfigId: number
  pipeConfig: string
  diameterMm: number
  pressureClass: string
  stageType: string
  pipesCompleted: number
}

interface PipeRow {
  pipeConfigId: number
  pipeConfig: string
  diameterMm: number
  pressureClass: string
  stages: Record<string, number>
  total: number
}

export default function StageWiseInventoryPage() {
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  const params = useMemo(() => ({
    ...(fromDate ? { fromDate } : {}),
    ...(toDate   ? { toDate }   : {}),
  }), [fromDate, toDate])

  const { data, isLoading } = useQuery({
    queryKey: ['stage-wise-inventory', params],
    queryFn: async () => {
      const res = await inventoryApi.getStageWise(params)
      return res.data.data as Row[]
    },
  })

  // Pivot: group rows by pipeConfigId
  const pipeRows = useMemo<PipeRow[]>(() => {
    if (!data) return []
    const map = new Map<number, PipeRow>()
    for (const row of data) {
      if (!map.has(row.pipeConfigId)) {
        map.set(row.pipeConfigId, {
          pipeConfigId: row.pipeConfigId,
          pipeConfig: row.pipeConfig,
          diameterMm: row.diameterMm,
          pressureClass: row.pressureClass,
          stages: {},
          total: 0,
        })
      }
      const pr = map.get(row.pipeConfigId)!
      pr.stages[row.stageType] = (pr.stages[row.stageType] ?? 0) + row.pipesCompleted
      pr.total += row.pipesCompleted
    }
    // Sort by diameter then pressureClass
    return [...map.values()].sort((a, b) =>
      a.diameterMm !== b.diameterMm ? a.diameterMm - b.diameterMm : a.pressureClass.localeCompare(b.pressureClass)
    )
  }, [data])

  // Column totals
  const colTotals = useMemo(() => {
    const t: Record<string, number> = {}
    for (const pr of pipeRows) {
      for (const s of STAGES) {
        t[s.key] = (t[s.key] ?? 0) + (pr.stages[s.key] ?? 0)
      }
    }
    return t
  }, [pipeRows])

  const grandTotal = useMemo(() => Object.values(colTotals).reduce((a, b) => a + b, 0), [colTotals])

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Layers size={20} className="text-violet-500" />
            Stage Wise Inventory
          </h1>
          <p className="text-sm text-gray-500 mt-0.5">Pipes completed at each production stage, by pipe type</p>
        </div>

        {/* Date filters */}
        <div className="flex items-center gap-2">
          <Calendar size={15} className="text-gray-400" />
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={fromDate}
              onChange={e => setFromDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="From"
            />
            <span className="text-gray-400 text-sm">—</span>
            <input
              type="date"
              value={toDate}
              onChange={e => setToDate(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-violet-300"
              placeholder="To"
            />
            {(fromDate || toDate) && (
              <button
                onClick={() => { setFromDate(''); setToDate('') }}
                className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Clear dates"
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <Loader2 size={24} className="animate-spin mr-2" /> Loading…
        </div>
      ) : pipeRows.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-300">
          <Layers size={40} className="mb-3" />
          <p className="text-sm text-gray-400">No production data found{(fromDate || toDate) ? ' for the selected period' : ''}</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-gray-100 shadow-sm">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gradient-to-r from-violet-600 to-blue-600 text-white">
                <th className="sticky left-0 z-10 bg-violet-700 px-4 py-3 text-left font-semibold whitespace-nowrap">
                  Pipe Type
                </th>
                {STAGES.map(s => (
                  <th key={s.key} className="px-3 py-3 text-center font-semibold whitespace-nowrap">
                    {s.label}
                  </th>
                ))}
                <th className="px-4 py-3 text-center font-semibold whitespace-nowrap bg-violet-800">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pipeRows.map((pr, i) => (
                <tr
                  key={pr.pipeConfigId}
                  className={`${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/60'} hover:bg-violet-50/40 transition-colors`}
                >
                  <td className="sticky left-0 z-10 px-4 py-3 font-medium text-gray-800 whitespace-nowrap bg-inherit border-r border-gray-100">
                    <div className="font-semibold text-gray-900">{pr.pipeConfig}</div>
                    <div className="text-xs text-gray-400">{pr.diameterMm}mm · {pr.pressureClass}</div>
                  </td>
                  {STAGES.map(s => {
                    const val = pr.stages[s.key] ?? 0
                    return (
                      <td key={s.key} className="px-3 py-3 text-center">
                        {val > 0 ? (
                          <span className="inline-flex items-center justify-center min-w-[2.5rem] px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-700">
                            {val}
                          </span>
                        ) : (
                          <span className="text-gray-200 text-xs">—</span>
                        )}
                      </td>
                    )
                  })}
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center min-w-[3rem] px-2.5 py-0.5 rounded-full text-xs font-bold bg-violet-100 text-violet-700">
                      {pr.total}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Totals row */}
            <tfoot>
              <tr className="bg-gray-800 text-white font-semibold">
                <td className="sticky left-0 z-10 bg-gray-800 px-4 py-3 whitespace-nowrap border-r border-gray-700">
                  Total
                </td>
                {STAGES.map(s => (
                  <td key={s.key} className="px-3 py-3 text-center">
                    {colTotals[s.key] ? (
                      <span className="text-sm font-bold">{colTotals[s.key]}</span>
                    ) : (
                      <span className="text-gray-500 text-xs">—</span>
                    )}
                  </td>
                ))}
                <td className="px-4 py-3 text-center">
                  <span className="text-sm font-bold text-violet-300">{grandTotal}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}
