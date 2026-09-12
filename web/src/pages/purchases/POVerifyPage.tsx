import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import axios from 'axios'
import { CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

function fmtCur(v: any) {
  return '₹' + Number(v ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(s: string | null | undefined) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Draft', CONFIRMED: 'Confirmed', RECEIVED: 'Received', CANCELLED: 'Cancelled',
}
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-600',
  CONFIRMED: 'bg-blue-100 text-blue-700',
  RECEIVED: 'bg-green-100 text-green-700',
  CANCELLED: 'bg-red-100 text-red-600',
}

export default function POVerifyPage() {
  const { poNumber } = useParams<{ poNumber: string }>()

  const { data, isLoading, isError } = useQuery({
    queryKey: ['po-public', poNumber],
    queryFn: () =>
      axios.get(`/api/purchase-orders/public/${encodeURIComponent(poNumber!)}`)
        .then(r => r.data.data),
    enabled: !!poNumber,
    retry: false,
  })

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 flex flex-col items-center py-10 px-4">

      {/* Header — same branding as PDF */}
      <div className="w-full max-w-2xl mb-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="bg-[#1e497d] px-6 py-5 flex items-center gap-4">
            <img src="/pp-logo.png" alt="P&P Logo" className="h-14 w-14 object-contain rounded-lg bg-white p-1" />
            <div>
              <p className="text-white font-bold text-xl leading-tight">P&amp;P Pipe Products Pvt. Ltd.</p>
              <p className="text-blue-200 text-xs mt-0.5">Manufacturer of PSC, PCCP, BWSC &amp; RCC Pipes</p>
              <p className="text-blue-300 text-[11px] mt-0.5">Gat No. 156, At Post Hotgi, Tal. South Solapur, Dist. Solapur - 413215</p>
            </div>
          </div>
          <div className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-2">
            <CheckCircle2 size={15} className="text-blue-600 shrink-0" />
            <p className="text-xs text-blue-700 font-medium">
              This is an official Purchase Order issued through the P&amp;P Pipe Products management system.
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="w-full max-w-2xl space-y-4">

        {isLoading && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 flex flex-col items-center gap-3">
            <Loader2 size={32} className="animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">Loading purchase order…</p>
          </div>
        )}

        {isError && (
          <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-10 flex flex-col items-center gap-3">
            <AlertCircle size={32} className="text-red-400" />
            <p className="text-sm font-semibold text-gray-700">Purchase Order Not Found</p>
            <p className="text-xs text-gray-400 text-center">
              No purchase order matching <span className="font-mono">{poNumber}</span> was found in our system.
              This document may be invalid or tampered.
            </p>
          </div>
        )}

        {data && (
          <>
            {/* PO Identity */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Purchase Order</p>
                  <p className="text-2xl font-bold font-mono text-[#1e497d]">{data.poNumber}</p>
                </div>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${STATUS_COLOR[data.status] ?? 'bg-gray-100 text-gray-600'}`}>
                  {STATUS_LABEL[data.status] ?? data.status}
                </span>
              </div>
              <div className="px-6 py-4 grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Issue Date</p>
                  <p className="text-gray-800 font-medium">{fmtDate(data.createdAt)}</p>
                </div>
                {data.expectedDate && (
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Expected Delivery</p>
                    <p className="text-gray-800 font-medium">{fmtDate(data.expectedDate)}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Parties */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Purchase Order By</p>
                <p className="font-bold text-gray-900 text-sm leading-snug">P&amp;P Pipe Products Pvt. Ltd.</p>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  Gat No. 156, At Post Hotgi,<br />
                  Tal. South Solapur, Dist. Solapur - 413215<br />
                  Cell: 9922450055
                </p>
              </div>
              <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Purchase Order To</p>
                <p className="font-bold text-gray-900 text-sm leading-snug">{data.supplier?.name ?? '—'}</p>
                {data.supplier?.address && (
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{data.supplier.address}</p>
                )}
                {data.supplier?.gstin && (
                  <p className="text-xs text-gray-500 mt-1">GSTIN: {data.supplier.gstin}</p>
                )}
              </div>
            </div>

            {/* Items */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-6 py-3 bg-gray-50 border-b border-gray-100">
                <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
                  Items ({(data.items ?? []).length})
                </p>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="px-5 py-2.5 text-left text-[11px] font-bold text-gray-400 uppercase">Item</th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-bold text-gray-400 uppercase">Qty</th>
                    <th className="px-5 py-2.5 text-right text-[11px] font-bold text-gray-400 uppercase">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {(data.items ?? []).map((item: any, i: number) => {
                    const parts = (item.description ?? '').split('\n')
                    const name = item.product?.name ?? parts[0] ?? '—'
                    const desc = parts.slice(1).join(' ')
                    return (
                      <tr key={item.id ?? i} className="border-b border-gray-50 last:border-0">
                        <td className="px-5 py-3">
                          <p className="font-semibold text-gray-900 text-xs">{name}</p>
                          {desc && <p className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{desc}</p>}
                        </td>
                        <td className="px-5 py-3 text-right text-xs text-gray-600 whitespace-nowrap">
                          {parseFloat(item.orderedQuantity)} {item.product?.unit ?? ''}
                        </td>
                        <td className="px-5 py-3 text-right text-xs font-semibold text-gray-800 whitespace-nowrap">
                          {fmtCur(item.lineTotal)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-6 py-4 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span>
                <span className="font-medium">{fmtCur(data.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>GST</span>
                <span className="font-medium">{fmtCur(data.taxAmount)}</span>
              </div>
              <div className="flex justify-between font-bold text-base border-t border-gray-100 pt-2 mt-2">
                <span className="text-gray-900">Grand Total</span>
                <span className="text-[#1e497d]">{fmtCur(data.totalAmount)}</span>
              </div>
            </div>

            {/* Authenticity stamp */}
            <div className="bg-green-50 border border-green-100 rounded-2xl px-6 py-4 flex items-start gap-3">
              <CheckCircle2 size={18} className="text-green-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800">Verified Purchase Order</p>
                <p className="text-xs text-green-600 mt-0.5">
                  This document is verified as an authentic Purchase Order generated by the P&amp;P Pipe Products
                  management system. The details shown above match the official record.
                </p>
              </div>
            </div>
          </>
        )}
      </div>

      <p className="mt-8 text-[11px] text-gray-400 text-center">
        system.pppipeproducts.com &nbsp;·&nbsp; P&amp;P Pipe Products Pvt. Ltd.
      </p>
    </div>
  )
}
