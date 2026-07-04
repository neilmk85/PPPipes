import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  FileText, Loader2, X, ClipboardList, ChevronRight,
  AlertCircle, IndianRupee, ArrowLeft, HardHat, Plus, Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { workBillApi, workOrderApi, contractorApi } from '@/services/api'
import SiteFloatingNav from './SiteFloatingNav'

type SupplyType = 'INTRA_STATE' | 'INTER_STATE'

interface Contractor {
  id: number; name: string; tradeType?: string; gstin?: string; contactName?: string
}

interface WorkOrder {
  id: number; woNumber: string; contractorId: number; contractorName: string
  contractorGstin?: string; title: string; location: string
  startDate: string; endDate: string; status: string; notes: string
  items: { id: string; description: string; unit: string; quantity: number; rate: number }[]
  createdAt: string
}

interface BillItem {
  id: string; description: string; unit: string
  contractedQty: number; actualQty: number; rate: number; gstRate: number
}

const GST_RATES = [0, 5, 12, 18]
const TDS_OPTIONS = [
  { label: 'No TDS', value: 0 },
  { label: '1% (Sec 194C – Individual)', value: 1 },
  { label: '2% (Sec 194C – Company/Firm)', value: 2 },
]

function fmt(n: number) {
  return n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
function today() { return new Date().toISOString().split('T')[0] }
function addDays(d: string, n: number) {
  const dt = new Date(d); dt.setDate(dt.getDate() + n)
  return dt.toISOString().split('T')[0]
}

function calcBill(items: BillItem[], tdsRate: number, supplyType: SupplyType) {
  const subtotal = items.reduce((s, it) => s + it.actualQty * it.rate, 0)
  const gstTotal = items.reduce((s, it) => s + it.actualQty * it.rate * it.gstRate / 100, 0)
  const cgst = supplyType === 'INTRA_STATE' ? gstTotal / 2 : 0
  const sgst = supplyType === 'INTRA_STATE' ? gstTotal / 2 : 0
  const igst = supplyType === 'INTER_STATE' ? gstTotal : 0
  const tds = subtotal * tdsRate / 100
  const netPayable = subtotal + gstTotal - tds
  return { subtotal, gstTotal, cgst, sgst, igst, tds, netPayable }
}

function ContractorSelector({ value, onSelect }: {
  value: Contractor | null
  onSelect: (c: Contractor | null) => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { data: contractors = [] } = useQuery<Contractor[]>({
    queryKey: ['site-contractors'],
    queryFn: () => contractorApi.getAll().then(r => r.data.data ?? []),
  })

  const filtered = contractors.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.tradeType ?? '').toLowerCase().includes(search.toLowerCase())
  )

  if (value) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <HardHat size={14} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-amber-800">{value.name}</p>
          {value.tradeType && <p className="text-xs text-amber-500">{value.tradeType}</p>}
        </div>
        <button onClick={() => onSelect(null)} className="text-amber-300 hover:text-amber-500 transition-colors">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl hover:border-amber-400 text-sm text-gray-500 hover:text-gray-700 transition-colors bg-white">
        <HardHat size={14} className="text-gray-400" />
        <span>Select a contractor…</span>
        <ChevronRight size={13} className={`ml-auto transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 max-h-64 overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search contractors…"
              className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400/40" />
          </div>
          <div className="overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-4 text-sm text-gray-400 text-center">
                <AlertCircle size={16} className="mx-auto mb-1 text-gray-300" />
                No contractors found
              </div>
            ) : filtered.map(c => (
              <button key={c.id} onClick={() => { onSelect(c); setOpen(false); setSearch('') }}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-amber-50 text-left border-b border-gray-50 last:border-0 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                  <HardHat size={12} className="text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-800">{c.name}</p>
                  {c.tradeType && <p className="text-xs text-gray-400">{c.tradeType}</p>}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function WOSelector({ value, contractorId, onSelect }: {
  value: WorkOrder | null
  contractorId: number | null
  onSelect: (wo: WorkOrder | null) => void
}) {
  const [open, setOpen] = useState(false)

  const { data: allWOs = [] } = useQuery<WorkOrder[]>({
    queryKey: ['work-orders'],
    queryFn: () => workOrderApi.getAll().then(r => r.data.data ?? []),
  })

  const filteredWOs = allWOs.filter(w =>
    contractorId !== null ? w.contractorId === contractorId : true
  )

  if (value) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 bg-indigo-50 border border-indigo-200 rounded-xl">
        <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
          <ClipboardList size={14} className="text-indigo-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-indigo-800">{value.woNumber} — {value.title}</p>
          <p className="text-xs text-indigo-500">{value.items.length} services</p>
        </div>
        <button onClick={() => onSelect(null)} className="text-indigo-300 hover:text-indigo-500 transition-colors">
          <X size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <button onClick={() => { if (contractorId !== null) setOpen(v => !v) }}
        disabled={contractorId === null}
        className="w-full flex items-center gap-2 px-3 py-2.5 border border-gray-200 rounded-xl hover:border-blue-400 text-sm text-gray-500 hover:text-gray-700 transition-colors bg-white disabled:opacity-50 disabled:cursor-not-allowed">
        <ClipboardList size={14} className="text-gray-400" />
        <span>{contractorId === null ? 'Select contractor first' : 'No work order (optional)…'}</span>
        <ChevronRight size={13} className={`ml-auto transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-20 top-full mt-1 w-full bg-white rounded-xl shadow-xl border border-gray-100 max-h-56 overflow-y-auto">
          <button onClick={() => { onSelect(null); setOpen(false) }}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 transition-colors">
            <span className="text-sm text-gray-500 italic">Create bill without work order</span>
          </button>
          {filteredWOs.length === 0 ? (
            <div className="px-4 py-4 text-sm text-gray-400 text-center">
              <AlertCircle size={16} className="mx-auto mb-1 text-gray-300" />
              No work orders for this contractor
            </div>
          ) : filteredWOs.map(wo => (
            <button key={wo.id} onClick={() => { onSelect(wo); setOpen(false) }}
              className="w-full flex items-start gap-3 px-4 py-3 hover:bg-blue-50 text-left border-b border-gray-50 last:border-0 transition-colors">
              <span className="text-xs font-bold font-mono text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded shrink-0 mt-0.5">{wo.woNumber}</span>
              <div>
                <p className="text-sm font-medium text-gray-800">{wo.title}</p>
                <p className="text-xs text-gray-400">{wo.status} · {wo.items.length} services</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function NewWorkBillPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const initialWoId = searchParams.get('woId') ?? undefined
  const queryClient = useQueryClient()

  const { data: allWOs = [] } = useQuery<WorkOrder[]>({
    queryKey: ['work-orders'],
    queryFn: () => workOrderApi.getAll().then(r => r.data.data ?? []),
  })

  const { data: contractors = [] } = useQuery<Contractor[]>({
    queryKey: ['site-contractors'],
    queryFn: () => contractorApi.getAll().then(r => r.data.data ?? []),
  })

  const [contractor, setContractor] = useState<Contractor | null>(null)
  const [wo, setWO] = useState<WorkOrder | null>(null)
  const [billDate, setBillDate] = useState(today())
  const [dueDate, setDueDate] = useState(addDays(today(), 30))
  const [periodFrom, setPeriodFrom] = useState('')
  const [periodTo, setPeriodTo] = useState(today())
  const [supplyType, setSupplyType] = useState<SupplyType>('INTRA_STATE')
  const [tdsRate, setTdsRate] = useState(2)
  const [contractorInvNo, setContractorInvNo] = useState('')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState<BillItem[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (initialWoId && allWOs.length > 0 && !wo) {
      const found = allWOs.find(w => String(w.id) === String(initialWoId)) ?? null
      if (found) {
        if (contractors.length > 0) {
          const c = contractors.find(c => c.id === found.contractorId) ?? null
          if (c) setContractor(c)
        }
        setWO(found)
      }
    }
  }, [allWOs, contractors, initialWoId, wo])

  useEffect(() => {
    if (wo) {
      setPeriodFrom(wo.startDate)
      setItems(wo.items.map(it => ({
        id: it.id,
        description: it.description,
        unit: it.unit,
        contractedQty: it.quantity,
        actualQty: it.quantity,
        rate: it.rate,
        gstRate: 18,
      })))
    }
  }, [wo])

  function handleContractorChange(c: Contractor | null) {
    setContractor(c)
    setWO(null)
    setItems([])
  }

  function updateItem(id: string, field: keyof BillItem, value: unknown) {
    setItems(prev => prev.map(it => it.id === id ? { ...it, [field]: value } : it))
  }

  function addRow() {
    setItems(prev => [...prev, {
      id: Date.now().toString(),
      description: '',
      unit: '',
      contractedQty: 0,
      actualQty: 0,
      rate: 0,
      gstRate: 18,
    }])
  }

  function deleteRow(id: string) {
    setItems(prev => prev.filter(it => it.id !== id))
  }

  const calc = calcBill(items, tdsRate, supplyType)

  async function handleSave() {
    if (!contractor) { toast.error('Select a contractor'); return }
    setSaving(true)
    try {
      const payload = {
        workOrderId: wo?.id ?? null,
        woNumber: wo?.woNumber ?? '',
        woTitle: wo?.title ?? '',
        contractorId: contractor.id,
        contractorName: contractor.name,
        billingPeriodFrom: periodFrom,
        billingPeriodTo: periodTo,
        billDate,
        dueDate,
        supplyType,
        tdsRate,
        status: 'DRAFT',
        items,
        contractorInvoiceNo: contractorInvNo,
        notes,
      }
      const res = await workBillApi.create(payload)
      const billNumber = res.data.data?.billNumber ?? ''
      toast.success(`Work Bill ${billNumber} created`)
      await queryClient.invalidateQueries({ queryKey: ['work-bills'] })
      await queryClient.invalidateQueries({ queryKey: ['work-orders'] })
      navigate('/site/work-bills')
    } catch (err: unknown) {
      const e = err as { response?: { data?: { message?: string } } }
      toast.error(e?.response?.data?.message ?? 'Failed to create work bill')
    } finally {
      setSaving(false)
    }
  }

  const COLS = '2fr 80px 80px 90px 100px 90px 80px 110px 40px'

  return (
    <div className="min-h-screen bg-[#f8f9fb] flex flex-col">

      <div style={{ background: 'linear-gradient(180deg, #ddd6fe 0%, #ede9fe 35%, #f5f3ff 65%, #faf9ff 85%, #ffffff 100%)' }}>
        <div className="px-6 pt-4 pb-2 flex items-center gap-4">
          <button onClick={() => navigate('/site/work-bills')}
            className="text-violet-500 hover:text-violet-900 transition-colors shrink-0">
            <ArrowLeft size={18} />
          </button>
          <div className="flex-1 flex justify-center">
            <SiteFloatingNav theme="light" inline />
          </div>
        </div>
        <div className="px-6 pt-4 pb-5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center shrink-0">
              <FileText size={15} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900 leading-tight">New Work Bill</h1>
              <p className="text-xs text-gray-500">Bill number assigned on save</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/site/work-bills')}
              className="px-3.5 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors bg-white">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving || !contractor}
              className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-semibold shadow-sm transition-colors">
              {saving ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
              Save Bill
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 px-8 py-6 w-full space-y-5">

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Contractor <span className="text-red-500">*</span>
            </p>
            <ContractorSelector value={contractor} onSelect={handleContractorChange} />
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Work Order <span className="text-gray-300">(optional)</span></p>
            <WOSelector value={wo} contractorId={contractor?.id ?? null} onSelect={setWO} />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm">
          <div className="grid divide-x divide-gray-100" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr' }}>
            {[
              { label: 'Bill Date', val: billDate, set: setBillDate },
              { label: 'Due Date', val: dueDate, set: setDueDate },
              { label: 'Period From', val: periodFrom, set: setPeriodFrom },
              { label: 'Period To', val: periodTo, set: setPeriodTo },
            ].map(f => (
              <div key={f.label} className="px-5 py-4">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">{f.label}</p>
                <input type="date" value={f.val} onChange={e => f.set(e.target.value)}
                  className="w-full text-sm text-gray-800 border-0 bg-transparent p-0 focus:outline-none" />
              </div>
            ))}
            <div className="px-5 py-4">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1.5">Contractor Inv. No</p>
              <input type="text" value={contractorInvNo} onChange={e => setContractorInvNo(e.target.value)}
                placeholder="e.g. INV-2024-001"
                className="w-full text-sm text-gray-700 placeholder-gray-300 border-0 bg-transparent p-0 focus:outline-none" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Supply Type</p>
            <div className="flex gap-2">
              {(['INTRA_STATE', 'INTER_STATE'] as SupplyType[]).map(t => (
                <button key={t} onClick={() => setSupplyType(t)}
                  className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-colors ${
                    supplyType === t ? 'bg-blue-500 text-white shadow-sm' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'
                  }`}>
                  {t === 'INTRA_STATE' ? 'Intra-State (CGST+SGST)' : 'Inter-State (IGST)'}
                </button>
              ))}
            </div>
          </div>
          <div className="bg-white rounded-xl shadow-sm p-5 space-y-3">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">TDS Deduction</p>
            <select value={tdsRate} onChange={e => setTdsRate(Number(e.target.value))}
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 bg-white">
              {TDS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Services</p>
              <p className="text-xs text-gray-400 mt-0.5">Add services and set quantities, rates and GST.</p>
            </div>
          </div>
          <div className="grid text-[10px] font-bold text-gray-400 uppercase tracking-widest bg-gray-50 border-b border-gray-100"
            style={{ gridTemplateColumns: COLS }}>
            <div className="px-5 py-3">Description</div>
            <div className="px-3 py-3 text-center">Unit</div>
            <div className="px-3 py-3 text-right">Contracted</div>
            <div className="px-3 py-3 text-right">Actual</div>
            <div className="px-3 py-3 text-right">Rate (₹)</div>
            <div className="px-3 py-3 text-center">GST %</div>
            <div className="px-3 py-3 text-right">Amount</div>
            <div className="px-3 py-3 text-right">+GST</div>
            <div className="px-2 py-3" />
          </div>

          {items.length === 0 ? (
            <div className="px-5 py-8 text-center text-gray-400">
              <ClipboardList size={32} className="mx-auto mb-2 text-gray-200" />
              <p className="text-sm">No services yet. Add a row or select a work order above.</p>
            </div>
          ) : items.map((it, idx) => {
            const amount = it.actualQty * it.rate
            const gstAmt = amount * it.gstRate / 100
            const diff = it.actualQty - it.contractedQty
            return (
              <div key={it.id}
                className={`grid items-center border-b border-gray-100 last:border-0 ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}
                style={{ gridTemplateColumns: COLS }}>
                <div className="px-3 py-2">
                  <input type="text" value={it.description} onChange={e => updateItem(it.id, 'description', e.target.value)}
                    placeholder="Service description"
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                  {diff !== 0 && (
                    <span className={`text-[10px] font-semibold ${diff > 0 ? 'text-amber-600' : 'text-green-600'}`}>
                      {diff > 0 ? `+${diff}` : diff} from contracted
                    </span>
                  )}
                </div>
                <div className="px-2 py-2">
                  <select value={it.unit} onChange={e => updateItem(it.id, 'unit', e.target.value)}
                    className="w-full px-2 py-1.5 text-sm text-center border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
                    <option value="">—</option>
                    <option value="RMT">RMT</option>
                    <option value="m">m</option>
                    <option value="Cum">Cum</option>
                    <option value="Sqm">Sqm</option>
                    <option value="MT">MT</option>
                    <option value="Kg">Kg</option>
                    <option value="Nos">Nos</option>
                    <option value="LS">LS</option>
                    <option value="Bags">Bags</option>
                    <option value="Trips">Trips</option>
                  </select>
                </div>
                <div className="px-2 py-2">
                  <input type="number" min="0" step="0.01" value={it.contractedQty || ''}
                    onChange={e => updateItem(it.id, 'contractedQty', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                </div>
                <div className="px-2 py-2">
                  <input type="number" min="0" step="0.01" value={it.actualQty || ''}
                    onChange={e => updateItem(it.id, 'actualQty', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                </div>
                <div className="px-2 py-2">
                  <input type="number" min="0" step="0.01" value={it.rate || ''}
                    onChange={e => updateItem(it.id, 'rate', parseFloat(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-sm text-right border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white" />
                </div>
                <div className="px-2 py-2">
                  <select value={it.gstRate} onChange={e => updateItem(it.id, 'gstRate', Number(e.target.value))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-center">
                    {GST_RATES.map(r => <option key={r} value={r}>{r}%</option>)}
                  </select>
                </div>
                <div className="px-3 py-3 text-right">
                  <p className="text-sm font-bold text-gray-800 tabular-nums">₹{fmt(amount)}</p>
                </div>
                <div className="px-3 py-3 text-right">
                  {it.gstRate > 0 && <p className="text-xs text-blue-500 tabular-nums">₹{fmt(gstAmt)}</p>}
                </div>
                <div className="px-2 py-2 flex justify-center">
                  <button onClick={() => deleteRow(it.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            )
          })}

          <div className="px-5 py-3 border-t border-gray-100">
            <button onClick={addRow}
              className="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700 font-semibold transition-colors">
              <Plus size={14} /> Add Service
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-5 pb-8">
          <div className="bg-white rounded-xl shadow-sm p-5">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4">Bill Summary</p>
            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal (Work Value)</span>
                <span className="tabular-nums font-medium">₹{fmt(calc.subtotal)}</span>
              </div>
              {supplyType === 'INTRA_STATE' ? (
                <>
                  <div className="flex justify-between text-gray-500">
                    <span>CGST</span><span className="tabular-nums">₹{fmt(calc.cgst)}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>SGST</span><span className="tabular-nums">₹{fmt(calc.sgst)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-gray-500">
                  <span>IGST</span><span className="tabular-nums">₹{fmt(calc.igst)}</span>
                </div>
              )}
              <div className="flex justify-between text-gray-600 border-t pt-2">
                <span>Gross Total</span>
                <span className="tabular-nums font-semibold">₹{fmt(calc.subtotal + calc.gstTotal)}</span>
              </div>
              {tdsRate > 0 && (
                <div className="flex justify-between text-gray-500">
                  <span>TDS ({tdsRate}% on base)</span>
                  <span className="tabular-nums font-medium">−₹{fmt(calc.tds)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-[15px] border-t pt-3 mt-1 text-gray-900">
                <span>Net Payable</span>
                <span className="tabular-nums">₹{fmt(calc.netPayable)}</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-5">
            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={6}
              placeholder="Payment instructions, site remarks, deduction details…"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-400/40 focus:border-blue-400 transition-colors resize-none" />
          </div>
        </div>

      </div>

      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-8 py-3.5 flex items-center justify-between">
        <p className="text-xs text-gray-400 tabular-nums">
          {contractor
            ? `${items.length} services · Net payable ₹${fmt(calc.netPayable)}`
            : 'Select a contractor to begin'}
        </p>
        <div className="flex gap-2">
          <button onClick={() => navigate('/site/work-bills')}
            className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving || !contractor}
            className="flex items-center gap-1.5 px-5 py-2 text-sm bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg font-semibold shadow-sm transition-colors">
            {saving ? <Loader2 size={13} className="animate-spin" /> : <IndianRupee size={13} />}
            Save Work Bill
          </button>
        </div>
      </div>

    </div>
  )
}
