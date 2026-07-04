import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Printer, Download, Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import { workBillApi, outletApi } from '@/services/api'

type SupplyType = 'INTRA_STATE' | 'INTER_STATE'

interface BillItem {
  id: string; description: string; unit: string
  contractedQty: number; actualQty: number; rate: number; gstRate: number
}

interface BillPayment {
  id: string; date: string; amount: number; mode: string; reference: string
}

interface WorkBill {
  id: number; billNumber: string
  workOrderId: number | null; woNumber: string; woTitle: string
  contractorId: number; contractorName: string; contractorGstin?: string
  billingPeriodFrom: string; billingPeriodTo: string
  billDate: string; dueDate: string
  supplyType: SupplyType; tdsRate: number
  status: string; items: BillItem[]
  contractorInvoiceNo: string; notes: string
  payments: BillPayment[]; createdAt: string
}

function fmt(n: number) {
  return '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(d: string | null | undefined) {
  if (!d) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split('-')
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${parseInt(day)} ${months[parseInt(m) - 1]} ${y}`
  }
  const dt = new Date(d)
  if (isNaN(dt.getTime())) return d
  return dt.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtCreatedAt(d: string | null | undefined) {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: 'numeric', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }) + ' IST'
  } catch { return d }
}

function calcBill(items: BillItem[], tdsRate: number, supplyType: SupplyType) {
  const subtotal = items.reduce((s, it) => s + it.actualQty * it.rate, 0)
  const gstTotal = items.reduce((s, it) => s + it.actualQty * it.rate * it.gstRate / 100, 0)
  const cgst = supplyType === 'INTRA_STATE' ? gstTotal / 2 : 0
  const sgst = supplyType === 'INTRA_STATE' ? gstTotal / 2 : 0
  const igst = supplyType === 'INTER_STATE' ? gstTotal : 0
  const tds = subtotal * tdsRate / 100
  const netPayable = subtotal + gstTotal - tds
  return { subtotal, gstTotal, cgst, sgst, igst, tds, netPayable }
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-500 border-gray-200',
  SUBMITTED: 'bg-blue-50 text-blue-600 border-blue-200',
  APPROVED:  'bg-green-50 text-green-700 border-green-200',
  PAID:      'bg-violet-50 text-violet-700 border-violet-200',
}

const PAY_MODE_LABELS: Record<string, string> = {
  BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque', UPI: 'UPI', CASH: 'Cash',
}

export default function WorkBillInvoicePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const { data: bill, isLoading: billLoading, isError: billError } = useQuery<WorkBill>({
    queryKey: ['work-bill', id],
    queryFn: () => workBillApi.getById(Number(id)).then(r => r.data.data),
    enabled: !!id,
  })

  const { data: outlets = [] } = useQuery<any[]>({
    queryKey: ['outlets'],
    queryFn: () => outletApi.getAll().then(r => r.data.data ?? []),
  })

  const outlet = outlets[0] ?? {}

  if (billLoading) return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-blue-500" />
    </div>
  )

  if (billError || !bill) return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center gap-3 text-gray-500">
      <AlertCircle size={40} className="text-red-400" />
      <p className="text-base font-medium">Work bill not found</p>
    </div>
  )

  const calc = calcBill(bill.items, bill.tdsRate, bill.supplyType)
  const paid = bill.payments.reduce((s, p) => s + p.amount, 0)
  const balance = calc.netPayable - paid

  const gstRates = [...new Set(bill.items.map(i => i.gstRate).filter(r => r > 0))]
  const gstLabel = gstRates.length === 1 ? `${gstRates[0]}%` : ''

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">

      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 transition-colors">
            <ArrowLeft size={16} />
          </button>
          <div>
            <p className="text-sm text-gray-500">Work Bill Invoice</p>
            <p className="text-lg font-bold text-gray-900">{bill.billNumber}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm">
            <Printer size={15} /> Print
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-[#1e3a5f] text-white rounded-lg text-sm font-medium shadow-sm hover:bg-[#16304f]">
            <Download size={15} /> Save as PDF
          </button>
        </div>
      </div>

      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden print:shadow-none print:rounded-none print:max-w-full">

        <div className="px-8 py-7 flex items-start justify-between" style={{ background: '#1e3a5f' }}>
          <div>
            <div className="text-2xl font-black tracking-tight text-white">WORK BILL</div>
            <div className="text-sm mt-1 text-white/70">{bill.billNumber}</div>
            <div className="text-xs mt-0.5 text-white/60">{bill.contractorName}</div>
          </div>
          <div className="text-right">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${STATUS_COLORS[bill.status] ?? STATUS_COLORS.DRAFT}`}>
              {bill.status}
            </span>
            <div className="text-xs mt-2 text-white/70">{fmtDate(bill.billDate)}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 border-b border-gray-100">
          <div className="px-6 py-4 border-r border-gray-100">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Contractor</p>
            <p className="text-sm font-semibold text-gray-900">{bill.contractorName}</p>
            {bill.contractorGstin && (
              <p className="text-xs text-gray-400 font-mono mt-0.5">GSTIN: {bill.contractorGstin}</p>
            )}
          </div>
          <div className="px-6 py-4 border-r border-gray-100">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Work Order</p>
            {bill.woNumber ? (
              <>
                <p className="text-sm font-semibold text-gray-900 font-mono">{bill.woNumber}</p>
                {bill.woTitle && <p className="text-xs text-gray-400 mt-0.5">{bill.woTitle}</p>}
              </>
            ) : (
              <p className="text-sm text-gray-400">—</p>
            )}
          </div>
          <div className="px-6 py-4">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Billing Period</p>
            <p className="text-sm font-semibold text-gray-900">
              {fmtDate(bill.billingPeriodFrom)} → {fmtDate(bill.billingPeriodTo)}
            </p>
          </div>
        </div>

        <div className="px-8 py-6">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50">
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Service</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">Unit</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Contracted</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Actual Qty</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Rate</th>
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">GST%</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {bill.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-3">
                    <p className="text-sm font-medium text-gray-900">{item.description || '—'}</p>
                  </td>
                  <td className="px-3 py-3 text-center text-sm text-gray-500">{item.unit || '—'}</td>
                  <td className="px-3 py-3 text-right text-sm text-gray-500 tabular-nums">
                    {item.contractedQty.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-700 tabular-nums">
                    {item.actualQty.toLocaleString('en-IN')}
                  </td>
                  <td className="px-3 py-3 text-right text-sm text-gray-600 tabular-nums">
                    {fmt(item.rate)}
                  </td>
                  <td className="px-3 py-3 text-center text-sm text-blue-500 font-semibold">
                    {item.gstRate}%
                  </td>
                  <td className="px-3 py-3 text-right text-sm font-semibold text-gray-900 tabular-nums">
                    {fmt(item.actualQty * item.rate)}
                  </td>
                </tr>
              ))}
              <tr className="bg-gray-50">
                <td colSpan={6} className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                  Total Work Value
                </td>
                <td className="px-3 py-2.5 text-right text-sm font-bold text-gray-900 tabular-nums">
                  {fmt(calc.subtotal)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="px-8 pb-6 flex justify-end">
          <div className="w-72 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal (Work Value)</span><span className="tabular-nums">{fmt(calc.subtotal)}</span>
            </div>
            {bill.supplyType === 'INTRA_STATE' ? (
              <>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>CGST {gstLabel ? `(${gstLabel}/2)` : ''}</span>
                  <span className="tabular-nums">{fmt(calc.cgst)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-500">
                  <span>SGST {gstLabel ? `(${gstLabel}/2)` : ''}</span>
                  <span className="tabular-nums">{fmt(calc.sgst)}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between text-sm text-gray-500">
                <span>IGST {gstLabel ? `(${gstLabel})` : ''}</span>
                <span className="tabular-nums">{fmt(calc.igst)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-gray-700 pt-1 border-t border-gray-200">
              <span className="font-semibold">Gross Total</span>
              <span className="tabular-nums font-semibold">{fmt(calc.subtotal + calc.gstTotal)}</span>
            </div>
            {bill.tdsRate > 0 && (
              <div className="flex justify-between text-sm text-gray-500">
                <span>TDS ({bill.tdsRate}% on base)</span>
                <span className="tabular-nums">−{fmt(calc.tds)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t-2 border-gray-900">
              <span>NET PAYABLE</span><span className="tabular-nums">{fmt(calc.netPayable)}</span>
            </div>
          </div>
        </div>

        {bill.payments.length > 0 && (
          <div className="px-8 py-5 border-t border-gray-100">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-3">Payment History</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Date</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Mode</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Reference</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {bill.payments.map(p => (
                  <tr key={p.id}>
                    <td className="px-3 py-2.5 text-gray-700">{fmtDate(p.date)}</td>
                    <td className="px-3 py-2.5 text-gray-500">{PAY_MODE_LABELS[p.mode] ?? p.mode}</td>
                    <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">{p.reference || '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums font-semibold text-gray-800">{fmt(p.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {balance > 0.01 && (
              <div className="flex justify-end mt-3">
                <div className="flex justify-between w-72 text-sm font-bold text-red-600 border-t border-red-200 pt-2">
                  <span>Balance Due</span>
                  <span className="tabular-nums">{fmt(balance)}</span>
                </div>
              </div>
            )}
          </div>
        )}

        <div className="px-8 py-5 border-t border-gray-100 flex items-end justify-between">
          <div>
            <p className="text-xs text-gray-500">For {outlet.name || 'PP Pipes Products'}</p>
            <p className="text-[10px] text-gray-400 mt-3">Created: {fmtCreatedAt(bill.createdAt)}</p>
          </div>
          <div className="text-right border-t border-gray-400 pt-2 w-40">
            <p className="text-xs text-gray-500">Authorised Signatory</p>
          </div>
        </div>
      </div>

      <style>{`
        @media print {
          body { background: white !important; padding: 0 !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
