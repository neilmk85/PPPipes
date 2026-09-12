import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import QRCode from 'qrcode'

const HEADER_H  = 40
const CONTENT_T = 46
const FOOTER_Y  = 274
const PAGE_W    = 210

const INR = (n: number) =>
  Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
  doc.setFillColor(230, 243, 250)
  doc.rect(0, 0, PAGE_W, 32, 'F')
  doc.setDrawColor(190, 220, 238)
  doc.setLineWidth(0.25)
  for (let i = 1.5; i <= 31; i += 1.5) {
    doc.line(0, i, PAGE_W, i)
  }
  if (deityB64) doc.addImage(deityB64, 'JPEG', 5,  2, 28, 28)
  if (logoB64)  doc.addImage(logoB64,  'PNG',  36, 2, 32, 28)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(24)
  doc.setTextColor(31, 73, 125)
  doc.text('Pipe Products Pvt. Ltd.', 80, 22)
  doc.setFillColor(70, 130, 180)
  doc.rect(0, 32, PAGE_W, 8, 'F')
  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.text('Manufacturer of PSC, PCCP, BWSC & RCC Pipes', PAGE_W / 2, 37.5, { align: 'center' })
  doc.setTextColor(30, 30, 30)
}

function drawPageFooter(doc: jsPDF, logoB64: string) {
  // "Computer-generated" disclaimer above footer
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(6.5)
  doc.setTextColor(140, 140, 140)
  doc.text(
    'This is a computer-generated Purchase Order issued by P&P Pipe Products Pvt. Ltd. and does not require a physical signature.',
    PAGE_W / 2, FOOTER_Y - 3, { align: 'center' }
  )

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

export async function buildPurchaseOrderPdf(po: any): Promise<jsPDF> {
  const verifyUrl = `https://system.pppipeproducts.com/verify/po/${encodeURIComponent(po.poNumber ?? '')}`

  const [logoB64, deityB64, qrDataUrl] = await Promise.all([
    loadImgBase64('/pp-logo.png'),
    loadImgBase64('/pp-deity.jpg'),
    QRCode.toDataURL(verifyUrl, { width: 128, margin: 1, color: { dark: '#1e497d', light: '#ffffff' } }),
  ])

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const L = 14
  const R = 196

  // ── Page 1 ──────────────────────────────────────────────────────────────────
  drawPageHeader(doc, logoB64, deityB64)
  drawPageFooter(doc, logoB64)

  // PO number + date line
  const dateStr = po.createdAt
    ? new Date(po.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(30, 30, 30)
  doc.text(po.poNumber ?? 'P&P/PO/2026-27', L, CONTENT_T)
  doc.text(`Date: ${dateStr}`, R, CONTENT_T, { align: 'right' })

  // "PURCHASE ORDER" heading
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(16)
  doc.setTextColor(31, 73, 125)
  doc.text('PURCHASE ORDER', PAGE_W / 2, CONTENT_T + 10, { align: 'center' })
  doc.setDrawColor(70, 130, 180)
  doc.setLineWidth(0.5)
  doc.line(62, CONTENT_T + 12, 148, CONTENT_T + 12)
  doc.setTextColor(30, 30, 30)

  // Two info boxes
  let y = CONTENT_T + 22
  const boxH = 34
  const midX = PAGE_W / 2

  // Left box — Purchase Order By (us)
  doc.setFillColor(240, 247, 255)
  doc.roundedRect(L, y, midX - L - 3, boxH, 2, 2, 'F')
  doc.setDrawColor(200, 220, 240)
  doc.setLineWidth(0.3)
  doc.roundedRect(L, y, midX - L - 3, boxH, 2, 2, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(80, 120, 180)
  doc.text('PURCHASE ORDER BY', L + 3, y + 5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(20, 20, 20)
  doc.text('P&P Pipe Products Pvt. Ltd.', L + 3, y + 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)
  doc.text('Gat No. 156, At Post Hotgi,', L + 3, y + 17)
  doc.text('Tal. South Solapur, Dist. Solapur - 413215.', L + 3, y + 22)
  doc.text('Cell: 9922450055', L + 3, y + 27)
  doc.text('GSTIN: 27AADCP9803A1Z1', L + 3, y + 32)

  // Right box — Purchase Order To (vendor)
  const vendor = po.supplier ?? {}
  doc.setFillColor(255, 252, 240)
  doc.roundedRect(midX + 3, y, R - midX - 3, boxH, 2, 2, 'F')
  doc.setDrawColor(240, 220, 160)
  doc.roundedRect(midX + 3, y, R - midX - 3, boxH, 2, 2, 'S')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(160, 120, 40)
  doc.text('PURCHASE ORDER TO', midX + 6, y + 5)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(20, 20, 20)
  const vendorName = vendor.name ?? 'Vendor'
  doc.text(vendorName, midX + 6, y + 11)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(60, 60, 60)
  const vendorLines: string[] = []
  if (vendor.address) vendorLines.push(vendor.address)
  if (vendor.city || vendor.state) vendorLines.push([vendor.city, vendor.state].filter(Boolean).join(', '))
  if (vendor.phone) vendorLines.push(`Tel: ${vendor.phone}`)
  if (vendor.gstin) vendorLines.push(`GSTIN: ${vendor.gstin}`)
  vendorLines.slice(0, 4).forEach((line, idx) => {
    const wrappedLines = doc.splitTextToSize(line, R - midX - 9)
    doc.text(wrappedLines[0] ?? line, midX + 6, y + 17 + idx * 5)
  })
  doc.setTextColor(30, 30, 30)

  // Items table
  // Col widths: 7+55+9+24+24+13+22+28 = 182mm (= R - L = 196 - 14)
  const items: any[] = po.items ?? []

  interface ItemMeta { name: string; desc: string }
  const itemMeta: ItemMeta[] = items.map((item: any) => {
    const parts = (item.description ?? '').split('\n')
    return {
      name: item.product?.name ?? parts[0] ?? '—',
      desc: parts.slice(1).join(' '),
    }
  })

  const tableRows = items.map((item: any, idx: number) => {
    const { name, desc } = itemMeta[idx]
    const displayName = desc ? `${name}\n${desc}` : name
    const qty = parseFloat(item.orderedQuantity ?? item.qty ?? 1)
    const rate = parseFloat(item.unitCost ?? 0)
    const taxRate = parseFloat(item.taxRate ?? 0)
    const subtotal = qty * rate
    const tax = subtotal * taxRate / 100
    const total = subtotal + tax
    return [
      String(idx + 1),
      displayName,
      qty % 1 === 0 ? String(qty) : qty.toFixed(2),
      INR(rate),
      INR(subtotal),
      INR(tax),
      INR(total),
    ]
  })

  const subtotalVal = parseFloat(String(po.subtotal ?? 0))
  const taxVal = parseFloat(String(po.taxAmount ?? 0))
  const grandTotal = parseFloat(String(po.totalAmount ?? 0))

  // DESC col uses custom didDrawCell at NAME_FONT/DESC_FONT.
  // Number cols use NUM_FONT so widest Indian-format amount (e.g. "59,54,634.00" ≈ 18mm at 9.5pt)
  // fits comfortably inside each column's content area (col width − 2×cellPadding).
  const NAME_FONT  = 11    // description name line
  const DESC_FONT  = 10    // description sub-text line
  const NUM_FONT   = 9.5   // numeric body cells
  const HEAD_FONT  = 9     // header row
  const NAME_LINE_H = 5.5  // mm per name line in didDrawCell
  const DESC_LINE_H = 5.0  // mm per desc line in didDrawCell
  // Col widths: 7+48+10+29+29+29+30 = 182 = R−L ✓
  // Content width for 29mm col at 2.5mm pad = 29−5 = 24mm → "59,54,634.00" @9.5pt ≈ 18mm ✓

  autoTable(doc, {
    startY: y + boxH + 6,
    head: [['#', 'Item Description', 'Qty', 'Unit Rate (₹)', 'Amount', 'GST (18%)', 'Total']],
    body: tableRows,
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: NUM_FONT, cellPadding: 2.5, textColor: [30, 30, 30], overflow: 'linebreak' },
    rowPageBreak: 'avoid',
    headStyles: { fillColor: [31, 73, 125], textColor: 255, fontStyle: 'normal', fontSize: HEAD_FONT, halign: 'center', valign: 'middle', minCellHeight: 10 },
    columnStyles: {
      // # col needs 10mm: 2-digit number "10" at 9.5pt ≈ 4mm + 2×2.5mm padding = 9mm
      0: { cellWidth: 10, halign: 'center', valign: 'middle' },
      1: { cellWidth: 48, halign: 'left',   fontSize: NAME_FONT },
      2: { cellWidth: 10, halign: 'center', valign: 'middle' },
      3: { cellWidth: 29, halign: 'right',  valign: 'middle' },
      4: { cellWidth: 29, halign: 'right',  valign: 'middle' },
      5: { cellWidth: 29, halign: 'right',  valign: 'middle' },
      6: { cellWidth: 27, halign: 'right',  valign: 'middle' },
    },
    margin: { left: L, right: PAGE_W - R, top: HEADER_H + 4, bottom: 297 - FOOTER_Y + 8 },
    tableLineWidth: 0.4,
    tableLineColor: [160, 160, 160],
    didParseCell: (data: any) => {
      // Pre-calculate exact row height for description column so autoTable
      // never allocates a shorter cell than what didDrawCell actually draws.
      if (data.section !== 'body' || data.column.index !== 1) return
      const meta = itemMeta[data.row.index]
      if (!meta) return
      const pad = 2.5
      const contentW = 48 - pad * 2
      doc.setFontSize(NAME_FONT)
      const nameLines: string[] = doc.splitTextToSize(meta.name, contentW)
      // Height consumed: top-pad + first-baseline + (lines-1)×lineH + bottom-pad
      let h = pad + NAME_FONT * 0.3528 + (nameLines.length - 1) * NAME_LINE_H
      if (meta.desc) {
        doc.setFontSize(DESC_FONT)
        const descLines: string[] = doc.splitTextToSize(meta.desc, contentW)
        const descLineH = DESC_FONT * 0.3528 * 1.15
        // gap between name bottom and desc first baseline
        h += NAME_LINE_H + (DESC_LINE_H - DESC_FONT * 0.3528)
        h += (descLines.length - 1) * descLineH
      }
      h += pad * 2  // bottom padding + small clearance
      data.cell.styles.minCellHeight = Math.max(h, 16)
    },
    didDrawPage: (data: any) => {
      drawPageHeader(doc, logoB64, deityB64)
      drawPageFooter(doc, logoB64)
    },
    didDrawCell: (data: any) => {
      if (data.section !== 'body') return

      // ── Description column: bold name + normal description ──────────────────
      if (data.column.index === 1) {
        const meta = itemMeta[data.row.index]
        if (!meta) return

        doc.setFillColor(255, 255, 255)
        doc.rect(data.cell.x + 0.2, data.cell.y + 0.2, data.cell.width - 0.4, data.cell.height - 0.4, 'F')

        const pad = 2.5
        const maxW = data.cell.width - pad * 2
        let textY = data.cell.y + pad + NAME_FONT * 0.3528

        doc.setFont('helvetica', 'bold')
        doc.setFontSize(NAME_FONT)
        doc.setTextColor(20, 20, 20)
        const nameLines: string[] = doc.splitTextToSize(meta.name, maxW)
        doc.text(nameLines, data.cell.x + pad, textY)
        textY += nameLines.length * NAME_LINE_H

        if (meta.desc) {
          doc.setFont('helvetica', 'normal')
          doc.setFontSize(DESC_FONT)
          doc.setTextColor(90, 90, 90)
          const descLines: string[] = doc.splitTextToSize(meta.desc, maxW)
          doc.text(descLines, data.cell.x + pad, textY + DESC_LINE_H - DESC_FONT * 0.3528)
        }
        doc.setTextColor(30, 30, 30)
      }
    },
  })

  // Summary block after table
  const finalY = (doc as any).lastAutoTable?.finalY ?? y + boxH + 6 + tableRows.length * 10
  const summaryX = R - 75
  const summaryW = 75

  if (finalY + 42 < FOOTER_Y) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setFillColor(248, 250, 255)
    doc.rect(summaryX, finalY + 4, summaryW, 38, 'F')
    doc.setDrawColor(200, 210, 230)
    doc.setLineWidth(0.3)
    doc.rect(summaryX, finalY + 4, summaryW, 38, 'S')

    doc.setTextColor(60, 60, 60)
    doc.text('Subtotal (excl. GST):', summaryX + 3, finalY + 14)
    doc.text('GST:', summaryX + 3, finalY + 24)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(31, 73, 125)
    doc.text('Grand Total:', summaryX + 3, finalY + 36)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(11)
    doc.setTextColor(30, 30, 30)
    doc.text(INR(subtotalVal), R - 3, finalY + 14, { align: 'right' })
    doc.text(INR(taxVal), R - 3, finalY + 24, { align: 'right' })
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(12)
    doc.setTextColor(31, 73, 125)
    doc.text(INR(grandTotal), R - 3, finalY + 36, { align: 'right' })
    doc.setTextColor(30, 30, 30)
  }

  // ── Page 2 — Terms ──────────────────────────────────────────────────────────
  doc.addPage()
  drawPageHeader(doc, logoB64, deityB64)
  drawPageFooter(doc, logoB64)

  let ty = CONTENT_T
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.setTextColor(31, 73, 125)
  doc.text('Terms & Conditions', L, ty)
  doc.setDrawColor(70, 130, 180)
  doc.setLineWidth(0.4)
  doc.line(L, ty + 2, R, ty + 2)
  ty += 10

  // Use saved terms if available, else fall back to defaults
  const termsText: string = po.terms || `1. All the above are Final Supply rates only.
2. Payment: 30% Advance along with Purchase Order. 50% immediately on Delivery. 20% immediately after testing.
3. Taxes: GST @ 18% extra. Or as applicable at the time of invoicing.
4. Transportation: Transportation to site is included in price.
5. Delivery: Delivery within 10 to 12 Weeks from the date of receipt of advance, along with your firm order whichever is later.
6. Once order is booked cannot be cancelled. In case of order cancelled dispatch, 25% of the order value will be charged to buyer as commitment charges, and balance will be refunded back to buyer after 6 month of lockout period.
7. Buyer will have to arrange the storage of equipment in a covered hall with lock and key facility at your site so as to protect equipment / accessories from theft and weather effect.
8. Part Fabrication and Erection will be done at your factory by us. For this electricity required to be supplied by you free of cost. Unskilled Manpower, Crane, Boarding, Lodging to our Engineer and staff shall be borne by the purchaser.
9. Foundations casting, installation of drives for spinning machine and also for pipe and Mould handling equipment which will have to be done by you at your cost, only guidance will be given by us.
10. Erection: Erection and assembly in 3 days from the date of supply of material at site / completion of foundations / supply of electricity at site for part fabrication and erection / supply and installation of motors and electricity accessories / supply of core pipes for winding and coating whichever is later.
11. Warranty: 12 months warranty from the date of supply against any manufacturing defects or bad workmanship. All rubber, plastic items and all electric/electronic items (fuses, SSR, PLC etc.) shall not be covered under warranty.
12. This quotation is valid for 10 days from the date of quotation.`
  const terms = termsText.split('\n').filter(line => line.trim()).map(line => {
    const m = line.match(/^(\d+\.)\s*(.*)$/)
    return m ? { heading: m[1], body: m[2] } : { heading: '', body: line }
  })

  doc.setTextColor(30, 30, 30)
  const termLineH = 6.5
  const termFontSize = 10.5

  for (const term of terms) {
    if (ty > FOOTER_Y - 18) {
      doc.addPage()
      drawPageHeader(doc, logoB64, deityB64)
      drawPageFooter(doc, logoB64)
      ty = CONTENT_T
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(termFontSize)
    doc.text(term.heading, L, ty)
    doc.setFont('helvetica', 'normal')
    const lines = doc.splitTextToSize(term.body, R - L - 8)
    doc.text(lines, L + 8, ty)
    ty += lines.length * termLineH + 3
  }

  // Signatory block — compact, fits in ~52mm so it lands on same page as last terms
  ty += 8
  if (ty > FOOTER_Y - 58) {
    doc.addPage()
    drawPageHeader(doc, logoB64, deityB64)
    drawPageFooter(doc, logoB64)
    ty = CONTENT_T
  }

  const sigBlockH = 48
  const thirdW = (R - L) / 3

  // Left third — QR code + verify label
  const qrSize = 26
  const qrX = L + (thirdW - qrSize) / 2
  doc.addImage(qrDataUrl, 'PNG', qrX, ty + 4, qrSize, qrSize)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(100, 100, 100)
  doc.text('Scan to verify', L + thirdW / 2, ty + 4 + qrSize + 4, { align: 'center' })

  // Middle third — Accepted by (vendor)
  const midStart = L + thirdW + 2
  doc.setFillColor(255, 252, 240)
  doc.setDrawColor(200, 185, 130)
  doc.setLineWidth(0.3)
  doc.roundedRect(midStart, ty, thirdW - 4, sigBlockH, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(140, 100, 30)
  doc.text('ACCEPTED BY (VENDOR)', midStart + 3, ty + 7)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(80, 80, 80)
  doc.text('Name:', midStart + 3, ty + 18)
  doc.text('Sign:', midStart + 3, ty + 30)
  doc.text('Date:', midStart + 3, ty + 42)
  doc.setDrawColor(160, 140, 100)
  doc.line(midStart + 16, ty + 18, midStart + thirdW - 6, ty + 18)
  doc.line(midStart + 16, ty + 30, midStart + thirdW - 6, ty + 30)
  doc.line(midStart + 16, ty + 42, midStart + thirdW - 6, ty + 42)

  // Right third — Authorised signatory
  const rightStart = L + 2 * thirdW + 4
  doc.setFillColor(240, 247, 255)
  doc.setDrawColor(180, 210, 240)
  doc.roundedRect(rightStart, ty, R - rightStart, sigBlockH, 2, 2, 'FD')
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7.5)
  doc.setTextColor(50, 90, 160)
  doc.text('FOR P&P PIPE PRODUCTS', rightStart + 3, ty + 7)
  doc.text('PVT. LTD.', rightStart + 3, ty + 13)
  doc.setDrawColor(100, 140, 200)
  doc.line(rightStart + 3, ty + sigBlockH - 14, R - 3, ty + sigBlockH - 14)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8.5)
  doc.setTextColor(40, 40, 40)
  doc.text('Authorised Signatory', rightStart + 3, ty + sigBlockH - 7)

  return doc
}
