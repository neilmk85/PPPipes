import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Printer, Download, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react'
import axios from 'axios'
import QRCode from 'qrcode'
import { DEFAULT_INVOICE_TEMPLATE, InvoiceTemplateConfig } from '@/pages/settings/SettingsPage'

function fmtDateLocal(d: string | null | undefined) {
  if (!d) return '—'
  const clean = d.substring(0, 10)
  const [y, m, day] = clean.split('-')
  if (!y || !m || !day) return d
  return `${day}/${m}/${y}`
}

function fmtTimeLocal(d: string | null | undefined) {
  if (!d) return ''
  try {
    return new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  } catch { return '' }
}

export default function InvoiceViewPage() {
  const { invoiceNumber } = useParams<{ invoiceNumber: string }>()
  const [invoice, setInvoice] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')

  useEffect(() => {
    axios.get(`/api/invoices/public/${invoiceNumber}`)
      .then(r => setInvoice(r.data.data))
      .catch(() => setError('Invoice not found or no longer available.'))
      .finally(() => setLoading(false))
  }, [invoiceNumber])

  useEffect(() => {
    if (!invoiceNumber) return
    const url = `https://system.pppipeproducts.com/invoice/${invoiceNumber}`
    QRCode.toDataURL(url, { width: 96, margin: 1, color: { dark: '#1e497d', light: '#ffffff' } })
      .then(setQrDataUrl)
  }, [invoiceNumber])

  if (loading) return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <Loader2 size={28} className="animate-spin text-blue-500" />
    </div>
  )

  if (error || !invoice) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-3 text-gray-500">
      <AlertCircle size={40} className="text-red-400" />
      <p className="text-base font-medium">{error || 'Invoice not found'}</p>
    </div>
  )

  // ── Parse template config from outlet ──────────────────────────────────────
  let tpl: InvoiceTemplateConfig = DEFAULT_INVOICE_TEMPLATE
  try {
    if (invoice.outlet?.invoiceTemplate) {
      tpl = { ...DEFAULT_INVOICE_TEMPLATE, ...JSON.parse(invoice.outlet.invoiceTemplate) }
    }
  } catch { /* use default */ }

  const fmt = (n: any) => `₹${Number(n ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  const subtotal  = Number(invoice.subtotal      ?? 0)
  const discount  = Number(invoice.discountAmount ?? 0)
  const tax       = Number(invoice.taxAmount      ?? 0)
  const total     = Number(invoice.totalAmount    ?? 0)
  const paid      = Number(invoice.paidAmount     ?? 0)
  const due       = total - paid
  const invItems: any[] = invoice.items ?? []

  // GST label
  const taxRates  = [...new Set(invItems.map((i: any) => Number(i.taxRate ?? 0)).filter(r => r > 0))]
  const gstLabel  = taxRates.length === 1 ? `GST (${taxRates[0]}%)` : 'GST'

  // Rounding
  const roundedTotal = Math.round(total)
  const roundOff     = parseFloat((roundedTotal - total).toFixed(2))

  const outlet = invoice.outlet ?? {}

  const STATUS_COLORS: Record<string, string> = {
    PAID:      'bg-green-50 text-green-700 border-green-200',
    PARTIAL:   'bg-yellow-50 text-yellow-700 border-yellow-200',
    OVERDUE:   'bg-red-50 text-red-600 border-red-200',
    SENT:      'bg-blue-50 text-blue-600 border-blue-200',
    DRAFT:     'bg-gray-100 text-gray-500 border-gray-200',
    CANCELLED: 'bg-gray-100 text-gray-400 border-gray-200',
  }

  // Column visibility
  const showHsn  = tpl.showHsn
  const showTax  = tpl.showTaxRate
  const showDisc = tpl.showDiscPercent

  // ── Header styles per layout ───────────────────────────────────────────────
  const headerStyle = tpl.layout === 'minimal'
    ? { background: '#ffffff', borderBottom: '2px solid #111' }
    : { background: tpl.primaryColor }

  const headerTextClass = tpl.layout === 'minimal' ? 'text-gray-900' : 'text-white'
  const headerSubClass  = tpl.layout === 'minimal' ? 'text-gray-500' : 'text-white/70'
  const thBg            = tpl.layout === 'minimal' ? 'bg-white border-b-2 border-gray-800' : 'bg-gray-50'

  return (
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      {/* Toolbar */}
      <div className="max-w-3xl mx-auto mb-4 flex items-center justify-between print:hidden">
        <div>
          <p className="text-sm text-gray-500">Invoice</p>
          <p className="text-lg font-bold text-gray-900">{invoice.invoiceNumber}</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 shadow-sm">
            <Printer size={15} /> Print
          </button>
          <button onClick={() => window.print()}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium shadow-sm hover:opacity-90"
            style={{ background: tpl.accentColor }}>
            <Download size={15} /> Save as PDF
          </button>
        </div>
      </div>

      {/* Invoice card */}
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-sm overflow-hidden print:shadow-none print:rounded-none print:max-w-full">

        {/* ── Header ── */}
        <div className="px-8 py-7 flex items-start justify-between" style={headerStyle}>
          <div>
            {tpl.showLogo && tpl.logoUrl
              ? <img src={tpl.logoUrl} alt="Logo" className="h-10 object-contain mb-2" />
              : null}
            <div className={`text-2xl font-black tracking-tight ${headerTextClass}`}>
              {tpl.layout === 'classic' ? 'TAX INVOICE' : 'INVOICE'}
            </div>
            <div className={`text-sm mt-1 ${headerSubClass}`}>{invoice.invoiceNumber}</div>
            {outlet.name && <div className={`text-xs mt-0.5 ${headerSubClass}`}>{outlet.name}</div>}
          </div>
          <div className="text-right">
            <span className={`text-xs font-bold px-3 py-1 rounded-full border ${STATUS_COLORS[invoice.status] ?? STATUS_COLORS.DRAFT}`}>
              {invoice.status}
            </span>
            {tpl.showIssueDate !== false && (
              <div className={`text-xs mt-2 ${headerSubClass}`}>
                {fmtDateLocal(invoice.issueDate)}
                {tpl.showTime && <span className="ml-1 opacity-70">{fmtTimeLocal(invoice.createdAt ?? invoice.issueDate)}</span>}
              </div>
            )}
          </div>
        </div>

        {/* ── Meta strip ── */}
        {(() => {
          const showDueDateCell   = tpl.showDueDate !== false
          const extraCols = (showDueDateCell ? 1 : 0) + (outlet.gstin ? 1 : 0)
          const cols = `grid-cols-${1 + extraCols}`
          return (
            <div className={`grid border-b border-gray-100 ${cols}`}>
              <div className="px-6 py-4 border-r border-gray-100">
                <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Bill To</p>
                <p className="text-sm font-semibold text-gray-900">{invoice.customer?.name ?? 'Walk-in Customer'}</p>
                {invoice.customer?.phone && <p className="text-xs text-gray-400 mt-0.5">{invoice.customer.phone}</p>}
                {invoice.customer?.gstin && <p className="text-xs text-gray-400 font-mono mt-0.5">GSTIN: {invoice.customer.gstin}</p>}
              </div>
              {showDueDateCell && (
                <div className={`px-6 py-4 ${outlet.gstin ? 'border-r border-gray-100' : ''}`}>
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Due Date</p>
                  <p className="text-sm font-semibold text-gray-900">{fmtDateLocal(invoice.dueDate)}</p>
                </div>
              )}
              {outlet.gstin && (
                <div className="px-6 py-4">
                  <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">GSTIN</p>
                  <p className="text-sm font-semibold font-mono text-gray-900">{outlet.gstin}</p>
                </div>
              )}
            </div>
          )
        })()}

        {/* ── Items table ── */}
        <div className="px-8 py-6">
          <table className="w-full">
            <thead>
              <tr className={thBg}>
                <th className="px-3 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">Product</th>
                {showHsn  && <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">HSN</th>}
                <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">Qty</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Price</th>
                {showDisc && <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">Disc%</th>}
                {showTax  && <th className="px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-gray-500">Tax%</th>}
                <th className="px-3 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {invItems.map((item: any, i: number) => (
                <tr key={i}>
                  <td className="px-3 py-3">
                    <p className="text-sm font-medium text-gray-900">{item.productName}</p>
                    {item.productSku && <p className="text-[11px] font-mono text-gray-400 mt-0.5">{item.productSku}</p>}
                  </td>
                  {showHsn && (
                    <td className="px-3 py-3 text-center text-sm text-gray-400 font-mono">
                      {item.product?.taxGroup?.hsnCode ?? '—'}
                    </td>
                  )}
                  <td className="px-3 py-3 text-center text-sm text-gray-700">{Number(item.quantity)}</td>
                  <td className="px-3 py-3 text-right text-sm text-gray-600">{fmt(item.unitPrice)}</td>
                  {showDisc && (
                    <td className="px-3 py-3 text-center text-sm text-gray-400">
                      {Number(item.discountPercent ?? 0) > 0 ? item.discountPercent + '%' : '—'}
                    </td>
                  )}
                  {showTax && (
                    <td className="px-3 py-3 text-center text-sm text-gray-400">
                      {Number(item.taxRate ?? 0) > 0 ? item.taxRate + '%' : '—'}
                    </td>
                  )}
                  <td className="px-3 py-3 text-right text-sm font-semibold text-gray-900">{fmt(item.lineTotal)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ── Totals ── */}
        <div className="px-8 pb-6 flex justify-end">
          <div className="w-64 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Subtotal</span><span>{fmt(subtotal)}</span>
            </div>
            {discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount</span><span>−{fmt(discount)}</span>
              </div>
            )}
            {tax > 0 && (
              <div className="flex justify-between text-sm text-gray-600">
                <span>{gstLabel}</span><span>{fmt(tax)}</span>
              </div>
            )}
            {roundOff !== 0 && (
              <div className="flex justify-between text-sm text-gray-400">
                <span>Round Off</span>
                <span>{roundOff > 0 ? '+' : ''}{fmt(roundOff)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-2 border-t-2 border-gray-900">
              <span>Total</span><span>{fmt(roundedTotal)}</span>
            </div>
            {paid > 0 && (
              <div className="flex justify-between text-sm font-semibold text-green-600">
                <span>Paid</span><span>{fmt(paid)}</span>
              </div>
            )}
            {due > 0.01 && (
              <div className="flex justify-between text-sm font-bold text-red-600">
                <span>Balance Due</span><span>{fmt(due)}</span>
              </div>
            )}
          </div>
        </div>

        {/* ── Bank Details ── */}
        {tpl.bankDetails && (
          <div className="px-8 py-4 border-t border-gray-100 grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Bank Details</p>
              <p className="text-xs text-gray-600 whitespace-pre-wrap font-mono">{tpl.bankDetails}</p>
            </div>
            {tpl.showSignatureLine && (
              <div className="flex flex-col items-end justify-end">
                <div className="border-t border-gray-400 pt-2 text-center w-40">
                  <p className="text-xs text-gray-500">For {outlet.name}</p>
                  <p className="text-[10px] text-gray-400 mt-1">Authorised Signatory</p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Signature only (no bank details) ── */}
        {!tpl.bankDetails && tpl.showSignatureLine && (
          <div className="px-8 py-4 border-t border-gray-100 flex justify-end">
            <div className="border-t border-gray-400 pt-2 text-center w-40">
              <p className="text-xs text-gray-500">For {outlet.name}</p>
              <p className="text-[10px] text-gray-400 mt-1">Authorised Signatory</p>
            </div>
          </div>
        )}

        {/* ── Terms ── */}
        {tpl.terms && (
          <div className="px-8 py-4 border-t border-gray-100">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-1">Terms & Conditions</p>
            <p className="text-xs text-gray-500 whitespace-pre-wrap">{tpl.terms}</p>
          </div>
        )}

        {/* ── QR + Verification ── */}
        <div className="px-8 py-4 border-t border-gray-100 flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={16} className="text-green-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-xs font-semibold text-green-700">Computer-Generated Invoice</p>
              <p className="text-[10px] text-gray-400 mt-0.5 leading-relaxed">
                This is a computer-generated invoice issued by {outlet.name ?? 'P&P Pipe Products Pvt. Ltd.'}<br />
                and does not require a physical signature.
              </p>
            </div>
          </div>
          {qrDataUrl && (
            <div className="flex flex-col items-center shrink-0">
              <img src={qrDataUrl} alt="Scan to verify" className="w-16 h-16" />
              <p className="text-[9px] text-gray-400 mt-0.5">Scan to verify</p>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="px-8 py-4 border-t border-gray-100 text-center" style={{ background: tpl.primaryColor + '0d' }}>
          <p className="text-xs text-gray-500">{tpl.thankYouMessage || 'Thank you for your business!'}</p>
          {tpl.footerNote && <p className="text-[10px] text-gray-400 mt-0.5">{tpl.footerNote}</p>}
          {outlet.address && <p className="text-[10px] text-gray-400 mt-1">{outlet.address}{outlet.city ? `, ${outlet.city}` : ''}</p>}
          {outlet.phone  && <p className="text-[10px] text-gray-400">Ph: {outlet.phone}</p>}
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          body { background: white !important; padding: 0 !important; }
          .print\\:hidden { display: none !important; }
        }
      `}</style>
    </div>
  )
}
