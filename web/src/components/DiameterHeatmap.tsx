import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Gauge, ExternalLink } from 'lucide-react'

// ── helpers ───────────────────────────────────────────────────────────────────

export function extractDiameterMm(name: string): number {
  const m = name.match(/(\d{3,4})\s*mm/i)
  return m ? parseInt(m[1]) : 0
}

export function extractPressureClass(name: string): string {
  const m = name.match(/([\d.]+)\s*kg/i)
  return m ? `${m[1]}kg` : ''
}

function heatCell(value: number, max: number): string {
  if (value === 0 || max === 0) return 'bg-white text-gray-300'
  const ratio = value / max
  if (ratio <= 0.12) return 'bg-violet-50  text-violet-400'
  if (ratio <= 0.28) return 'bg-violet-100 text-violet-600'
  if (ratio <= 0.45) return 'bg-violet-200 text-violet-700'
  if (ratio <= 0.62) return 'bg-violet-300 text-violet-800'
  if (ratio <= 0.80) return 'bg-violet-400 text-white'
  return 'bg-violet-600 text-white'
}

// ── canonical order ───────────────────────────────────────────────────────────

export const DIAMETER_ORDER = [350, 400, 450, 500, 600, 700, 800, 900, 1000, 1100, 1200, 1300, 1400, 1500, 1600, 1700, 1800]
export const PC_ORDER       = ['4kg', '5.5kg', '7kg', '8.5kg', '10kg', '11.5kg', '13kg', '14.5kg']

// ── dummy data ────────────────────────────────────────────────────────────────

export const HEATMAP_DUMMY: Record<number, Partial<Record<string, number>>> = {
  350:  { '4kg': 12, '5.5kg': 47, '7kg': 8,  '8.5kg': 31, '10kg': 3,  '11.5kg': 19, '13kg': 0,  '14.5kg': 7  },
  400:  { '4kg': 56, '5.5kg': 4,  '7kg': 33, '8.5kg': 0,  '10kg': 21, '11.5kg': 2,  '13kg': 14, '14.5kg': 0  },
  450:  { '4kg': 0,  '5.5kg': 28, '7kg': 11, '8.5kg': 44, '10kg': 0,  '11.5kg': 9,  '13kg': 5               },
  500:  { '4kg': 38, '5.5kg': 0,  '7kg': 52, '8.5kg': 6,  '10kg': 17, '11.5kg': 0,  '13kg': 3               },
  600:  { '4kg': 7,  '5.5kg': 41, '7kg': 0,  '8.5kg': 23, '10kg': 0,  '11.5kg': 11                          },
  700:  { '4kg': 63, '5.5kg': 5,  '7kg': 18, '8.5kg': 0,  '10kg': 8                                         },
  800:  { '4kg': 4,  '5.5kg': 29, '7kg': 0,  '8.5kg': 14, '10kg': 1                                         },
  900:  { '4kg': 22, '5.5kg': 0,  '7kg': 35, '8.5kg': 3                                                      },
  1000: { '4kg': 0,  '5.5kg': 16, '7kg': 7,  '8.5kg': 0                                                      },
  1100: { '4kg': 31, '5.5kg': 2,  '7kg': 0                                                                    },
  1200: { '4kg': 8,  '5.5kg': 19                                                                               },
  1300: { '4kg': 0,  '5.5kg': 11, '7kg': 4                                                                    },
  1400: { '4kg': 24, '5.5kg': 0                                                                                },
  1500: { '4kg': 3,  '5.5kg': 14                                                                               },
  1600: { '4kg': 17                                                                                            },
  1700: { '4kg': 0,  '5.5kg': 6                                                                               },
  1800: { '4kg': 9                                                                                             },
}

// ── matrix builder ────────────────────────────────────────────────────────────

