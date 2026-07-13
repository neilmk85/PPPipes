import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Plus, Search, FileText, CheckCircle2, Truck,
  Factory, User, ChevronRight, X,
} from 'lucide-react'
import { format } from 'date-fns'
import { salesOrderApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { DateRangePicker } from '@/components/DateRangePicker'

const STATUS_CFG: Record<string, { label: string; bg: string; text: string; dot: string }> = {
  DRAFT:               { label: 'Draft',          bg: 'bg-gray-100',  text: 'text-gray-600',   dot: 'bg-gray-400'   },
  CONFIRMED:           { label: 'Confirmed',       bg: 'bg-blue-50',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
  IN_PRODUCTION:       { label: 'In Production',   bg: 'bg-amber-50',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  PROCESSING:          { label: 'Processing',      bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-400' },
  PARTIALLY_DELIVERED: { label: 'Part. Delivered', bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  DELIVERED:           { label: 'Delivered',       bg: 'bg-teal-50',   text: 'text-teal-700',   dot: 'bg-teal-500'   },
  INVOICED:            { label: 'Invoiced',        bg: 'bg-green-50',  text: 'text-green-700',  dot: 'bg-green-500'  },
  CANCELLED:           { label: 'Cancelled',       bg: 'bg-red-50',    text: 'text-red-600',    dot: 'bg-red-400'    },
  ON_HOLD:             { label: 'On Hold',         bg: 'bg-slate-100', text: 'text-slate-600',  dot: 'bg-slate-400'  },
}

function StatusBadge({ status }: { status: string }) {
  const c = STATUS_CFG[status] ?? STATUS_CFG.DRAFT
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${c.dot}`} />
      {c.label}
    </span>
  )
}

export default function SalesOrdersPage() {
  const navigate = useNavigate()
  const { outletId } = useAuthStore()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('ALL')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate]     = useState('')
  const [page, setPage]         = useState(0)

  const { data, isLoading } = useQuery({
    queryKey: ['sales-orders', status, fromDate, toDate, page, outletId],
    queryFn: () => salesOrderApi.getAll({
      outletId: outletId ?? 1,
      ...(status !== 'ALL' ? { status } : {}),
      ...(fromDate ? { from: fromDate } : {}),
      ...(toDate   ? { to: toDate }     : {}),
      page, size: 50,
    }).then(r => r.data),
  })

  const allOrders: any[] = data?.data?.content ?? data?.data ?? []
  const orders = allOrders.filter((o: any) => {
    if (!search) return true
    const q = search.toLowerCase()
    return o.soNumber?.toLowerCase().includes(q) || o.customer?.name?.toLowerCase().includes(q)
  })
  const total: number = data?.data?.totalElements ?? allOrders.length
  const inProduction = allOrders.filter((o: any) => o.status === 'IN_PRODUCTION').length
  const confirmed    = allOrders.filter((o: any) => o.status === 'CONFIRMED').length
  const delivered    = allOrders.filter((o: any) => ['DELIVERED','INVOICED'].includes(o.status)).length
  const totalPipes   = allOrders.reduce((sum: number, o: any) =>
    sum + (o.items ?? []).filter((i: any) => i.pipeConfigId).reduce((s: number, i: any) => s + Number(i.quantity), 0), 0)
  const totalMeters  = +allOrders.reduce((sum: number, o: any) =>
    sum + (o.items ?? []).filter((i: any) => i.pipeConfigId).reduce((s: number, i: any) =>
      s + Number(i.quantity) * (i.pipeConfig?.lengthM ?? 5.25), 0), 0).toFixed(2)

  return (
    <div className="min-h-full bg-gray-50/60 p-6 space-y-6">

      {/* ── Hero header ───────────────────────────────────────────── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)]">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-28 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        {/* Top row */}
        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <FileText size={26} className="text-amber-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Commerce</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Sales Orders</h1>
              <p className="text-sm text-blue-200 mt-0.5">Manage customer pipe orders and convert to production</p>
            </div>
          </div>
          <button
            onClick={() => navigate('/sales-orders/new')}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 border border-white/25 text-white text-sm font-semibold rounded-xl backdrop-blur-sm hover:bg-white/25 transition-all"
          >
            <Plus size={16} /> New Sales Order
          </button>
        </div>

        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-6 divide-x divide-white/10">
          {[
            { label: 'Total Orders',   value: total,                          sub: 'all time'             },
            { label: 'Confirmed',      value: confirmed,                      sub: 'awaiting production'  },
            { label: 'In Production',  value: inProduction,                   sub: 'currently active',    warn: inProduction > 0 },
            { label: 'Delivered',      value: delivered,                      sub: 'completed & invoiced' },
            { label: 'Total Pipes',    value: totalPipes.toLocaleString(),    sub: 'across all orders',   highlight: true },
            { label: 'Total Meters',   value: totalMeters.toLocaleString(),   sub: 'pipe length (m)',     highlight: true },
          ].map(s => (
            <div key={s.label} className="px-5 py-3.5">
              <p className={`text-xl font-extrabold tabular-nums leading-none ${(s as any).warn ? 'text-amber-300' : (s as any).highlight ? 'text-amber-200' : 'text-white'}`}>{s.value}</p>
              <p className="text-xs text-blue-200 mt-0.5">{s.label}</p>
              <p className="text-[10px] text-white/40 mt-0.5">{s.sub}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Table card */}
      <div className="bg-white rounded-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] overflow-hidden ring-1 ring-gray-100">

        {/* Dark header */}
        <div className="bg-gradient-to-r from-violet-600 to-blue-600 px-6 py-3">
          <div className="flex items-center gap-3">
            {/* Icon + title */}
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
              <FileText size={18} className="text-amber-400" />
            </div>
            <div className="shrink-0">
              <h2 className="text-sm font-bold text-white tracking-wide">All Sales Orders</h2>
              <p className="text-xs text-blue-100 mt-0.5">{total} order{total !== 1 ? 's' : ''}</p>
            </div>
            {/* Filters inline */}
            <div className="flex items-center gap-2 ml-4 flex-1">
              <div className="relative w-72">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/60" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
                  className="w-full pl-8 pr-7 py-1.5 text-sm bg-white/15 border border-white/20 rounded-xl text-white placeholder-white/50 focus:outline-none focus:bg-white/25" />
                {search && <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white"><X size={13} /></button>}
              </div>
              <div className="flex gap-1.5">
                {['ALL','DRAFT','CONFIRMED','IN_PRODUCTION','DELIVERED','CANCELLED'].map(s => (
                  <button key={s} onClick={() => setStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${status === s ? 'bg-white text-violet-700 shadow-sm' : 'bg-white/15 text-white border border-white/20 hover:bg-white/25'}`}>
                    {s === 'ALL' ? 'All' : (STATUS_CFG[s]?.label ?? s)}
                  </button>
                ))}
              </div>
              <div className="ml-auto">
                <DateRangePicker fromDate={fromDate} toDate={toDate} onChange={(f, t) => { setFromDate(f); setToDate(t) }} />
              </div>
            </div>{/* end filters */}
          </div>{/* end flex row */}
        </div>{/* end dark header */}

        {/* Table */}
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-50 border-y border-slate-200">
              <th className="px-6 py-3 text-left   text-[11px] font-bold text-slate-400 uppercase tracking-widest">SO Number</th>
              <th className="px-6 py-3 text-left   text-[11px] font-bold text-slate-400 uppercase tracking-widest">Customer</th>
              <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">Pipe Items</th>
              <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">Order Date</th>
              <th className="px-6 py-3 text-center text-[11px] font-bold text-slate-400 uppercase tracking-widest">Required By</th>
              <th className="px-6 py-3 text-right  text-[11px] font-bold text-slate-400 uppercase tracking-widest">Amount</th>
              <th className="px-5 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="animate-pulse">
                  {Array.from({ length: 8 }).map((_, j) => (
                    <td key={j} className="px-6 py-4"><div className="h-3 bg-gray-100 rounded" /></td>
                  ))}
                </tr>
              ))
            ) : orders.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-6 py-16 text-center">
                  <FileText size={32} className="text-gray-200 mx-auto mb-3" />
                  <p className="text-sm font-semibold text-gray-400">No sales orders found</p>
                  <button onClick={() => navigate('/sales-orders/new')}
                    className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs font-semibold rounded-xl hover:from-violet-700 hover:to-blue-700">
                    <Plus size={13} /> New Sales Order
                  </button>
                </td>
              </tr>
            ) : (
              orders.map((o: any) => {
                const pipeItems = (o.items ?? []).filter((i: any) => i.pipeConfigId)
                const converted = pipeItems.filter((i: any) => i.productionOrderId).length
                return (
                  <tr key={o.id} onClick={() => navigate(`/sales-orders/${o.id}`)}
                    className="hover:bg-violet-50/30 cursor-pointer transition-colors group">
                    <td className="px-6 py-3.5">
                      <span className="font-bold text-gray-900">{o.soNumber}</span>
                      {o.customerPoNumber && <p className="text-[11px] text-gray-400 mt-0.5">Ref: {o.customerPoNumber}</p>}
                    </td>
                    <td className="px-6 py-3.5">
                      <span className="font-medium text-gray-800">{o.customer?.name ?? '—'}</span>
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {pipeItems.length > 0 ? (
                        <div className="flex flex-col items-center gap-0.5">
                          <span className="font-semibold text-gray-800">{pipeItems.length} pipe{pipeItems.length !== 1 ? 's' : ''}</span>
                          <span className={`text-[10px] font-semibold ${converted === pipeItems.length ? 'text-green-600' : 'text-amber-600'}`}>
                            {converted}/{pipeItems.length} → PO
                          </span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-xs">{(o.items ?? []).length} items</span>
                      )}
                    </td>
                    <td className="px-6 py-3.5 text-center"><StatusBadge status={o.status} /></td>
                    <td className="px-6 py-3.5 text-center text-xs text-gray-500">
                      {o.orderDate ? format(new Date(o.orderDate), 'dd MMM yyyy') : '—'}
                    </td>
                    <td className="px-6 py-3.5 text-center">
                      {o.requiredDate
                        ? <span className="text-xs font-semibold text-orange-600">{format(new Date(o.requiredDate), 'dd MMM yyyy')}</span>
                        : <span className="text-xs text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-3.5 text-right font-bold text-gray-900 tabular-nums">
                      ₹{parseFloat(o.totalAmount ?? 0).toLocaleString('en-IN')}
                    </td>
                    <td className="px-5 py-3.5">
                      <ChevronRight size={16} className="text-gray-300 group-hover:text-slate-600 mx-auto transition-colors" />
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {orders.length > 1 && (
            <tfoot>
              <tr className="bg-violet-50 border-t-2 border-violet-200">
                <td colSpan={6} className="px-6 py-3 text-xs font-bold text-violet-700 uppercase tracking-widest">{orders.length} orders shown</td>
                <td className="px-6 py-3 text-right text-sm font-bold text-gray-900 tabular-nums">
                  ₹{orders.reduce((s: number, o: any) => s + parseFloat(o.totalAmount ?? 0), 0).toLocaleString('en-IN')}
                </td>
                <td />
              </tr>
            </tfoot>
          )}
        </table>

        {total > 50 && (
          <div className="px-6 py-3.5 border-t border-gray-100 flex items-center justify-between bg-gray-50/40">
            <p className="text-xs text-gray-500">Showing {page * 50 + 1}–{Math.min((page + 1) * 50, total)} of {total}</p>
            <div className="flex gap-2">
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Prev</button>
              <button disabled={(page + 1) * 50 >= total} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg disabled:opacity-40 hover:bg-gray-50">Next</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
