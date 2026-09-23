import { useState } from 'react'
import { X, Loader2, Package, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import { inventoryApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

interface Props {
  inventory: any
  onClose: () => void
  onSaved: (newReorderLevel?: number) => void
}

const reasons = ['CORRECTION', 'OPENING_STOCK', 'DAMAGE', 'THEFT', 'EXPIRY', 'AUDIT', 'OTHER']

function getConvInfo(product: any) {
  const baseUom     = product?.unitOfMeasure ?? 'pcs'
  const purchaseUom = product?.purchaseUom ?? null
  const pFactor     = parseFloat(product?.purchaseFactor ?? 1)
  const saleUom     = product?.saleUom ?? null
  const sFactor     = parseFloat(product?.saleFactor ?? 1)
  const hasPurchaseConv = !!purchaseUom && pFactor > 1 && purchaseUom !== baseUom
  const hasWeightConv   = !!saleUom && sFactor > 1 && saleUom !== baseUom && !hasPurchaseConv
  return { baseUom, purchaseUom, pFactor, saleUom, sFactor, hasPurchaseConv, hasWeightConv }
}

function fmtN(n: number) {
  const r = Math.round(n * 10) / 10
  return r % 1 === 0 ? r.toLocaleString('en-IN') : r.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

export default function AdjustStockModal({ inventory, onClose, onSaved }: Props) {
  const { user, outletId } = useAuthStore()
  const product = inventory.product

  const { baseUom, purchaseUom, pFactor, saleUom, sFactor, hasPurchaseConv, hasWeightConv } = getConvInfo(product)

  const currentQty     = parseFloat(inventory.quantityOnHand ?? 0)
  const currentReorder = inventory.reorderLevel ?? product?.reorderLevel ?? 10

  const [tab,      setTab]      = useState<'stock' | 'reorder'>('stock')
  const [mode,     setMode]     = useState<'adjust' | 'set'>('set')
  const [quantity, setQuantity] = useState('')
  const [reason,   setReason]   = useState('AUDIT')
  const [notes,    setNotes]    = useState('')
  const [reorder,  setReorder]  = useState(String(currentReorder))
  const [loading,  setLoading]  = useState(false)

  // Derived weight equivalent for display
  const qtyNum      = parseFloat(quantity) || 0
  const reorderNum  = parseFloat(reorder)  || 0
  // In "set" mode the user enters the absolute physical count; we compute delta before sending
  const effectiveDelta = mode === 'set' ? qtyNum - currentQty : qtyNum

  function weightLabel(n: number) {
    if (hasPurchaseConv) return `${fmtN(n / pFactor)} ${purchaseUom} / ${fmtN(n)} ${baseUom}`
    if (hasWeightConv)   return `${fmtN(n)} ${baseUom} / ${fmtN(n * sFactor)} ${saleUom}`
    return `${fmtN(n)} ${baseUom}`
  }

  const handleStock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!quantity) { toast.error('Enter a quantity'); return }
    setLoading(true)
    try {
      await inventoryApi.adjust({
        productId: product?.id || inventory.productId,
        outletId,
        quantity: parseFloat(quantity),
        reason,
        notes: notes || undefined,
        userId: user?.id,
      })
      toast.success('Stock adjusted')
      onSaved(undefined)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to adjust stock')
    } finally {
      setLoading(false)
    }
  }

  const handleReorder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!reorder || isNaN(reorderNum) || reorderNum < 0) { toast.error('Enter a valid reorder level'); return }
    setLoading(true)
    try {
      await inventoryApi.updateReorderLevel(
        product?.id || inventory.productId,
        outletId!,
        reorderNum,
      )
      toast.success('Reorder level updated')
      onSaved(reorderNum)
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update reorder level')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">

        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
              <Package size={16} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">{product?.name}</h2>
              <p className="text-xs text-gray-400">
                Stock: <span className="font-semibold text-gray-600">{weightLabel(currentQty)}</span>
                {' · '}Reorder: <span className="font-semibold text-gray-600">{weightLabel(currentReorder)}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-2 bg-gray-50 border-b border-gray-100">
          {(['stock', 'reorder'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                tab === t ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {t === 'stock' ? 'Adjust Stock' : 'Reorder Level'}
            </button>
          ))}
        </div>

        {/* Stock tab */}
        {tab === 'stock' && (
          <form onSubmit={handleStock} className="p-5 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Adjustment Quantity — in <span className="text-indigo-600 font-semibold">{baseUom}</span>
                <span className="text-xs text-gray-400 font-normal ml-1">(+ to add · − to reduce)</span>
              </label>
              <input type="number" step="1" value={quantity} onChange={e => setQuantity(e.target.value)}
                placeholder={`e.g. 50 or -5 ${baseUom}`}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none" />
              {qtyNum !== 0 && (hasWeightConv || hasPurchaseConv) && (
                <p className="mt-1.5 text-xs text-indigo-600 font-medium">
                  = {weightLabel(currentQty + qtyNum)} after adjustment
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <select value={reason} onChange={e => setReason(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none">
                {reasons.map(r => <option key={r} value={r}>{r.replace(/_/g, ' ')}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
                className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none resize-none" />
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all">
                {loading && <Loader2 size={14} className="animate-spin" />}
                Adjust Stock
              </button>
            </div>
          </form>
        )}

        {/* Reorder tab */}
        {tab === 'reorder' && (
          <form onSubmit={handleReorder} className="p-5 space-y-4">
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex gap-2">
              <AlertTriangle size={15} className="text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700">
                Low Stock alert triggers when stock falls at or below this level.
                Enter the value in <span className="font-semibold">{baseUom}</span>.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Reorder Level — in <span className="text-indigo-600 font-semibold">{baseUom}</span>
              </label>
              <input type="number" step="1" min="0" value={reorder} onChange={e => setReorder(e.target.value)}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none" />
              {!isNaN(reorderNum) && reorderNum >= 0 && (hasWeightConv || hasPurchaseConv) && (
                <p className="mt-1.5 text-xs text-indigo-600 font-medium">
                  = {weightLabel(reorderNum)}
                </p>
              )}
            </div>

            <div className="flex gap-3 pt-1">
              <button type="button" onClick={onClose}
                className="flex-1 border border-gray-200 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={loading}
                className="flex-1 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 disabled:opacity-50 text-white py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all">
                {loading && <Loader2 size={14} className="animate-spin" />}
                Update Reorder Level
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