export function buildHeatmapMatrix(
  liveRows: { pipeName: string; finalTesting: number }[],
  pipeConfigs: { name: string; diameterMm: number; pressureClass: string }[],
) {
  const liveMap = new Map<string, number>()
  liveRows.forEach(r => { if (r.finalTesting > 0) liveMap.set(r.pipeName, r.finalTesting) })

  const isDummy = liveMap.size === 0

  if (isDummy) {
    const diameters = DIAMETER_ORDER
    const pressureClasses = PC_ORDER
    const matrix: Record<number, Record<string, number>> = {}
    diameters.forEach(d => {
      matrix[d] = {}
      pressureClasses.forEach(pc => { matrix[d][pc] = HEATMAP_DUMMY[d]?.[pc] ?? 0 })
    })
    const colTotals: Record<string, number> = {}
    pressureClasses.forEach(pc => { colTotals[pc] = diameters.reduce((s, d) => s + (matrix[d][pc] ?? 0), 0) })
    const rowTotals: Record<number, number> = {}
    diameters.forEach(d => { rowTotals[d] = pressureClasses.reduce((s, pc) => s + (matrix[d][pc] ?? 0), 0) })
    return { diameters, pressureClasses, matrix, colTotals, rowTotals, isDummy: true }
  }

  const configSource = Array.from(liveMap.keys()).map(name => ({
    name,
    diameterMm: extractDiameterMm(name),
    pressureClass: extractPressureClass(name),
  }))
  // Always show the full standard grid so the heatmap looks the same in live
  // mode as in dummy mode — only cells with real data are non-zero.
  const dSet  = new Set(configSource.map(c => c.diameterMm).filter(d => d > 0))
  const pcSet = new Set(configSource.map(c => c.pressureClass).filter(Boolean))
  const liveDiameters = DIAMETER_ORDER.filter(d => dSet.has(d))
    .concat(Array.from(dSet).filter(d => !DIAMETER_ORDER.includes(d)).sort((a, b) => a - b))
  const livePcs = PC_ORDER.filter(pc => pcSet.has(pc))
    .concat(Array.from(pcSet).filter(pc => !PC_ORDER.includes(pc)).sort())
  // Merge live sizes into the full standard order so all columns/rows are shown
  const diameters = DIAMETER_ORDER
    .concat(liveDiameters.filter(d => !DIAMETER_ORDER.includes(d)))
  const pressureClasses = PC_ORDER
    .concat(livePcs.filter(pc => !PC_ORDER.includes(pc)))

  const matrix: Record<number, Record<string, number>> = {}
  diameters.forEach(d => { matrix[d] = {}; pressureClasses.forEach(pc => { matrix[d][pc] = 0 }) })
  configSource.forEach(c => {
    if (c.diameterMm > 0 && c.pressureClass && matrix[c.diameterMm]) {
      matrix[c.diameterMm][c.pressureClass] =
        (matrix[c.diameterMm][c.pressureClass] ?? 0) + (liveMap.get(c.name) ?? 0)
    }
  })

  const colTotals: Record<string, number> = {}
  pressureClasses.forEach(pc => { colTotals[pc] = diameters.reduce((s, d) => s + (matrix[d]?.[pc] ?? 0), 0) })
  const rowTotals: Record<number, number> = {}
  diameters.forEach(d => { rowTotals[d] = pressureClasses.reduce((s, pc) => s + (matrix[d]?.[pc] ?? 0), 0) })

  return { diameters, pressureClasses, matrix, colTotals, rowTotals, isDummy: false }
}

// ── component ─────────────────────────────────────────────────────────────────

interface Props {
  liveRows: { pipeName: string; finalTesting: number }[]
  pipeConfigs: { name: string; diameterMm: number; pressureClass: string }[]
  showLink?: boolean
  light?: boolean
}

