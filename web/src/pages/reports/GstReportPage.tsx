import { useState, useEffect } from 'react'
import { format, startOfMonth, endOfMonth } from 'date-fns'
import {
  Download, RefreshCw, Loader2, ChevronDown, ChevronUp,
  FileSpreadsheet, Info, CheckCircle2, Receipt,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { gstApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import { DateRangePicker } from '@/components/DateRangePicker'

type Tab = 'gstr1' | 'gstr3b' | 'hsn' | 'tally'

const TABS: { key: Tab; label: string }[] = [
  { key: 'gstr1', label: 'GSTR-1' },
  { key: 'gstr3b', label: 'GSTR-3B' },
  { key: 'hsn', label: 'HSN Summary' },
  { key: 'tally', label: 'Tally Export' },
]

function fmt(v: any) {
  if (v == null) return '—'
  const n = Number(v)
  return isNaN(n) ? String(v) : `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function num(v: any) {
  if (v == null) return '—'
  const n = Number(v)
  return isNaN(n) ? String(v) : n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function dmy(iso: string) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return d && m && y ? `${d}/${m}/${y}` : iso
}

async function triggerDownload(promise: Promise<any>, filename: string) {
  const res = await promise
  const mime = filename.endsWith('.xml') ? 'application/xml' : 'text/csv'
  const url = URL.createObjectURL(new Blob([res.data], { type: mime }))
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

export default function GstReportPage() {
  const { outletId } = useAuthStore()
  const [tab, setTab] = useState<Tab>('gstr1')

  // Period: default to current month
  const [from, setFrom] = useState(format(startOfMonth(new Date()), 'yyyy-MM-dd'))
  const [to, setTo] = useState(format(endOfMonth(new Date()), 'yyyy-MM-dd'))

  const [data, setData] = useState<any>({
    totalInvoices: 47,
    totalTaxableValue: 284500,
    totalCgst: 25605,
    totalSgst: 25605,
    totalIgst: 0,
    grandTotal: 335710,
    period: 'Apr 2026',
    outletGstin: '27AABCP1234H1Z5',
    b2b: [
      { gstin: '27AABCP1234H1Z5', customerName: 'Rajesh Pipes Pvt Ltd',    invoiceNumber: 'INV-2026-001', invoiceDate: '02-Apr-2026', invoiceValue: 45000,  taxableValue: 38136, cgst: 3432, sgst: 3432, igst: 0 },
      { gstin: '29AABCP5678H1Z2', customerName: 'Bharat Fittings Co',       invoiceNumber: 'INV-2026-002', invoiceDate: '05-Apr-2026', invoiceValue: 62500,  taxableValue: 52966, cgst: 4767, sgst: 4767, igst: 0 },
      { gstin: '24AABCP9012H1Z8', customerName: 'Gujarat Plumbing Works',   invoiceNumber: 'INV-2026-003', invoiceDate: '08-Apr-2026', invoiceValue: 28750,  taxableValue: 24364, cgst: 2193, sgst: 2193, igst: 0 },
      { gstin: '27AABCP3456H1Z1', customerName: 'Nashik Hardware Supplies', invoiceNumber: 'INV-2026-004', invoiceDate: '12-Apr-2026', invoiceValue: 91200,  taxableValue: 77288, cgst: 6960, sgst: 6952, igst: 0 },
      { gstin: '27AABCP7890H1Z4', customerName: 'Pune Infra Materials',     invoiceNumber: 'INV-2026-005', invoiceDate: '15-Apr-2026', invoiceValue: 33600,  taxableValue: 28475, cgst: 2563, sgst: 2562, igst: 0 },
      { gstin: '19AABCP2345H1Z3', customerName: 'Kolkata Building Mart',    invoiceNumber: 'INV-2026-006', invoiceDate: '18-Apr-2026', invoiceValue: 74350,  taxableValue: 62500, cgst: 5625, sgst: 0,    igst: 11250 },
    ],
    b2cs: [
      { taxRate: 18, taxableValue: 45678, cgst: 4111, sgst: 4111, igst: 0 },
      { taxRate: 12, taxableValue: 17250, cgst: 1035, sgst: 1035, igst: 0 },
      { taxRate: 5,  taxableValue:  8900, cgst:  222, sgst:  223, igst: 0 },
    ],
    hsnSummary: [
      { hsnCode: '3917', description: 'PVC Pipes & Tubes',  uom: 'MTR', totalQuantity: 850,  taxableValue: 127500, cgst: 11475, sgst: 11475, totalTax: 22950 },
      { hsnCode: '3926', description: 'UPVC Fittings',      uom: 'NOS', totalQuantity: 1240, taxableValue:  89600, cgst:  8064, sgst:  8064, totalTax: 16128 },
      { hsnCode: '7307', description: 'GI Pipe Fittings',   uom: 'NOS', totalQuantity: 420,  taxableValue:  52800, cgst:  4752, sgst:  4752, totalTax:  9504 },
      { hsnCode: '3916', description: 'HDPE Pipes',         uom: 'MTR', totalQuantity: 320,  taxableValue:  14600, cgst:  1314, sgst:  1314, totalTax:  2628 },
    ],
  })
  const [hsnPurchaseData, setHsnPurchaseData] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [b2bExpanded, setB2bExpanded] = useState(true)
  const [b2csExpanded, setB2csExpanded] = useState(true)
  const [hsnExpanded, setHsnExpanded] = useState(true)

  async function fetchData() {
    if (!outletId || tab === 'tally') return
    setLoading(true)
    setLoadError(false)
    try {
      if (tab === 'gstr1') {
        const res = await gstApi.getGstr1(outletId, from, to)
        setData(res.data.data ?? null)
      } else if (tab === 'gstr3b') {
        const res = await gstApi.getGstr3b(outletId, from, to)
        setData(res.data.data ?? null)
      } else if (tab === 'hsn') {
        const [saleRes, purchaseRes] = await Promise.all([
          gstApi.getHsnSummary(outletId, from, to),
          gstApi.getHsnPurchaseSummary(outletId, from, to),
        ])
        setData(saleRes.data.data ?? null)
        setHsnPurchaseData(purchaseRes.data.data ?? [])
      }
    } catch {
      setLoadError(true)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [tab, from, to, outletId])

  async function handleExport(type: 'gstr1' | 'gstr3b' | 'hsn' | 'hsn-purchase' | 'tally') {
    if (!outletId) return
    setExporting(true)
    try {
      if (type === 'gstr1') {
        await triggerDownload(gstApi.exportGstr1Csv(outletId, from, to), `GSTR1_${from}_${to}.csv`)
      } else if (type === 'gstr3b') {
        await triggerDownload(gstApi.exportGstr3bCsv(outletId, from, to), `GSTR3B_${from}_${to}.csv`)
      } else if (type === 'hsn') {
        await triggerDownload(gstApi.exportHsnCsv(outletId, from, to), `HSN_Summary_${from}_${to}.csv`)
      } else if (type === 'hsn-purchase') {
        await triggerDownload(gstApi.exportHsnPurchaseCsv(outletId, from, to), `HSN_Purchase_${from}_${to}.csv`)
      } else if (type === 'tally') {
        await triggerDownload(gstApi.tallyExport(outletId, from, to), `Tally_Export_${from}_${to}.xml`)
      }
      toast.success('File downloaded')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  // ── GSTR-1 view ────────────────────────────────────────────────────────────

  const Gstr1View = () => {
    const hasData = data !== null
    const b2b: any[] = data?.b2b || []
    const b2cs: any[] = data?.b2cs || []
    const hsn: any[] = data?.hsnSummary || []

    const placeholder = (cols: number) => (
      <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-gray-400">
        {loading ? 'Loading…' : 'No data for this period'}
      </td></tr>
    )

    return (
      <div className="space-y-5">
        {/* Info row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Info size={13} />
            {hasData
              ? <><span>Total invoices: <strong>{data.totalInvoices}</strong> | Period: <strong>{data.period}</strong></span>
                  {data.outletGstin && <span>| GSTIN: <strong className="font-mono">{data.outletGstin}</strong></span>}</>
              : <span>No data for the selected period</span>
            }
          </div>
        </div>

        {/* B2B Section */}
        <div className="rounded-xl overflow-hidden shadow-lg">
          <button onClick={() => setB2bExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-400 to-blue-400 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">B2B — Registered Business Customers (GSTIN)</span>
              {hasData && <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">{b2b.length} invoices</span>}
            </div>
            {b2bExpanded ? <ChevronUp size={15} className="text-white/70" /> : <ChevronDown size={15} className="text-white/70" />}
          </button>
          {b2bExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">GSTIN</th>
                    <th className="px-3 py-2 text-left">Customer</th>
                    <th className="px-3 py-2 text-left">Invoice #</th>
                    <th className="px-3 py-2 text-left">Date</th>
                    <th className="px-3 py-2 text-right">Invoice Value</th>
                    <th className="px-3 py-2 text-right">Taxable</th>
                    <th className="px-3 py-2 text-right">CGST</th>
                    <th className="px-3 py-2 text-right">SGST</th>
                    <th className="px-3 py-2 text-right">IGST</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!hasData || b2b.length === 0 ? placeholder(9) : b2b.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono text-gray-600">{row.gstin}</td>
                      <td className="px-3 py-2 text-gray-800 font-medium">{row.customerName}</td>
                      <td className="px-3 py-2 text-gray-600">{row.invoiceNumber}</td>
                      <td className="px-3 py-2 text-gray-500">{row.invoiceDate}</td>
                      <td className="px-3 py-2 text-right font-semibold">{num(row.invoiceValue)}</td>
                      <td className="px-3 py-2 text-right">{num(row.taxableValue)}</td>
                      <td className="px-3 py-2 text-right text-blue-700">{num(row.cgst)}</td>
                      <td className="px-3 py-2 text-right text-green-700">{num(row.sgst)}</td>
                      <td className="px-3 py-2 text-right text-purple-700">{num(row.igst)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* B2CS Section */}
        <div className="rounded-xl overflow-hidden shadow-lg">
          <button onClick={() => setB2csExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-400 to-blue-400 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">B2CS — Unregistered Customers (Aggregate)</span>
              {hasData && <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">{b2cs.length} tax slab{b2cs.length !== 1 ? 's' : ''}</span>}
            </div>
            {b2csExpanded ? <ChevronUp size={15} className="text-white/70" /> : <ChevronDown size={15} className="text-white/70" />}
          </button>
          {b2csExpanded && (
            <table className="w-full text-xs">
              <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2 text-left">GST Rate %</th>
                  <th className="px-4 py-2 text-right">Taxable Value</th>
                  <th className="px-4 py-2 text-right">CGST</th>
                  <th className="px-4 py-2 text-right">SGST</th>
                  <th className="px-4 py-2 text-right">IGST</th>
                  <th className="px-4 py-2 text-right">Total Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!hasData || b2cs.length === 0 ? placeholder(6) : b2cs.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-semibold text-gray-800">{row.taxRate}%</td>
                    <td className="px-4 py-2 text-right">{num(row.taxableValue)}</td>
                    <td className="px-4 py-2 text-right text-blue-700">{num(row.cgst)}</td>
                    <td className="px-4 py-2 text-right text-green-700">{num(row.sgst)}</td>
                    <td className="px-4 py-2 text-right text-purple-700">{num(row.igst)}</td>
                    <td className="px-4 py-2 text-right font-semibold">
                      {num(Number(row.cgst) + Number(row.sgst) + Number(row.igst))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Inline HSN summary */}
        <div className="rounded-xl overflow-hidden shadow-lg">
          <button onClick={() => setHsnExpanded(v => !v)}
            className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-violet-400 to-blue-400 transition-colors">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-white">HSN / SAC Summary</span>
              {hasData && <span className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">{hsn.length} code{hsn.length !== 1 ? 's' : ''}</span>}
            </div>
            {hsnExpanded ? <ChevronUp size={15} className="text-white/70" /> : <ChevronDown size={15} className="text-white/70" />}
          </button>
          {hsnExpanded && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 text-[10px] text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left">HSN Code</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">UOM</th>
                    <th className="px-3 py-2 text-right">Qty</th>
                    <th className="px-3 py-2 text-right">Taxable</th>
                    <th className="px-3 py-2 text-right">CGST</th>
                    <th className="px-3 py-2 text-right">SGST</th>
                    <th className="px-3 py-2 text-right">Total Tax</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {!hasData || hsn.length === 0 ? placeholder(8) : hsn.map((row, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2 font-mono font-semibold text-gray-800">{row.hsnCode}</td>
                      <td className="px-3 py-2 text-gray-600 max-w-[160px] truncate">{row.description}</td>
                      <td className="px-3 py-2 text-gray-500">{row.uom}</td>
                      <td className="px-3 py-2 text-right">{num(row.totalQuantity)}</td>
                      <td className="px-3 py-2 text-right">{num(row.taxableValue)}</td>
                      <td className="px-3 py-2 text-right text-blue-700">{num(row.cgst)}</td>
                      <td className="px-3 py-2 text-right text-green-700">{num(row.sgst)}</td>
                      <td className="px-3 py-2 text-right font-semibold">{num(row.totalTax)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── GSTR-3B view ───────────────────────────────────────────────────────────

  const Gstr3bView = () => {
    const hasData = data !== null
    const s31 = data?.section3_1_taxable || {}
    const itc = data?.section4_itc || {}
    const net = data?.netTaxPayable || {}
    const carry = data?.itcCarryForward || {}
    const hasCarry = hasData && Number(carry.total ?? 0) > 0
    const d = (v: any) => hasData ? num(v) : '—'

    return (
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <Info size={13} />
            {hasData
              ? <><span>Period: <strong>{data.period}</strong> | Outlet: <strong>{data.outletName}</strong></span>
                  {data.outletGstin && <span>| GSTIN: <strong className="font-mono">{data.outletGstin}</strong></span>}
                  {data.billCount > 0 && <span className="text-emerald-600">| ITC from <strong>{data.billCount}</strong> purchase bill{data.billCount !== 1 ? 's' : ''}</span>}</>
              : <span>No data for the selected period</span>
            }
          </div>
        </div>

        {/* Section 3.1 */}
        <div className="bg-white rounded-xl overflow-hidden shadow-lg">
          <div className="px-4 py-3 bg-gradient-to-r from-violet-400 to-blue-400">
            <h3 className="text-sm font-semibold text-white">3.1 — Details of Outward Supplies and Inward Supplies liable to reverse charge</h3>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left w-8">#</th>
                <th className="px-4 py-2 text-left">Nature of Supplies</th>
                <th className="px-4 py-2 text-right">Total Taxable Value</th>
                <th className="px-4 py-2 text-right">Integrated Tax</th>
                <th className="px-4 py-2 text-right">Central Tax</th>
                <th className="px-4 py-2 text-right">State/UT Tax</th>
                <th className="px-4 py-2 text-right">Cess</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <tr className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 text-xs">(a)</td>
                <td className="px-4 py-3 text-gray-700">Outward taxable supplies (other than zero rated, nil and exempted)</td>
                <td className="px-4 py-3 text-right font-semibold">{d(s31.taxableValue)}</td>
                <td className="px-4 py-3 text-right text-purple-700">{d(s31.igst)}</td>
                <td className="px-4 py-3 text-right text-blue-700">{d(s31.cgst)}</td>
                <td className="px-4 py-3 text-right text-green-700">{d(s31.sgst)}</td>
                <td className="px-4 py-3 text-right text-gray-500">{d(s31.cess)}</td>
              </tr>
              <tr className="text-gray-400 hover:bg-gray-50">
                <td className="px-4 py-3 text-xs">(b)</td>
                <td className="px-4 py-3">Outward taxable supplies (zero rated)</td>
                <td className="px-4 py-3 text-right">0.00</td>
                <td className="px-4 py-3 text-right">0.00</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right">0.00</td>
              </tr>
              <tr className="text-gray-400 hover:bg-gray-50">
                <td className="px-4 py-3 text-xs">(c)</td>
                <td className="px-4 py-3">Other outward supplies (nil rated, exempted)</td>
                <td className="px-4 py-3 text-right">0.00</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right">—</td>
                <td className="px-4 py-3 text-right">—</td>
              </tr>
              <tr className="text-gray-400 hover:bg-gray-50">
                <td className="px-4 py-3 text-xs">(d)</td>
                <td className="px-4 py-3">Inward supplies (liable to reverse charge)</td>
                <td className="px-4 py-3 text-right">0.00</td>
                <td className="px-4 py-3 text-right">0.00</td>
                <td className="px-4 py-3 text-right">0.00</td>
                <td className="px-4 py-3 text-right">0.00</td>
                <td className="px-4 py-3 text-right">0.00</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Section 4 — ITC */}
        <div className="bg-white rounded-xl overflow-hidden shadow-lg">
          <div className="px-4 py-3 bg-gradient-to-r from-violet-400 to-blue-400">
            <h3 className="text-sm font-semibold text-white">4 — Eligible ITC (Input Tax Credit)</h3>
            <p className="text-xs text-blue-100 mt-0.5">ITC from purchase invoices — link your purchase bills with tax details to populate this section automatically.</p>
          </div>
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
              <tr>
                <th className="px-4 py-2 text-left">Description</th>
                <th className="px-4 py-2 text-right">Integrated Tax</th>
                <th className="px-4 py-2 text-right">Central Tax</th>
                <th className="px-4 py-2 text-right">State/UT Tax</th>
                <th className="px-4 py-2 text-right">Cess</th>
              </tr>
            </thead>
            <tbody>
              <tr className="text-gray-400">
                <td className="px-4 py-3">4(A)(5) — All other ITC (from purchase bills)</td>
                <td className="px-4 py-3 text-right">{d(itc.igst)}</td>
                <td className="px-4 py-3 text-right">{d(itc.cgst)}</td>
                <td className="px-4 py-3 text-right">{d(itc.sgst)}</td>
                <td className="px-4 py-3 text-right">{d(itc.cess)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Net Tax Payable */}
        <div className="bg-white border rounded-xl p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Net Tax Payable (Output Tax − ITC)</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {[
              { label: 'IGST', value: net.igst, gradient: 'bg-gradient-to-br from-violet-400 to-violet-600' },
              { label: 'CGST', value: net.cgst, gradient: 'bg-gradient-to-br from-blue-400 to-blue-600' },
              { label: 'SGST/UTGST', value: net.sgst, gradient: 'bg-gradient-to-br from-teal-400 to-teal-600' },
              { label: 'Cess', value: net.cess, gradient: 'bg-gradient-to-br from-slate-400 to-slate-600' },
              { label: 'Total Tax', value: net.total, gradient: 'bg-gradient-to-br from-indigo-500 to-indigo-700' },
            ].map(c => (
              <div key={c.label} className={`${c.gradient} rounded-lg p-3 text-center shadow-sm`}>
                <p className="font-bold text-white">{hasData ? num(c.value) : '—'}</p>
                <p className="text-xs text-white/70 mt-0.5">{c.label}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── HSN Summary view ───────────────────────────────────────────────────────

  const HsnView = () => {
    const saleRows: any[] = Array.isArray(data) ? data : []
    const purchaseRows: any[] = Array.isArray(hsnPurchaseData) ? hsnPurchaseData : []
    const hasData = data !== null

    const saleTaxable = saleRows.reduce((s, r) => s + Number(r.taxableValue || 0), 0)
    const saleCgst = saleRows.reduce((s, r) => s + Number(r.cgst || 0), 0)
    const saleSgst = saleRows.reduce((s, r) => s + Number(r.sgst || 0), 0)
    const saleTax = saleRows.reduce((s, r) => s + Number(r.totalTax || 0), 0)

    const purTaxable = purchaseRows.reduce((s, r) => s + Number(r.taxableValue || 0), 0)
    const purCgst = purchaseRows.reduce((s, r) => s + Number(r.cgst || 0), 0)
    const purSgst = purchaseRows.reduce((s, r) => s + Number(r.sgst || 0), 0)
    const purTax = purchaseRows.reduce((s, r) => s + Number(r.totalTax || 0), 0)

    const PlaceholderRow = ({ cols }: { cols: number }) => (
      <tr>
        <td colSpan={cols} className="px-4 py-12 text-center text-gray-400 text-sm">
          {loading ? 'Loading…' : 'No HSN data for this period'}
        </td>
      </tr>
    )

    return (
      <div className="space-y-6">
        {/* ── HSN Sale Report ── */}
        <div className="rounded-xl overflow-hidden shadow-lg">
          <div className="px-4 py-3 bg-gradient-to-r from-violet-400 to-blue-400">
            <span className="text-sm font-semibold text-white">HSN Sale Report</span>
          </div>
          <div className="bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">HSN/SAC Code</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">UOM</th>
                  <th className="px-4 py-3 text-right">Total Qty</th>
                  <th className="px-4 py-3 text-right">Total Value</th>
                  <th className="px-4 py-3 text-right">Taxable Value</th>
                  <th className="px-4 py-3 text-right">CGST</th>
                  <th className="px-4 py-3 text-right">SGST</th>
                  <th className="px-4 py-3 text-right">IGST</th>
                  <th className="px-4 py-3 text-right">Total Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!hasData || saleRows.length === 0 ? (
                  <PlaceholderRow cols={10} />
                ) : (
                  <>
                    {saleRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-800">{row.hsnCode}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate" title={row.description}>{row.description}</td>
                        <td className="px-4 py-3 text-gray-500">{row.uom}</td>
                        <td className="px-4 py-3 text-right">{num(row.totalQuantity)}</td>
                        <td className="px-4 py-3 text-right">{num(row.totalValue)}</td>
                        <td className="px-4 py-3 text-right font-medium">{num(row.taxableValue)}</td>
                        <td className="px-4 py-3 text-right text-blue-700">{num(row.cgst)}</td>
                        <td className="px-4 py-3 text-right text-green-700">{num(row.sgst)}</td>
                        <td className="px-4 py-3 text-right text-purple-700">{num(row.igst)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{num(row.totalTax)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold text-sm">
                      <td className="px-4 py-3 text-gray-700" colSpan={3}>Total</td>
                      <td className="px-4 py-3 text-right">—</td>
                      <td className="px-4 py-3 text-right">{num(saleRows.reduce((s, r) => s + Number(r.totalValue || 0), 0))}</td>
                      <td className="px-4 py-3 text-right">{num(saleTaxable)}</td>
                      <td className="px-4 py-3 text-right text-blue-700">{num(saleCgst)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{num(saleSgst)}</td>
                      <td className="px-4 py-3 text-right text-purple-700">0.00</td>
                      <td className="px-4 py-3 text-right">{num(saleTax)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── HSN Purchase Report ── */}
        <div className="rounded-xl overflow-hidden shadow-lg">
          <div className="px-4 py-3 bg-gradient-to-r from-violet-400 to-blue-400">
            <span className="text-sm font-semibold text-white">HSN Purchase Report</span>
          </div>
          <div className="bg-white">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-3 text-left">HSN/SAC Code</th>
                  <th className="px-4 py-3 text-left">Description</th>
                  <th className="px-4 py-3 text-left">UOM</th>
                  <th className="px-4 py-3 text-right">Ordered Qty</th>
                  <th className="px-4 py-3 text-right">Received Qty</th>
                  <th className="px-4 py-3 text-right">Total Value</th>
                  <th className="px-4 py-3 text-right">Taxable Value</th>
                  <th className="px-4 py-3 text-right">CGST</th>
                  <th className="px-4 py-3 text-right">SGST</th>
                  <th className="px-4 py-3 text-right">Total Tax</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {!hasData || purchaseRows.length === 0 ? (
                  <PlaceholderRow cols={10} />
                ) : (
                  <>
                    {purchaseRows.map((row, i) => (
                      <tr key={i} className="hover:bg-gray-50">
                        <td className="px-4 py-3 font-mono font-semibold text-gray-800">{row.hsnCode}</td>
                        <td className="px-4 py-3 text-gray-600 max-w-[180px] truncate" title={row.description}>{row.description}</td>
                        <td className="px-4 py-3 text-gray-500">{row.uom}</td>
                        <td className="px-4 py-3 text-right">{num(row.totalOrderedQty)}</td>
                        <td className="px-4 py-3 text-right">{num(row.totalReceivedQty)}</td>
                        <td className="px-4 py-3 text-right">{num(row.totalValue)}</td>
                        <td className="px-4 py-3 text-right font-medium">{num(row.taxableValue)}</td>
                        <td className="px-4 py-3 text-right text-blue-700">{num(row.cgst)}</td>
                        <td className="px-4 py-3 text-right text-green-700">{num(row.sgst)}</td>
                        <td className="px-4 py-3 text-right font-semibold">{num(row.totalTax)}</td>
                      </tr>
                    ))}
                    <tr className="bg-gray-50 font-semibold text-sm">
                      <td className="px-4 py-3 text-gray-700" colSpan={3}>Total</td>
                      <td className="px-4 py-3 text-right">{num(purchaseRows.reduce((s, r) => s + Number(r.totalOrderedQty || 0), 0))}</td>
                      <td className="px-4 py-3 text-right">{num(purchaseRows.reduce((s, r) => s + Number(r.totalReceivedQty || 0), 0))}</td>
                      <td className="px-4 py-3 text-right">{num(purchaseRows.reduce((s, r) => s + Number(r.totalValue || 0), 0))}</td>
                      <td className="px-4 py-3 text-right">{num(purTaxable)}</td>
                      <td className="px-4 py-3 text-right text-blue-700">{num(purCgst)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{num(purSgst)}</td>
                      <td className="px-4 py-3 text-right">{num(purTax)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    )
  }

  // ── Tally Export view ──────────────────────────────────────────────────────

  const TallyView = () => (
    <div className="space-y-5">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">About Tally Export</p>
            <p className="text-sm text-amber-700 mt-1">
              This generates a Tally-compatible XML file containing all completed sales vouchers for the selected period.
              The XML follows the standard Tally TDL import format supported by Tally ERP 9 and Tally Prime.
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-4">How to import into Tally</h3>
        <ol className="space-y-3">
          {[
            { step: '1', text: 'Select the date range and click "Export Tally XML" below.' },
            { step: '2', text: 'Open Tally ERP 9 or Tally Prime and select your company.' },
            { step: '3', text: 'Go to Gateway of Tally → Import Data → Vouchers (Tally ERP 9) or Company → Import → Master & Transactions (Tally Prime).' },
            { step: '4', text: 'Browse and select the downloaded XML file.' },
            { step: '5', text: 'Ensure the following ledgers exist in Tally before importing: "Sales Account", "Output CGST X%", "Output SGST X%", "Discount Allowed", and individual customer ledgers (or "Cash").' },
            { step: '6', text: 'After import, verify vouchers in Tally under Day Book.' },
          ].map(item => (
            <li key={item.step} className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{item.step}</span>
              <p className="text-sm text-gray-700">{item.text}</p>
            </li>
          ))}
        </ol>
      </div>

      <div className="bg-white border rounded-xl p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Required Tally Ledgers</h3>
        <div className="grid grid-cols-2 gap-3 text-sm">
          {[
            { ledger: 'Sales Account', group: 'Sales Accounts', note: 'Main sales credit ledger' },
            { ledger: 'Output CGST 9%', group: 'Duties & Taxes', note: 'For 18% GST items (9% CGST)' },
            { ledger: 'Output SGST 9%', group: 'Duties & Taxes', note: 'For 18% GST items (9% SGST)' },
            { ledger: 'Output CGST 6%', group: 'Duties & Taxes', note: 'For 12% GST items (6% CGST)' },
            { ledger: 'Output SGST 6%', group: 'Duties & Taxes', note: 'For 12% GST items (6% SGST)' },
            { ledger: 'Output CGST 2.5%', group: 'Duties & Taxes', note: 'For 5% GST items (2.5% CGST)' },
            { ledger: 'Discount Allowed', group: 'Indirect Expenses', note: 'For sale discounts (if any)' },
            { ledger: 'Cash', group: 'Cash-in-hand', note: 'For walk-in / cash sales' },
          ].map(item => (
            <div key={item.ledger} className="flex items-start gap-2 border rounded-lg p-2.5">
              <CheckCircle2 size={14} className="text-green-500 shrink-0 mt-0.5" />
              <div>
                <p className="font-medium text-gray-800 text-xs">{item.ledger}</p>
                <p className="text-[10px] text-gray-500">Group: {item.group}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">{item.note}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="text-xs text-gray-400">Use the <strong>Export XML</strong> button in the header to download all completed sales for the selected period.</p>
    </div>
  )

  // ── Empty state ────────────────────────────────────────────────────────────

  const EmptyState = () => (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <FileSpreadsheet size={48} className="text-gray-200 mb-4" />
      <p className="text-gray-500 font-medium">No data for the selected period</p>
      <p className="text-gray-400 text-sm mt-1">GST data is computed from completed sales orders</p>
    </div>
  )

  // ── Stats strip data ────────────────────────────────────────────────────────

  const statStrip = (() => {
    if (!data) return [
      { label: 'Total Invoices', value: '—', sub: 'B2B + B2CS' },
      { label: 'Taxable Value', value: '—', sub: 'excl. GST' },
      { label: 'CGST', value: '—', sub: 'central tax' },
      { label: 'SGST', value: '—', sub: 'state tax' },
      { label: 'IGST', value: '—', sub: 'integrated tax' },
      { label: 'Grand Total', value: '—', sub: 'incl. all taxes' },
      { label: 'ITC Credit', value: '—', sub: 'from purchases' },
      { label: 'Net Payable', value: '—', sub: 'output − ITC' },
    ]
    if (tab === 'gstr1') return [
      { label: 'Total Invoices', value: String(data.totalInvoices ?? '—'), sub: 'B2B + B2CS' },
      { label: 'Taxable Value', value: fmt(data.totalTaxableValue), sub: 'excl. GST' },
      { label: 'CGST', value: fmt(data.totalCgst), sub: 'central tax' },
      { label: 'SGST', value: fmt(data.totalSgst), sub: 'state tax' },
      { label: 'IGST', value: fmt(data.totalIgst), sub: 'integrated tax' },
      { label: 'Grand Total', value: fmt(data.grandTotal), sub: 'incl. all taxes' },
      { label: 'ITC Credit', value: '—', sub: 'see GSTR-3B' },
      { label: 'Net Payable', value: '—', sub: 'see GSTR-3B' },
    ]
    if (tab === 'gstr3b') return [
      { label: 'Purchase Bills', value: String(data.billCount ?? 0), sub: 'ITC eligible' },
      { label: 'Gross Sales', value: fmt(data.grossSales), sub: 'total sales' },
      { label: 'CGST Output', value: fmt(data.section3_1_taxable?.cgst), sub: 'outward supply' },
      { label: 'SGST Output', value: fmt(data.section3_1_taxable?.sgst), sub: 'outward supply' },
      { label: 'IGST Output', value: fmt(data.section3_1_taxable?.igst), sub: 'outward supply' },
      { label: 'ITC CGST', value: fmt(data.section4_itc?.cgst), sub: 'input credit' },
      { label: 'ITC SGST', value: fmt(data.section4_itc?.sgst), sub: 'input credit' },
      { label: 'Net Payable', value: fmt(data.netTaxPayable?.total), sub: 'output − ITC', warn: Number(data.netTaxPayable?.total ?? 0) > 0 },
    ]
    if (tab === 'hsn') {
      const rows: any[] = Array.isArray(data) ? data : []
      const taxable = rows.reduce((s, r) => s + Number(r.taxableValue || 0), 0)
      const cgst = rows.reduce((s, r) => s + Number(r.cgst || 0), 0)
      const sgst = rows.reduce((s, r) => s + Number(r.sgst || 0), 0)
      const tax = rows.reduce((s, r) => s + Number(r.totalTax || 0), 0)
      return [
        { label: 'HSN Codes', value: String(rows.length), sub: 'sale' },
        { label: 'Taxable Value', value: fmt(taxable), sub: 'sale' },
        { label: 'CGST', value: fmt(cgst), sub: 'sale' },
        { label: 'SGST', value: fmt(sgst), sub: 'sale' },
        { label: 'Total Tax', value: fmt(tax), sub: 'sale' },
        { label: 'Purchase HSN', value: String(hsnPurchaseData.length), sub: 'purchase' },
        { label: 'Purchase Tax', value: fmt(hsnPurchaseData.reduce((s, r) => s + Number(r.totalTax || 0), 0)), sub: 'purchase' },
        { label: 'Net Tax', value: fmt(tax - hsnPurchaseData.reduce((s, r) => s + Number(r.totalTax || 0), 0)), sub: 'sale − purchase' },
      ]
    }
    return [
      { label: 'Total Invoices', value: '—', sub: '' }, { label: 'Taxable Value', value: '—', sub: '' },
      { label: 'CGST', value: '—', sub: '' }, { label: 'SGST', value: '—', sub: '' },
      { label: 'IGST', value: '—', sub: '' }, { label: 'Grand Total', value: '—', sub: '' },
      { label: 'ITC Credit', value: '—', sub: '' }, { label: 'Net Payable', value: '—', sub: '' },
    ]
  })()

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">
      {/* ── Gradient hero header ─────────────────────────────────────────── */}
      <div className="bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)] overflow-hidden">
        <div className="px-6 pt-6 pb-4">
          {/* Title row */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0">
                <Receipt size={24} className="text-amber-300" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">GST Reports</h1>
                <p className="text-sm text-white/60 mt-0.5">GSTR-1 · GSTR-3B · HSN · Tally</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {tab !== 'tally' && (
                <button
                  onClick={() => handleExport(tab === 'hsn' ? 'hsn' : tab === 'gstr3b' ? 'gstr3b' : 'gstr1')}
                  disabled={exporting || !data}
                  className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-amber-900 px-3.5 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-60 transition-all shadow-sm">
                  <Download size={11} className={exporting ? 'animate-bounce' : ''} />
                  {exporting ? 'Exporting…' : 'Export CSV'}
                </button>
              )}
              {tab === 'tally' && (
                <button
                  onClick={() => handleExport('tally')}
                  disabled={exporting}
                  className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-amber-900 px-3.5 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-60 transition-all shadow-sm">
                  <Download size={11} className={exporting ? 'animate-bounce' : ''} />
                  {exporting ? 'Exporting…' : 'Export XML'}
                </button>
              )}
              <button onClick={fetchData} disabled={loading}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 disabled:opacity-50 transition-colors">
                {loading
                  ? <Loader2 size={14} className="animate-spin text-white" />
                  : <RefreshCw size={14} className="text-white" />}
              </button>
            </div>
          </div>

          {/* Tab switcher + date filters — separate strips */}
          <div className="flex items-center justify-between gap-3">
            {/* Tabs */}
            <div className="bg-white/10 rounded-xl p-1 backdrop-blur-sm flex items-center gap-1">
              {TABS.map(t => (
                <button key={t.key} onClick={() => { setTab(t.key); setData(null) }}
                  className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tab === t.key
                      ? 'bg-white text-violet-700 shadow-sm'
                      : 'text-white/70 hover:text-white hover:bg-white/10'
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {/* Date range picker */}
            <DateRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
          </div>
        </div>

        {/* ── Stats strip ─────────────────────────────────────────────────── */}
        <div className="grid grid-cols-8 divide-x divide-white/10 border-t border-white/10 mt-2">
          {statStrip.map((s, i) => (
            <div key={i} className="px-3 py-3 text-center">
              <p className={`text-sm font-bold truncate ${(s as any).warn ? 'text-amber-300' : 'text-white'} ${loading ? 'animate-pulse' : ''}`}>
                {s.value}
              </p>
              <p className="text-[11px] text-white/50 mt-0.5 truncate">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}
      {loadError && tab !== 'tally' && (
        <div className="flex items-center gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <Info size={15} className="shrink-0 text-amber-500" />
          <span>Could not load GST data for this period. Check your backend connection or try a different date range.</span>
          <button onClick={fetchData} className="ml-auto text-xs font-semibold text-amber-700 hover:text-amber-900 underline underline-offset-2">Retry</button>
        </div>
      )}
      <div>
        {tab === 'gstr1' && <Gstr1View />}
        {tab === 'gstr3b' && <Gstr3bView />}
        {tab === 'hsn' && <HsnView />}
        {tab === 'tally' && <TallyView />}
      </div>
    </div>
  )
}
