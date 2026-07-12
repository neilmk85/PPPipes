import { useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ArrowLeft, Save } from 'lucide-react'
import { productionOrderApi, pipeConfigApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

export default function CreateProductionOrderPage() {
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { outletId } = useAuthStore()

  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: {
      pipeConfigId: '',
      plannedQty: '',
      plannedStartDate: '',
      plannedEndDate: '',
      notes: '',
    },
  })

  const { data: configsData } = useQuery({
    queryKey: ['pipe-configs-active'],
    queryFn: () => pipeConfigApi.getAll({ active: true, size: 500 }).then(r => r.data.data?.content ?? []),
  })

  const createMut = useMutation({
    mutationFn: (data: any) => productionOrderApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['production-orders'] })
      toast.success('Production order created')
      navigate(`/production/orders/${res.data.data?.id}`)
    },
    onError: (e: any) => toast.error(e.response?.data?.message ?? 'Failed to create order'),
  })

  const onSubmit = handleSubmit((data) => {
    createMut.mutate({
      pipeConfigId:     Number(data.pipeConfigId),
      outletId:         outletId ?? 1,
      plannedQty:       Number(data.plannedQty),
      plannedStartDate: data.plannedStartDate || undefined,
      plannedEndDate:   data.plannedEndDate   || undefined,
      notes:            data.notes            || undefined,
    })
  })

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate('/production/orders')} className="text-gray-400 hover:text-gray-700">
          <ArrowLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-gray-900">New Production Order</h1>
      </div>

      <form onSubmit={onSubmit} className="bg-white rounded-xl border p-6 space-y-5">

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Pipe Configuration *</label>
          <select
            {...register('pipeConfigId', { required: 'Required' })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
          >
            <option value="">Select pipe type...</option>
            {(configsData ?? []).map((c: any) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          {errors.pipeConfigId && <p className="text-red-500 text-xs mt-1">{errors.pipeConfigId.message}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Planned Quantity *</label>
          <input
            type="number"
            min="1"
            {...register('plannedQty', { required: 'Required', min: { value: 1, message: 'Must be > 0' } })}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Number of pipes to produce"
          />
          {errors.plannedQty && <p className="text-red-500 text-xs mt-1">{errors.plannedQty.message}</p>}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Planned Start</label>
            <input
              type="date"
              {...register('plannedStartDate')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Planned End</label>
            <input
              type="date"
              {...register('plannedEndDate')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea
            {...register('notes')}
            rows={3}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
            placeholder="Optional notes"
          />
        </div>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate('/production/orders')}
            className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-violet-50/40"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMut.isPending}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white px-5 py-2 rounded-xl font-medium text-sm"
          >
            <Save size={15} />
            Create Order
          </button>
        </div>
      </form>
    </div>
  )
}