export default function DiameterHeatmap({ liveRows, pipeConfigs, showLink = false, light = false }: Props) {
  const { diameters, pressureClasses, matrix, colTotals, rowTotals, isDummy } = useMemo(
    () => buildHeatmapMatrix(liveRows, pipeConfigs),
    [liveRows, pipeConfigs],
  )

  const globalMax = useMemo(
    () => Math.max(0, ...diameters.flatMap(d => pressureClasses.map(pc => matrix[d]?.[pc] ?? 0))),
    [diameters, pressureClasses, matrix],
  )

  const grandTotal = pressureClasses.reduce((s, pc) => s + (colTotals[pc] ?? 0), 0)

  return (
    <div className="bg-white rounded-2xl shadow-[0_8px_40px_rgba(0,0,0,0.18)] overflow-hidden ring-1 ring-gray-100">

      {/* header */}
      <div className={`flex items-center justify-between px-6 py-4 ${light ? 'bg-gray-50 border-b border-gray-100' : 'bg-gradient-to-r from-violet-600 to-purple-600'}`}>
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${light ? 'bg-violet-100' : 'bg-white/15'}`}>
            <Gauge size={18} className={light ? 'text-violet-600' : 'text-white'} />
          </div>
          <div>
            <p className={`text-sm font-extrabold ${light ? 'text-gray-900' : 'text-white'}`}>Final Testing stock · <span className="tabular-nums">{grandTotal}</span> pipes</p>
          </div>
        </div>

        {/* centre legend */}
        <div className="flex flex-col items-center gap-1">
          <span className={`text-[10px] font-semibold uppercase tracking-widest ${light ? 'text-gray-400' : 'text-white/60'}`}>Intensity</span>
          <div className="flex items-center gap-1">
            {['bg-white/30', 'bg-violet-200/70', 'bg-violet-300/80', 'bg-violet-400', 'bg-violet-500', 'bg-violet-600', 'bg-violet-800'].map((cls, i) => (
              <div key={i} className={`w-4 h-4 rounded ${light ? ['bg-white border border-gray-200','bg-violet-50','bg-violet-100','bg-violet-200','bg-violet-300','bg-violet-400','bg-violet-600'][i] : cls}`} />
            ))}
          </div>
          <div className={`flex justify-between w-full text-[9px] font-medium ${light ? 'text-gray-400' : 'text-white/50'}`}>
            <span>Low</span><span>High</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {showLink && (
            <Link
              to="/business/loading/diameter-view"
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${light ? 'bg-violet-100 hover:bg-violet-200 text-violet-700' : 'bg-white/15 hover:bg-white/25 text-white'}`}
            >
              <ExternalLink size={13} />
              Full view
            </Link>
          )}
        </div>
      </div>

      {/* table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-3 py-3 text-left text-[13px] font-extrabold text-violet-600 uppercase tracking-widest border-b border-r border-gray-100 w-[116px] min-w-[116px] max-w-[116px] whitespace-nowrap">
                Dia (mm)
              </th>
              {pressureClasses.map(pc => (
                <th key={pc} className="px-3 py-3 text-center border-b border-gray-100 whitespace-nowrap min-w-[70px]">
                  <span className="text-xs font-bold text-violet-800">{pc}</span>
                </th>
              ))}
              <th className="px-3 py-3 text-center text-[10px] font-semibold text-gray-400 uppercase tracking-widest border-b border-l border-gray-100 min-w-[60px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {diameters.map((d, ri) => (
              <tr key={d} className={ri % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'}>
                <td className="sticky left-0 z-10 bg-inherit px-3 py-2.5 border-r border-gray-100 font-bold text-gray-700 tabular-nums text-xs w-[116px] min-w-[116px] max-w-[116px]">
                  {d} mm
                </td>
                {pressureClasses.map(pc => {
                  const val = matrix[d]?.[pc] ?? 0
                  return (
                    <td key={pc}
                      className={`px-3 py-2.5 text-center font-bold tabular-nums transition-colors ${heatCell(val, globalMax)}`}
                    >
                      {val > 0 ? val : <span className="text-gray-200 font-normal select-none">—</span>}
                    </td>
                  )
                })}
                <td className="px-3 py-2.5 text-center font-extrabold text-violet-700 tabular-nums border-l border-gray-100 bg-violet-50 text-xs">
                  {(rowTotals[d] ?? 0) > 0 ? rowTotals[d] : <span className="text-gray-300">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-violet-50 border-t-2 border-violet-100">
              <td className="sticky left-0 z-10 bg-violet-50 px-3 py-3 text-[10px] font-bold text-violet-600 uppercase tracking-widest border-r border-violet-100 w-[116px] min-w-[116px] max-w-[116px]">
                Total
              </td>
              {pressureClasses.map(pc => (
                <td key={pc} className="px-3 py-3 text-center font-extrabold text-violet-700 tabular-nums text-xs">
                  {colTotals[pc] ?? 0}
                </td>
              ))}
              <td className="px-3 py-3 text-center font-extrabold text-violet-800 tabular-nums border-l border-violet-100 bg-violet-100 text-xs">
                {grandTotal}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

    </div>
  )
}
