import { useState, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, FileText, X, Loader2, ChevronLeft, ChevronRight,
  Trash2, CheckCircle, Send, Ban,
  ArrowRightCircle, Eye, Mail, ClipboardList,
  Building2, Percent, Pencil, Download, Printer,
} from 'lucide-react'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import toast from 'react-hot-toast'
import { format, addDays } from 'date-fns'
import { quotationApi, productApi, variantApi, discountApi, integrationApi, taxGroupApi, pipeConfigApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import CustomerSearchInput from '@/components/CustomerSearchInput'
import { createPortal } from 'react-dom'

const NO_SPINNER = '[appearance:textfield] [&::-webkit-inner-spin-button]:hidden [&::-webkit-outer-spin-button]:hidden'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  DRAFT:     'bg-gray-100 text-gray-600',
  SENT:      'bg-blue-50 text-blue-700',
  ACCEPTED:  'bg-green-50 text-green-700',
  REJECTED:  'bg-red-50 text-red-600',
  EXPIRED:   'bg-orange-50 text-orange-600',
  CONVERTED: 'bg-purple-50 text-purple-700',
}
const STATUS_TABS = ['ALL', 'DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CONVERTED']

// ─── Constants ────────────────────────────────────────────────────────────────

// Extract pipe length from product name — "PCCP 600mm 10kg 6.5m" → 6.5, fallback 5.25
function pipeLength(name: string): number {
  const m = name.match(/(\d+\.?\d+)m$/)
  return m ? parseFloat(m[1]) : 5.25
}

// ─── Line item type ────────────────────────────────────────────────────────────

interface LineItem {
  id: string
  productId: number | null
  productName: string
  productSku: string
  lengthM: number
  meters: number
  quantity: number
  unitPrice: number
  discountPercent: number
  taxRate: number
  autoDiscountLabel?: string
}

function calcLine(item: LineItem) {
  const base = item.meters * item.unitPrice
  const disc = base * (item.discountPercent / 100)
  const afterDisc = base - disc
  const tax = afterDisc * (item.taxRate / 100)
  return { base, disc, tax, total: afterDisc + tax }
}

// ─── PDF Builder ─────────────────────────────────────────────────────────────

const INR = (n: number) => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const HEADER_H  = 40
const CONTENT_T = 46
const FOOTER_Y  = 274
const PAGE_W    = 210

const DEFAULT_TERMS = `The pipe rates are for at Site and based on the present rates of raw materials and other inputs. Any increase in the above prices of raw materials will be paid at actuals to us plus taxes & duties applicable there on.

1) Taxes & duties :-
i) Our Price is Exclusive of GST. The prevailing rate of GST is 18%.
ii) If there is any rise in present taxes/duties, or imposition of any new taxes or any LBT/Octroi, etc. are levied on supply of PCC pipes, the same shall be made applicable and paid to us extra.
iii) The rates are including third party inspection charges.
iv) Rates are including with TCS as per Govt. norms.

2) Transportation:-
We have considered prevailing transport.
The pipes shall be transported up to motorable roads only.
Unloading of the pipes at site will be done by you at your cost.

3) Specification: The PCC pipes shall be manufactured conforming to IS 784-2019.

4) Payment:-
a) Interest free advance of 80% of total order value shall be paid to us along with confirmed order and will be adjusted in the Last Bill.
b) Remaining amount will be paid after receiving Performa-invoice.
c) We shall raise the Invoice(s)/Bill(s) every week and it will be promptly verified and cleared for payment by you.
d) All charges towards usance period interest including Letter of Credit Opening and charges towards Letter of Credit amendments, if any, shall be borne and paid by you.`

async function loadImgBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url)
    if (!res.ok) return ''
    const blob = await res.blob()
    if (!blob.type.startsWith('image/')) return ''
    return new Promise(resolve => {
      const r = new FileReader()
      r.onloadend = () => resolve(r.result as string)
      r.onerror   = () => resolve('')
      r.readAsDataURL(blob)
    })
  } catch {
    return ''
  }
}

function drawPageHeader(doc: jsPDF, logoB64: string, deityB64: string) {
  doc.setFillColor(255, 255, 255)
  doc.rect(0, 0, PAGE_W, 32, 'F')
  for (let i = 4; i <= 30; i += 4) {
    doc.setDrawColor(180, 220, 240)
    doc.setLineWidth(0.7)
    doc.line(0, i, PAGE_W, i)
  }
  if (deityB64) doc.addImage(deityB64, 'JPEG', 5,  2, 28, 28)
  if (logoB64)  doc.addImage(logoB64,  'PNG',  36, 2, 32, 28)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(0, 100, 180)
  doc.text('Pipe Products Pvt. Ltd.', 80, 22)
  doc.setFillColor(0, 82, 110)
  doc.rect(0, 32, PAGE_W, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('Manufacturer of PSC, PCCP, BWSC & RCC Pipes', PAGE_W / 2, 37.5, { align: 'center' })
  doc.setTextColor(30, 30, 30)
}

function drawPageFooter(doc: jsPDF, logoB64: string) {
  doc.setFillColor(210, 235, 248)
  doc.roundedRect(5, FOOTER_Y, PAGE_W - 10, 18, 3, 3, 'F')
  if (logoB64) doc.addImage(logoB64, 'PNG', 7, FOOTER_Y + 4, 10, 10)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(50, 50, 50)
  doc.text('Factory : Gat No. 156, At Post Hotgi, Tal. South Solapur, Dist. Solapur - 413215.', 20, FOOTER_Y + 6)
  doc.text('Office : 14/B, Asara Housing Society, Hotgi Road, Solapur - 413003.',              20, FOOTER_Y + 12)
  doc.text('Cell : 9922450055',                 150, FOOTER_Y + 6)
  doc.text('e-mail : pppipeproducts@gmail.com', 150, FOOTER_Y + 12)
  doc.setTextColor(30, 30, 30)
}

async function buildQuotationDoc(q: any): Promise<jsPDF> {
  const [logoB64, deityB64] = await Promise.all([
    loadImgBase64('/pp-logo.png'),
    loadImgBase64('/pp-deity.jpg'),
  ])
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const L = 14
  const R = 196
  const W = 182

  const dateStr = q.createdAt
    ? format(new Date(q.createdAt), 'dd-MM-yyyy')
    : format(new Date(), 'dd-MM-yyyy')

  // ── Page 1 header & footer ─────────────────────────────────────────────
  drawPageHeader(doc, logoB64, deityB64)
  drawPageFooter(doc, logoB64)

  // ── Reference & date ──────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(30, 30, 30)
  doc.text(q.quotationNumber ?? 'P&P/Quotation/2026-27', L, CONTENT_T)
  doc.text(`Date: - ${dateStr}`, R, CONTENT_T, { align: 'right' })

  // ── QUOTATION heading ─────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.text('QUOTATION', 105, CONTENT_T + 10, { align: 'center' })
  doc.setDrawColor(30, 30, 30)
  doc.setLineWidth(0.4)
  doc.line(72, CONTENT_T + 12, 138, CONTENT_T + 12)

  // ── To block ──────────────────────────────────────────────────────────
  let y = CONTENT_T + 22
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('To,', L, y); y += 6
  doc.text((q.customer?.name ?? 'Customer').toUpperCase() + ',', L, y); y += 5.5
  doc.setFont('helvetica', 'normal')
  if (q.customer?.address) {
    const al = doc.splitTextToSize(q.customer.address.toUpperCase() + ',', 110)
    doc.text(al, L, y); y += al.length * 5.5
  }
  if (q.customer?.city)  { doc.text(`DIST-${q.customer.city.toUpperCase()},`,   L, y); y += 5.5 }
  if (q.customer?.state) { doc.text(`STATE-${q.customer.state.toUpperCase()}.`, L, y); y += 5.5 }
  if (q.customer?.gstin) {
    doc.setFont('helvetica', 'bold')
    doc.text('GST NO - ' + q.customer.gstin, L, y); y += 5.5
  }
  y += 4

  // ── Subject line ──────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  const subject = q.notes ? `Sub: - ${q.notes}` : `Sub: - Quotation for supply PCC Pipes As Per IS 784:2019.`
  const subLines = doc.splitTextToSize(subject, W)
  doc.text(subLines, 40, y); y += subLines.length * 5.5 + 4

  // ── Dear Sir intro ────────────────────────────────────────────────────
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  doc.text('Dear Sir,', L, y); y += 5.5
  const introLines = doc.splitTextToSize(
    'With reference to sited subject our quotation for supply of PCC pipes.', W)
  doc.text(introLines, L, y); y += introLines.length * 5.5 + 4

  // ── Items table ───────────────────────────────────────────────────────
  const items     = q.items ?? []
  const tableBody = items.map((item: any, idx: number) => [
    String(idx + 1),
    item.productName ?? '',
    Number(item.quantity).toLocaleString('en-IN'),
    INR(Number(item.unitPrice)),
    INR(Number(item.lineTotal)),
  ])
  const totalQty   = items.reduce((s: number, i: any) => s + Number(i.quantity), 0)
  const subtotal   = Number(q.subtotal   ?? 0)
  const taxAmount  = Number(q.taxAmount  ?? 0)
  const grandTotal = Number(q.totalAmount ?? 0)
  const taxRate    = items.length > 0 ? Number(items[0].taxRate ?? 18) : 18

  tableBody.push(['', 'TOTAL',          totalQty.toLocaleString('en-IN'), '', INR(subtotal)])
  tableBody.push(['', `GST ${taxRate}%`, '',                              '', INR(taxAmount)])
  tableBody.push(['', 'TOTAL AMOUNT',   '',                              '', INR(grandTotal)])

  autoTable(doc, {
    startY: y,
    margin: { top: HEADER_H + 4, bottom: 297 - FOOTER_Y + 4 },
    head: [['SR\nNO.', 'DIA OF PIPE', 'QTY IN\nMTR', 'RATE /RMT', 'AMOUNT']],
    body: tableBody,
    theme: 'grid',
    styles:     { fontSize: 8.5, cellPadding: 2.5, textColor: [20,20,20], lineColor: [100,100,100], lineWidth: 0.2 },
    headStyles: { fillColor: [255,255,255], textColor: [20,20,20], fontStyle: 'bold', fontSize: 8.5, halign: 'center', lineColor: [60,60,60], lineWidth: 0.3 },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' as const },
      1: { cellWidth: 72 },
      2: { cellWidth: 22, halign: 'right' as const },
      3: { cellWidth: 34, halign: 'right' as const },
      4: { cellWidth: 42, halign: 'right' as const },
    },
    didParseCell: (data: any) => {
      if (data.section === 'body' && data.row.index >= items.length) {
        data.cell.styles.fontStyle = 'bold'
        data.cell.styles.fillColor = [245, 245, 245]
      }
    },
    didDrawPage: (_data: any) => {
      drawPageHeader(doc, logoB64, deityB64)
      drawPageFooter(doc, logoB64)
    },
  })

  // ── Page 2: Terms & Conditions ────────────────────────────────────────
  doc.addPage()
  drawPageHeader(doc, logoB64, deityB64)
  drawPageFooter(doc, logoB64)

  let ty = CONTENT_T
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(20, 20, 20)
  doc.text('Following terms & conditions:-', L, ty); ty += 7

  const terms = q.termsConditions || DEFAULT_TERMS
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const termLines = doc.splitTextToSize(terms.trim(), W)
  doc.text(termLines, L, ty)
  ty += termLines.length * 4.8 + 8

  // ── Closing paragraph ─────────────────────────────────────────────────
  const closingY = Math.min(Math.max(ty + 6, CONTENT_T + 140), FOOTER_Y - 55)
  doc.setFontSize(9.5)
  const closingLines = doc.splitTextToSize(
    'If you need any further clarification/information, please feel free to call us. Assuring you of our best services and now look forward to receive your valued order in return.', W)
  doc.text(closingLines, L, closingY)

  // ── Signature block ───────────────────────────────────────────────────
  const sigY = closingY + closingLines.length * 5.5 + 8
  doc.setFont('helvetica', 'normal')
  doc.text('Thanking you,', L, sigY)
  doc.text('Regards,', R, sigY + 10, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 120, 120)
  doc.text('For: - P & P Pipe Products Pvt Ltd', R, sigY + 22, { align: 'right' })
  doc.setDrawColor(80, 80, 80)
  doc.setLineWidth(0.3)
  doc.line(130, sigY + 37, R, sigY + 37)
  doc.setFont('helvetica', 'bold')
  doc.setTextColor(0, 120, 120)
  doc.text('Authorized Signatory', R, sigY + 43, { align: 'right' })

  doc.setTextColor(30, 30, 30)
  return doc
}

