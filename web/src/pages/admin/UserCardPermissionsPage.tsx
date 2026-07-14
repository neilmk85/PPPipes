import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, ShieldCheck, Save, CheckSquare, Square } from 'lucide-react'
import toast from 'react-hot-toast'
import { staffApi, userCardPermissionsApi } from '@/services/api'

const BUSINESS_CARDS = [
  { key: 'pccp',              label: 'PCCP',                category: 'Production' },
  { key: 'psc',               label: 'PSC',                 category: 'Production' },
  { key: 'testing-lab',       label: 'Testing Lab',         category: 'Quality' },
  { key: 'pdi',               label: 'PDI',                 category: 'Quality' },
  { key: 'maintenance',       label: 'Maintenance',         category: 'Operations' },
  { key: 'vehicles',          label: 'Vehicles',            category: 'Operations' },
  { key: 'silo',              label: 'Silo',                category: 'Materials' },
  { key: 'silo-extraction',   label: 'Silo Extraction',     category: 'Materials' },
  { key: 'discard',           label: 'Discard',             category: 'Production' },
  { key: 'extra-fab',         label: 'Extra Fabrication',   category: 'Production' },
  { key: 'labour',            label: 'Labour',              category: 'HR' },
  { key: 'cement-bags',       label: 'Cement Bags',         category: 'Materials' },
  { key: 'store-material',    label: 'Store Material',      category: 'Materials' },
  { key: 'diesel-maintenance',label: 'Diesel Maintenance',  category: 'Operations' },
  { key: 'extra-vehicles',    label: 'Extra Vehicles',      category: 'Operations' },
  { key: 'cutting',           label: 'Cutting',             category: 'Production' },
  { key: 'conversion',        label: 'Conversion',          category: 'Production' },
  { key: 'loading',           label: 'Loading',             category: 'Logistics' },
  { key: 'loaded-pipes',      label: 'Loaded Pipes',        category: 'Logistics' },
  { key: 'transport-report',  label: 'Transport Report',    category: 'Logistics' },
]

const PCCP_STAGES = [
  { key: 'FABRICATION',         label: 'Fabrication' },
  { key: 'FABRICATION_TESTING', label: 'Fabrication Testing' },
  { key: 'MOULDING',            label: 'Moulding' },
  { key: 'SPINNING',            label: 'Spinning' },
  { key: 'DEMOULDING',          label: 'Demoulding' },
  { key: 'CURING_1',            label: 'Curing 1' },
  { key: 'WINDING',             label: 'Winding' },
  { key: 'COATING',             label: 'Coating' },
  { key: 'CURING_2',            label: 'Curing 2' },
  { key: 'FINAL_TESTING',       label: 'Final Testing' },
  { key: 'PDI',                 label: 'PDI' },
]

const BUSINESS_CATEGORIES = ['Production', 'Quality', 'Operations', 'Materials', 'Logistics', 'HR']

const REPORTS_CARDS = [
  { key: 'debtors',   label: 'Debtors Ledger',   subtitle: 'Customer outstanding receivables' },
  { key: 'creditors', label: 'Creditors Ledger',  subtitle: 'Vendor outstanding payables' },
  { key: 'daybook',   label: 'Day Book',           subtitle: 'Daily transaction journal' },
  { key: 'ledger',    label: 'Ledger',             subtitle: 'Account-wise balance summary' },
]

