import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Printer, CheckCircle2, Clock, RefreshCw, FileText } from 'lucide-react'
import { invoiceApi } from '@/services/api'

function formatDate(dateStr: string | null | undefined) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatCurrency(amount: number | null | undefined) {
  if (amount == null) return '—'
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount)
}

export default function PrintInvoicesPage() {
  const queryClient = useQueryClient()
  const [confirmId, setConfirmId] = useState<number | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['print-queue'],
    queryFn: () => invoiceApi.getPrintQueue().then(r => r.data.data ?? []),
  })

  const markPrinted = useMutation({
    mutationFn: (id: number) => invoiceApi.markPrinted(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-queue'] })
      setConfirmId(null)
    },
  })

  const invoices: any[] = data ?? []

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">

      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-sky-500 to-cyan-500 shadow-[0_8px_32px_rgba(14,165,233,0.25)]">
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.08]"
          style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }}
        />
        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center">
              <Printer size={22} className="text-white" />
            </div>
            <div>
              <p className="text-xs font-semibold text-sky-100 uppercase tracking-widest mb-0.5">Logistics</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Print Invoices</h1>
              <p className="text-sm text-sky-100 mt-0.5">Invoices created while accountant was out of office</p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/25 text-white px-4 py-2.5 rounded-xl font-semibold text-sm transition backdrop-blur-sm"
          >
            <RefreshCw size={15} />
            Refresh
          </button>
        </div>

        <div className="relative border-t border-white/15 grid grid-cols-2 divide-x divide-white/15">
          <div className="px-8 py-3.5">
            <p className="text-xl font-extrabold text-white tabular-nums leading-none">{invoices.length}</p>
            <p className="text-xs text-sky-100 mt-0.5">Pending Print</p>
          </div>
          <div className="px-8 py-3.5">
            <p className="text-xl font-extrabold text-white tabular-nums leading-none">
              {formatCurrency(invoices.reduce((sum, inv) => sum + (inv.totalAmount ?? 0), 0))}
            </p>
            <p className="text-xs text-sky-100 mt-0.5">Total Value</p>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-24 text-gray-400">
          <RefreshCw size={20} className="animate-spin mr-2" />
          Loading print queue…
        </div>
      ) : isError ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-sky-50 flex items-center justify-center">
            <Printer size={28} className="text-sky-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-700">No invoices pending print</p>
            <p className="text-sm text-gray-400 mt-1">
              Invoices created while the accountant is <span className="font-medium text-gray-600">Out of Office</span> will appear here for printing.
            </p>
          </div>
          <button
            onClick={() => refetch()}
            className="flex items-center gap-2 px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-sm font-semibold transition"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      ) : invoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-16 flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-full bg-sky-50 flex items-center justify-center">
            <Printer size={28} className="text-sky-400" />
          </div>
          <div>
            <p className="text-base font-semibold text-gray-700">No invoices pending print</p>
            <p className="text-sm text-gray-400 mt-1">
              Invoices created while the accountant is <span className="font-medium text-gray-600">Out of Office</span> will appear here for printing.
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/70">
                  <th className="px-5 py-3.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Invoice #</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Date</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Customer</th>
                  <th className="px-5 py-3.5 text-right font-semibold text-gray-500 text-xs uppercase tracking-wide">Amount</th>
                  <th className="px-5 py-3.5 text-left font-semibold text-gray-500 text-xs uppercase tracking-wide">Status</th>
                  <th className="px-5 py-3.5 text-center font-semibold text-gray-500 text-xs uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {invoices.map((inv: any) => (
                  <tr key={inv.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <FileText size={14} className="text-sky-500 shrink-0" />
                        <span className="font-semibold text-gray-800">{inv.invoiceNumber ?? `#${inv.id}`}</span>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-gray-600">{formatDate(inv.invoiceDate ?? inv.createdAt)}</td>
                    <td className="px-5 py-4 text-gray-700">
                      {inv.customer?.name ?? inv.customerName ?? '—'}
                    </td>
                    <td className="px-5 py-4 text-right font-semibold text-gray-800">
                      {formatCurrency(inv.totalAmount)}
                    </td>
                    <td className="px-5 py-4">
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
                        <Clock size={11} />
                        Pending Print
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      {confirmId === inv.id ? (
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => markPrinted.mutate(inv.id)}
                            disabled={markPrinted.isPending}
                            className="px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold transition disabled:opacity-50"
                          >
                            {markPrinted.isPending ? 'Marking…' : 'Confirm'}
                          </button>
                          <button
                            onClick={() => setConfirmId(null)}
                            className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-lg text-xs font-semibold transition"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmId(inv.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-xs font-semibold transition"
                        >
                          <Printer size={12} />
                          Mark Printed
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  )
}