async function buildQuotationDocModern(q: any): Promise<jsPDF> {
  const [logoB64, deityB64] = await Promise.all([
    loadImgBase64('/pp-logo.png'),
    loadImgBase64('/pp-deity.jpg'),
  ])
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const L = 14
  const R = 196
  const W = 182
  const TEAL: [number, number, number]  = [0, 82, 110]
  const LTEAL: [number, number, number] = [235, 246, 251]

  const dateStr = q.createdAt
    ? format(new Date(q.createdAt), 'dd-MM-yyyy')
    : format(new Date(), 'dd-MM-yyyy')
  const validDate = q.validUntil
    ? format(new Date(q.validUntil), 'dd-MM-yyyy')
    : format(addDays(new Date(), 30), 'dd-MM-yyyy')

  drawPageHeader(doc, logoB64, deityB64)
  drawPageFooter(doc, logoB64)

  // ── Title row ─────────────────────────────────────────────────────────
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.6)
  doc.line(L, CONTENT_T, R, CONTENT_T)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(...TEAL)
  doc.text('QUOTATION', L, CONTENT_T + 9)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 100, 100)
  doc.text(q.quotationNumber ?? 'P&P/Quotation/2026-27', R, CONTENT_T + 5, { align: 'right' })
  doc.text(`Date: ${dateStr}`, R, CONTENT_T + 11, { align: 'right' })
  doc.setDrawColor(200, 215, 225)
  doc.setLineWidth(0.3)
  doc.line(L, CONTENT_T + 14, R, CONTENT_T + 14)

  // ── To / Details two-column (plain text, no backgrounds) ─────────────
  const INFO_Y = CONTENT_T + 20
  const COL2_X = 120

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...TEAL)
  doc.text('TO', L, INFO_Y)

  let cy = INFO_Y + 5.5
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(15, 15, 15)
  doc.text((q.customer?.name ?? 'Customer').toUpperCase(), L, cy); cy += 5.5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(60, 60, 60)
  if (q.customer?.address) {
    const al = doc.splitTextToSize(q.customer.address, 98)
    doc.text(al, L, cy); cy += al.length * 5
  }
  if (q.customer?.city)  { doc.text(`Dist: ${q.customer.city}`, L, cy); cy += 5 }
  if (q.customer?.state) { doc.text(`State: ${q.customer.state}`, L, cy); cy += 5 }
  if (q.customer?.gstin) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...TEAL)
    doc.text(`GSTIN: ${q.customer.gstin}`, L, cy)
  }

  // Right column — ref details, no box
  const rDetails: [string, string][] = [
    ['Ref No.', q.quotationNumber ?? 'P&P/QT/2026-27'],
    ['Date', dateStr],
    ['Valid Until', validDate],
  ]
  let dy = INFO_Y + 5.5
  rDetails.forEach(([label, val]) => {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(110, 110, 110)
    doc.text(label, COL2_X, dy)
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(20, 20, 20)
    doc.text(val, R, dy, { align: 'right' })
    dy += 7
  })

  // ── Thin divider ──────────────────────────────────────────────────────
  const divY = Math.max(cy, dy) + 4
  doc.setDrawColor(200, 215, 225)
  doc.setLineWidth(0.3)
  doc.line(L, divY, R, divY)

  // ── Subject & intro ───────────────────────────────────────────────────
  let sy = divY + 7
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(20, 20, 20)
  const subject = q.notes
    ? `Sub: ${q.notes}`
    : `Sub: Quotation for supply PCC Pipes As Per IS 784:2019.`
  const subLines = doc.splitTextToSize(subject, W)
  doc.text(subLines, L, sy); sy += subLines.length * 5.5 + 3

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(40, 40, 40)
  doc.text('Dear Sir,', L, sy); sy += 5.5
  const introLines = doc.splitTextToSize(
    'With reference to sited subject our quotation for supply of PCC pipes.', W)
  doc.text(introLines, L, sy); sy += introLines.length * 5.5 + 5

  // ── Items table ────────────────────────────────────────────────────────
  const items = q.items ?? []
  const tableBody = items.map((item: any, idx: number) => [
    String(idx + 1),
    item.productName ?? '',
    Number(item.quantity).toLocaleString('en-IN'),
    INR(Number(item.unitPrice)),
    INR(Number(item.lineTotal)),
  ])
  const subtotal   = Number(q.subtotal   ?? 0)
  const taxAmount  = Number(q.taxAmount  ?? 0)
  const grandTotal = Number(q.totalAmount ?? 0)
  const taxRate    = items.length > 0 ? Number(items[0].taxRate ?? 18) : 18

  autoTable(doc, {
    startY: sy,
    margin: { top: HEADER_H + 4, bottom: 297 - FOOTER_Y + 4 },
    head: [['#', 'Dia of Pipe', 'Qty (Mtr)', 'Rate /Rmt', 'Amount']],
    body: tableBody,
    theme: 'plain',
    styles: {
      fontSize: 9,
      cellPadding: 3.5,
      textColor: [20, 20, 20],
      lineColor: [210, 225, 235],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [230, 243, 250],
      textColor: [0, 82, 110],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: 3,
    },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' as const },
      1: { cellWidth: 72 },
      2: { cellWidth: 22, halign: 'right' as const },
      3: { cellWidth: 34, halign: 'right' as const },
      4: { cellWidth: 42, halign: 'right' as const },
    },
    didDrawPage: (_data: any) => {
      drawPageHeader(doc, logoB64, deityB64)
      drawPageFooter(doc, logoB64)
    },
  })

  // ── Totals — plain right-aligned text, one teal line above grand total ─
  const finalY = (doc as any).lastAutoTable.finalY + 5
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  doc.text('Sub Total', 140, finalY)
  doc.text(INR(subtotal), R, finalY, { align: 'right' })

  doc.text(`GST @ ${taxRate}%`, 140, finalY + 7)
  doc.text(INR(taxAmount), R, finalY + 7, { align: 'right' })

  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.5)
  doc.line(130, finalY + 10, R, finalY + 10)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...TEAL)
  doc.text('Total Amount', 130, finalY + 17)
  doc.text(INR(grandTotal), R, finalY + 17, { align: 'right' })

  // ── Page 2: Terms ─────────────────────────────────────────────────────
  doc.addPage()
  drawPageHeader(doc, logoB64, deityB64)
  drawPageFooter(doc, logoB64)

  let ty = CONTENT_T
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(...TEAL)
  doc.text('Terms & Conditions', L, ty)
  doc.setDrawColor(...TEAL)
  doc.setLineWidth(0.5)
  doc.line(L, ty + 2, L + 60, ty + 2)
  ty += 9

  const terms = q.termsConditions || DEFAULT_TERMS
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(30, 30, 30)
  const termLines = doc.splitTextToSize(terms.trim(), W)
  doc.text(termLines, L, ty)
  ty += termLines.length * 4.8 + 8

  const closingY = Math.min(Math.max(ty + 6, CONTENT_T + 140), FOOTER_Y - 50)
  const closingLines = doc.splitTextToSize(
    'If you need any further clarification/information, please feel free to call us. Assuring you of our best services and now look forward to receive your valued order in return.', W)
  doc.text(closingLines, L, closingY)

  const sigY = closingY + closingLines.length * 5.5 + 10
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(50, 50, 50)
  doc.text('Thanking you,', L, sigY)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...TEAL)
  doc.text('For P & P Pipe Products Pvt Ltd', R, sigY + 6, { align: 'right' })
  doc.setDrawColor(150, 170, 180)
  doc.setLineWidth(0.3)
  doc.line(130, sigY + 22, R, sigY + 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(100, 100, 100)
  doc.text('Authorized Signatory', R, sigY + 28, { align: 'right' })

  doc.setTextColor(30, 30, 30)
  return doc
}

async function downloadQuotationPdf(q: any) {
  const doc = await buildQuotationDoc(q)
  doc.save(`Quotation-${q.quotationNumber ?? 'draft'}.pdf`)
}

async function downloadQuotationPdfModern(q: any) {
  const doc = await buildQuotationDocModern(q)
  doc.save(`Quotation-Modern-${q.quotationNumber ?? 'draft'}.pdf`)
}

async function printQuotationPdf(q: any) {
  const doc = await buildQuotationDoc(q)
  doc.autoPrint()
  window.open(doc.output('bloburl'), '_blank')
}

async function printQuotationPdfModern(q: any) {
  const doc = await buildQuotationDocModern(q)
  doc.autoPrint()
  window.open(doc.output('bloburl'), '_blank')
}

