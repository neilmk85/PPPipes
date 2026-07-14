import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { BookOpen, Download, ChevronDown, ChevronUp, X, ChevronRight, Package } from 'lucide-react'
import { reportApi, invoiceApi, purchaseBillApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { DateRangePicker } from '@/components/DateRangePicker'

// ─── Types ────────────────────────────────────────────────────────────────────

type VoucherType =
  | 'INVOICE' | 'PAYMENT_RECEIVED'
  | 'PURCHASE_BILL' | 'VENDOR_PAYMENT'
  | 'EXPENSE' | 'CREDIT_NOTE'
  | 'SALE_RETURN' | 'PURCHASE_RETURN' | 'VENDOR_CREDIT'

interface Entry {
  date: string
  createdAt: string
  voucherType: VoucherType
  voucherNo: string
  party: string
  narration: string
  debit: string
  credit: string
  status: string
  refId: number
}

// ─── Config ───────────────────────────────────────────────────────────────────

const VOUCHER_META: Record<VoucherType, { label: string; color: string; dot: string; category: 'sales' | 'purchase' | 'expense' | 'adjustment' }> = {
  INVOICE:          { label: 'Invoice',          color: 'bg-blue-100 text-blue-700 border-blue-200',    dot: 'bg-blue-500',    category: 'sales' },
  PAYMENT_RECEIVED: { label: 'Payment Received', color: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500', category: 'sales' },
  CREDIT_NOTE:      { label: 'Credit Note',      color: 'bg-amber-100 text-amber-700 border-amber-200',   dot: 'bg-amber-500',   category: 'adjustment' },
  SALE_RETURN:      { label: 'Sale Return',       color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500',  category: 'adjustment' },
  PURCHASE_BILL:    { label: 'Purchase Bill',     color: 'bg-rose-100 text-rose-700 border-rose-200',     dot: 'bg-rose-500',    category: 'purchase' },
  VENDOR_PAYMENT:   { label: 'Vendor Payment',   color: 'bg-red-100 text-red-700 border-red-200',       dot: 'bg-red-500',     category: 'purchase' },
  EXPENSE:          { label: 'Expense',           color: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500', category: 'expense' },
  PURCHASE_RETURN:  { label: 'Purchase Return',  color: 'bg-teal-100 text-teal-700 border-teal-200',    dot: 'bg-teal-500',    category: 'adjustment' },
  VENDOR_CREDIT:    { label: 'Vendor Credit',    color: 'bg-cyan-100 text-cyan-700 border-cyan-200',    dot: 'bg-cyan-500',    category: 'adjustment' },
}

const ALL_TYPES = Object.keys(VOUCHER_META) as VoucherType[]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: string | number): string {
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (!v || isNaN(v)) return '—'
  return '₹' + v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtPlain(n: string | number): string {
  const v = typeof n === 'string' ? parseFloat(n) : n
  if (!v || isNaN(v)) return '0.00'
  return v.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function parseAmt(s: string): number { return parseFloat(s) || 0 }

// ─── Summary Card ─────────────────────────────────────────────────────────────

function SummaryCard({ label, value, sub, icon, accent }: {
  label: string; value: string; sub?: string
  icon: React.ReactNode; accent: string
}) {
  return (
    <div className={`rounded-2xl p-5 border bg-white shadow-sm flex items-start gap-4 ${accent}`}>
      <div className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center bg-white/60 shadow-inner">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-70 mb-0.5">{label}</p>
        <p className="text-xl font-bold truncate">{value}</p>
        {sub && <p className="text-xs opacity-60 mt-0.5">{sub}</p>}
      </div>
    </div>
  )
}

// ─── Voucher Badge ────────────────────────────────────────────────────────────

function VoucherBadge({ type }: { type: VoucherType }) {
  const meta = VOUCHER_META[type] ?? { label: type, color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' }
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-semibold whitespace-nowrap ${meta.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
      {meta.label}
    </span>
  )
}

// ─── Voucher Detail Drawer ────────────────────────────────────────────────────

function VoucherDetailDrawer({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const isInvoice     = entry.voucherType === 'INVOICE'
  const isPurchaseBill = entry.voucherType === 'PURCHASE_BILL'
  const needsFetch    = isInvoice || isPurchaseBill

  const { data: detailRes, isLoading } = useQuery({
    queryKey: ['daybook-voucher', entry.voucherType, entry.refId],
    queryFn: () => {
      if (isInvoice)     return invoiceApi.getById(entry.refId)
      if (isPurchaseBill) return purchaseBillApi.getById(entry.refId)
      return Promise.resolve(null)
    },
    enabled: needsFetch && entry.refId > 0,
  })

  const detail = (detailRes as any)?.data?.data ?? (detailRes as any)?.data ?? null
  const meta   = VOUCHER_META[entry.voucherType] ?? { label: entry.voucherType, color: 'bg-gray-100 text-gray-600 border-gray-200', dot: 'bg-gray-400' }

  const amtColor = parseAmt(entry.debit) > 0 ? 'text-emerald-600' : 'text-rose-500'
  const amtLabel = parseAmt(entry.debit) > 0 ? 'Dr' : 'Cr'
  const amtValue = parseAmt(entry.debit) > 0 ? entry.debit : entry.credit

  // line items for invoice or purchase bill
  const lineItems: any[] = detail?.items ?? detail?.lines ?? detail?.invoiceItems ?? detail?.billItems ?? []

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />

      {/* Panel */}
      <div
        className="relative w-[480px] max-w-full h-full bg-white shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-100 bg-gray-50">
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold ${meta.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
          <span className="text-sm font-mono text-gray-500 flex-1">{entry.voucherNo}</span>
          <button onClick={onClose} className="w-7 h-7 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors">
            <X size={15} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">

          {/* Amount hero */}
          <div className="rounded-2xl bg-gray-50 border border-gray-100 px-5 py-4 flex items-center gap-4">
            <div className="flex-1">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-0.5">{amtLabel === 'Dr' ? 'Debit (Dr)' : 'Credit (Cr)'}</p>
              <p className={`text-2xl font-bold ${amtColor}`}>₹{fmtPlain(amtValue)}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400 mb-0.5">Date</p>
              <p className="text-sm font-semibold text-gray-700">
                {(() => { try { return format(new Date(entry.date.substring(0, 10) + 'T00:00:00'), 'd MMM yyyy') } catch { return entry.date } })()}
              </p>
            </div>
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3">
            {entry.party && (
              <div className="col-span-2 bg-white border border-gray-100 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 font-medium mb-0.5">Party</p>
                <p className="text-sm font-semibold text-gray-800">{entry.party}</p>
              </div>
            )}
            {entry.narration && (
              <div className="col-span-2 bg-white border border-gray-100 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 font-medium mb-0.5">Narration</p>
                <p className="text-sm text-gray-700">{entry.narration}</p>
              </div>
            )}
            {entry.status && (
              <div className="bg-white border border-gray-100 rounded-xl px-4 py-3">
                <p className="text-xs text-gray-400 font-medium mb-0.5">Status</p>
                <p className="text-sm font-semibold text-gray-800 capitalize">{entry.status.toLowerCase()}</p>
              </div>
            )}
          </div>

          {/* Line items (invoice / purchase bill) */}
          {needsFetch && (
            <>
              <div className="flex items-center gap-2 pt-1">
                <Package size={14} className="text-gray-400" />
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Line Items</p>
              </div>

              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-gray-400">
                  <div className="w-6 h-6 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin mr-2" />
                  Loading…
                </div>
              ) : lineItems.length > 0 ? (
                <div className="rounded-xl border border-gray-100 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500">Item</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Qty</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-500">Rate</th>
                        <th className="px-4 py-2.5 text-right text-xs font-semibold text-gray-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {lineItems.map((item: any, i: number) => {
                        const name  = item.productName ?? item.itemName ?? item.description ?? `Item ${i + 1}`
                        const qty   = item.quantity ?? item.qty ?? ''
                        const rate  = item.unitPrice ?? item.rate ?? item.price ?? ''
                        const total = item.lineTotal ?? item.totalPrice ?? item.amount ?? ''
                        return (
                          <tr key={i} className="hover:bg-gray-50/60">
                            <td className="px-4 py-2.5 text-gray-800 font-medium">{name}</td>
                            <td className="px-3 py-2.5 text-right text-gray-600">{qty}</td>
                            <td className="px-3 py-2.5 text-right text-gray-600">{rate ? `₹${fmtPlain(rate)}` : '—'}</td>
                            <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{total ? `₹${fmtPlain(total)}` : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {/* Totals */}
                  {detail && (
                    <div className="bg-gray-50 border-t border-gray-100 px-4 py-3 space-y-1.5">
                      {detail.subtotal != null && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Subtotal</span>
                          <span>₹{fmtPlain(detail.subtotal)}</span>
                        </div>
                      )}
                      {detail.discountAmount != null && parseAmt(detail.discountAmount) > 0 && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Discount</span>
                          <span className="text-rose-500">−₹{fmtPlain(detail.discountAmount)}</span>
                        </div>
                      )}
                      {(detail.taxAmount ?? detail.gstAmount) != null && (
                        <div className="flex justify-between text-xs text-gray-500">
                          <span>Tax / GST</span>
                          <span>₹{fmtPlain(detail.taxAmount ?? detail.gstAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-sm font-bold text-gray-800 pt-1 border-t border-gray-200">
                        <span>Total</span>
                        <span>₹{fmtPlain(detail.totalAmount ?? detail.grandTotal ?? detail.total ?? amtValue)}</span>
                      </div>
                      {(detail.paidAmount ?? detail.amountPaid) != null && (
                        <div className="flex justify-between text-xs text-emerald-600 font-semibold">
                          <span>Paid</span>
                          <span>₹{fmtPlain(detail.paidAmount ?? detail.amountPaid)}</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ) : !isLoading && (
                <div className="text-center py-4 text-gray-400 text-sm">No line items found</div>
              )}
            </>
          )}

          {/* For non-fetchable types, show payment info from inline data */}
          {!needsFetch && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Details</p>
              <div className="space-y-1.5">
                {entry.party && <div className="flex justify-between"><span className="text-gray-400">Party</span><span className="font-medium">{entry.party}</span></div>}
                {entry.voucherNo && <div className="flex justify-between"><span className="text-gray-400">Ref No.</span><span className="font-mono text-gray-700">{entry.voucherNo}</span></div>}
                <div className="flex justify-between"><span className="text-gray-400">Amount</span><span className={`font-bold ${amtColor}`}>₹{fmtPlain(amtValue)} {amtLabel}</span></div>
                {entry.narration && <div className="flex flex-col gap-0.5 pt-1 border-t border-gray-200"><span className="text-gray-400 text-xs">Narration</span><span>{entry.narration}</span></div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Day Group ────────────────────────────────────────────────────────────────

function DayGroup({ date, entries, onSelect }: { date: string; entries: Entry[]; onSelect: (e: Entry) => void }) {
  const [open, setOpen] = useState(true)
  const dayDebit  = entries.reduce((s, e) => s + parseAmt(e.debit), 0)
  const dayCredit = entries.reduce((s, e) => s + parseAmt(e.credit), 0)

  const displayDate = (() => {
    try {
      return format(new Date(date + 'T00:00:00'), 'EEEE, d MMMM yyyy')
    } catch { return date }
  })()

  return (
    <div className="mb-4">
      {/* Day header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl mb-0.5 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-3">
          {open ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
          <span className="text-sm font-semibold text-gray-700">{displayDate}</span>
          <span className="text-xs text-gray-400 font-medium">{entries.length} {entries.length === 1 ? 'entry' : 'entries'}</span>
        </div>
        <div className="flex items-center gap-6 text-xs font-semibold">
          {dayDebit > 0 && (
            <span className="text-emerald-600">
              Dr ₹{fmtPlain(dayDebit)}
            </span>
          )}
          {dayCredit > 0 && (
            <span className="text-rose-500">
              Cr ₹{fmtPlain(dayCredit)}
            </span>
          )}
        </div>
      </button>

      {/* Entries */}
      {open && (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-gray-100">
              {entries.map((e, i) => (
                <tr
                  key={i}
                  className="hover:bg-violet-50/60 transition-colors group cursor-pointer"
                  onClick={() => onSelect(e)}
                >
                  <td className="px-4 py-3 w-28 shrink-0">
                    <span className="text-xs text-gray-400 font-mono">
                      {(() => {
                        try { return format(new Date(e.createdAt), 'hh:mm a') }
                        catch { return '—' }
                      })()}
                    </span>
                  </td>
                  <td className="px-3 py-3 w-44">
                    <VoucherBadge type={e.voucherType} />
                  </td>
                  <td className="px-3 py-3 w-36">
                    <span className="text-xs font-mono text-gray-500 group-hover:text-violet-600 transition-colors">
                      {e.voucherNo}
                    </span>
                  </td>
                  <td className="px-3 py-3 w-44">
                    <span className="text-sm font-semibold text-gray-800 truncate block max-w-[160px]" title={e.party}>
                      {e.party}
                    </span>
                  </td>
                  <td className="px-3 py-3">
                    <span className="text-xs text-gray-500 truncate block max-w-xs" title={e.narration}>
                      {e.narration}
                    </span>
                  </td>
                  <td className="px-4 py-3 w-36 text-right">
                    {parseAmt(e.debit) > 0 ? (
                      <span className="text-sm font-semibold text-emerald-600">
                        ₹{fmtPlain(e.debit)}
                      </span>
                    ) : (
                      <span className="text-gray-200">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 w-36 text-right">
                    {parseAmt(e.credit) > 0 ? (
                      <span className="text-sm font-semibold text-rose-500">
                        ₹{fmtPlain(e.credit)}
                      </span>
                    ) : (
                      <span className="text-gray-200">—</span>
                    )}
                  </td>
                  <td className="px-2 py-3 w-8">
                    <ChevronRight size={14} className="text-gray-300 group-hover:text-violet-400 transition-colors" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function DayBookPage() {
  const { outletId } = useAuthStore()
  const [from, setFrom] = useState(new Date().toISOString().split('T')[0])
  const [to,   setTo]   = useState(new Date().toISOString().split('T')[0])
  const [activeTypes, setActiveTypes] = useState<Set<VoucherType>>(new Set(ALL_TYPES))
  const [search, setSearch] = useState('')
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['daybook', outletId, from, to],
    queryFn: () => reportApi.getDayBook(outletId!, from, to),
    enabled: !!outletId,
  })

  const allEntries: Entry[] = (data as any)?.data?.data ?? []

  // Apply filters
  const filtered = useMemo(() => {
    return allEntries.filter(e => {
      if (!activeTypes.has(e.voucherType)) return false
      if (search.trim()) {
        const q = search.toLowerCase()
        return e.party.toLowerCase().includes(q)
          || e.voucherNo.toLowerCase().includes(q)
          || e.narration.toLowerCase().includes(q)
      }
      return true
    })
  }, [allEntries, activeTypes, search])

  // Group by date
  const grouped = useMemo(() => {
    const map = new Map<string, Entry[]>()
    for (const e of filtered) {
      if (!map.has(e.date)) map.set(e.date, [])
      map.get(e.date)!.push(e)
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]))
  }, [filtered])

  // Summary totals
  const totalDebit  = filtered.reduce((s, e) => s + parseAmt(e.debit), 0)
  const totalCredit = filtered.reduce((s, e) => s + parseAmt(e.credit), 0)
  const netFlow     = totalDebit - totalCredit

  // Toggle voucher type filter
  function toggleType(t: VoucherType) {
    setActiveTypes(prev => {
      const next = new Set(prev)
      if (next.has(t)) { next.delete(t) } else { next.add(t) }
      return next
    })
  }

  function toggleAll() {
    if (activeTypes.size === ALL_TYPES.length) {
      setActiveTypes(new Set())
    } else {
      setActiveTypes(new Set(ALL_TYPES))
    }
  }

  // CSV export
  function exportCSV() {
    const rows = [
      ['Date', 'Time', 'Voucher Type', 'Voucher No', 'Party', 'Narration', 'Debit (₹)', 'Credit (₹)', 'Status'],
      ...filtered.map(e => [
        e.date,
        (() => { try { return format(new Date(e.createdAt), 'hh:mm a') } catch { return '' } })(),
        VOUCHER_META[e.voucherType]?.label ?? e.voucherType,
        e.voucherNo,
        e.party,
        e.narration,
        parseAmt(e.debit) > 0 ? fmtPlain(e.debit) : '',
        parseAmt(e.credit) > 0 ? fmtPlain(e.credit) : '',
        e.status,
      ])
    ]
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `daybook-${from}-to-${to}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <>
    <div className="min-h-screen bg-gray-50">

      {/* ── Hero header ── */}
      <div className="bg-gradient-to-br from-violet-700 via-violet-600 to-indigo-600 px-6 pt-8 pb-6">
        <div>

          {/* Title row */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
                <BookOpen size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Day Book</h1>
                <p className="text-violet-200 text-sm mt-0.5">Complete chronological transaction log</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <DateRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
              <button
                onClick={exportCSV}
                className="flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 backdrop-blur border border-white/20 text-white text-sm font-semibold rounded-xl transition-all"
              >
                <Download size={15} />
                Export CSV
              </button>
            </div>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-2">
            <div className="bg-white/15 backdrop-blur rounded-2xl border border-white/20 p-4">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-1">Total Debit (Dr)</p>
              <p className="text-white text-xl font-bold">₹{fmtPlain(totalDebit)}</p>
              <p className="text-white/50 text-xs mt-1">Sales & receivables</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl border border-white/20 p-4">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-1">Total Credit (Cr)</p>
              <p className="text-white text-xl font-bold">₹{fmtPlain(totalCredit)}</p>
              <p className="text-white/50 text-xs mt-1">Purchases & payments</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl border border-white/20 p-4">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-1">Net Position</p>
              <p className={`text-xl font-bold ${netFlow >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>
                {netFlow >= 0 ? '+' : ''}₹{fmtPlain(Math.abs(netFlow))}
              </p>
              <p className="text-white/50 text-xs mt-1">{netFlow >= 0 ? 'Dr > Cr' : 'Cr > Dr'}</p>
            </div>
            <div className="bg-white/15 backdrop-blur rounded-2xl border border-white/20 p-4">
              <p className="text-white/60 text-xs font-semibold uppercase tracking-wide mb-1">Entries</p>
              <p className="text-white text-xl font-bold">{filtered.length}</p>
              <p className="text-white/50 text-xs mt-1">across {grouped.length} day{grouped.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Filters + Table ── */}
      <div className="px-6 py-6">

        {/* Filter bar */}
        <div className="bg-white rounded-2xl shadow-md p-4 mb-5">
          <div className="flex flex-wrap items-center gap-3">

            {/* Search */}
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search party, voucher no, narration…"
              className="border border-gray-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-violet-200 focus:border-violet-400 focus:outline-none w-72"
            />

            <div className="h-5 w-px bg-gray-200" />

            {/* All toggle */}
            <button
              onClick={toggleAll}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                activeTypes.size === ALL_TYPES.length
                  ? 'bg-gray-800 text-white border-gray-800'
                  : 'bg-white text-gray-500 border-gray-200 hover:border-gray-400'
              }`}
            >
              All
            </button>

            {/* Type chips */}
            {ALL_TYPES.map(t => {
              const meta = VOUCHER_META[t]
              const active = activeTypes.has(t)
              return (
                <button
                  key={t}
                  onClick={() => toggleType(t)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                    active ? `${meta.color} shadow-sm` : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {active && <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />}
                  {meta.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Table header */}
        <div className="grid grid-cols-[112px_176px_144px_176px_1fr_144px_144px] px-4 py-2 mb-2">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Time</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Type</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Voucher No.</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Party</span>
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Narration</span>
          <span className="text-xs font-semibold text-emerald-500 uppercase tracking-wide text-right">Debit (Dr)</span>
          <span className="text-xs font-semibold text-rose-400 uppercase tracking-wide text-right">Credit (Cr)</span>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex items-center justify-center py-24 text-gray-400">
            <div className="w-8 h-8 border-2 border-violet-200 border-t-violet-500 rounded-full animate-spin mr-3" />
            Loading entries…
          </div>
        )}

        {/* Empty */}
        {!isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400">
            <BookOpen size={40} className="mb-3 opacity-30" />
            <p className="font-semibold text-gray-500">No transactions found</p>
            <p className="text-sm mt-1">Try a different date range or clear the filters</p>
          </div>
        )}

        {/* Day groups */}
        {!isLoading && grouped.map(([date, entries]) => (
          <DayGroup key={date} date={date} entries={entries} onSelect={setSelectedEntry} />
        ))}

        {/* Grand totals */}
        {!isLoading && filtered.length > 0 && (
          <div className="mt-4 border-t-2 border-gray-200 pt-4">
            <div className="grid grid-cols-[112px_176px_144px_176px_1fr_144px_144px] px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
              <div className="col-span-5 flex items-center gap-2">
                <span className="text-sm font-bold text-gray-700">Grand Total</span>
                <span className="text-xs text-gray-400">({filtered.length} entries)</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-emerald-600">₹{fmtPlain(totalDebit)}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-bold text-rose-500">₹{fmtPlain(totalCredit)}</span>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 mt-3 px-4">
              <span className="text-xs text-gray-500">Net (Dr − Cr):</span>
              <span className={`text-base font-bold ${netFlow >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                {netFlow >= 0 ? '+' : '−'}₹{fmtPlain(Math.abs(netFlow))}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>

    {/* Voucher detail drawer */}
    {selectedEntry && (
      <VoucherDetailDrawer entry={selectedEntry} onClose={() => setSelectedEntry(null)} />
    )}
    </>
  )
}
