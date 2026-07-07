import { useState, useEffect } from 'react'
import { format, subDays } from 'date-fns'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, BookOpen, Search, X, ChevronRight, Loader2 } from 'lucide-react'
import { reportApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { DateRangePicker } from '@/components/DateRangePicker'


function dmy(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function fmtAmt(v: number | string) {
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (!n && n !== 0) return '—'
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function amtClass(v: number | string) {
  const n = typeof v === 'string' ? parseFloat(v) : v
  if (n < 0) return 'text-red-600'
  if (n > 0) return 'text-gray-900'
  return 'text-gray-400'
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface LedgerAccount {
  id: string
  name: string
  accountType: 'gl' | 'customer' | 'supplier'
  partyId?: number
  openingBalance: number
  debit: number
  credit: number
  closingBalance: number
}

interface LedgerEntry {
  date: string
  particulars: string
  voucherType: string
  voucherNo: string
  debit: number
  credit: number
  balance: number
}

interface LedgerDetail {
  partyName: string
  partyType: string
  openingBalance: number
  closingBalance: number
  entries: LedgerEntry[]
}

// ── Detail drawer ─────────────────────────────────────────────────────────────
function LedgerDetailDrawer({ account, outletId, from, to, onClose }: {
  account: LedgerAccount; outletId: number; from: string; to: string; onClose: () => void
}) {
  const [detail, setDetail] = useState<LedgerDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!account.partyId) { setLoading(false); return }
    setLoading(true)
    reportApi.getLedgerDetail(outletId, from, to, account.accountType, account.partyId)
      .then(r => setDetail(r.data.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [account, outletId, from, to])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center gap-3 flex-shrink-0">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <BookOpen size={16} className="text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 truncate">{account.name}</p>
            <p className="text-xs text-gray-500 capitalize">{account.accountType} · {dmy(from)} – {dmy(to)}</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl hover:bg-gray-100 flex items-center justify-center transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-violet-400" />
          </div>
        ) : !detail || !detail.entries?.length ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 gap-2">
            <BookOpen size={32} className="opacity-30" />
            <p className="text-sm">No transactions in this period</p>
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 flex-shrink-0">
              {[
                { label: 'Opening Balance', value: detail.openingBalance },
                { label: 'Closing Balance', value: detail.closingBalance },
                { label: 'Entries', value: detail.entries.length, isCount: true },
              ].map(s => (
                <div key={s.label} className="px-5 py-3 text-center">
                  <p className="text-xs text-gray-400 mb-0.5">{s.label}</p>
                  <p className={`text-base font-semibold ${s.isCount ? 'text-gray-700' : amtClass(s.value)}`}>
                    {s.isCount ? s.value : fmtAmt(s.value)}
                  </p>
                </div>
              ))}
            </div>

            {/* Transaction table */}
            <div className="flex-1 overflow-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                  <tr>
                    {['Date', 'Particulars', 'Voucher No', 'Debit', 'Credit', 'Balance'].map(h => (
                      <th key={h} className={`px-4 py-3 text-xs font-semibold text-gray-900 uppercase tracking-wider ${['Debit','Credit','Balance'].includes(h) ? 'text-right' : 'text-left'}`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {detail.entries.map((e, i) => (
                    <tr key={i} className="hover:bg-gray-50/60 transition-colors">
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{e.date}</td>
                      <td className="px-4 py-3 text-gray-700">
                        <span className="block">{e.particulars}</span>
                        <span className="text-xs text-gray-400">{e.voucherType}</span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{e.voucherNo}</td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">
                        {parseFloat(String(e.debit)) > 0 ? fmtAmt(e.debit) : ''}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-800">
                        {parseFloat(String(e.credit)) > 0 ? fmtAmt(e.credit) : ''}
                      </td>
                      <td className={`px-4 py-3 text-right font-semibold ${amtClass(e.balance)}`}>
                        {fmtAmt(e.balance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function LedgerReportPage() {
  const navigate = useNavigate()
  const { outletId } = useAuthStore()

  const today = format(new Date(), 'yyyy-MM-dd')
  const thirtyAgo = format(subDays(new Date(), 89), 'yyyy-MM-dd')

  const [from, setFrom] = useState(thirtyAgo)
  const [to, setTo] = useState(today)
  const [search, setSearch] = useState('')
  const [accounts, setAccounts] = useState<LedgerAccount[]>([])
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<LedgerAccount | null>(null)

  function load() {
    if (!outletId) return
    setLoading(true)
    reportApi.getLedger(outletId, from, to)
      .then(r => setAccounts(r.data.data?.accounts ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [outletId, from, to])

  const filtered = accounts.filter(a =>
    !search || a.name.toLowerCase().includes(search.toLowerCase())
  )

  const typeLabel = (t: string) => {
    if (t === 'customer') return { label: 'Debtor', cls: 'bg-blue-50 text-blue-600' }
    if (t === 'supplier') return { label: 'Creditor', cls: 'bg-orange-50 text-orange-600' }
    return { label: 'GL', cls: 'bg-violet-50 text-violet-600' }
  }

  const canDrill = (a: LedgerAccount) => (a.accountType === 'customer' || a.accountType === 'supplier') && !!a.partyId

  return (
    <div className="min-h-screen bg-gray-50/60">

      {/* Hero header */}
      <div className="relative shadow-[0_8px_40px_rgba(109,40,217,0.25)]">
        <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-28 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>
        <div className="relative px-8 pt-6 pb-5">
          <div className="flex items-center gap-5">
            <button onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors">
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner">
              <BookOpen size={26} className="text-violet-200" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Reports</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight">Ledger</h1>
              <p className="text-sm text-blue-200 mt-0.5">Account-wise opening balance, debit, credit and closing balance</p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-8 py-4 bg-white border-b border-gray-100 flex flex-wrap items-center gap-3">
        <DateRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        <div className="relative ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search account..."
            className="pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 w-52 transition-colors"
          />
          {search && <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2"><X size={13} className="text-gray-400" /></button>}
        </div>
      </div>

      {/* Table */}
      <div className="px-8 py-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead style={{ background: 'linear-gradient(to right, #eff6ff 0%, #eef2ff 100%)', borderBottom: '1px solid #dbeafe' }}>
              <tr>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider w-10" style={{ color: '#1f2937' }}>#</th>
                <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: '#1f2937' }}>Account</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#1f2937' }}>Opening Balance</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#1f2937' }}>Debit</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#1f2937' }}>Credit</th>
                <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider" style={{ color: '#1f2937' }}>Closing Balance</th>
                <th className="w-8" style={{ background: 'transparent' }} />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center">
                  <Loader2 size={28} className="animate-spin text-violet-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-400">Loading ledger…</p>
                </td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-gray-400 text-sm">No accounts found</td></tr>
              ) : filtered.map((a, i) => {
                const tag = typeLabel(a.accountType)
                const drill = canDrill(a)
                return (
                  <tr key={a.id}
                    onClick={() => drill && setSelected(a)}
                    className={`transition-colors ${drill ? 'hover:bg-violet-50/40 cursor-pointer' : ''}`}>
                    <td className="px-5 py-4 text-gray-400 text-xs">{i + 1}</td>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2.5">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-md ${tag.cls}`}>{tag.label}</span>
                        <span className={`font-medium ${drill ? 'text-violet-700 hover:underline' : 'text-gray-800'}`}>{a.name}</span>
                        {drill && <ChevronRight size={13} className="text-gray-300 ml-auto flex-shrink-0" />}
                      </div>
                    </td>
                    <td className="px-5 py-4 text-right text-gray-500">{fmtAmt(a.openingBalance)}</td>
                    <td className="px-5 py-4 text-right font-medium text-gray-800">
                      {parseFloat(String(a.debit)) > 0 ? fmtAmt(a.debit) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-4 text-right font-medium text-gray-800">
                      {parseFloat(String(a.credit)) > 0 ? fmtAmt(a.credit) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className={`px-5 py-4 text-right font-semibold ${amtClass(a.closingBalance)}`}>
                      {fmtAmt(a.closingBalance)}
                    </td>
                    <td className="px-3 py-4">
                      {drill && <ChevronRight size={14} className="text-gray-300" />}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>

          {/* Footer totals */}
          {!loading && filtered.length > 0 && (() => {
            const totalDebit   = filtered.reduce((s, a) => s + parseFloat(String(a.debit)),   0)
            const totalCredit  = filtered.reduce((s, a) => s + parseFloat(String(a.credit)),  0)
            const totalClosing = filtered.reduce((s, a) => s + parseFloat(String(a.closingBalance)), 0)
            return (
              <div className="border-t-2 border-gray-200 bg-gray-50/80 grid grid-cols-[auto_1fr_1fr_1fr_1fr_1fr_auto]">
                <div className="px-5 py-3.5 col-span-2">
                  <span className="text-xs font-bold text-gray-700 uppercase tracking-wider">Total ({filtered.length} accounts)</span>
                </div>
                <div className="px-5 py-3.5 text-right text-xs text-gray-400">—</div>
                <div className="px-5 py-3.5 text-right font-bold text-gray-900">{fmtAmt(totalDebit)}</div>
                <div className="px-5 py-3.5 text-right font-bold text-gray-900">{fmtAmt(totalCredit)}</div>
                <div className={`px-5 py-3.5 text-right font-bold ${amtClass(totalClosing)}`}>{fmtAmt(totalClosing)}</div>
                <div />
              </div>
            )
          })()}
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <LedgerDetailDrawer
          account={selected}
          outletId={outletId!}
          from={from}
          to={to}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  )
}