async function buildQuotationDocClean(q: any): Promise<jsPDF> {
  const logoB64 = await loadImgBase64('/pp-logo.png')

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const L = 14
  const R = 196
  const W = 182
  const PRP: [number, number, number] = [88, 68, 184]
  const LPRP: [number, number, number] = [248, 246, 255]
  const GREY: [number, number, number] = [110, 110, 110]

  const dateStr = q.createdAt
    ? format(new Date(q.createdAt), 'dd-MM-yyyy')
    : format(new Date(), 'dd-MM-yyyy')

  drawPageHeader(doc, logoB64, '')
  drawPageFooter(doc, logoB64)

  // ── Title ─────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(25, 25, 25)
  doc.text('Quotation', L, CONTENT_T + 9)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GREY)
  doc.text('Quotation No.', R, CONTENT_T + 4, { align: 'right' })
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(25, 25, 25)
  doc.text(q.quotationNumber ?? 'P&P/QT/2026-27', R, CONTENT_T + 9, { align: 'right' })
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GREY)
  doc.text(`Date: ${dateStr}`, R, CONTENT_T + 14, { align: 'right' })

  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.25)
  doc.line(L, CONTENT_T + 17, R, CONTENT_T + 17)

  // ── Quotation By | Quotation To ───────────────────────────────────────
  const C2 = 108
  const BY_Y = CONTENT_T + 23

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...GREY)
  doc.text('QUOTATION BY', L, BY_Y)
  doc.text('QUOTATION TO', C2, BY_Y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(20, 20, 20)
  doc.text('P & P Pipe Products Pvt. Ltd.', L, BY_Y + 6)
  doc.text((q.customer?.name ?? 'Customer').toUpperCase(), C2, BY_Y + 6)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(70, 70, 70)
  const byLines = ['Gat No. 156, At Post Hotgi,', 'Tal. South Solapur, Dist. Solapur - 413215', 'Cell: 9922450055 | pppipeproducts@gmail.com']
  byLines.forEach((ln, i) => doc.text(ln, L, BY_Y + 12 + i * 5))

  let toY = BY_Y + 12
  if (q.customer?.address) {
    const al = doc.splitTextToSize(q.customer.address, 84)
    doc.text(al, C2, toY); toY += al.length * 5
  }
  if (q.customer?.city)  { doc.text(`Dist: ${q.customer.city}`, C2, toY); toY += 5 }
  if (q.customer?.state) { doc.text(`State: ${q.customer.state}`, C2, toY); toY += 5 }
  if (q.customer?.gstin) {
    doc.setFont('helvetica', 'bold')
    doc.setTextColor(...PRP)
    doc.text(`GSTIN: ${q.customer.gstin}`, C2, toY)
  }

  doc.setDrawColor(220, 220, 220)
  doc.setLineWidth(0.25)
  const divY = CONTENT_T + 52
  doc.line(L, divY, R, divY)

  // ── Subject ───────────────────────────────────────────────────────────
  let sy = divY + 6
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(40, 40, 40)
  const subject = q.notes
    ? `Sub: ${q.notes}`
    : `Sub: Quotation for supply PCC Pipes As Per IS 784:2019.`
  const subLines = doc.splitTextToSize(subject, W)
  doc.text(subLines, L, sy); sy += subLines.length * 5 + 4

  // ── Items table ───────────────────────────────────────────────────────
  const items = q.items ?? []
  const tableBody = items.map((item: any, idx: number) => [
    `${idx + 1}.`,
    item.productName ?? '',
    Number(item.quantity).toLocaleString('en-IN'),
    INR(Number(item.unitPrice)),
    INR(Number(item.lineTotal)),
  ])
  const subtotal   = Number(q.subtotal   ?? 0)
  const taxAmount  = Number(q.taxAmount  ?? 0)
  const grandTotal = Number(q.totalAmount ?? 0)
  const taxRate    = items.length > 0 ? Number(items[0].taxRate ?? 18) : 18

  autoTable(doc, {
    startY: sy,
    margin: { top: HEADER_H + 4, bottom: 297 - FOOTER_Y + 30 },
    head: [['#', 'Item & Description', 'Qty (Mtr)', 'Rate /Rmt', 'Amount']],
    body: tableBody,
    theme: 'plain',
    styles: { fontSize: 9, cellPadding: 3.5, textColor: [25, 25, 25] },
    headStyles: {
      fillColor: PRP,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center',
      cellPadding: 3.5,
    },
    alternateRowStyles: { fillColor: LPRP },
    columnStyles: {
      0: { cellWidth: 12, halign: 'center' as const },
      1: { cellWidth: 72 },
      2: { cellWidth: 22, halign: 'right' as const },
      3: { cellWidth: 34, halign: 'right' as const },
      4: { cellWidth: 42, halign: 'right' as const },
    },
    didDrawPage: (_data: any) => {
      drawPageHeader(doc, logoB64, '')
      drawPageFooter(doc, logoB64)
    },
  })

  // ── Below table: short terms (left) + totals (right) ─────────────────
  const belowY = (doc as any).lastAutoTable.finalY + 5
  const TERMS_W = 90
  const TOT_X = L + TERMS_W + 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(40, 40, 40)
  doc.text('Terms & Conditions', L, belowY + 1)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)
  const shortT = [
    `• Price is exclusive of GST @ ${taxRate}%.`,
    '• 80% interest-free advance with confirmed order.',
    '• Transportation up to motorable roads only.',
    '• Pipes as per IS 784-2019.',
  ]
  shortT.forEach((ln, i) => doc.text(ln, L, belowY + 7 + i * 4.5))

  // Totals
  const totRows: [string, string, boolean][] = [
    ['Sub Total', INR(subtotal), false],
    [`GST @ ${taxRate}%`, INR(taxAmount), false],
    ['Total', INR(grandTotal), true],
  ]
  let ty = belowY
  totRows.forEach(([label, val, isBold]) => {
    if (isBold) {
      doc.setFillColor(...PRP)
      doc.rect(TOT_X, ty - 3, R - TOT_X, 9, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(255, 255, 255)
      doc.text(label, TOT_X + 3, ty + 2.5)
      doc.text(val, R - 2, ty + 2.5, { align: 'right' })
      ty += 13
    } else {
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8.5)
      doc.setTextColor(60, 60, 60)
      doc.text(label, TOT_X + 3, ty)
      doc.text(val, R - 2, ty, { align: 'right' })
      doc.setDrawColor(225, 225, 225)
      doc.setLineWidth(0.2)
      doc.line(TOT_X, ty + 3, R, ty + 3)
      ty += 9
    }
  })

  // ── Signature ─────────────────────────────────────────────────────────
  const sigY = belowY + 35
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...PRP)
  doc.text('For P & P Pipe Products Pvt. Ltd.', R, sigY, { align: 'right' })
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.line(148, sigY + 16, R, sigY + 16)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GREY)
  doc.text('Authorized Signatory', R, sigY + 21, { align: 'right' })

  // ── Page 2: Full Terms ────────────────────────────────────────────────
  doc.addPage()
  drawPageHeader(doc, logoB64, '')
  drawPageFooter(doc, logoB64)

  let p2y = CONTENT_T
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...PRP)
  doc.text('Terms & Conditions', L, p2y)
  doc.setDrawColor(...PRP)
  doc.setLineWidth(0.4)
  doc.line(L, p2y + 2, L + 55, p2y + 2)
  p2y += 9

  const terms = q.termsConditions || DEFAULT_TERMS
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(30, 30, 30)
  const termLines = doc.splitTextToSize(terms.trim(), W)
  doc.text(termLines, L, p2y)
  p2y += termLines.length * 4.8 + 10

  const closingY = Math.min(Math.max(p2y, CONTENT_T + 145), FOOTER_Y - 45)
  const closingLines = doc.splitTextToSize(
    'If you need any further clarification/information, please feel free to call us. Assuring you of our best services and look forward to receiving your valued order.', W)
  doc.text(closingLines, L, closingY)

  const p2sigY = closingY + closingLines.length * 5 + 10
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(50, 50, 50)
  doc.text('Thanking you,', L, p2sigY)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...PRP)
  doc.text('For P & P Pipe Products Pvt. Ltd.', R, p2sigY + 6, { align: 'right' })
  doc.setDrawColor(180, 180, 180)
  doc.setLineWidth(0.3)
  doc.line(148, p2sigY + 22, R, p2sigY + 22)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...GREY)
  doc.text('Authorized Signatory', R, p2sigY + 27, { align: 'right' })

  return doc
}

async function downloadQuotationPdfClean(q: any) {
  const doc = await buildQuotationDocClean(q)
  doc.save(`Quotation-Pro-${q.quotationNumber ?? 'draft'}.pdf`)
}

async function printQuotationPdfClean(q: any) {
  const doc = await buildQuotationDocClean(q)
  doc.autoPrint()
  window.open(doc.output('bloburl'), '_blank')
}

// ─── Product search dropdown ───────────────────────────────────────────────────

