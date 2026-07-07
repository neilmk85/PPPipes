import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import {
  Loader2, RefreshCw, Download, Search,
  ChevronDown, ChevronRight, CheckCircle, Users, FileText,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { reportApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import { DateRangePicker } from '@/components/DateRangePicker'


const AGING_COLORS: Record<string, string> = {
  current:   'bg-green-50 text-green-700',
  days1_30:  'bg-yellow-50 text-yellow-700',
  days31_60: 'bg-orange-50 text-orange-700',
  days61_90: 'bg-red-50 text-red-600',
  days90plus:'bg-red-100 text-red-800',
}

type Invoice = {
  invoiceNumber: string; issueDate: string; dueDate: string | null
  totalAmount: number; paidAmount: number; outstanding: number; status: string; daysOverdue: number
}
type DebtorRow = {
  customerId: number; name: string; phone: string; gstin: string
  totalInvoiced: number; totalPaid: number; outstanding: number
  current: number; days1_30: number; days31_60: number; days61_90: number; days90plus: number
  invoices: Invoice[]
}

type Tab = 'summary' | 'party-wise' | 'invoice-aging'
const TABS: { key: Tab; label: string }[] = [
  { key: 'summary',       label: 'Summary' },
  { key: 'party-wise',    label: 'Party-wise' },
  { key: 'invoice-aging', label: 'Invoice Aging' },
]

const fmt  = (n: number) => `₹${n.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
const fmt2 = (n: number) => `₹${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

export default function DebtorsReportPage() {
  const { outletId } = useAuthStore()
  const oid = outletId ?? 1
  const [tab, setTab]           = useState<Tab>('summary')
  const [rows, setRows]         = useState<DebtorRow[]>([])
  const [loading, setLoading]   = useState(false)
  const [exporting, setExporting] = useState(false)
  const [expanded, setExpanded] = useState<Set<number>>(new Set())
  const [search, setSearch]     = useState('')
  const [invSearch, setInvSearch] = useState('')
  const [from, setFrom]         = useState('')
  const [to,   setTo]           = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const res = await reportApi.getDebtorsLedger(oid, from, to)
      const raw: any[] = res.data.data || []
      setRows(raw.map(r => ({
        ...r,
        totalInvoiced: Number(r.totalInvoiced),
        totalPaid:     Number(r.totalPaid),
        outstanding:   Number(r.outstanding),
        current:       Number(r.current),
        days1_30:      Number(r.days1_30),
        days31_60:     Number(r.days31_60),
        days61_90:     Number(r.days61_90),
        days90plus:    Number(r.days90plus),
        invoices: (r.invoices || []).map((inv: any) => ({
          ...inv,
          totalAmount: Number(inv.totalAmount),
          paidAmount:  Number(inv.paidAmount),
          outstanding: Number(inv.outstanding),
        })),
      })))
    } catch { toast.error('Failed to load debtors ledger') }
    finally { setLoading(false) }
  }

  useEffect(() => { load() }, [oid, from, to])

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await reportApi.exportDebtorsCsv(oid, from, to)
      const url = URL.createObjectURL(new Blob([res.data as any], { type: 'text/csv' }))
      const a = document.createElement('a'); a.href = url; a.download = 'debtors_ledger.csv'; a.click()
      URL.revokeObjectURL(url)
      toast.success('CSV downloaded')
    } catch { toast.error('Export failed') }
    finally { setExporting(false) }
  }

  const handleExportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
    const pageW = doc.internal.pageSize.getWidth()
    const fmtDMY = (iso: string) => { if (!iso) return '—'; const [y,m,d] = iso.split('-'); return `${d}/${m}/${y}` }
    const dateRange = from && to ? `${fmtDMY(from)} – ${fmtDMY(to)}` : 'All Time'

    // Header
    doc.setFillColor(109, 40, 217)
    doc.rect(0, 0, pageW, 50, 'F')
    doc.setTextColor(255, 255, 255)
    doc.setFontSize(16); doc.setFont('helvetica', 'bold')
    doc.text('Debtors Ledger', 40, 22)
    doc.setFontSize(9); doc.setFont('helvetica', 'normal')
    doc.text('Sundry Debtors · Accounts Receivable', 40, 36)
    doc.text(`Period: ${dateRange}`, pageW - 40, 22, { align: 'right' })
    doc.text(`Generated: ${fmtDMY(new Date().toISOString().split('T')[0])}`, pageW - 40, 36, { align: 'right' })

    // Summary strip
    doc.setTextColor(30, 30, 30)
    const summaryY = 62
    const cols = [
      ['Parties', rows.length.toString()],
      ['Total Invoiced', fmt(totals.totalInvoiced)],
      ['Total Received', fmt(totals.totalPaid)],
      ['Outstanding', fmt(totals.outstanding)],
      ['1–30 Days', fmt(totals.days1_30)],
      ['31–90 Days', fmt(totals.days31_60 + totals.days61_90)],
      ['90+ Days', fmt(totals.days90plus)],
    ]
    const colW = (pageW - 80) / cols.length
    cols.forEach(([label, value], i) => {
      const x = 40 + i * colW
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10)
      doc.text(value, x, summaryY)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor(100, 100, 100)
      doc.text(label, x, summaryY + 12)
      doc.setTextColor(30, 30, 30)
    })

    // Party-wise table
    autoTable(doc, {
      startY: summaryY + 28,
      head: [['#', 'Party', 'GSTIN', 'Invoiced', 'Received', 'Outstanding', 'Current', '1–30d', '31–60d', '61–90d', '90+d']],
      body: rows.map((r, i) => [
        i + 1,
        r.name + (r.phone ? `\n${r.phone}` : ''),
        r.gstin || '—',
        fmt2(r.totalInvoiced),
        fmt2(r.totalPaid),
        fmt2(r.outstanding),
        r.current    > 0 ? fmt2(r.current)    : '—',
        r.days1_30   > 0 ? fmt2(r.days1_30)   : '—',
        r.days31_60  > 0 ? fmt2(r.days31_60)  : '—',
        r.days61_90  > 0 ? fmt2(r.days61_90)  : '—',
        r.days90plus > 0 ? fmt2(r.days90plus) : '—',
      ]),
      foot: [['', `Total (${rows.length} parties)`, '', fmt2(totals.totalInvoiced), fmt2(totals.totalPaid),
        fmt2(totals.outstanding), fmt2(totals.current), fmt2(totals.days1_30),
        fmt2(totals.days31_60), fmt2(totals.days61_90), fmt2(totals.days90plus)]],
      headStyles: { fillColor: [109, 40, 217], textColor: 255, fontSize: 7.5, fontStyle: 'bold', halign: 'center' },
      footStyles: { fillColor: [240, 235, 255], textColor: [50, 50, 50], fontSize: 7.5, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 22, halign: 'center' },
        1: { cellWidth: 130 },
        2: { cellWidth: 90, font: 'courier', fontSize: 7 },
        3: { halign: 'right' }, 4: { halign: 'right', textColor: [22, 163, 74] },
        5: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },
        6: { halign: 'right', textColor: [22, 163, 74] },
        7: { halign: 'right', textColor: [161, 98, 7] },
        8: { halign: 'right', textColor: [194, 65, 12] },
        9: { halign: 'right', textColor: [185, 28, 28] },
        10: { halign: 'right', textColor: [153, 27, 27], fontStyle: 'bold' },
      },
      styles: { fontSize: 7.5, cellPadding: 4 },
      alternateRowStyles: { fillColor: [249, 250, 255] },
      margin: { left: 40, right: 40 },
    })

    // Invoice detail pages — one section per party
    rows.forEach(r => {
      if (!r.invoices.length) return
      doc.addPage()
      const y0 = 40
      doc.setFillColor(245, 243, 255)
      doc.rect(0, 0, pageW, 34, 'F')
      doc.setTextColor(109, 40, 217); doc.setFontSize(11); doc.setFont('helvetica', 'bold')
      doc.text(r.name, 40, 20)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(100, 100, 100)
      doc.text(`GSTIN: ${r.gstin || '—'}  ·  ${r.phone || ''}  ·  Outstanding: ${fmt2(r.outstanding)}`, 40, 30)

      autoTable(doc, {
        startY: y0,
        head: [['Invoice #', 'Issue Date', 'Due Date', 'Amount', 'Received', 'Outstanding', 'Aging']],
        body: r.invoices.map(inv => [
          inv.invoiceNumber,
          inv.issueDate,
          inv.dueDate ?? '—',
          fmt2(inv.totalAmount),
          fmt2(inv.paidAmount),
          fmt2(inv.outstanding),
          inv.daysOverdue === 0 ? 'Current' : `${inv.daysOverdue}d overdue`,
        ]),
        headStyles: { fillColor: [139, 92, 246], textColor: 255, fontSize: 7.5, fontStyle: 'bold' },
        columnStyles: {
          0: { fontStyle: 'bold', textColor: [109, 40, 217] },
          3: { halign: 'right' }, 4: { halign: 'right', textColor: [22, 163, 74] },
          5: { halign: 'right', fontStyle: 'bold', textColor: [220, 38, 38] },
          6: { halign: 'center' },
        },
        styles: { fontSize: 7.5, cellPadding: 4 },
        alternateRowStyles: { fillColor: [250, 248, 255] },
        margin: { left: 40, right: 40 },
      })
    })

    doc.save(`Debtors_Ledger_${from}_${to}.pdf`)
    toast.success('PDF downloaded')
  }

  const toggle = (id: number) => setExpanded(prev => {
    const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next
  })

  const filtered = rows.filter(r =>
    !search || r.name.toLowerCase().includes(search.toLowerCase()) ||
    r.phone.includes(search) || r.gstin.toLowerCase().includes(search.toLowerCase())
  )

  const allInvoices = rows.flatMap(r => r.invoices.map(inv => ({ ...inv, partyName: r.name })))
    .filter(inv => !invSearch || inv.invoiceNumber.toLowerCase().includes(invSearch.toLowerCase()) ||
      inv.partyName.toLowerCase().includes(invSearch.toLowerCase()))

  const totals = filtered.reduce(
    (a, r) => ({ totalInvoiced: a.totalInvoiced + r.totalInvoiced, totalPaid: a.totalPaid + r.totalPaid,
      outstanding: a.outstanding + r.outstanding, current: a.current + r.current,
      days1_30: a.days1_30 + r.days1_30, days31_60: a.days31_60 + r.days31_60,
      days61_90: a.days61_90 + r.days61_90, days90plus: a.days90plus + r.days90plus }),
    { totalInvoiced: 0, totalPaid: 0, outstanding: 0, current: 0, days1_30: 0, days31_60: 0, days61_90: 0, days90plus: 0 }
  )

  const agingChart = [
    { name: 'Current',    value: totals.current },
    { name: '1–30 days',  value: totals.days1_30 },
    { name: '31–60 days', value: totals.days31_60 },
    { name: '61–90 days', value: totals.days61_90 },
    { name: '90+ days',   value: totals.days90plus },
  ].filter(d => d.value > 0)

  const statStrip = [
    { label: 'Parties',       value: rows.length.toString(),       sub: 'total debtors' },
    { label: 'Total Invoiced',value: fmt(totals.totalInvoiced),    sub: 'gross invoiced' },
    { label: 'Total Received',value: fmt(totals.totalPaid),        sub: 'payments received' },
    { label: 'Outstanding',   value: fmt(totals.outstanding),      sub: 'total receivable', warn: totals.outstanding > 0 },
    { label: 'Current',       value: fmt(totals.current),          sub: 'not yet due' },
    { label: '1–30 Days',     value: fmt(totals.days1_30),         sub: 'overdue',           warn: totals.days1_30 > 0 },
    { label: '31–90 Days',    value: fmt(totals.days31_60 + totals.days61_90), sub: 'overdue', warn: (totals.days31_60 + totals.days61_90) > 0 },
    { label: '90+ Days',      value: fmt(totals.days90plus),       sub: 'critical',           warn: totals.days90plus > 0 },
  ]

  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6 font-inter">

      {/* ── Hero header ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 shadow-[0_8px_40px_rgba(109,40,217,0.30)]">

        {/* Title row */}
        <div className="relative flex items-center justify-between px-8 py-5">
          <div className="flex items-center gap-5">
            <div className="w-12 h-12 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <Users size={22} className="text-amber-300" />
            </div>
            <div>
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">Reports</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Debtors Ledger</h1>
              <p className="text-sm text-blue-200 mt-0.5">Sundry Debtors · Accounts Receivable</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={loading}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 disabled:opacity-50 transition-colors">
              {loading ? <Loader2 size={15} className="animate-spin text-white" /> : <RefreshCw size={15} className="text-white" />}
            </button>
            <button onClick={handleExport} disabled={exporting}
              className="flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 active:scale-95 text-amber-900 px-3.5 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-60 transition-all shadow-sm">
              <Download size={13} />
              {exporting ? 'Exporting…' : 'CSV'}
            </button>
            <button onClick={handleExportPDF} disabled={rows.length === 0}
              className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 border border-white/30 text-white px-3.5 py-1.5 rounded-xl text-xs font-semibold disabled:opacity-40 transition-all shadow-sm">
              <FileText size={13} />
              PDF
            </button>
          </div>
        </div>

        {/* Tabs + date filter strip */}
        <div className="relative flex items-center justify-between gap-3 px-6 pb-4">
          {/* Tabs */}
          <div className="flex gap-1 bg-white/10 rounded-xl p-1 backdrop-blur-sm">
            {TABS.map(t => (
              <button key={t.key} onClick={() => setTab(t.key)}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  tab === t.key ? 'bg-white text-violet-700 shadow-sm' : 'text-white/80 hover:text-white hover:bg-white/10'
                }`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Date filter */}
          <DateRangePicker fromDate={from} toDate={to} onChange={(f, t) => { setFrom(f); setTo(t) }} />
        </div>

        {/* Stats strip */}
        <div className="relative border-t border-white/10 grid grid-cols-8 divide-x divide-white/10">
          {statStrip.map(s => (
            <div key={s.label} className="px-4 py-3">
              <p className={`text-base font-extrabold tabular-nums leading-none ${s.warn ? 'text-amber-300' : 'text-white'}`}>
                {loading ? <span className="inline-block w-12 h-4 bg-white/20 rounded animate-pulse" /> : s.value}
              </p>
              <p className="text-[11px] text-blue-200 mt-0.5 font-medium">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Summary Tab */}
      {tab === 'summary' && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="px-5 py-3" style={{background:'linear-gradient(to right,#eff6ff 0%,#eef2ff 100%)',borderBottom:'1px solid #dbeafe'}}>
            <h2 className="text-sm font-semibold" style={{color:'#1f2937'}}>Outstanding by Aging Bucket</h2>
          </div>
          <div className="p-5">
          {agingChart.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-gray-300 gap-2">
              <CheckCircle size={36} className="text-green-300" />
              <p className="text-sm text-gray-400">No outstanding receivables</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={agingChart}>
                <defs>
                  <linearGradient id="debtBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#8b5cf6" />
                    <stop offset="100%" stopColor="#6366f1" />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ borderRadius: '10px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
                  formatter={(v: any) => [fmt2(Number(v)), 'Amount']} />
                <Bar dataKey="value" fill="url(#debtBarGrad)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
          </div>
        </div>
      )}

      {/* Party-wise Tab */}
      {tab === 'party-wise' && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 rounded-t-xl" style={{background:'linear-gradient(to right,#eff6ff 0%,#eef2ff 100%)',borderBottom:'1px solid #dbeafe'}}>
            <div>
              <h2 className="text-sm font-semibold" style={{color:'#1f2937'}}>Party-wise Outstanding</h2>
              {rows.length > 0 && <p className="text-xs mt-0.5" style={{color:'#6b7280'}}>{rows.length} parties with outstanding dues</p>}
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name / GSTIN..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-blue-200 text-gray-700 placeholder:text-gray-400 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-[11px] uppercase tracking-wide" >
                <tr style={{background:'linear-gradient(to right,#eff6ff 0%,#eef2ff 100%)',borderBottom:'1px solid #dbeafe',color:'#1f2937'}}>
                  <th className="px-4 py-3 text-left w-8"></th>
                  <th className="px-4 py-3 text-left">#</th>
                  <th className="px-4 py-3 text-left">Party</th>
                  <th className="px-4 py-3 text-left">GSTIN</th>
                  <th className="px-4 py-3 text-right">Invoiced</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-right">Current</th>
                  <th className="px-4 py-3 text-right">1–30d</th>
                  <th className="px-4 py-3 text-right">31–60d</th>
                  <th className="px-4 py-3 text-right">61–90d</th>
                  <th className="px-4 py-3 text-right">90+d</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}>{Array(12).fill(0).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                )) : filtered.length === 0 ? (
                  <tr><td colSpan={12} className="px-4 py-14 text-center">
                    <CheckCircle size={32} className="mx-auto text-green-300 mb-2" />
                    <p className="text-sm text-gray-400">No outstanding receivables</p>
                  </td></tr>
                ) : (
                  <>
                    {filtered.map((row, i) => (
                      <>
                        <tr key={row.customerId}
                          className="hover:bg-gray-50 transition-colors cursor-pointer"
                          onClick={() => toggle(row.customerId)}>
                          <td className="px-4 py-3 text-gray-400">
                            {expanded.has(row.customerId) ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                          </td>
                          <td className="px-4 py-3 text-xs text-gray-400">{i + 1}</td>
                          <td className="px-4 py-3">
                            <p className="text-sm font-medium text-gray-900">{row.name}</p>
                            {row.phone && <p className="text-xs text-gray-400">{row.phone}</p>}
                          </td>
                          <td className="px-4 py-3 font-mono text-xs text-gray-500">{row.gstin || '—'}</td>
                          <td className="px-4 py-3 text-right text-sm text-gray-600">{fmt2(row.totalInvoiced)}</td>
                          <td className="px-4 py-3 text-right text-sm text-green-700">{fmt2(row.totalPaid)}</td>
                          <td className="px-4 py-3 text-right text-sm font-bold text-red-600">{fmt2(row.outstanding)}</td>
                          <td className="px-4 py-3 text-right text-sm text-green-600">{row.current > 0 ? fmt2(row.current) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-right text-sm text-yellow-600">{row.days1_30 > 0 ? fmt2(row.days1_30) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-right text-sm text-orange-600">{row.days31_60 > 0 ? fmt2(row.days31_60) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-right text-sm text-red-500">{row.days61_90 > 0 ? fmt2(row.days61_90) : <span className="text-gray-300">—</span>}</td>
                          <td className="px-4 py-3 text-right text-sm font-semibold text-red-700">{row.days90plus > 0 ? fmt2(row.days90plus) : <span className="text-gray-300 font-normal">—</span>}</td>
                        </tr>

                        {expanded.has(row.customerId) && (
                          <tr key={`${row.customerId}-inv`}>
                            <td colSpan={12} className="px-0 py-0 bg-indigo-50/60 border-b border-indigo-100">
                              <div className="px-10 py-3">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="text-[11px] text-gray-500 uppercase tracking-wide border-b border-indigo-100">
                                      <th className="pb-2 text-left pr-4">Invoice #</th>
                                      <th className="pb-2 text-left pr-4">Issue Date</th>
                                      <th className="pb-2 text-left pr-4">Due Date</th>
                                      <th className="pb-2 text-right pr-4">Amount</th>
                                      <th className="pb-2 text-right pr-4">Paid</th>
                                      <th className="pb-2 text-right pr-4">Outstanding</th>
                                      <th className="pb-2 text-center">Aging</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-indigo-100">
                                    {row.invoices.map(inv => (
                                      <tr key={inv.invoiceNumber}>
                                        <td className="py-2 pr-4 font-mono font-medium text-indigo-700">{inv.invoiceNumber}</td>
                                        <td className="py-2 pr-4 text-gray-500">{inv.issueDate}</td>
                                        <td className="py-2 pr-4 text-gray-500">{inv.dueDate ?? '—'}</td>
                                        <td className="py-2 pr-4 text-right">{fmt2(inv.totalAmount)}</td>
                                        <td className="py-2 pr-4 text-right text-green-700">{fmt2(inv.paidAmount)}</td>
                                        <td className="py-2 pr-4 text-right font-semibold text-red-600">{fmt2(inv.outstanding)}</td>
                                        <td className="py-2 text-center">
                                          {inv.daysOverdue === 0
                                            ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.current}`}>Current</span>
                                            : inv.daysOverdue <= 30
                                            ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days1_30}`}>{inv.daysOverdue}d</span>
                                            : inv.daysOverdue <= 60
                                            ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days31_60}`}>{inv.daysOverdue}d</span>
                                            : inv.daysOverdue <= 90
                                            ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days61_90}`}>{inv.daysOverdue}d</span>
                                            : <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days90plus}`}>{inv.daysOverdue}d</span>
                                          }
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    ))}

                    <tr className="bg-gray-50 font-semibold text-sm">
                      <td colSpan={4} className="px-4 py-3 text-gray-700">Total ({filtered.length} parties)</td>
                      <td className="px-4 py-3 text-right">{fmt2(totals.totalInvoiced)}</td>
                      <td className="px-4 py-3 text-right text-green-700">{fmt2(totals.totalPaid)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{fmt2(totals.outstanding)}</td>
                      <td className="px-4 py-3 text-right text-green-600">{fmt2(totals.current)}</td>
                      <td className="px-4 py-3 text-right text-yellow-600">{fmt2(totals.days1_30)}</td>
                      <td className="px-4 py-3 text-right text-orange-600">{fmt2(totals.days31_60)}</td>
                      <td className="px-4 py-3 text-right text-red-500">{fmt2(totals.days61_90)}</td>
                      <td className="px-4 py-3 text-right text-red-700">{fmt2(totals.days90plus)}</td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Invoice Aging Tab */}
      {tab === 'invoice-aging' && (
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 rounded-t-xl" style={{background:'linear-gradient(to right,#eff6ff 0%,#eef2ff 100%)',borderBottom:'1px solid #dbeafe'}}>
            <div>
              <h2 className="text-sm font-semibold" style={{color:'#1f2937'}}>Invoice Aging</h2>
              <p className="text-xs mt-0.5" style={{color:'#6b7280'}}>{allInvoices.length} unpaid / partial invoices</p>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input value={invSearch} onChange={e => setInvSearch(e.target.value)} placeholder="Search invoice / party..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-blue-200 text-gray-700 placeholder:text-gray-400 rounded-lg w-52 focus:outline-none focus:ring-2 focus:ring-blue-200" />
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="text-[11px] uppercase tracking-wide" >
                <tr style={{background:'linear-gradient(to right,#eff6ff 0%,#eef2ff 100%)',borderBottom:'1px solid #dbeafe',color:'#1f2937'}}>
                  <th className="px-4 py-3 text-left">Invoice #</th>
                  <th className="px-4 py-3 text-left">Party</th>
                  <th className="px-4 py-3 text-left">Issue Date</th>
                  <th className="px-4 py-3 text-left">Due Date</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3 text-right">Paid</th>
                  <th className="px-4 py-3 text-right">Outstanding</th>
                  <th className="px-4 py-3 text-center">Status</th>
                  <th className="px-4 py-3 text-center">Aging</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? Array(5).fill(0).map((_, i) => (
                  <tr key={i}>{Array(9).fill(0).map((_, j) => <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-100 rounded animate-pulse" /></td>)}</tr>
                )) : allInvoices.length === 0 ? (
                  <tr><td colSpan={9} className="px-4 py-14 text-center">
                    <CheckCircle size={32} className="mx-auto text-green-300 mb-2" />
                    <p className="text-sm text-gray-400">No outstanding invoices</p>
                  </td></tr>
                ) : allInvoices.map((inv, i) => (
                  <tr key={i} className={`hover:bg-gray-50 transition-colors ${inv.daysOverdue > 90 ? 'bg-red-50/30' : ''}`}>
                    <td className="px-4 py-3"><span className="font-mono text-sm font-medium text-primary-600">{inv.invoiceNumber}</span></td>
                    <td className="px-4 py-3 text-sm text-gray-900">{inv.partyName}</td>
                    <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{inv.issueDate}</td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <span className={inv.daysOverdue > 0 ? 'text-red-600 font-medium' : 'text-gray-500'}>
                        {inv.dueDate ?? '—'}{inv.daysOverdue > 0 ? ' ⚠' : ''}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-sm text-gray-700">{fmt2(inv.totalAmount)}</td>
                    <td className="px-4 py-3 text-right text-sm text-green-700">{fmt2(inv.paidAmount)}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold text-red-600">{fmt2(inv.outstanding)}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        inv.status === 'OVERDUE'  ? 'bg-red-50 text-red-600'
                        : inv.status === 'PARTIAL' ? 'bg-yellow-50 text-yellow-700'
                        : 'bg-blue-50 text-blue-700'}`}>{inv.status}</span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {inv.daysOverdue === 0
                        ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.current}`}>Current</span>
                        : inv.daysOverdue <= 30
                        ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days1_30}`}>{inv.daysOverdue}d</span>
                        : inv.daysOverdue <= 60
                        ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days31_60}`}>{inv.daysOverdue}d</span>
                        : inv.daysOverdue <= 90
                        ? <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days61_90}`}>{inv.daysOverdue}d</span>
                        : <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${AGING_COLORS.days90plus}`}>{inv.daysOverdue}d</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-400 mt-3">
        Aging from due date (defaults to issue date + 30 days if unset). Export is Tally ERP compatible.
      </p>
    </div>
  )
}
