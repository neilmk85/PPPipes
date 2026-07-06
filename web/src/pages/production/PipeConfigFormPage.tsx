import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm, Controller } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ArrowLeft, Plus, Trash2, Save, ChevronDown, ChevronRight, Info } from 'lucide-react'
import { pipeConfigApi, productApi } from '@/services/api'
import { PIPE_DIAMETERS, PRESSURE_CLASSES, MATERIAL_STAGES, PipeConfigMaterial } from '@/types'

const STAGE_LABELS: Record<string, string> = {
  FABRICATION: 'Fabrication',
  FABRICATION_TESTING: 'Fabrication Testing',
  MOULDING: 'Moulding',
  SPINNING: 'Spinning',
  DEMOULDING: 'Demoulding',
  CURING_1: 'Curing 1',
  WINDING: 'Winding',
  COATING: 'Coating',
  FINAL_TESTING: 'Final Testing',
}
const STAGE_ORDER = Object.keys(STAGE_LABELS)

interface MaterialRow {
  stageType: string
  materialProductId: number | ''
  quantityPerPipe: string
  uom: string
  scrapPercent: string
  notes?: string
}

export default function PipeConfigFormPage() {
  const { id } = useParams()
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [activeTab, setActiveTab] = useState<'details' | 'materials'>('details')
  const [savedId, setSavedId] = useState<number | null>(isEdit ? Number(id) : null)
  const [materialRows, setMaterialRows] = useState<Record<string, MaterialRow[]>>({
    FABRICATION: [], SPINNING: [], WINDING: [], COATING: [],
  })
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm({
    defaultValues: {
      name: '',
      diameterMm: '',
      pressureClass: '',
      description: '',
      lengthM: '5.25',
      active: true,
    },
  })

  const diamVal = watch('diameterMm')
  const pcVal = watch('pressureClass')
  const lengthVal = watch('lengthM')

  // Auto-fill name when diameter + pressure + length selected
  useEffect(() => {
    if (diamVal && pcVal && !isEdit) {
      const suffix = lengthVal && parseFloat(lengthVal) !== 5.25 ? ` ${lengthVal}m` : ''
      setValue('name', `PCCP ${diamVal}mm ${pcVal}${suffix}`)
    }
  }, [diamVal, pcVal, lengthVal, isEdit, setValue])

  // Load existing config on edit
  const { data: existingData } = useQuery({
    queryKey: ['pipe-config', id],
    queryFn: () => pipeConfigApi.getById(Number(id)).then(r => r.data.data),
    enabled: isEdit,
  })

  useEffect(() => {
    if (existingData) {
      setValue('name', existingData.name)
      setValue('diameterMm', String(existingData.diameterMm))
      setValue('pressureClass', existingData.pressureClass)
      setValue('description', existingData.description ?? '')
      setValue('lengthM', String(existingData.lengthM ?? '5.25'))
      setValue('active', existingData.active)

      // Populate material rows from existing config
      const rows: Record<string, MaterialRow[]> = { FABRICATION: [], SPINNING: [], WINDING: [], COATING: [] }
      for (const mat of existingData.materials ?? []) {
        if (!rows[mat.stageType]) rows[mat.stageType] = []
        rows[mat.stageType].push({
          stageType: mat.stageType,
          materialProductId: mat.materialProductId,
          quantityPerPipe: String(mat.quantityPerPipe),
          uom: mat.uom || 'kg',
          scrapPercent: String(mat.scrapPercent ?? '0'),
          notes: mat.notes,
        })
      }
      setMaterialRows(rows)
    }
  }, [existingData, setValue])

  // Load raw material products
  const { data: productsData } = useQuery({
    queryKey: ['products-raw-materials'],
    queryFn: () => productApi.getAll({ size: 200, search: '' }).then(r => {
      const items = r.data.data?.content ?? r.data.data?.items ?? []
      return items.filter((p: any) => p.itemType === 'RAW_MATERIAL')
    }),
  })
  const rawMaterials = productsData ?? []

  // Save details
  const detailsMut = useMutation({
    mutationFn: (data: any) => isEdit && savedId
      ? pipeConfigApi.update(savedId, data)
      : pipeConfigApi.create(data),
    onSuccess: (res) => {
      const newId = res.data.data?.id
      if (newId) setSavedId(newId)
      qc.invalidateQueries({ queryKey: ['pipe-configs'] })
      toast.success('Pipe configuration saved')
      setActiveTab('materials')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Save failed'),
  })

  // Save materials
  const materialsMut = useMutation({
    mutationFn: (rows: MaterialRow[]) => {
      const materials = rows
        .filter(r => r.materialProductId !== '')
        .map(r => ({
          stageType: r.stageType,
          materialProductId: Number(r.materialProductId),
          quantityPerPipe: parseFloat(r.quantityPerPipe) || 0,
          uom: r.uom || 'kg',
          scrapPercent: parseFloat(r.scrapPercent) || 0,
          notes: r.notes || undefined,
        }))
      return pipeConfigApi.upsertMaterials(savedId!, materials)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pipe-configs'] })
      qc.invalidateQueries({ queryKey: ['pipe-config', String(savedId)] })
      toast.success('Material formula saved')
      navigate('/production/pipe-configs')
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Save failed'),
  })

  const onSaveDetails = handleSubmit((data) => {
    detailsMut.mutate({
      name: data.name,
      diameterMm: Number(data.diameterMm),
      pressureClass: data.pressureClass,
      description: data.description || undefined,
      lengthM: parseFloat(data.lengthM) || 5.25,
      active: data.active,
    })
  })

  const onSaveMaterials = () => {
    const allRows = Object.values(materialRows).flat()
    materialsMut.mutate(allRows)
  }

  const addMaterialRow = (stage: string) => {
    setMaterialRows(prev => ({
      ...prev,
      [stage]: [...(prev[stage] ?? []), { stageType: stage, materialProductId: '', quantityPerPipe: '', uom: 'kg', scrapPercent: '0' }],
    }))
  }

  const updateRow = (stage: string, idx: number, field: keyof MaterialRow, value: string | number) => {
    setMaterialRows(prev => {
      const rows = [...(prev[stage] ?? [])]
      rows[idx] = { ...rows[idx], [field]: value }
      return { ...prev, [stage]: rows }
    })
  }

  const removeRow = (stage: string, idx: number) => {
    setMaterialRows(prev => {
      const rows = [...(prev[stage] ?? [])]
      rows.splice(idx, 1)
      return { ...prev, [stage]: rows }
    })
  }

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/production/pipe-configs')} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">
            {isEdit ? 'Edit Pipe Configuration' : 'New Pipe Configuration'}
          </h1>
          {existingData && <p className="text-sm text-gray-500">{existingData.name}</p>}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {(['details', 'materials'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => {
              if (tab === 'materials' && !savedId) {
                toast.error('Save pipe details first')
                return
              }
              setActiveTab(tab)
            }}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              activeTab === tab
                ? 'border-violet-600 text-violet-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'details' ? 'Pipe Details' : 'Raw Material Formula'}
          </button>
        ))}
      </div>

      {/* ── Tab 1: Pipe Details ── */}
      {activeTab === 'details' && (
        <form onSubmit={onSaveDetails} className="bg-white rounded-xl border p-6 space-y-5">
          <div className="grid grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Diameter (mm) *</label>
              <select
                {...register('diameterMm', { required: 'Required' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Select diameter</option>
                {PIPE_DIAMETERS.map(d => <option key={d} value={d}>{d} mm</option>)}
              </select>
              {errors.diameterMm && <p className="text-red-500 text-xs mt-1">{errors.diameterMm.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Pressure Class *</label>
              <select
                {...register('pressureClass', { required: 'Required' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              >
                <option value="">Select pressure class</option>
                {PRESSURE_CLASSES.map(pc => <option key={pc} value={pc}>{pc}</option>)}
              </select>
              {errors.pressureClass && <p className="text-red-500 text-xs mt-1">{errors.pressureClass.message}</p>}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
            <input
              {...register('name', { required: 'Required' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="e.g. PCCP 600mm 10kg"
            />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Pipe Length (meters) *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              {...register('lengthM', { required: 'Required' })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="e.g. 5.25"
            />
            {errors.lengthM && <p className="text-red-500 text-xs mt-1">{errors.lengthM.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              {...register('description')}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              placeholder="Optional notes"
            />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="active" {...register('active')} className="rounded" />
            <label htmlFor="active" className="text-sm text-gray-700">Active</label>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={detailsMut.isPending}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl font-medium text-sm"
            >
              <Save size={15} />
              Save & Configure Materials
            </button>
          </div>
        </form>
      )}

      {/* ── Tab 2: Raw Material Formula ── */}
      {activeTab === 'materials' && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 flex gap-2 text-sm text-blue-700">
            <Info size={15} className="shrink-0 mt-0.5" />
            Configure raw materials consumed at each process stage. Fabrication, Spinning, Winding, and Coating consume materials.
          </div>

          {STAGE_ORDER.map(stage => {
            const isMaterial = MATERIAL_STAGES.includes(stage)
            const rows = materialRows[stage] ?? []

            return (
              <div key={stage} className="bg-white rounded-xl border overflow-hidden">
                <div className={`flex items-center justify-between px-4 py-3 ${isMaterial ? 'bg-violet-50' : 'bg-gray-50'}`}>
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${isMaterial ? 'bg-violet-500' : 'bg-gray-300'}`} />
                    <span className="font-medium text-sm text-gray-800">{STAGE_LABELS[stage]}</span>
                    {isMaterial && rows.length > 0 && (
                      <span className="text-xs bg-violet-100 text-violet-700 px-1.5 py-0.5 rounded-full">{rows.length} materials</span>
                    )}
                  </div>
                  {!isMaterial && (
                    <span className="text-xs text-gray-400">No materials — process step only</span>
                  )}
                  {isMaterial && (
                    <button
                      onClick={() => addMaterialRow(stage)}
                      className="flex items-center gap-1 text-xs text-violet-600 hover:text-violet-800 font-medium"
                    >
                      <Plus size={13} />
                      Add Material
                    </button>
                  )}
                </div>

                {isMaterial && rows.length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 text-xs text-gray-500 uppercase">
                          <th className="text-left px-4 py-2">Material</th>
                          <th className="text-right px-4 py-2 w-32">Qty / Pipe</th>
                          <th className="text-left px-4 py-2 w-20">UOM</th>
                          <th className="text-right px-4 py-2 w-24">Scrap %</th>
                          <th className="w-10 px-2" />
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row, idx) => (
                          <tr key={idx} className="border-t border-gray-100">
                            <td className="px-4 py-2">
                              <select
                                value={row.materialProductId}
                                onChange={e => updateRow(stage, idx, 'materialProductId', e.target.value)}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                              >
                                <option value="">Select material...</option>
                                {rawMaterials.map((p: any) => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="number"
                                step="0.0001"
                                min="0"
                                value={row.quantityPerPipe}
                                onChange={e => updateRow(stage, idx, 'quantityPerPipe', e.target.value)}
                                className="w-full text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                                placeholder="0.0000"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                value={row.uom}
                                onChange={e => updateRow(stage, idx, 'uom', e.target.value)}
                                className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                                placeholder="kg"
                              />
                            </td>
                            <td className="px-4 py-2">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                max="100"
                                value={row.scrapPercent}
                                onChange={e => updateRow(stage, idx, 'scrapPercent', e.target.value)}
                                className="w-full text-right border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-violet-400"
                                placeholder="0"
                              />
                            </td>
                            <td className="px-2 py-2">
                              <button
                                onClick={() => removeRow(stage, idx)}
                                className="text-red-400 hover:text-red-600"
                              >
                                <Trash2 size={14} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )
          })}

          <div className="flex justify-between items-center pt-2">
            <button
              onClick={() => setActiveTab('details')}
              className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1"
            >
              <ArrowLeft size={14} />
              Back to Details
            </button>
            <button
              onClick={onSaveMaterials}
              disabled={materialsMut.isPending}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl font-medium text-sm"
            >
              <Save size={15} />
              Save Formula
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