function ProductSearch({ onSelect }: { onSelect: (p: any) => void }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [pickedProduct, setPickedProduct] = useState<any>(null)
  const [variants, setVariants] = useState<any[]>([])
  const [variantsLoading, setVariantsLoading] = useState(false)
  const [dropRect, setDropRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const reset = () => { setOpen(false); setPickedProduct(null); setVariants([]); setQuery('') }

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      const t = e.target as Node
      if (!wrapRef.current?.contains(t) && !dropRef.current?.contains(t)) { setOpen(false); setPickedProduct(null); setVariants([]) }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    if (!open || !wrapRef.current) { if (!open) setDropRect(null); return }
    const update = () => {
      if (!wrapRef.current) return
      const r = wrapRef.current.getBoundingClientRect()
      setDropRect({ top: r.bottom + 4, left: r.left, width: r.width })
    }
    update()
    window.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => { window.removeEventListener('scroll', update, true); window.removeEventListener('resize', update) }
  }, [open])

  useEffect(() => {
    if (query.length < 2) { setResults([]); setOpen(false); return }
    const t = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await productApi.search(query)
        const products = res.data.data ?? []

        // For every 5.25m product, also generate a synthetic 6.5m entry
        const expanded: any[] = []
        products.forEach((p: any) => {
          expanded.push(p)
          if ((p.name ?? '').includes('5.25m')) {
            expanded.push({
              ...p,
              _synthetic: true,
              name: p.name.replace(/5\.25m/g, '6.5m'),
              sku: p.sku ? p.sku.replace(/5\.25/g, '6.5') : p.sku,
              lengthM: 6.5,
            })
          }
        })

        const withDiscounts = await Promise.all(expanded.map(async (p: any) => {
          try {
            const unitPrice = p.sellingPrice ?? p.price ?? 0
            if (unitPrice > 0) {
              const dr = await discountApi.itemPreview(p.id, 1, unitPrice)
              const preview = dr.data.data
              if (preview && preview.discountPct > 0) return { ...p, _offerLabel: preview.label, _offerPct: Number(preview.discountPct) }
            }
          } catch { /* ignore */ }
          return p
        }))
        setResults(withDiscounts)
        setOpen(true)
      } catch { setResults([]) }
      finally { setLoading(false) }
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  async function handleProductClick(p: any) {
    setVariantsLoading(true)
    try {
      const res = await variantApi.getAll(p.id)
      const vars = (res.data.data ?? []).filter((v: any) => v.active !== false)
      if (vars.length > 0) {
        setPickedProduct(p)
        setVariants(vars)
      } else {
        onSelect(p)
        reset()
      }
    } catch {
      onSelect(p)
      reset()
    } finally {
      setVariantsLoading(false)
    }
  }

  function handleVariantClick(v: any) {
    const basePrice = pickedProduct.sellingPrice ?? pickedProduct.price ?? 0
    const variantPrice = basePrice + Number(v.priceAdjustment ?? 0)
    onSelect({
      ...pickedProduct,
      name: v.name || pickedProduct.name,
      sku: v.sku ?? pickedProduct.sku,
      sellingPrice: variantPrice,
      price: variantPrice,
    })
    reset()
  }

  return (
    <div ref={wrapRef}>
      <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-3 py-2.5 bg-white shadow-[0_4px_16px_rgba(0,0,0,0.10)] hover:shadow-[0_6px_24px_rgba(0,0,0,0.14)] transition-shadow">
        <Search size={15} className="text-gray-400 shrink-0" />
        <input value={query} onChange={e => { setQuery(e.target.value); setPickedProduct(null); setVariants([]) }}
          placeholder="Search product to add…"
          className="flex-1 text-sm outline-none bg-transparent text-gray-800 placeholder-gray-400" />
        {(loading || variantsLoading) && <Loader2 size={13} className="animate-spin text-gray-400" />}
      </div>
      {open && dropRect && createPortal(
        <div ref={dropRef}
          className="fixed z-[9999] bg-white border border-gray-200 rounded-xl shadow-2xl max-h-64 overflow-y-auto"
          style={{ top: dropRect.top, left: dropRect.left, width: dropRect.width }}>
          {pickedProduct ? (
            <>
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-xl">
                <button type="button" onMouseDown={() => { setPickedProduct(null); setVariants([]) }}
                  className="text-gray-400 hover:text-gray-600">
                  <ChevronLeft size={14} />
                </button>
                <span className="text-xs font-semibold text-gray-500 truncate">{pickedProduct.name}</span>
                <span className="text-xs text-gray-400 ml-auto shrink-0">Select length</span>
              </div>
              {variants.map(v => {
                const basePrice = pickedProduct.sellingPrice ?? pickedProduct.price ?? 0
                const vPrice = basePrice + Number(v.priceAdjustment ?? 0)
                const label = [v.attribute1Value, v.attribute2Value].filter(Boolean).join(' / ') || v.name
                return (
                  <button key={v.id} type="button"
                    onMouseDown={() => handleVariantClick(v)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{label}</p>
                      {v.sku && <p className="text-xs text-gray-400 mt-0.5">{v.sku}</p>}
                    </div>
                    <span className="text-sm font-semibold text-violet-600 shrink-0">₹{vPrice.toLocaleString('en-IN')}</span>
                  </button>
                )
              })}
            </>
          ) : results.length > 0 ? (
            results.map(p => {
              const price = p.sellingPrice ?? p.price ?? 0
              const hasOffer = p._offerPct > 0
              const discounted = hasOffer ? price * (1 - p._offerPct / 100) : price
              return (
                <button key={p.id} type="button"
                  onMouseDown={() => handleProductClick(p)}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50 text-left border-b border-gray-50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.name}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <p className="text-xs text-gray-400">{p.sku}</p>
                      {hasOffer && (
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <Percent size={8} /> {p._offerLabel || `${p._offerPct}% off`}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    {hasOffer ? (
                      <>
                        <p className="text-xs text-gray-400 line-through">₹{price.toLocaleString('en-IN')}</p>
                        <p className="text-sm font-semibold text-emerald-600">₹{discounted.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
                      </>
                    ) : (
                      <span className="text-sm font-semibold text-violet-600">₹{price.toLocaleString('en-IN')}</span>
                    )}
                  </div>
                </button>
              )
            })
          ) : null}
        </div>,
        document.body
      )}
    </div>
  )
}

// ─── GST Picker ───────────────────────────────────────────────────────────────

function GstPicker({ value, onChange, taxGroups }: {
  value: number
  onChange: (rate: number) => void
  taxGroups: any[]
}) {
  const [open, setOpen] = useState(false)
  const [pos, setPos]   = useState<{ top: number; left: number; width: number } | null>(null)
  const btnRef          = useRef<HTMLButtonElement>(null)

  function updatePos() {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      setPos({ top: r.bottom + 4, left: r.left, width: Math.max(r.width, 100) })
    }
  }
  useEffect(() => {
    if (!open) return
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => { window.removeEventListener('scroll', updatePos, true); window.removeEventListener('resize', updatePos) }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const options = taxGroups.filter(g => Number(g.totalRate) > 0)

  return (
    <>
      <button ref={btnRef} type="button"
        onClick={() => { setOpen(o => !o) }}
        className="w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white flex items-center justify-end gap-0.5 hover:border-violet-300 transition-colors">
        <span className="tabular-nums">{value > 0 ? value : '0'}</span>
        <span className="text-gray-400 text-xs">%</span>
      </button>
      {open && pos && createPortal(
        <div style={{ position: 'fixed', top: pos.top, left: pos.left, width: pos.width, zIndex: 9999 }}
          className="bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden">
          <button type="button"
            onMouseDown={e => { e.preventDefault(); onChange(0); setOpen(false) }}
            className={`w-full px-3 py-2 text-sm text-left hover:bg-violet-50 transition-colors flex items-center justify-between ${value === 0 ? 'bg-violet-50 font-semibold text-violet-700' : 'text-gray-700'}`}>
            <span>No Tax</span><span className="text-xs text-gray-400">0%</span>
          </button>
          {options.map(g => (
            <button key={g.id} type="button"
              onMouseDown={e => { e.preventDefault(); onChange(Number(g.totalRate)); setOpen(false) }}
              className={`w-full px-3 py-2 text-sm text-left hover:bg-violet-50 transition-colors flex items-center justify-between ${Number(g.totalRate) === value ? 'bg-violet-50 font-semibold text-violet-700' : 'text-gray-700'}`}>
              <span>{g.name}</span><span className="text-xs tabular-nums">{g.totalRate}%</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  )
}

// ─── Create Quotation Panel ────────────────────────────────────────────────────

function CreateQuotationPanel({ outletId, onClose, onCreated }: {
  outletId: number
  onClose: () => void
  onCreated: () => void
}) {
  const [visible, setVisible]               = useState(false)
  const [submitting, setSubmitting]         = useState(false)
  const [sendOnSave, setSendOnSave]         = useState(false)
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [quoteDate, setQuoteDate]           = useState(format(new Date(), 'yyyy-MM-dd'))
  const [validUntil, setValidUntil]         = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
  const [poNumber, setPoNumber]             = useState('')
  const [billDiscPct, setBillDiscPct]       = useState(0)
  const [shippingAmt, setShippingAmt]       = useState(0)
  const [notes, setNotes]                   = useState('')
  const [terms, setTerms]                   = useState('Prices are valid till the validity date mentioned above.\nGST as applicable.\nSubject to local jurisdiction.')
  const [items, setItems]                   = useState<LineItem[]>([])
  const [errors, setErrors]                 = useState<{ customer?: string; items?: string }>({})

  const { data: taxGroupsData } = useQuery({
    queryKey: ['taxGroups'],
    queryFn: () => taxGroupApi.getAll(true).then((r: any) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  })
  const taxGroups: any[] = taxGroupsData ?? []

  const { data: pipeConfigsData } = useQuery({
    queryKey: ['pipeConfigs-active'],
    queryFn: () => pipeConfigApi.getAll({ active: true, size: 200 }).then((r: any) => {
      const d = r.data.data; return (d?.content ?? d ?? []) as any[]
    }),
    staleTime: 10 * 60 * 1000,
  })
  const pipeLengths: number[] = Array.from(new Set([
    5.25, 6.5,
    ...(pipeConfigsData ?? []).map((c: any) => Number(c.lengthM)).filter((l: number) => l > 0),
  ])).sort((a, b) => a - b)

  const { data: nextNumberData } = useQuery({
    queryKey: ['quotation-next-number'],
    queryFn: () => quotationApi.nextNumber().then((r: any) => r.data.data?.nextNumber ?? ''),
  })
  const nextQuotationNumber: string = nextNumberData ?? ''

  useEffect(() => {
    const id = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(id)
  }, [])

  function handleClose() { setVisible(false); setTimeout(onClose, 300) }

  async function addProduct(p: any) {
    const unitPrice = p.sellingPrice ?? p.price ?? 0
    const lm2 = p.lengthM ?? pipeLength(p.name ?? '')
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      productId: p.id,
      productName: p.name,
      productSku: p.sku ?? '',
      lengthM: lm2,
      meters: lm2,
      quantity: 1,
      unitPrice,
      discountPercent: 0,
      taxRate: p.taxGroup?.totalRate ?? 0,
    }
    try {
      const res = await discountApi.itemPreview(p.id, 1, unitPrice)
      const preview = res.data.data
      if (preview && preview.discountPct > 0) {
        newItem.discountPercent = Number(preview.discountPct)
        newItem.autoDiscountLabel = preview.label
      }
    } catch { /* no discount */ }
    setItems(prev => [...prev, newItem])
  }

  function updateItem(id: string, field: keyof LineItem, value: any) {
    setItems(prev => prev.map(it => {
      if (it.id !== id) return it
      const updated = { ...it, [field]: value }
      if (field === 'meters')   updated.quantity = Math.ceil((value as number) / (it.lengthM ?? 5.25))
      if (field === 'quantity') updated.meters   = (value as number) * (it.lengthM ?? 5.25)
      if (field === 'lengthM')  updated.quantity = Math.ceil(it.meters / (value as number))
      return updated
    }))
  }

  function removeItem(id: string) { setItems(prev => prev.filter(it => it.id !== id)) }

  const lineTotals = items.reduce((acc, it) => {
    const c = calcLine(it)
    return { subtotal: acc.subtotal + c.base, lineDisc: acc.lineDisc + c.disc, tax: acc.tax + c.tax }
  }, { subtotal: 0, lineDisc: 0, tax: 0 })

  const afterLineDisc  = lineTotals.subtotal - lineTotals.lineDisc
  const billDiscAmt    = afterLineDisc * (billDiscPct / 100)
  const grandTotal     = afterLineDisc - billDiscAmt + lineTotals.tax + shippingAmt
  const roundedTotal   = Math.round(grandTotal)
  const roundOff       = parseFloat((roundedTotal - grandTotal).toFixed(2))
  const taxRates       = [...new Set(items.map(i => i.taxRate).filter(r => r > 0))]
  const gstLabel       = taxRates.length === 1 ? `GST (${taxRates[0]}%)` : 'GST'

  async function handleSubmit(send: boolean) {
    const newErrors: typeof errors = {}
    if (!selectedCustomer)  newErrors.customer = 'Please select a customer'
    if (items.length === 0) newErrors.items    = 'Add at least one item'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
    setErrors({})
    setSendOnSave(send)
    setSubmitting(true)
    try {
      const res = await quotationApi.create({
        customerId: selectedCustomer?.id ?? null,
        outletId,
        validUntil: validUntil ? `${validUntil}T00:00:00Z` : undefined,
        notes: notes || undefined,
        termsConditions: terms || undefined,
        items: items.map(it => ({
          productId: it.productId ?? undefined,
          productName: it.productName,
          productSku: it.productSku,
          quantity: it.meters,
          unitPrice: it.unitPrice,
          discountPercent: it.discountPercent,
          taxRate: it.taxRate,
        })),
      })
      if (send) await quotationApi.updateStatus(res.data.data.id, 'SENT')
      toast.success(send ? 'Quotation sent' : 'Quotation saved as draft')
      onCreated()
      handleClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to create quotation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />

      {/* Sliding panel */}
      <div className={`fixed inset-y-0 right-0 left-[220px] z-50 transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="w-full h-full bg-[#f8f9fb] flex flex-col overflow-hidden">

          {/* ── Header ── */}
          <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
                <ClipboardList size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 leading-none">New Quotation</h2>
                <p className="text-xs text-gray-400 mt-0.5">Quotation number assigned on save</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleClose} className="px-3.5 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={() => handleSubmit(false)} disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-violet-400 text-violet-700 rounded-lg hover:bg-violet-50 transition-colors font-medium">
                {submitting && !sendOnSave ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                Save Draft
              </button>
              <button onClick={() => handleSubmit(true)} disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium shadow-sm">
                {submitting && sendOnSave ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Save & Send
              </button>
            </div>
          </div>

          {/* ── Scrollable body ── */}
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-6xl mx-auto px-8 py-6 space-y-5">

              {/* ── From / To ── */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-white rounded-xl shadow-md p-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">From</p>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                      <Building2 size={17} className="text-violet-600" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900">PP Pipes Products</p>
                      <p className="text-xs text-gray-400 mt-0.5">Outlet #{outletId}</p>
                    </div>
                  </div>
                </div>

                <div className={`bg-white rounded-xl shadow-md p-5 ${errors.customer ? 'ring-2 ring-red-300' : ''}`}>
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Quote To</p>
                  {selectedCustomer ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 font-bold text-sm">
                        {selectedCustomer.name[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-bold text-gray-900 truncate">{selectedCustomer.name}</p>
                        {selectedCustomer.phone && <p className="text-xs text-gray-400 mt-0.5">{selectedCustomer.phone}</p>}
                      </div>
                      <button onClick={() => setSelectedCustomer(null)}
                        className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors shrink-0">
                        <X size={13} />
                      </button>
                    </div>
                  ) : (
                    <CustomerSearchInput label="" value={selectedCustomer} onSelect={c => { setSelectedCustomer(c); setErrors(e => ({ ...e, customer: undefined })) }}
                      onClear={() => setSelectedCustomer(null)} placeholder="Search customer by name or phone…" />
                  )}
                  {errors.customer && <p className="text-xs text-red-500 mt-2">{errors.customer}</p>}
                </div>
              </div>

              {/* ── Quotation metadata bar ── */}
              <div className="bg-white rounded-xl shadow-md">
                <div className="grid divide-x divide-gray-100" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr' }}>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Quotation No.</p>
                    {nextQuotationNumber
                      ? <p className="text-[13px] font-semibold tracking-wide text-indigo-600">{nextQuotationNumber}</p>
                      : <p className="text-sm text-gray-400 italic">Auto-assigned</p>
                    }
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Quote Date</p>
                    <input type="date" value={quoteDate} onChange={e => setQuoteDate(e.target.value)}
                      className="w-full text-sm text-gray-800 border-0 bg-transparent p-0 focus:outline-none" />
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Valid Until</p>
                    <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                      className="w-full text-sm text-gray-800 border-0 bg-transparent p-0 focus:outline-none" />
                  </div>
                  <div className="px-5 py-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">PO Reference</p>
                    <input type="text" value={poNumber} onChange={e => setPoNumber(e.target.value)} placeholder="PO-001"
                      className="w-full text-sm text-gray-800 placeholder-gray-300 border-0 bg-transparent p-0 focus:outline-none" />
                  </div>
                </div>
              </div>

              {/* ── Line Items ── */}
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-100">
                  <ProductSearch onSelect={addProduct} />
                </div>

                {/* Table header */}
                <div className="grid text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100"
                  style={{ gridTemplateColumns: '2.5fr 120px 120px 80px 72px 116px 36px' }}>
                  <div className="px-5 py-3">Description</div>
                  <div className="px-3 py-3 text-right">Meters / Pipes</div>
                  <div className="px-3 py-3 text-right">Price / m (₹)</div>
                  <div className="px-3 py-3 text-right">Disc %</div>
                  <div className="px-3 py-3 text-right">GST %</div>
                  <div className="px-3 py-3 text-right">Net Amount</div>
                  <div />
                </div>

                {items.length === 0 ? (
                  <div className="py-8 text-center">
                    <p className="text-sm text-gray-400">No items yet — search a product above to add</p>
                    {errors.items && <p className="text-xs text-red-500 mt-1">{errors.items}</p>}
                  </div>
                ) : items.map((it, idx) => {
                  const c = calcLine(it)
                  return (
                    <div key={it.id}
                      className={`grid items-center border-b border-gray-100 last:border-0 transition-colors ${idx % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'} hover:bg-violet-50/20`}
                      style={{ gridTemplateColumns: '2.5fr 120px 120px 80px 72px 116px 36px' }}>
                      <div className="px-5 py-3">
                        <p className="text-sm font-semibold text-gray-900">{it.productName}</p>
                        {it.productSku && <p className="text-[11px] text-gray-400 mt-0.5">{it.productSku}</p>}
                        {it.autoDiscountLabel && it.discountPercent > 0 && (
                          <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Percent size={8} /> {it.autoDiscountLabel}
                          </span>
                        )}
                      </div>
                      {/* Meters + Pipes dual input */}
                      <div className="px-2 py-2 flex flex-col gap-1">
                        <div className="relative">
                          <input type="number" min="0.01" step="0.01" value={it.meters || ''}
                            onChange={e => updateItem(it.id, 'meters', parseFloat(e.target.value) || 0)}
                            className={`w-full px-2 pr-5 py-1 text-xs text-right border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white ${NO_SPINNER}`} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-gray-400 pointer-events-none">m</span>
                        </div>
                        <div className="relative">
                          <input type="number" min="1" step="1" value={it.quantity || ''}
                            onChange={e => updateItem(it.id, 'quantity', parseInt(e.target.value) || 0)}
                            className={`w-full px-2 pr-8 py-1 text-xs text-right border border-violet-200 bg-violet-50/50 rounded-md focus:outline-none focus:ring-2 focus:ring-violet-300 ${NO_SPINNER}`} />
                          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-violet-400 pointer-events-none">pipes</span>
                        </div>
                        {pipeLengths.length > 0 && (
                          <select value={it.lengthM}
                            onChange={e => updateItem(it.id, 'lengthM', parseFloat(e.target.value))}
                            className="w-full mt-1 px-2 py-1 text-[10px] text-center border border-gray-200 rounded-md bg-white text-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-300 cursor-pointer">
                            {pipeLengths.map(l => (
                              <option key={l} value={l}>{l}m</option>
                            ))}
                          </select>
                        )}
                      </div>
                      <div className="px-2 py-2.5">
                        <div className="relative">
                          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">₹</span>
                          <input type="number" min="0" step="0.01" value={it.unitPrice || ''}
                            onChange={e => updateItem(it.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className={`w-full pl-5 pr-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white ${NO_SPINNER}`} />
                        </div>
                      </div>
                      <div className="px-2 py-2.5">
                        <input type="number" min="0" max="100" step="0.5" value={it.discountPercent || ''}
                          onChange={e => updateItem(it.id, 'discountPercent', parseFloat(e.target.value) || 0)}
                          className={`w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white ${NO_SPINNER}`} />
                      </div>
                      <div className="px-2 py-2.5">
                        <GstPicker value={it.taxRate} onChange={rate => updateItem(it.id, 'taxRate', rate)} taxGroups={taxGroups} />
                      </div>
                      <div className="px-3 py-2.5 text-right">
                        <p className="text-sm font-bold text-gray-900 tabular-nums">₹{c.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                        {c.disc > 0 && <p className="text-[10px] text-emerald-600 tabular-nums">−₹{c.disc.toLocaleString('en-IN', { minimumFractionDigits: 2 })} disc</p>}
                      </div>
                      <div className="pr-2 flex items-center justify-center">
                        <button type="button" onClick={() => removeItem(it.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>
                  )
                })}

                {items.length > 0 && (
                  <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex justify-end gap-8 text-sm">
                    <span className="text-gray-500">Subtotal: <span className="font-semibold text-gray-800 tabular-nums">₹{lineTotals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                    {lineTotals.lineDisc > 0 && <span className="text-emerald-600">Discount: <span className="font-semibold tabular-nums">−₹{lineTotals.lineDisc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>}
                    <span className="text-gray-500">{gstLabel}: <span className="font-semibold text-gray-800 tabular-nums">₹{lineTotals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                  </div>
                )}
              </div>

              {/* ── Adjustments + Summary ── */}
              <div className="grid grid-cols-2 gap-5">
                <div className="bg-white rounded-xl shadow-md p-5 space-y-4">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Adjustments</p>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-gray-600 w-36 shrink-0">Trade Discount (%)</label>
                      <input type="number" min="0" max="100" step="0.5" value={billDiscPct || ''}
                        onChange={e => setBillDiscPct(parseFloat(e.target.value) || 0)} placeholder="0"
                        className={`flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white text-right ${NO_SPINNER}`} />
                      {billDiscPct > 0 && <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">−₹{billDiscAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>}
                    </div>
                    <div className="flex items-center gap-3">
                      <label className="text-xs font-medium text-gray-600 w-36 shrink-0">Freight (₹)</label>
                      <input type="number" min="0" step="0.01" value={shippingAmt || ''}
                        onChange={e => setShippingAmt(parseFloat(e.target.value) || 0)} placeholder="0.00"
                        className={`flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white text-right ${NO_SPINNER}`} />
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-md p-5">
                  <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Quotation Summary</p>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between text-gray-600">
                      <span>Subtotal</span>
                      <span className="tabular-nums font-medium">₹{lineTotals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {lineTotals.lineDisc > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Line Discounts</span>
                        <span className="tabular-nums font-medium">−₹{lineTotals.lineDisc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {billDiscPct > 0 && (
                      <div className="flex justify-between text-emerald-600">
                        <span>Trade Discount ({billDiscPct}%)</span>
                        <span className="tabular-nums font-medium">−₹{billDiscAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-gray-600">
                      <span>{gstLabel}</span>
                      <span className="tabular-nums font-medium">₹{lineTotals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    {shippingAmt > 0 && (
                      <div className="flex justify-between text-gray-600">
                        <span>Freight</span>
                        <span className="tabular-nums font-medium">₹{shippingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                    )}
                    {roundOff !== 0 && (
                      <div className="flex justify-between text-xs text-gray-400">
                        <span>Round Off</span>
                        <span>{roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between font-bold text-[15px] border-t border-gray-200 pt-3 mt-1 text-gray-900">
                      <span>Grand Total</span>
                      <span className="tabular-nums text-violet-700">₹{roundedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <p className="text-[11px] text-gray-400 text-right pt-1">Valid until {validUntil}</p>
                  </div>
                </div>
              </div>

              {/* ── Notes & Terms ── */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</label>
                  <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="e.g. Special rates for bulk order, delivery included…"
                    className="w-full px-4 py-3 text-sm rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white resize-none" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Terms &amp; Conditions of Quotation</label>
                  <textarea rows={3} value={terms} onChange={e => setTerms(e.target.value)}
                    className="w-full px-4 py-3 text-sm rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white resize-none" />
                </div>
              </div>

            </div>
          </div>

          {/* ── Footer ── */}
          <div className="px-8 py-3.5 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
            <p className="text-xs text-gray-400 tabular-nums">
              {items.length} item{items.length !== 1 ? 's' : ''}
              {grandTotal > 0 ? ` · Total ₹${roundedTotal.toLocaleString('en-IN')}` : ''}
            </p>
            <div className="flex gap-2.5">
              <button onClick={handleClose} disabled={submitting}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={() => handleSubmit(false)} disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm border border-violet-400 text-violet-700 rounded-lg hover:bg-violet-50 transition-colors font-medium">
                {submitting && !sendOnSave ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                Save Draft
              </button>
              <button onClick={() => handleSubmit(true)} disabled={submitting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium shadow-sm">
                {submitting && sendOnSave ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
                Save & Send
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ─── Edit Quotation Panel ──────────────────────────────────────────────────────

function EditQuotationPanel({ id, outletId, onClose, onUpdated }: {
  id: number
  outletId: number
  onClose: () => void
  onUpdated: () => void
}) {
  const [visible, setVisible]               = useState(false)
  const [loading, setLoading]               = useState(true)
  const [submitting, setSubmitting]         = useState(false)
  const [quotationNumber, setQuotationNumber] = useState('')
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null)
  const [validUntil, setValidUntil]         = useState(format(addDays(new Date(), 30), 'yyyy-MM-dd'))
  const [billDiscPct, setBillDiscPct]       = useState(0)
  const [shippingAmt, setShippingAmt]       = useState(0)
  const [notes, setNotes]                   = useState('')
  const [terms, setTerms]                   = useState('Prices are valid till the validity date mentioned above.\nGST as applicable.\nSubject to local jurisdiction.')
  const [items, setItems]                   = useState<LineItem[]>([])
  const [errors, setErrors]                 = useState<{ customer?: string; items?: string }>({})

  const { data: taxGroupsData } = useQuery({
    queryKey: ['taxGroups'],
    queryFn: () => taxGroupApi.getAll(true).then((r: any) => r.data.data ?? []),
    staleTime: 5 * 60 * 1000,
  })
  const taxGroups: any[] = taxGroupsData ?? []

  const { data: pipeConfigsData2 } = useQuery({
    queryKey: ['pipeConfigs-active'],
    queryFn: () => pipeConfigApi.getAll({ active: true, size: 200 }).then((r: any) => {
      const d = r.data.data; return (d?.content ?? d ?? []) as any[]
    }),
    staleTime: 10 * 60 * 1000,
  })
  const pipeLengths2: number[] = Array.from(new Set([
    5.25, 6.5,
    ...(pipeConfigsData2 ?? []).map((c: any) => Number(c.lengthM)).filter((l: number) => l > 0),
  ])).sort((a, b) => a - b)

  useEffect(() => {
    const frameId = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(frameId)
  }, [])

  useEffect(() => {
    quotationApi.getById(id).then(r => {
      const q = r.data.data
      setQuotationNumber(q.quotationNumber ?? '')
      if (q.customer) setSelectedCustomer(q.customer)
      if (q.validUntil) setValidUntil(q.validUntil.split('T')[0])
      if (q.notes) setNotes(q.notes)
      if (q.termsConditions) setTerms(q.termsConditions)
      setItems((q.items ?? []).map((it: any) => {
        const lm = pipeLength(it.productName ?? '')
        return {
          id: crypto.randomUUID(),
          productId: it.productId ?? null,
          productName: it.productName ?? '',
          productSku: it.productSku ?? '',
          lengthM: lm,
          meters: Number(it.quantity),
          quantity: Math.ceil(Number(it.quantity) / lm),
          unitPrice: Number(it.unitPrice),
          discountPercent: Number(it.discountPercent ?? 0),
          taxRate: Number(it.taxRate ?? 0),
        }
      }))
    }).finally(() => setLoading(false))
  }, [id])

  function handleClose() { setVisible(false); setTimeout(onClose, 300) }

  async function addProduct(p: any) {
    const unitPrice = p.sellingPrice ?? p.price ?? 0
    const lm = p.lengthM ?? pipeLength(p.name ?? '')
    const newItem: LineItem = {
      id: crypto.randomUUID(),
      productId: p.id,
      productName: p.name,
      productSku: p.sku ?? '',
      lengthM: lm,
      meters: lm,
      quantity: 1,
      unitPrice,
      discountPercent: 0,
      taxRate: p.taxGroup?.totalRate ?? 0,
    }
    try {
      const res = await discountApi.itemPreview(p.id, 1, unitPrice)
      const preview = res.data.data
      if (preview && preview.discountPct > 0) {
        newItem.discountPercent = Number(preview.discountPct)
        newItem.autoDiscountLabel = preview.label
      }
    } catch { /* no discount */ }
    setItems(prev => [...prev, newItem])
  }

  function updateItem(itemId: string, field: keyof LineItem, value: any) {
    setItems(prev => prev.map(it => {
      if (it.id !== itemId) return it
      const updated = { ...it, [field]: value }
      if (field === 'meters')  updated.quantity = Math.ceil((value as number) / (it.lengthM ?? 5.25))
      if (field === 'lengthM') updated.quantity = Math.ceil(it.meters / (value as number))
      return updated
    }))
  }

  function removeItem(itemId: string) { setItems(prev => prev.filter(it => it.id !== itemId)) }

  const lineTotals = items.reduce((acc, it) => {
    const c = calcLine(it)
    return { subtotal: acc.subtotal + c.base, lineDisc: acc.lineDisc + c.disc, tax: acc.tax + c.tax }
  }, { subtotal: 0, lineDisc: 0, tax: 0 })

  const afterLineDisc  = lineTotals.subtotal - lineTotals.lineDisc
  const billDiscAmt    = afterLineDisc * (billDiscPct / 100)
  const grandTotal     = afterLineDisc - billDiscAmt + lineTotals.tax + shippingAmt
  const roundedTotal   = Math.round(grandTotal)
  const roundOff       = parseFloat((roundedTotal - grandTotal).toFixed(2))
  const taxRates       = [...new Set(items.map(i => i.taxRate).filter(r => r > 0))]
  const gstLabel       = taxRates.length === 1 ? `GST (${taxRates[0]}%)` : 'GST'

  async function handleSubmit() {
    const newErrors: typeof errors = {}
    if (!selectedCustomer)  newErrors.customer = 'Please select a customer'
    if (items.length === 0) newErrors.items    = 'Add at least one item'
    if (Object.keys(newErrors).length > 0) { setErrors(newErrors); return }
    setErrors({})
    setSubmitting(true)
    try {
      await quotationApi.update(id, {
        customerId: selectedCustomer?.id ?? null,
        outletId,
        validUntil: validUntil ? `${validUntil}T00:00:00Z` : undefined,
        notes: notes || undefined,
        termsConditions: terms || undefined,
        items: items.map(it => ({
          productId: it.productId ?? undefined,
          productName: it.productName,
          productSku: it.productSku,
          quantity: it.meters,
          unitPrice: it.unitPrice,
          discountPercent: it.discountPercent,
          taxRate: it.taxRate,
        })),
      })
      toast.success('Quotation updated')
      onUpdated()
      handleClose()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to update quotation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      <div className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'}`} onClick={handleClose} />
      <div className={`fixed inset-y-0 right-0 left-[220px] z-50 transition-transform duration-300 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="w-full h-full bg-[#f8f9fb] flex flex-col overflow-hidden">

          <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
                <Pencil size={15} className="text-white" />
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-gray-900 leading-none">Edit {quotationNumber || 'Quotation'}</h2>
                <p className="text-xs text-gray-400 mt-0.5">Only DRAFT quotations can be edited</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleClose} className="px-3.5 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">Cancel</button>
              <button onClick={handleSubmit} disabled={submitting || loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium shadow-sm">
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                Update Draft
              </button>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <Loader2 size={28} className="animate-spin text-violet-400" />
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto">
              <div className="max-w-6xl mx-auto px-8 py-6 space-y-5">

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl shadow-md p-5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">From</p>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center shrink-0">
                        <Building2 size={17} className="text-violet-600" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-gray-900">PP Pipes Products</p>
                        <p className="text-xs text-gray-400 mt-0.5">Outlet #{outletId}</p>
                      </div>
                    </div>
                  </div>
                  <div className={`bg-white rounded-xl shadow-md p-5 ${errors.customer ? 'ring-2 ring-red-300' : ''}`}>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Quote To</p>
                    {selectedCustomer ? (
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center shrink-0 text-amber-700 font-bold text-sm">
                          {selectedCustomer.name[0]?.toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold text-gray-900 truncate">{selectedCustomer.name}</p>
                          {selectedCustomer.phone && <p className="text-xs text-gray-400 mt-0.5">{selectedCustomer.phone}</p>}
                        </div>
                        <button onClick={() => setSelectedCustomer(null)}
                          className="w-7 h-7 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 hover:text-red-400 transition-colors shrink-0">
                          <X size={13} />
                        </button>
                      </div>
                    ) : (
                      <CustomerSearchInput label="" value={selectedCustomer} onSelect={c => { setSelectedCustomer(c); setErrors(e => ({ ...e, customer: undefined })) }}
                        onClear={() => setSelectedCustomer(null)} placeholder="Search customer by name or phone…" />
                    )}
                    {errors.customer && <p className="text-xs text-red-500 mt-2">{errors.customer}</p>}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-md">
                  <div className="grid divide-x divide-gray-100" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Quotation No.</p>
                      <p className="text-sm font-medium text-gray-800">{quotationNumber}</p>
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Valid Until</p>
                      <input type="date" value={validUntil} onChange={e => setValidUntil(e.target.value)}
                        className="w-full text-sm text-gray-800 border-0 bg-transparent p-0 focus:outline-none" />
                    </div>
                    <div className="px-5 py-4">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Status</p>
                      <p className="text-sm font-medium text-amber-600">DRAFT</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-md overflow-hidden">
                  <div className="px-5 py-4 border-b border-gray-100">
                    <ProductSearch onSelect={addProduct} />
                  </div>
                  <div className="grid text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100"
                    style={{ gridTemplateColumns: '2.5fr 100px 120px 80px 72px 116px 36px' }}>
                    <div className="px-5 py-3">Description</div>
                    <div className="px-3 py-3 text-right">Meters (m)</div>
                    <div className="px-3 py-3 text-right">Price / m (₹)</div>
                    <div className="px-3 py-3 text-right">Disc %</div>
                    <div className="px-3 py-3 text-right">GST %</div>
                    <div className="px-3 py-3 text-right">Net Amount</div>
                    <div />
                  </div>
                  {items.length === 0 ? (
                    <div className="py-8 text-center">
                      <p className="text-sm text-gray-400">No items — search a product above to add</p>
                      {errors.items && <p className="text-xs text-red-500 mt-1">{errors.items}</p>}
                    </div>
                  ) : items.map((it, idx) => {
                    const c = calcLine(it)
                    return (
                      <div key={it.id}
                        className={`grid items-center border-b border-gray-100 last:border-0 ${idx % 2 === 1 ? 'bg-gray-50/40' : 'bg-white'} hover:bg-violet-50/20`}
                        style={{ gridTemplateColumns: '2.5fr 100px 120px 80px 72px 116px 36px' }}>
                        <div className="px-5 py-3">
                          <p className="text-sm font-semibold text-gray-900">{it.productName}</p>
                          {it.productSku && <p className="text-[11px] text-gray-400 mt-0.5">{it.productSku}</p>}
                          {it.autoDiscountLabel && it.discountPercent > 0 && (
                            <span className="inline-flex items-center gap-0.5 mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <Percent size={8} /> {it.autoDiscountLabel}
                            </span>
                          )}
                          {it.meters > 0 && it.unitPrice > 0 && (
                            <p className="text-[10px] text-gray-400 mt-0.5 tabular-nums">
                              {it.meters}m × ₹{it.unitPrice}/m · ≈ {it.quantity} pipe{it.quantity !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <div className="px-2 py-2.5">
                          <input type="number" min="0.01" step="0.01" value={it.meters || ''}
                            onChange={e => updateItem(it.id, 'meters', parseFloat(e.target.value) || 0)}
                            className={`w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white ${NO_SPINNER}`} />
                          {pipeLengths2.length > 0 && (
                            <select value={it.lengthM}
                              onChange={e => updateItem(it.id, 'lengthM', parseFloat(e.target.value))}
                              className="w-full mt-1 px-2 py-1 text-[10px] text-center border border-gray-200 rounded-md bg-white text-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-300 cursor-pointer">
                              {pipeLengths2.map(l => (
                                <option key={l} value={l}>{l}m</option>
                              ))}
                            </select>
                          )}
                        </div>
                        <div className="px-2 py-2.5">
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-300 pointer-events-none">₹</span>
                            <input type="number" min="0" step="0.01" value={it.unitPrice || ''}
                              onChange={e => updateItem(it.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                              className={`w-full pl-5 pr-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white ${NO_SPINNER}`} />
                          </div>
                        </div>
                        <div className="px-2 py-2.5">
                          <input type="number" min="0" max="100" step="0.5" value={it.discountPercent || ''}
                            onChange={e => updateItem(it.id, 'discountPercent', parseFloat(e.target.value) || 0)}
                            className={`w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white ${NO_SPINNER}`} />
                        </div>
                        <div className="px-2 py-2.5">
                          <GstPicker value={it.taxRate} onChange={rate => updateItem(it.id, 'taxRate', rate)} taxGroups={taxGroups} />
                        </div>
                        <div className="px-3 py-2.5 text-right">
                          <p className="text-sm font-bold text-gray-900 tabular-nums">₹{c.total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</p>
                          {c.disc > 0 && <p className="text-[10px] text-emerald-600 tabular-nums">−₹{c.disc.toLocaleString('en-IN', { minimumFractionDigits: 2 })} disc</p>}
                        </div>
                        <div className="pr-2 flex items-center justify-center">
                          <button type="button" onClick={() => removeItem(it.id)}
                            className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    )
                  })}
                  {items.length > 0 && (
                    <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex justify-end gap-8 text-sm">
                      <span className="text-gray-500">Subtotal: <span className="font-semibold text-gray-800 tabular-nums">₹{lineTotals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                      {lineTotals.lineDisc > 0 && <span className="text-emerald-600">Discount: <span className="font-semibold tabular-nums">−₹{lineTotals.lineDisc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>}
                      <span className="text-gray-500">{gstLabel}: <span className="font-semibold text-gray-800 tabular-nums">₹{lineTotals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span></span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="bg-white rounded-xl shadow-md p-5 space-y-4">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Adjustments</p>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <label className="text-xs font-medium text-gray-600 w-36 shrink-0">Trade Discount (%)</label>
                        <input type="number" min="0" max="100" step="0.5" value={billDiscPct || ''}
                          onChange={e => setBillDiscPct(parseFloat(e.target.value) || 0)} placeholder="0"
                          className={`flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white text-right ${NO_SPINNER}`} />
                        {billDiscPct > 0 && <span className="text-xs text-emerald-600 font-medium whitespace-nowrap">−₹{billDiscAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>}
                      </div>
                      <div className="flex items-center gap-3">
                        <label className="text-xs font-medium text-gray-600 w-36 shrink-0">Freight (₹)</label>
                        <input type="number" min="0" step="0.01" value={shippingAmt || ''}
                          onChange={e => setShippingAmt(parseFloat(e.target.value) || 0)} placeholder="0.00"
                          className={`flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 bg-white text-right ${NO_SPINNER}`} />
                      </div>
                    </div>
                  </div>
                  <div className="bg-white rounded-xl shadow-md p-5">
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Quotation Summary</p>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between text-gray-600">
                        <span>Subtotal</span><span className="tabular-nums font-medium">₹{lineTotals.subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {lineTotals.lineDisc > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Line Discounts</span><span className="tabular-nums font-medium">−₹{lineTotals.lineDisc.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {billDiscPct > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Trade Discount ({billDiscPct}%)</span><span className="tabular-nums font-medium">−₹{billDiscAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      <div className="flex justify-between text-gray-600">
                        <span>{gstLabel}</span><span className="tabular-nums font-medium">₹{lineTotals.tax.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      {shippingAmt > 0 && (
                        <div className="flex justify-between text-gray-600">
                          <span>Freight</span><span className="tabular-nums font-medium">₹{shippingAmt.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                        </div>
                      )}
                      {roundOff !== 0 && (
                        <div className="flex justify-between text-xs text-gray-400">
                          <span>Round Off</span><span>{roundOff > 0 ? '+' : ''}₹{roundOff.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-[15px] border-t border-gray-200 pt-3 mt-1 text-gray-900">
                        <span>Grand Total</span><span className="tabular-nums text-violet-700">₹{roundedTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
                      </div>
                      <p className="text-[11px] text-gray-400 text-right pt-1">Valid until {validUntil}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</label>
                    <textarea rows={3} value={notes} onChange={e => setNotes(e.target.value)}
                      placeholder="e.g. Special rates for bulk order…"
                      className="w-full px-4 py-3 text-sm rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white resize-none" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Terms &amp; Conditions</label>
                    <textarea rows={3} value={terms} onChange={e => setTerms(e.target.value)}
                      className="w-full px-4 py-3 text-sm rounded-xl shadow-md focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white resize-none" />
                  </div>
                </div>

              </div>
            </div>
          )}

          <div className="px-8 py-3.5 bg-white border-t border-gray-200 flex items-center justify-between shrink-0">
            <p className="text-xs text-gray-400 tabular-nums">
              {items.length} item{items.length !== 1 ? 's' : ''}
              {grandTotal > 0 ? ` · Total ₹${roundedTotal.toLocaleString('en-IN')}` : ''}
            </p>
            <div className="flex gap-2.5">
              <button onClick={handleClose} disabled={submitting}
                className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSubmit} disabled={submitting || loading}
                className="flex items-center gap-1.5 px-4 py-2 text-sm bg-violet-600 hover:bg-violet-700 disabled:opacity-50 text-white rounded-lg transition-colors font-medium shadow-sm">
                {submitting ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
                Update Draft
              </button>
            </div>
          </div>

        </div>
      </div>
    </>
  )
}

// ─── View Quotation Modal ──────────────────────────────────────────────────────

function ViewQuotationModal({ id, onClose, onStatusChange, onEdit }: { id: number; onClose: () => void; onStatusChange: () => void; onEdit: () => void }) {
  const qc = useQueryClient()
  const { outletId } = useAuthStore()
  const [updating, setUpdating]         = useState(false)
  const [emailSending, setEmailSending] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['quotation', id],
    queryFn: () => quotationApi.getById(id).then(r => r.data.data),
  })

  const changeStatus = async (status: string) => {
    setUpdating(true)
    try {
      await quotationApi.updateStatus(id, status)
      toast.success(`Quotation ${status.toLowerCase()}`)
      qc.invalidateQueries({ queryKey: ['quotation', id] })
      onStatusChange()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to update status')
    } finally {
      setUpdating(false)
    }
  }

  const handleSendEmail = async () => {
    setEmailSending(true)
    try {
      await integrationApi.sendQuotationEmail(id, outletId!)
      toast.success(`Email sent to ${data?.customer?.email}`)
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to send email')
    } finally { setEmailSending(false) }
  }

  const q = data

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-bold text-gray-900">{q?.quotationNumber ?? '…'}</h2>
            {q?.status && (
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[q.status] ?? 'bg-gray-100 text-gray-600'}`}>
                {q.status}
              </span>
            )}
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <Loader2 size={24} className="animate-spin text-gray-300" />
          </div>
        ) : q ? (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">
            {/* Header info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Customer</p>
                <p className="text-sm font-semibold text-gray-900">{q.customer?.name ?? 'Walk-in'}</p>
                {q.customer?.phone && <p className="text-xs text-gray-400">{q.customer.phone}</p>}
              </div>
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs text-gray-500 mb-1">Valid Until</p>
                <p className="text-sm font-semibold text-gray-900">
                  {q.validUntil ? format(new Date(q.validUntil), 'dd MMM yyyy') : '—'}
                </p>
                <p className="text-xs text-gray-400">Created: {format(new Date(q.createdAt), 'dd MMM yyyy')}</p>
              </div>
            </div>

            {/* Items */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Items</p>
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-[11px] text-gray-500 uppercase">
                    <tr>
                      <th className="px-4 py-2.5 text-left">Product</th>
                      <th className="px-4 py-2.5 text-center">Qty</th>
                      <th className="px-4 py-2.5 text-right">Unit Price</th>
                      <th className="px-4 py-2.5 text-center">Disc%</th>
                      <th className="px-4 py-2.5 text-right">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {q.items?.map((item: any) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-2.5">
                          <p className="font-medium text-gray-900">{item.productName}</p>
                          {item.productSku && <p className="text-xs text-gray-400">{item.productSku}</p>}
                        </td>
                        <td className="px-4 py-2.5 text-center text-gray-700">{item.quantity}</td>
                        <td className="px-4 py-2.5 text-right text-gray-700">₹{Number(item.unitPrice).toLocaleString('en-IN')}</td>
                        <td className="px-4 py-2.5 text-center text-gray-500">{item.discountPercent > 0 ? `${item.discountPercent}%` : '—'}</td>
                        <td className="px-4 py-2.5 text-right font-semibold text-gray-900">₹{Number(item.lineTotal).toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div className="flex justify-end">
              <div className="w-56 space-y-1 text-sm">
                <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>₹{Number(q.subtotal).toLocaleString('en-IN')}</span></div>
                {Number(q.discountAmount) > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>− ₹{Number(q.discountAmount).toLocaleString('en-IN')}</span></div>}
                {Number(q.taxAmount) > 0 && <div className="flex justify-between text-gray-600"><span>Tax</span><span>₹{Number(q.taxAmount).toLocaleString('en-IN')}</span></div>}
                <div className="flex justify-between font-bold text-gray-900 border-t pt-1.5"><span>Total</span><span>₹{Number(q.totalAmount).toLocaleString('en-IN')}</span></div>
              </div>
            </div>

            {/* Notes & Terms */}
            {q.notes && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Notes</p>
                <p className="text-sm text-gray-700">{q.notes}</p>
              </div>
            )}
            {q.termsConditions && (
              <div className="bg-gray-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Terms & Conditions</p>
                <p className="text-sm text-gray-600 whitespace-pre-wrap">{q.termsConditions}</p>
              </div>
            )}
          </div>
        ) : null}

        {/* Actions footer */}
        {q && (
          <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between shrink-0 rounded-b-2xl">
            <div className="flex gap-2">
              <button onClick={() => printQuotationPdf(q)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-white transition-colors">
                <Printer size={12} /> Print
              </button>
              <button onClick={() => downloadQuotationPdf(q)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-200 text-gray-600 rounded-lg hover:bg-white transition-colors">
                <Download size={12} /> Download PDF
              </button>
              <button onClick={() => printQuotationPdfModern(q)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-teal-200 text-teal-700 rounded-lg hover:bg-teal-50 transition-colors">
                <Printer size={12} /> Print Modern
              </button>
              <button onClick={() => downloadQuotationPdfModern(q)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-teal-200 text-teal-700 rounded-lg hover:bg-teal-50 transition-colors">
                <Download size={12} /> Download Modern
              </button>
              <button onClick={() => printQuotationPdfClean(q)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-50 transition-colors">
                <Printer size={12} /> Print Pro
              </button>
              <button onClick={() => downloadQuotationPdfClean(q)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-violet-200 text-violet-700 rounded-lg hover:bg-violet-50 transition-colors">
                <Download size={12} /> Download Pro
              </button>
              {q.status === 'DRAFT' && (
                <button onClick={onEdit}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-violet-300 text-violet-700 rounded-lg hover:bg-violet-50 transition-colors">
                  <Pencil size={12} /> Edit
                </button>
              )}
            </div>
            <div className="flex gap-2">
              {q.status === 'DRAFT' && (
                <button onClick={() => changeStatus('SENT')} disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50">
                  <Send size={12} /> Send
                </button>
              )}
              {q.status === 'SENT' && (
                <>
                  <button onClick={() => changeStatus('ACCEPTED')} disabled={updating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                    <CheckCircle size={12} /> Accept
                  </button>
                  <button onClick={() => changeStatus('REJECTED')} disabled={updating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50">
                    <Ban size={12} /> Reject
                  </button>
                </>
              )}
              {q.status === 'ACCEPTED' && (
                <button onClick={() => changeStatus('CONVERTED')} disabled={updating}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50">
                  <ArrowRightCircle size={12} /> Convert to Order
                </button>
              )}
              {q.customer?.email && (
                <button disabled={emailSending} onClick={handleSendEmail}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                  title={`Send email to ${q.customer.email}`}>
                  {emailSending ? <Loader2 size={12} className="animate-spin" /> : <Mail size={12} />}
                  Send Email
                </button>
              )}
              {(updating || emailSending) && <Loader2 size={16} className="animate-spin text-gray-400 self-center" />}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function QuotationsPage() {
  const { outletId } = useAuthStore()
  const oid = outletId ?? 1
  const qc = useQueryClient()
  const [search, setSearch]           = useState('')
  const [statusTab, setStatusTab]     = useState('ALL')
  const [page, setPage]               = useState(0)
  const [showCreate, setShowCreate]   = useState(false)
  const [viewId, setViewId]           = useState<number | null>(null)
  const [editId, setEditId]           = useState<number | null>(null)
  const PAGE_SIZE = 15

  const { data, isLoading } = useQuery({
    queryKey: ['quotations', oid, statusTab, page],
    queryFn: () => quotationApi.getByOutlet(oid, {
      status: statusTab === 'ALL' ? undefined : statusTab,
      page, size: PAGE_SIZE, sort: 'createdAt,desc',
    }).then(r => r.data.data),
    enabled: !!oid,
  })

  const quotations: any[]   = data?.content ?? []
  const totalPages: number  = data?.totalPages ?? 0
  const totalElements: number = data?.totalElements ?? 0

  const filtered = quotations.filter(q =>
    !search ||
    q.quotationNumber?.toLowerCase().includes(search.toLowerCase()) ||
    q.customer?.name?.toLowerCase().includes(search.toLowerCase())
  )

  const handleStatusChange = () => qc.invalidateQueries({ queryKey: ['quotations'] })

  const draftCount     = quotations.filter(q => q.status === 'DRAFT').length
  const acceptedCount  = quotations.filter(q => q.status === 'ACCEPTED').length
  const expiredCount   = quotations.filter(q => q.status === 'EXPIRED').length

  return (
    <div className="p-6">

      {/* ── Hero Header ── */}
      <div className="relative rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)] mb-6">
        <div className="absolute inset-0 overflow-hidden rounded-2xl">
          <div className="absolute inset-0 bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600" />
          <div className="absolute inset-0 opacity-[0.15]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
          <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-blue-400/20 blur-3xl" />
          <div className="absolute -bottom-8 -left-8 w-56 h-56 rounded-full bg-violet-300/20 blur-2xl" />
        </div>

        {/* Top row */}
        <div className="relative flex items-center justify-between px-8 py-6">
          <div className="flex items-center gap-4">
            <ClipboardList size={26} className="text-amber-300" />
            <div>
              <p className="text-violet-200 text-xs font-semibold tracking-widest uppercase">Sales</p>
              <h1 className="text-white text-2xl font-bold tracking-tight">Quotations</h1>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search quotation # or customer…"
                className="pl-9 pr-4 py-2 bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/40 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-white/30 w-64" />
            </div>
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-white text-violet-700 hover:bg-violet-50 px-4 py-2 rounded-lg font-semibold text-sm shadow-sm transition-colors whitespace-nowrap">
              <Plus size={16} /> New Quotation
            </button>
          </div>
        </div>

        {/* Stat strip */}
        <div className="relative border-t border-white/10 grid grid-cols-4 divide-x divide-white/10">
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{totalElements}</p>
            <p className="text-violet-200 text-xs mt-0.5">Total Quotations</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className="text-white text-xl font-bold">{draftCount}</p>
            <p className="text-violet-200 text-xs mt-0.5">Drafts</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className={`text-xl font-bold ${acceptedCount > 0 ? 'text-emerald-300' : 'text-white'}`}>{acceptedCount}</p>
            <p className="text-violet-200 text-xs mt-0.5">Accepted</p>
          </div>
          <div className="px-6 py-3 text-center">
            <p className={`text-xl font-bold ${expiredCount > 0 ? 'text-red-300' : 'text-white'}`}>{expiredCount}</p>
            <p className="text-violet-200 text-xs mt-0.5">Expired</p>
          </div>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 flex-wrap">
          {STATUS_TABS.map(s => (
            <button key={s} onClick={() => { setStatusTab(s); setPage(0) }}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                statusTab === s ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {s === 'ALL' ? 'All' : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        {totalElements > 0 && (
          <span className="text-xs text-gray-400 whitespace-nowrap ml-auto">{totalElements} quotation{totalElements !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-gradient-to-r from-violet-50 to-blue-50 border-y border-violet-100">
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Quotation #</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Customer</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Items</th>
              <th className="px-4 py-3 text-right text-[11px] font-bold text-violet-500 uppercase tracking-widest">Total</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Valid Until</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Status</th>
              <th className="px-4 py-3 text-left text-[11px] font-bold text-violet-500 uppercase tracking-widest">Created</th>
              <th className="px-4 py-3 text-center text-[11px] font-bold text-violet-500 uppercase tracking-widest">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              Array(5).fill(0).map((_, i) => (
                <tr key={i}>{Array(8).fill(0).map((_, j) => (
                  <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>
                ))}</tr>
              ))
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="text-center py-16">
                  <FileText size={36} className="mx-auto text-gray-200 mb-3" />
                  <p className="text-sm text-gray-400">
                    {search ? 'No quotations match your search' : 'No quotations yet'}
                  </p>
                  {!search && (
                    <button onClick={() => setShowCreate(true)}
                      className="mt-3 text-sm text-primary-600 hover:text-primary-700 font-medium">
                      Create first quotation →
                    </button>
                  )}
                </td>
              </tr>
            ) : filtered.map((q: any) => (
              <tr key={q.id} onClick={() => setViewId(q.id)}
                className="hover:bg-violet-50/40 transition-colors cursor-pointer">
                <td className="px-4 py-3">
                  <span className="text-sm font-mono font-medium text-primary-600">{q.quotationNumber}</span>
                </td>
                <td className="px-4 py-3">
                  {q.customer ? (
                    <div>
                      <p className="text-sm text-gray-900">{q.customer.name}</p>
                      <p className="text-xs text-gray-400">{q.customer.phone}</p>
                    </div>
                  ) : (
                    <span className="text-xs text-gray-400">Walk-in</span>
                  )}
                </td>
                <td className="px-4 py-3 text-center text-sm text-gray-700">{q.items?.length ?? 0}</td>
                <td className="px-4 py-3 text-right text-sm font-semibold text-gray-900">
                  ₹{Number(q.totalAmount ?? 0).toLocaleString('en-IN')}
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {q.validUntil ? format(new Date(q.validUntil), 'dd MMM yyyy') : '—'}
                </td>
                <td className="px-4 py-3 text-center">
                  <span className={`text-[11px] font-medium px-2.5 py-1 rounded-full ${STATUS_COLORS[q.status] ?? 'bg-gray-100 text-gray-500'}`}>
                    {q.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                  {q.createdAt ? format(new Date(q.createdAt), 'dd MMM yyyy') : '—'}
                </td>
                <td className="px-4 py-3 text-center" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-center gap-1">
                    <button onClick={() => setViewId(q.id)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-primary-600 hover:bg-primary-50 transition-colors" title="View">
                      <Eye size={15} />
                    </button>
                    {q.status === 'DRAFT' && (
                      <button onClick={() => setEditId(q.id)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="Edit">
                        <Pencil size={15} />
                      </button>
                    )}
                    <button onClick={() => printQuotationPdf(q)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="Print Classic">
                      <Printer size={15} />
                    </button>
                    <button onClick={() => downloadQuotationPdf(q)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Download Classic PDF">
                      <Download size={15} />
                    </button>
                    <button onClick={() => printQuotationPdfModern(q)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Print Modern">
                      <Printer size={15} />
                    </button>
                    <button onClick={() => downloadQuotationPdfModern(q)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors" title="Download Modern PDF">
                      <Download size={15} />
                    </button>
                    <button onClick={() => printQuotationPdfClean(q)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="Print Pro">
                      <Printer size={15} />
                    </button>
                    <button onClick={() => downloadQuotationPdfClean(q)}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-violet-600 hover:bg-violet-50 transition-colors" title="Download Pro PDF">
                      <Download size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
            <p className="text-xs text-gray-500">Page {page + 1} of {totalPages}</p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const pg = totalPages <= 5 ? i : Math.max(0, Math.min(page - 2, totalPages - 5)) + i
                return (
                  <button key={pg} onClick={() => setPage(pg)}
                    className={`w-7 h-7 text-xs rounded-lg border transition-colors ${pg === page ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:bg-white'}`}>
                    {pg + 1}
                  </button>
                )
              })}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed">
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {showCreate && (
        <CreateQuotationPanel
          outletId={oid}
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            qc.invalidateQueries({ queryKey: ['quotations'] })
            qc.invalidateQueries({ queryKey: ['quotation-next-number'] })
          }}
        />
      )}

      {viewId !== null && (
        <ViewQuotationModal
          id={viewId}
          onClose={() => setViewId(null)}
          onStatusChange={handleStatusChange}
          onEdit={() => { setEditId(viewId); setViewId(null) }}
        />
      )}

      {editId !== null && (
        <EditQuotationPanel
          id={editId}
          outletId={oid}
          onClose={() => setEditId(null)}
          onUpdated={() => { qc.invalidateQueries({ queryKey: ['quotations'] }); setEditId(null) }}
        />
      )}
    </div>
  )
}