export default function UserCardPermissionsPage() {
  const qc = useQueryClient()
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null)
  const [business, setBusiness] = useState<string[]>([])
  const [pccp, setPccp] = useState<string[]>([])
  const [reports, setReports] = useState<string[]>([])
  const [dirty, setDirty] = useState(false)

  const { data: staffData } = useQuery({
    queryKey: ['staff-all'],
    queryFn: () => staffApi.getAll().then(r => r.data.data as any[]),
  })

  const { isLoading: loadingPerms, data: permsData } = useQuery({
    queryKey: ['card-permissions', selectedUserId],
    queryFn: () => userCardPermissionsApi.get(selectedUserId!).then(r => r.data.data),
    enabled: selectedUserId !== null,
  })

  useEffect(() => {
    if (permsData) {
      setBusiness((permsData as any).business ?? [])
      setPccp((permsData as any).pccp ?? [])
      setReports((permsData as any).reports ?? [])
      setDirty(false)
    }
  }, [permsData])

  const saveMutation = useMutation({
    mutationFn: () => userCardPermissionsApi.update(selectedUserId!, { business, pccp, reports }),
    onSuccess: () => {
      toast.success('Permissions saved')
      qc.invalidateQueries({ queryKey: ['card-permissions', selectedUserId] })
      setDirty(false)
    },
    onError: () => toast.error('Failed to save permissions'),
  })

  const toggleBusiness = (key: string) => {
    setBusiness(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
    setDirty(true)
  }
  const togglePccp = (key: string) => {
    setPccp(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
    setDirty(true)
  }
  const selectAllBusiness = () => { setBusiness(BUSINESS_CARDS.map(c => c.key)); setDirty(true) }
  const clearBusiness = () => { setBusiness([]); setDirty(true) }
  const selectAllPccp = () => { setPccp(PCCP_STAGES.map(s => s.key)); setDirty(true) }
  const clearPccp = () => { setPccp([]); setDirty(true) }
  const toggleReports = (key: string) => {
    setReports(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])
    setDirty(true)
  }
  const selectAllReports = () => { setReports(REPORTS_CARDS.map(c => c.key)); setDirty(true) }
  const clearReports = () => { setReports([]); setDirty(true) }

  const users = staffData ?? []
  const selectedUser = users.find((u: any) => u.id === selectedUserId)

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div style={{ background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }} className="px-6 py-5">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center">
            <ShieldCheck size={18} className="text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Card Permissions</h1>
            <p className="text-xs text-white/60">Configure Business & PCCP card access per user</p>
          </div>
        </div>
      </div>

      <div className="p-6 flex gap-6">
        {/* User list */}
        <div className="w-64 shrink-0">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Users size={14} className="text-gray-400" />
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Users</span>
              </div>
            </div>
            <div className="divide-y divide-gray-50 max-h-[calc(100vh-200px)] overflow-y-auto">
              {users.map((u: any) => (
                <button
                  key={u.id}
                  onClick={() => setSelectedUserId(u.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${selectedUserId === u.id ? 'bg-slate-900 text-white' : 'hover:bg-gray-50 text-gray-700'}`}
                >
                  <div className="text-sm font-medium truncate">{u.name || u.email}</div>
                  <div className={`text-xs mt-0.5 truncate ${selectedUserId === u.id ? 'text-white/60' : 'text-gray-400'}`}>
                    {u.roles?.[0] ?? 'USER'}
                  </div>
                </button>
              ))}
              {users.length === 0 && (
                <div className="px-4 py-6 text-center text-sm text-gray-400">Loading...</div>
              )}
            </div>
          </div>
        </div>

        {/* Permissions panel */}
        <div className="flex-1">
          {!selectedUserId ? (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
              <ShieldCheck size={40} className="mb-3 opacity-30" />
              <p className="text-sm">Select a user to configure permissions</p>
            </div>
          ) : loadingPerms ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-6 h-6 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="space-y-5">
              {/* Save bar */}
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">{selectedUser?.name || selectedUser?.email}</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{selectedUser?.roles?.[0] ?? 'USER'} · {business.length} business · {pccp.length} PCCP · {reports.length} reports</p>
                </div>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={!dirty || saveMutation.isPending}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all ${dirty ? 'bg-slate-900 text-white hover:bg-slate-800 shadow-sm' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                >
                  <Save size={15} />
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>

              {/* Business Cards */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Business Cards</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{business.length} of {BUSINESS_CARDS.length} selected</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={selectAllBusiness} className="text-xs text-blue-600 hover:underline font-medium">Select All</button>
                    <span className="text-gray-300">·</span>
                    <button onClick={clearBusiness} className="text-xs text-gray-400 hover:underline">Clear</button>
                  </div>
                </div>
                <div className="p-5 space-y-5">
                  {BUSINESS_CATEGORIES.map(cat => {
                    const cards = BUSINESS_CARDS.filter(c => c.category === cat)
                    if (!cards.length) return null
                    return (
                      <div key={cat}>
                        <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">{cat}</div>
                        <div className="grid grid-cols-2 gap-2">
                          {cards.map(card => {
                            const checked = business.includes(card.key)
                            return (
                              <button
                                key={card.key}
                                onClick={() => toggleBusiness(card.key)}
                                className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${checked ? 'border-blue-500 bg-blue-50 text-gray-900' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}
                              >
                                {checked
                                  ? <CheckSquare size={15} className="shrink-0 text-blue-500" />
                                  : <Square size={15} className="shrink-0 text-gray-300" />}
                                <span className="text-sm font-medium">{card.label}</span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* PCCP Stages */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">PCCP Production Stages</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{pccp.length} of {PCCP_STAGES.length} selected</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={selectAllPccp} className="text-xs text-blue-600 hover:underline font-medium">Select All</button>
                    <span className="text-gray-300">·</span>
                    <button onClick={clearPccp} className="text-xs text-gray-400 hover:underline">Clear</button>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-3 gap-2">
                    {PCCP_STAGES.map(stage => {
                      const checked = pccp.includes(stage.key)
                      return (
                        <button
                          key={stage.key}
                          onClick={() => togglePccp(stage.key)}
                          className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-left transition-all ${checked ? 'border-violet-500 bg-violet-50 text-gray-900' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}
                        >
                          {checked
                            ? <CheckSquare size={15} className="shrink-0 text-violet-500" />
                            : <Square size={15} className="shrink-0 text-gray-300" />}
                          <span className="text-sm font-medium">{stage.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Reports */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">Reports</h3>
                    <p className="text-xs text-gray-400 mt-0.5">{reports.length} of {REPORTS_CARDS.length} selected · mobile app report access</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={selectAllReports} className="text-xs text-emerald-600 hover:underline font-medium">Select All</button>
                    <span className="text-gray-300">·</span>
                    <button onClick={clearReports} className="text-xs text-gray-400 hover:underline">Clear</button>
                  </div>
                </div>
                <div className="p-5">
                  <div className="grid grid-cols-2 gap-2">
                    {REPORTS_CARDS.map(card => {
                      const checked = reports.includes(card.key)
                      return (
                        <button
                          key={card.key}
                          onClick={() => toggleReports(card.key)}
                          className={`flex items-center gap-2.5 px-3 py-3 rounded-lg border text-left transition-all ${checked ? 'border-emerald-500 bg-emerald-50 text-gray-900' : 'border-gray-200 hover:border-gray-300 text-gray-700'}`}
                        >
                          {checked
                            ? <CheckSquare size={15} className="shrink-0 text-emerald-500" />
                            : <Square size={15} className="shrink-0 text-gray-300" />}
                          <div>
                            <div className="text-sm font-medium">{card.label}</div>
                            <div className="text-xs text-gray-400 mt-0.5">{card.subtitle}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
