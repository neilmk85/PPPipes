import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, ShoppingBag, PackageCheck, Receipt, CreditCard, FileX, Search, Plus } from 'lucide-react'
import VendorsTab from './tabs/VendorsTab'
import PurchaseOrdersTab from './tabs/PurchaseOrdersTab'
import PurchaseReceivesTab from './tabs/PurchaseReceivesTab'
import BillsTab from './tabs/BillsTab'
import PaymentsMadeTab from './tabs/PaymentsMadeTab'
import VendorCreditsTab from './tabs/VendorCreditsTab'
import PurchaseReturnsPage from './PurchaseReturnsPage'
import { purchaseBillApi, vendorPaymentApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { DateRangePicker } from '@/components/DateRangePicker'

const SEGMENT_META: Record<string, { icon: React.ElementType; title: string }> = {
  'vendors':         { icon: Building2,    title: 'Vendors' },
  'purchase-orders': { icon: ShoppingBag,  title: 'Purchase Orders' },
  'receive':         { icon: PackageCheck, title: 'Purchase Receives' },
  'bills':           { icon: Receipt,      title: 'Bills' },
  'payments':        { icon: CreditCard,   title: 'Payments' },
  'vendor-credits':  { icon: FileX,        title: 'Vendor Credits' },
}

function fmtCur(n: any) {
  const v = parseFloat(String(n ?? 0))
  if (isNaN(v)) return '₹0'
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0 })
}

export default function PurchasesPage() {
  const { pathname } = useLocation()
  const { user } = useAuthStore()
  const outletId = user?.outletId ?? 1
  const segment = pathname.split('/purchases/')[1]?.split('/')[0] ?? 'vendors'
  const [payDateFrom, setPayDateFrom] = useState('')
  const [payDateTo, setPayDateTo] = useState('')
  const [paySearch, setPaySearch] = useState('')
  const [openPayModal, setOpenPayModal] = useState(false)

  const { data: billSummary } = useQuery({
    queryKey: ['purchase-bills-summary', outletId],
    queryFn: async () => {
      const res = await purchaseBillApi.getSummary(outletId)
      return res.data.data
    },
    enabled: segment === 'bills',
  })

  const { data: paymentsRaw } = useQuery({
    queryKey: ['vendor-payments', outletId],
    queryFn: () => vendorPaymentApi.getAll({ outletId: outletId ?? undefined, size: 500 })
      .then(r => r.data.data?.content ?? r.data.data ?? []),
    enabled: segment === 'payments',
  })
  const allPayments: any[] = Array.isArray(paymentsRaw) ? paymentsRaw : (paymentsRaw as any)?.content ?? []
  const filteredPayments = allPayments.filter(p => {
    const d = p.paymentDate ? new Date(p.paymentDate) : null
    return (!payDateFrom || (d && d >= new Date(payDateFrom))) &&
           (!payDateTo   || (d && d <= new Date(payDateTo + 'T23:59:59')))
  })
  const payTotal   = filteredPayments.reduce((s, p) => s + parseFloat(p.amount ?? 0), 0)
  const payTds     = filteredPayments.reduce((s, p) => s + parseFloat(p.tdsAmount ?? 0), 0)
  const payNet     = payTotal - payTds
  const payVendors = new Set(filteredPayments.map((p: any) => p.supplierId)).size

  // Purchase Returns is a full standalone page (no card wrapper)
  if (segment === 'returns') return <PurchaseReturnsPage />

  const renderContent = () => {
    switch (segment) {
      case 'vendors':          return <VendorsTab />
      case 'purchase-orders':  return <PurchaseOrdersTab />
      case 'receive':          return <PurchaseReceivesTab />
      case 'bills':            return <BillsTab />
      case 'payments':         return <PaymentsMadeTab dateFrom={payDateFrom} dateTo={payDateTo} search={paySearch} modalOpen={openPayModal} onModalClose={() => setOpenPayModal(false)} />
      case 'vendor-credits':   return <VendorCreditsTab />
      default:                 return <VendorsTab />
    }
  }

  const meta = SEGMENT_META[segment] ?? { icon: ShoppingBag, title: 'Purchases' }
  const Icon = meta.icon

  return (
    <div>
      {/* Hero Header — full width, flush to top */}
      <div className="relative shadow-[0_4px_24px_rgba(109,40,217,0.25)] mb-6">
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
          <div className="absolute inset-0 opacity-[0.15]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-56 h-56 rounded-full bg-violet-300/20 blur-2xl" />
        </div>
        <div className="relative px-8 py-5">
          {/* Row 1: title + chips + date filter */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <Icon size={26} className="text-amber-300" />
              <div>
                <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Purchases</p>
                <h1 className="text-white text-2xl font-bold tracking-tight">{meta.title}</h1>
              </div>
            </div>
            {segment === 'payments' && (
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Total Paid</p>
                  <p className="text-white font-bold text-base">{fmtCur(payTotal)}</p>
                </div>
                {payTds > 0 && (
                  <div className="text-center">
                    <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-0.5">TDS</p>
                    <p className="text-red-300 font-bold text-base">{fmtCur(payTds)}</p>
                  </div>
                )}
                <div className="text-center">
                  <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Net Outflow</p>
                  <p className="text-green-300 font-bold text-base">{fmtCur(payNet)}</p>
                </div>
                <div className="text-center">
                  <p className="text-white/50 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Vendors</p>
                  <p className="text-amber-300 font-bold text-base">{payVendors}</p>
                </div>
                <div className="w-px h-8 bg-white/20" />
                <DateRangePicker
                  fromDate={payDateFrom}
                  toDate={payDateTo}
                  onChange={(f, t) => { setPayDateFrom(f); setPayDateTo(t) }}
                />
              </div>
            )}
          </div>
          {/* Row 2: search + button (payments only) */}
          {segment === 'payments' && (
            <div className="flex items-center gap-3">
              <div className="relative flex-1 max-w-md">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
                <input
                  value={paySearch}
                  onChange={e => setPaySearch(e.target.value)}
                  placeholder="Search vendor or reference…"
                  className="w-full pl-9 pr-4 py-2 bg-white/10 border border-white/20 rounded-xl text-sm text-white placeholder-white/40 focus:outline-none focus:bg-white/20 focus:border-white/40"
                />
              </div>
              <button
                onClick={() => setOpenPayModal(true)}
                className="flex items-center gap-2 bg-white/15 hover:bg-white/25 border border-white/30 text-white px-4 py-2 rounded-xl text-sm font-medium backdrop-blur-sm transition-all"
              >
                <Plus size={15} /> Record Payment
              </button>
            </div>
          )}
          {segment === 'bills' && billSummary && (
            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
                <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Outstanding</p>
                <p className="text-white font-bold text-base">{fmtCur(billSummary.totalOutstanding)}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2.5 text-center min-w-[80px]">
                <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Unpaid</p>
                <p className="text-orange-300 font-bold text-base">{billSummary.unpaidCount ?? 0}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-2.5 text-center min-w-[100px]">
                <p className="text-white/60 text-[10px] font-semibold uppercase tracking-widest mb-0.5">Paid</p>
                <p className="text-green-300 font-bold text-base">{fmtCur(billSummary.totalPaid)}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      <div className="px-6 pb-6">
        {renderContent()}
      </div>
    </div>
  )
}
