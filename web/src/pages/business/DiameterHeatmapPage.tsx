import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { productionEntryApi, pipeConfigApi } from '@/services/api'
import { subDays, format } from 'date-fns'
import DiameterHeatmap from '@/components/DiameterHeatmap'

export default function DiameterHeatmapPage() {
  const navigate = useNavigate()
  const today    = new Date()
  const from     = format(subDays(today, 29), 'yyyy-MM-dd')
  const to       = format(today, 'yyyy-MM-dd')

  const { data: finalData = [], isLoading } = useQuery({
    queryKey: ['heatmap-final-testing', from, to],
    queryFn: () =>
      productionEntryApi.getAll({ stageType: 'FINAL_TESTING', from, to, size: 500 })
        .then(r => r.data.data?.content ?? r.data.data ?? []),
  })

  const { data: pipeConfigsRaw = [] } = useQuery({
    queryKey: ['pipe-configs-heatmap'],
    queryFn: () =>
      pipeConfigApi.getAll({ active: true, size: 500 })
        .then(r => r.data.data?.content ?? r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  })
  const pipeConfigs: { id: number; name: string; diameterMm: number; pressureClass: string }[] =
    pipeConfigsRaw as any[]

  const liveRows = useMemo(() => {
    const map = new Map<string, number>()
    ;(finalData as any[]).forEach(e => {
      const name = e.pipeConfig?.name ?? `Config #${e.pipeConfigId}`
      map.set(name, (map.get(name) ?? 0) + (e.pipesCompleted ?? 0))
    })
    return Array.from(map.entries()).map(([pipeName, finalTesting]) => ({ pipeName, finalTesting }))
  }, [finalData])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-violet-50/30 to-slate-50">

      {/* top bar */}
      <div className="sticky top-0 z-10 bg-white/80 backdrop-blur border-b border-gray-100 px-6 py-3.5 flex items-center gap-4">
        <button
          onClick={() => navigate('/business/loading')}
          className="w-9 h-9 rounded-xl flex items-center justify-center text-gray-500 hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="text-base font-bold text-gray-900 leading-tight">Pipes Ready — Diameter View</h1>
          <p className="text-xs text-gray-400">Final Testing stock · rows = diameter · columns = pressure class</p>
        </div>
      </div>

      <div className="p-6">
        {isLoading ? (
          <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Loading…</div>
        ) : (
          <DiameterHeatmap liveRows={liveRows} pipeConfigs={pipeConfigs} />
        )}
      </div>
    </div>
  )
}
