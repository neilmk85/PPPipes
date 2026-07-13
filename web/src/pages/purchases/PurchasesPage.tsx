import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Building2, ShoppingBag, PackageCheck, Receipt, CreditCard, FileX } from 'lucide-react'
import VendorsTab from './tabs/VendorsTab'
import PurchaseOrdersTab from './tabs/PurchaseOrdersTab'
import PurchaseReceivesTab from './tabs/PurchaseReceivesTab'
import BillsTab from './tabs/BillsTab'
import PaymentsMadeTab from './tabs/PaymentsMadeTab'
import VendorCreditsTab from './tabs/VendorCreditsTab'
import PurchaseReturnsPage from './PurchaseReturnsPage'
import { purchaseBillApi } from '@/services/api'
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

  const { data: billSummary } = useQuery({
    queryKey: ['purchase-bills-summary', outletId],
    queryFn: async () => {
      const res = await purchaseBillApi.getSummary(outletId)
      return res.data.data
    },
    enabled: segment === 'bills',
  })

  // Purchase Returns is a full standalone page (no card wrapper)
  if (segment === 'returns') return <PurchaseReturnsPage />

  const renderContent = () => {
    switch (segment) {
      case 'vendors':          return <VendorsTab />
      case 'purchase-orders':  return <PurchaseOrdersTab />
      case 'receive':          return <PurchaseReceivesTab />
      case 'bills':            return <BillsTab />
      case 'payments':         return <PaymentsMadeTab dateFrom={payDateFrom} dateTo={payDateTo} />
      case 'vendor-credits':   return <VendorCreditsTab />
      default:                 return <VendorsTab />
    }
  }

  const meta = SEGMENT_META[segment] ?? { icon: ShoppingBag, title: 'Purchases' }
  const Icon = meta.icon

  return (
    <div className="p-6">
      {/* Hero Header */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)] mb-6">
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
          <div className="absolute inset-0 opacity-[0.15]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-56 h-56 rounded-full bg-violet-300/20 blur-2xl" />
        </div>
        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <Icon size={26} className="text-amber-300" />
            <div>
              <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Purchases</p>
              <h1 className="text-white text-2xl font-bold tracking-tight">{meta.title}</h1>
            </div>
          </div>
          {segment === 'payments' && (
            <DateRangePicker
              fromDate={payDateFrom}
              toDate={payDateTo}
              onChange={(f, t) => { setPayDateFrom(f); setPayDateTo(t) }}
            />
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
      {renderContent()}
    </div>
  )
}
