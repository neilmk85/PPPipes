import { useState, useEffect, useRef } from 'react'
import { X, Loader2, ToggleLeft, ToggleRight } from 'lucide-react'
import toast from 'react-hot-toast'
import { discountApi } from '@/services/api'
import { Coupon } from '@/types'
import DateTimePicker from '@/components/DateTimePicker'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'

interface Props {
  coupon?: Coupon | null
  onClose: () => void
  onSaved: () => void
}

export default function CouponForm({ coupon, onClose, onSaved }: Props) {
  const isEdit = !!coupon

  const [form, setForm] = useState({
    code:              coupon?.code        ?? '',
    description:       coupon?.description ?? '',
    valueType:         (coupon?.valueType   ?? 'PERCENTAGE') as 'PERCENTAGE' | 'FLAT',
    value:             coupon?.value       ?? 0,
    minOrderAmount:    coupon?.minOrderAmount  ?? 0,
    maxDiscountAmount: (coupon as any)?.maxDiscountAmount ?? '',
    usageLimit:        coupon?.usageLimit  != null ? String(coupon.usageLimit) : '',
    usagePerCustomer:  coupon?.usagePerCustomer ?? 1,
    startDate:         coupon?.startDate   ? coupon.startDate.slice(0, 16) : '',
    expiryDate:        coupon?.expiryDate  ? coupon.expiryDate.slice(0, 16) : '',
    active:            coupon?.active      ?? true,
  })
  const [loading, setLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const cfMountedRef = useRef(false)
  useEffect(() => {
    if (!cfMountedRef.current) { cfMountedRef.current = true; return }
    setIsDirty(true)
  }, [form])
  const { isBlocked: cfIsBlocked, confirmLeave: cfConfirmLeave, cancelLeave: cfCancelLeave } = useUnsavedChanges(isDirty)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (form.valueType === 'PERCENTAGE' && form.value > 100) {
      toast.error('Discount cannot exceed 100%')
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...form,
        usageLimit:        form.usageLimit        ? parseInt(form.usageLimit)            : null,
        maxDiscountAmount: form.maxDiscountAmount  ? parseFloat(String(form.maxDiscountAmount)) : null,
        startDate:         form.startDate  || null,
        expiryDate:        form.expiryDate || null,
      }
      if (isEdit) {
        await discountApi.updateCoupon(coupon!.id, payload)
        toast.success('Coupon updated')
      } else {
        await discountApi.createCoupon(payload)
        toast.success('Coupon created')
      }
      onSaved()
    } catch (err: any) {
      toast.error(err.response?.data?.message || `Failed to ${isEdit ? 'update' : 'create'} coupon`)
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Coupon' : 'Create Coupon'}</h2>
            {isEdit && <p className="text-xs text-gray-400 mt-0.5 font-mono">{coupon!.code}</p>}
          </div>
          <button onClick={() => isDirty ? setShowConfirm(true) : onClose()} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <X size={18} className="text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          {/* Active toggle — only in edit mode */}
          {isEdit && (
            <div className="flex items-center justify-between p-3 rounded-xl bg-gray-50 border border-gray-100">
              <div>
                <p className="text-sm font-semibold text-gray-700">Status</p>
                <p className="text-xs text-gray-400">{form.active ? 'Coupon is active and usable' : 'Coupon is disabled'}</p>
              </div>
              <button
                type="button"
                onClick={() => setForm({ ...form, active: !form.active })}
                className="flex items-center gap-2"
              >
                {form.active
                  ? <ToggleRight size={36} className="text-teal-500" />
                  : <ToggleLeft  size={36} className="text-gray-300" />}
              </button>
            </div>
          )}

          {/* Code */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Coupon Code *</label>
            <input
              value={form.code}
              onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
              required
              placeholder="e.g. DIWALI20"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono uppercase focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <input
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="e.g. Diwali special 20% off"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
            />
          </div>

          {/* Type + Value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.valueType}
                onChange={(e) => setForm({ ...form, valueType: e.target.value as 'PERCENTAGE' | 'FLAT' })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
              >
                <option value="PERCENTAGE">Percentage</option>
                <option value="FLAT">Flat Amount</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Value * {form.valueType === 'PERCENTAGE' ? '(%)' : '(₹)'}
              </label>
              <input
                type="number" step="0.01" min="0"
                value={form.value}
                onChange={(e) => setForm({ ...form, value: parseFloat(e.target.value) })}
                required
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Min order + Max discount */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Min Order (₹)</label>
              <input
                type="number" step="0.01" min="0"
                value={form.minOrderAmount}
                onChange={(e) => setForm({ ...form, minOrderAmount: parseFloat(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Max Discount (₹)</label>
              <input
                type="number" step="0.01" min="0"
                value={form.maxDiscountAmount}
                onChange={(e) => setForm({ ...form, maxDiscountAmount: e.target.value })}
                placeholder="No cap"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Usage limit + Per customer */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Usage Limit</label>
              <input
                type="number" min="0"
                value={form.usageLimit}
                onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                placeholder="Unlimited"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Per Customer</label>
              <input
                type="number" min="1"
                value={form.usagePerCustomer}
                onChange={(e) => setForm({ ...form, usagePerCustomer: parseInt(e.target.value) })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-teal-500 focus:border-teal-500 focus:outline-none"
              />
            </div>
          </div>

          {/* Start + Expiry */}
          <div className="grid grid-cols-2 gap-3">
            <DateTimePicker
              label="Start Date"
              value={form.startDate}
              onChange={(v) => setForm({ ...form, startDate: v })}
              max={form.expiryDate || undefined}
            />
            <DateTimePicker
              label="Expiry Date"
              value={form.expiryDate}
              onChange={(v) => setForm({ ...form, expiryDate: v })}
              min={form.startDate || undefined}
            />
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <button
              type="button" onClick={onClose}
              className="flex-1 border border-gray-300 py-2.5 rounded-xl font-medium text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit" disabled={loading}
              className="flex-1 bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-600 hover:to-cyan-700 disabled:opacity-50 text-white py-2.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {isEdit ? 'Save Changes' : 'Create Coupon'}
            </button>
          </div>
        </form>
      </div>
      <UnsavedChangesDialog open={showConfirm} onConfirm={onClose} onCancel={() => setShowConfirm(false)} />
      <UnsavedChangesDialog open={cfIsBlocked} onConfirm={cfConfirmLeave} onCancel={cfCancelLeave} />
    </div>
  )
}
