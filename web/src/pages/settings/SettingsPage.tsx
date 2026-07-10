import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { Store, Users, Receipt, Percent, Plus, Pencil, Trash2, X, Loader2, Shield, Lock, Check, AlertCircle, ShieldCheck, Edit2, Building2, Phone, Mail, MapPin, FileText, Hash, MessageSquare, MessageCircle, Eye, EyeOff, Zap, Send, LayoutTemplate, Palette, Image, AlignLeft, Type, Baseline, KeyRound, Settings as SettingsIcon, ArrowLeft, IndianRupee, Save, Wrench, CheckSquare, Square, UserPlus } from 'lucide-react'
import PermissionsSettings from './PermissionsSettings'
import { tdsApi } from '@/services/api'
import toast from 'react-hot-toast'
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query'
import { taxGroupApi, rolesApi, outletApi, integrationApi, staffApi, userCardPermissionsApi, roleCardPermissionsApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

const tabs = [
  { key: 'outlet',           label: 'Factory',          icon: <Store size={13} />,         desc: 'Manage your factory details and business information' },
  { key: 'roles',            label: 'Users',            icon: <Shield size={13} />,        desc: 'Manage users and define staff roles' },
  { key: 'permissions',      label: 'Permissions',      icon: <KeyRound size={13} />,      desc: 'Manage system permissions and process access by role' },
  { key: 'tax',              label: 'Tax Groups',       icon: <Percent size={13} />,       desc: 'Configure GST tax groups and rates' },
  { key: 'receipt',          label: 'Receipt',          icon: <Receipt size={13} />,       desc: 'Customise your POS receipt template' },
  { key: 'invoice',          label: 'Templates',        icon: <LayoutTemplate size={13} />,desc: 'Manage notification and document templates' },
  { key: 'integrations',     label: 'Integrations',     icon: <Zap size={13} />,           desc: 'Connect email, SMS, and WhatsApp channels' },
  { key: 'service-rates',    label: 'Service Rates',    icon: <IndianRupee size={13} />,   desc: 'Define third-party service rates for fabrication, spinning, transport and labour' },
  { key: 'tds',              label: 'TDS Sections',     icon: <Wrench size={13} />,        desc: 'Manage TDS sections and applicable rates (194C, 194J, etc.)' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState('outlet')

  const activeTab = tabs.find(t => t.key === tab)

  return (
    <div className="min-h-screen bg-gray-50/60">

      {/* ── Hero header ──────────────────────────────────────────── */}
      <div className="relative shadow-[0_8px_40px_rgba(109,40,217,0.28)]">
        {/* Background */}
        <div className="absolute inset-0 overflow-hidden bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 pointer-events-none">
          <div className="absolute -top-8 -right-8 w-52 h-52 rounded-full bg-white/5 blur-2xl" />
          <div className="absolute bottom-0 left-1/4 w-64 h-28 rounded-full bg-blue-400/10 blur-3xl" />
          <div className="absolute inset-0 opacity-[0.07]"
            style={{ backgroundImage: 'radial-gradient(circle, #fff 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        </div>

        {/* Title row */}
        <div className="relative px-8 pt-6 pb-4">
          <div className="flex items-center gap-5 min-w-0">
            <button onClick={() => navigate(-1)}
              className="w-9 h-9 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center hover:bg-white/20 transition-colors flex-shrink-0">
              <ArrowLeft size={16} className="text-white" />
            </button>
            <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center shadow-inner flex-shrink-0">
              <SettingsIcon size={26} className="text-violet-200" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-semibold text-blue-200 uppercase tracking-widest mb-0.5">System</p>
              <h1 className="text-2xl font-extrabold text-white tracking-tight leading-tight">Settings</h1>
              <p className="text-sm text-blue-200 mt-0.5 transition-all">{activeTab?.desc}</p>
            </div>
          </div>
        </div>

        {/* Tab strip */}
        <div className="relative border-t border-white/10 flex items-center gap-1 px-6 py-2 overflow-x-auto">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-xl whitespace-nowrap transition-all ${
                tab === t.key
                  ? 'bg-white text-violet-700 shadow-sm'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Content ──────────────────────────────────────────────── */}
      <div className="p-6">
        {tab === 'outlet'           && <OutletSettings />}
        {tab === 'roles'            && <RolesSettings />}
        {tab === 'permissions'      && <PermissionsTab />}
        {tab === 'tax'              && <TaxSettings />}
        {tab === 'receipt'          && <ReceiptSettings />}
        {tab === 'invoice'          && <TemplatesSettings />}
        {tab === 'integrations'     && <IntegrationsSettings />}
        {tab === 'service-rates'    && <ServiceRatesSettings />}
        {tab === 'tds'              && <TDSSectionsSettings />}
      </div>
    </div>
  )
}

function PermissionsTab() {
  const [subTab, setSubTab] = useState<'system' | 'card'>('system')
  return (
    <div>
      <div className="flex items-center gap-2 mb-5 p-1 bg-gray-100 rounded-xl w-fit">
        <button
          onClick={() => setSubTab('system')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            subTab === 'system'
              ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}>
          System Permissions
        </button>
        <button
          onClick={() => setSubTab('card')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            subTab === 'card'
              ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}>
          Process Permissions
        </button>
      </div>
      {subTab === 'system' && <PermissionsSettings />}
      {subTab === 'card'   && <CardPermissionsSettings />}
    </div>
  )
}

function OutletSettings() {
  const { outletId } = useAuthStore()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<any>({})

  // When the logged-in user has no outletId (e.g. super-admin), fall back to
  // fetching all outlets and using the first one.
  const { data: allOutlets } = useQuery({
    queryKey: ['outlets-all'],
    queryFn: async () => {
      const res = await outletApi.getAll()
      return res.data.data as { id: number; name: string; code: string }[]
    },
    enabled: !outletId,
  })

  const resolvedOutletId: number | null = outletId ?? (allOutlets?.[0]?.id ?? null)

  const { data: outlet, isLoading } = useQuery({
    queryKey: ['outlet', resolvedOutletId],
    queryFn: async () => {
      const res = await outletApi.getById(resolvedOutletId!)
      return res.data.data
    },
    enabled: !!resolvedOutletId,
  })

  useEffect(() => {
    if (outlet && !editing) {
      setForm({
        name: outlet.name ?? '',
        gstin: outlet.gstin ?? '',
        pan: outlet.pan ?? '',
        address: outlet.address ?? '',
        city: outlet.city ?? '',
        state: outlet.state ?? '',
        pincode: outlet.pincode ?? '',
        phone: outlet.phone ?? '',
        phone2: outlet.phone2 ?? '',
        email: outlet.email ?? '',
      })
    }
  }, [outlet, editing])

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => outletApi.update(resolvedOutletId!, form),
    onSuccess: (res) => {
      toast.success('Business info saved')
      qc.setQueryData(['outlet', resolvedOutletId], res.data.data)
      qc.invalidateQueries({ queryKey: ['outlet-name'] })
      setEditing(false)
    },
    onError: () => toast.error('Failed to save'),
  })

  const field = (key: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f: any) => ({ ...f, [key]: e.target.value }))

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <Loader2 size={24} className="animate-spin text-primary-500" />
    </div>
  )

  // ── View Mode ──────────────────────────────────────────────────────────────
  if (!editing) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Business Info</h2>
            <p className="text-sm text-gray-500 mt-0.5">Your factory details shown on receipts and reports</p>
          </div>
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-2 border border-gray-300 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors">
            <Pencil size={14} /> Edit Info
          </button>
        </div>

        {/* Business name banner */}
        <div className="bg-primary-50 border border-primary-100 rounded-xl px-5 py-4 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-r from-violet-600 to-blue-600 flex items-center justify-center shrink-0">
            <Building2 size={22} className="text-white" />
          </div>
          <div>
            <p className="text-xs text-primary-600 font-medium uppercase tracking-wide">Business Name</p>
            <p className="text-xl font-bold text-gray-900 mt-0.5">{outlet?.name || '—'}</p>
            {outlet?.gstin && <p className="text-xs text-gray-500 mt-1">GSTIN: {outlet.gstin}</p>}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { icon: <MapPin size={14} />,  label: 'Address',        value: [outlet?.address, outlet?.city, outlet?.state, outlet?.pincode].filter(Boolean).join(', ') || '—' },
            { icon: <Phone size={14} />,   label: 'Phone',          value: outlet?.phone   || '—' },
            { icon: <Phone size={14} />,   label: 'Secondary Phone', value: outlet?.phone2  || '—' },
            { icon: <Mail size={14} />,    label: 'Email',          value: outlet?.email   || '—' },
            { icon: <Hash size={14} />,    label: 'GSTIN',          value: outlet?.gstin   || '—' },
            { icon: <FileText size={14} />, label: 'PAN',           value: outlet?.pan     || '—' },
          ].map(({ icon, label, value }) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4 border border-gray-100">
              <div className="flex items-center gap-2 text-gray-500 mb-1.5">
                {icon}
                <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
              </div>
              <p className="text-sm font-medium text-gray-800">{value}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ── Edit Mode ──────────────────────────────────────────────────────────────
  const inp = (label: string, key: string, placeholder = '') => (
    <div key={key}>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input value={form[key] ?? ''} onChange={field(key)} placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
    </div>
  )

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Edit Business Info</h2>
          <p className="text-sm text-gray-500 mt-0.5">Changes will reflect in the sidebar and receipts</p>
        </div>
      </div>

      <div className="space-y-4">
        {inp('Business Name', 'name', 'My Store')}
        <div className="grid grid-cols-2 gap-3">
          {inp('GSTIN', 'gstin', '22AAAAA0000A1Z5')}
          {inp('PAN', 'pan', 'AAAAA0000A')}
        </div>
        {inp('Address', 'address', '123 Main Street')}
        <div className="grid grid-cols-3 gap-3">
          {inp('City', 'city', 'Mumbai')}
          {inp('State', 'state', 'Maharashtra')}
          {inp('Pincode', 'pincode', '400001')}
        </div>
        <div className="grid grid-cols-2 gap-3">
          {inp('Phone', 'phone', '+91 9876543210')}
          {inp('Secondary Phone', 'phone2', '+91 9876543210')}
        </div>
        {inp('Email', 'email', 'store@business.com')}
      </div>

      <div className="flex gap-3 mt-6 pt-5 border-t border-gray-100">
        <button onClick={() => setEditing(false)}
          className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-50">
          Cancel
        </button>
        <button onClick={() => save()} disabled={isPending}
          className="flex-1 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50">
          {isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
          {isPending ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ─── Roles Settings ───────────────────────────────────────────────────────────

const PERMISSION_GROUPS = [
  {
    group: 'Point of Sale',
    icon: '🛒',
    items: [
      { key: 'POS_ACCESS',        label: 'POS Access',         desc: 'Open and use the POS screen' },
      { key: 'PROCESS_SALES',     label: 'Process Sales',      desc: 'Complete sales transactions' },
      { key: 'PROCESS_RETURNS',   label: 'Process Returns',    desc: 'Accept returns and issue refunds' },
      { key: 'APPLY_DISCOUNTS',   label: 'Apply Discounts',    desc: 'Apply item and bill discounts' },
      { key: 'OPEN_PRICE',        label: 'Open Price Edit',    desc: 'Modify item price at time of sale' },
    ],
  },
  {
    group: 'Products & Inventory',
    icon: '📦',
    items: [
      { key: 'VIEW_PRODUCTS',     label: 'View Products',      desc: 'Browse the product catalogue' },
      { key: 'MANAGE_PRODUCTS',   label: 'Manage Products',    desc: 'Add, edit and delete products' },
      { key: 'VIEW_INVENTORY',    label: 'View Inventory',     desc: 'View stock levels' },
      { key: 'MANAGE_INVENTORY',  label: 'Manage Inventory',   desc: 'Adjust stock and transfers' },
    ],
  },
  {
    group: 'Customers',
    icon: '👥',
    items: [
      { key: 'VIEW_CUSTOMERS',    label: 'View Customers',     desc: 'Browse customer profiles' },
      { key: 'MANAGE_CUSTOMERS',  label: 'Manage Customers',   desc: 'Add, edit customer records' },
    ],
  },
  {
    group: 'Sales',
    icon: '🧾',
    items: [
      { key: 'VIEW_ORDERS',       label: 'View Orders',        desc: 'Browse order history' },
      { key: 'MANAGE_ORDERS',     label: 'Manage Orders',      desc: 'Modify or cancel orders' },
      { key: 'VIEW_PAYMENTS',     label: 'View Payments',      desc: 'View payment records' },
    ],
  },
  {
    group: 'Purchases',
    icon: '🛒',
    items: [
      { key: 'VIEW_PURCHASES',    label: 'View Purchases',     desc: 'Browse purchase orders and bills' },
      { key: 'MANAGE_PURCHASES',  label: 'Manage Purchases',   desc: 'Create and manage purchase orders' },
    ],
  },
  {
    group: 'Reports',
    icon: '📊',
    items: [
      { key: 'VIEW_REPORTS',      label: 'View Reports',       desc: 'Access sales and analytics reports' },
      { key: 'VIEW_SHIFTS',       label: 'View Shifts',        desc: 'See shift summaries' },
      { key: 'MANAGE_SHIFTS',     label: 'Manage Shifts',      desc: 'Open and close shifts' },
    ],
  },
  {
    group: 'Administration',
    icon: '⚙️',
    items: [
      { key: 'MANAGE_STAFF',      label: 'Manage Staff',       desc: 'Add and edit staff accounts' },
      { key: 'MANAGE_DISCOUNTS',  label: 'Manage Discounts',   desc: 'Create and edit discounts' },
      { key: 'MANAGE_SETTINGS',   label: 'Manage Settings',    desc: 'Change system settings' },
    ],
  },
]

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key))

const BUILT_IN_ROLES = [
  {
    value: 'CASHIER',
    label: 'Cashier',
    color: 'bg-green-100 text-green-700',
    permissions: ['POS_ACCESS', 'PROCESS_SALES', 'PROCESS_RETURNS', 'VIEW_CUSTOMERS', 'VIEW_PRODUCTS', 'MANAGE_SHIFTS', 'VIEW_SHIFTS'],
  },
  {
    value: 'MANAGER',
    label: 'Manager',
    color: 'bg-blue-100 text-blue-700',
    permissions: ['POS_ACCESS', 'PROCESS_SALES', 'PROCESS_RETURNS', 'APPLY_DISCOUNTS', 'OPEN_PRICE',
      'VIEW_CUSTOMERS', 'MANAGE_CUSTOMERS', 'VIEW_PRODUCTS', 'MANAGE_PRODUCTS',
      'VIEW_INVENTORY', 'MANAGE_INVENTORY', 'VIEW_ORDERS', 'MANAGE_ORDERS',
      'VIEW_PAYMENTS', 'VIEW_REPORTS', 'MANAGE_SHIFTS', 'VIEW_SHIFTS', 'MANAGE_DISCOUNTS', 'MANAGE_STAFF'],
  },
  {
    value: 'ACCOUNTANT',
    label: 'Accountant',
    color: 'bg-purple-100 text-purple-700',
    permissions: ['VIEW_REPORTS', 'VIEW_PAYMENTS', 'VIEW_ORDERS', 'VIEW_PURCHASES', 'VIEW_SHIFTS'],
  },
  {
    value: 'ADMIN',
    label: 'Admin',
    color: 'bg-red-100 text-red-700',
    permissions: ALL_PERMISSIONS.filter(p => p !== 'MANAGE_SETTINGS'),
  },
  {
    value: 'SUPER_ADMIN',
    label: 'Super Admin',
    color: 'bg-orange-100 text-orange-700',
    permissions: ALL_PERMISSIONS,
  },
]

const CUSTOM_COLORS = [
  { value: 'bg-teal-100 text-teal-700',     label: 'Teal' },
  { value: 'bg-cyan-100 text-cyan-700',     label: 'Cyan' },
  { value: 'bg-indigo-100 text-indigo-700', label: 'Indigo' },
  { value: 'bg-pink-100 text-pink-700',     label: 'Pink' },
  { value: 'bg-lime-100 text-lime-700',     label: 'Lime' },
  { value: 'bg-amber-100 text-amber-700',   label: 'Amber' },
  { value: 'bg-sky-100 text-sky-700',       label: 'Sky' },
  { value: 'bg-rose-100 text-rose-700',     label: 'Rose' },
]

function RoleModal({ role, onClose, onDone }: { role: any | null; onClose: () => void; onDone: () => void }) {
  const isEdit = !!role
  const qc = useQueryClient()
  const [modalTab, setModalTab] = useState<'system' | 'process'>('system')

  // ── Details & system permissions ──────────────────────────────────────────
  const [displayName, setDisplayName] = useState(role?.displayName ?? '')
  const [description, setDescription] = useState(role?.description ?? '')
  const [color, setColor] = useState(role?.color ?? CUSTOM_COLORS[0].value)
  const [permissions, setPermissions] = useState<string[]>(role?.permissions ?? [])
  const [noPermissions, setNoPermissions] = useState<boolean>(role ? (role.permissions ?? []).length === 0 : false)

  // ── Process permissions ────────────────────────────────────────────────────
  const [business, setBusiness] = useState<string[]>([])
  const [pccp, setPccp]         = useState<string[]>([])

  const { isLoading: loadingProcessPerms, data: processPermsData } = useQuery({
    queryKey: ['role-card-permissions', role?.name],
    queryFn: () => roleCardPermissionsApi.get(role.name).then(r => r.data.data),
    enabled: isEdit && !!role?.name,
  })

  useEffect(() => {
    if (processPermsData) {
      setBusiness((processPermsData as any)?.business ?? [])
      setPccp((processPermsData as any)?.pccp ?? [])
    }
  }, [processPermsData])

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function togglePermission(key: string) {
    setPermissions(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key])
  }
  function selectGroup(groupItems: string[], select: boolean) {
    setPermissions(prev => select ? [...new Set([...prev, ...groupItems])] : prev.filter(p => !groupItems.includes(p)))
  }
  function toggleBusiness(key: string) { setBusiness(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]) }
  function togglePccp(key: string) { setPccp(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key]) }

  async function handleSubmit() {
    if (!displayName.trim()) { setError('Role name is required'); setModalTab('system'); return }
    if (!noPermissions && permissions.length === 0) { setError('Select at least one permission, or check "No Specific Permissions"'); setModalTab('system'); return }
    setError('')
    setLoading(true)
    const name = displayName.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')
    try {
      const payload = { name, displayName: displayName.trim(), description: description.trim(), permissions: noPermissions ? [] : permissions, color }
      if (isEdit) {
        await rolesApi.update(role.id, payload)
      } else {
        await rolesApi.create(payload)
      }
      // Save process permissions
      const roleName = isEdit ? role.name : name
      await roleCardPermissionsApi.update(roleName, { business, pccp })
      await qc.invalidateQueries({ queryKey: ['custom-roles'] })
      await qc.invalidateQueries({ queryKey: ['role-card-permissions', roleName] })
      toast.success(isEdit ? 'Role updated' : 'Role created')
      onDone()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save role')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Role' : 'Create Custom Role'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Configure name, badge color, system and process permissions</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        {/* Sub-tabs */}
        <div className="flex items-center gap-2 px-6 pt-4 pb-0 shrink-0">
          <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-xl">
            <button onClick={() => setModalTab('system')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${modalTab === 'system' ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              System Permissions
            </button>
            <button onClick={() => setModalTab('process')}
              className={`px-4 py-1.5 text-xs font-semibold rounded-lg transition-all ${modalTab === 'process' ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              Process Permissions
            </button>
          </div>
          {modalTab === 'process' && (
            <span className="text-xs text-gray-400">{business.length} business · {pccp.length} PCCP selected</span>
          )}
        </div>

        <div className="overflow-auto flex-1 px-6 py-5 space-y-5">

          {/* ── System tab ───────────────────────────────────────────── */}
          {modalTab === 'system' && (<>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Role Name <span className="text-red-500">*</span>
              </label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="e.g. Store Manager"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              {displayName && (
                <p className="text-xs text-gray-400 mt-1">
                  System key: <span className="font-mono">{displayName.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')}</span>
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Brief description of this role"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Badge Color</label>
            <div className="flex gap-2 flex-wrap">
              {CUSTOM_COLORS.map(c => (
                <button key={c.value} onClick={() => setColor(c.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border-2 transition-all ${c.value} ${color === c.value ? 'border-gray-800 scale-110' : 'border-transparent'}`}>
                  {c.label}
                </button>
              ))}
            </div>
            {displayName && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-400">Preview:</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{displayName}</span>
              </div>
            )}
          </div>

          {/* No specific permissions toggle */}
          <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl border border-gray-200 hover:bg-gray-50 transition-colors">
            <div
              onClick={() => { setNoPermissions(v => !v); if (!noPermissions) setPermissions([]) }}
              className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${noPermissions ? 'bg-violet-600 border-violet-600' : 'border-gray-300'}`}>
              {noPermissions && <Check size={12} className="text-white" strokeWidth={3} />}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800">No Specific Permissions</p>
              <p className="text-xs text-gray-400 mt-0.5">This role is a label only — no system access restrictions apply</p>
            </div>
          </label>

          <div className={noPermissions ? 'opacity-40 pointer-events-none' : ''}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <label className="text-sm font-medium text-gray-700">
                  Permissions {!noPermissions && <span className="text-red-500">*</span>}
                </label>
                <span className="text-xs text-gray-400 ml-2">{permissions.length} of {ALL_PERMISSIONS.length} selected</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setPermissions([...ALL_PERMISSIONS])}
                  className="text-xs text-primary-600 hover:text-primary-700 font-medium px-2 py-1 rounded hover:bg-primary-50">
                  Select All
                </button>
                <button onClick={() => setPermissions([])}
                  className="text-xs text-gray-500 hover:text-gray-700 font-medium px-2 py-1 rounded hover:bg-gray-50">
                  Clear All
                </button>
              </div>
            </div>
            <div className="space-y-4">
              {PERMISSION_GROUPS.map(group => {
                const groupKeys = group.items.map(i => i.key)
                const allSelected = groupKeys.every(k => permissions.includes(k))
                const someSelected = groupKeys.some(k => permissions.includes(k))
                return (
                  <div key={group.group} className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                      <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                        <span>{group.icon}</span> {group.group}
                      </span>
                      <button
                        onClick={() => selectGroup(groupKeys, !allSelected)}
                        className={`text-xs font-medium px-2 py-1 rounded transition-colors ${
                          allSelected ? 'text-primary-700 bg-primary-100 hover:bg-primary-200' :
                          someSelected ? 'text-gray-600 bg-gray-100 hover:bg-gray-200' :
                          'text-gray-500 hover:bg-gray-100'
                        }`}>
                        {allSelected ? 'Deselect all' : 'Select all'}
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-0 divide-x divide-y divide-gray-100">
                      {group.items.map(item => {
                        const active = permissions.includes(item.key)
                        return (
                          <button key={item.key} onClick={() => togglePermission(item.key)}
                            className={`flex items-start gap-3 px-4 py-3 text-left transition-colors ${active ? 'bg-primary-50' : 'bg-white hover:bg-gray-50'}`}>
                            <div className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${active ? 'bg-violet-600 border-violet-600' : 'border-gray-300'}`}>
                              {active && <Check size={10} className="text-white" strokeWidth={3} />}
                            </div>
                            <div>
                              <p className={`text-xs font-medium ${active ? 'text-primary-700' : 'text-gray-700'}`}>{item.label}</p>
                              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">{item.desc}</p>
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-500 flex items-center gap-1.5">
              <AlertCircle size={14} /> {error}
            </p>
          )}
          </>)}

          {/* ── Process tab ──────────────────────────────────────────── */}
          {modalTab === 'process' && (
            loadingProcessPerms ? (
              <div className="flex items-center justify-center py-16 text-gray-400">
                <Loader2 size={20} className="animate-spin mr-2" /> Loading…
              </div>
            ) : (
              <div className="space-y-5">
                {/* Business Cards */}
                <div className="bg-white rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div>
                      <span className="text-sm font-bold text-gray-800">Business Cards</span>
                      <span className="ml-2 text-xs text-gray-400">{business.length}/{CARD_PERMISSION_BUSINESS.length}</span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <button onClick={() => setBusiness(CARD_PERMISSION_BUSINESS.map(c => c.key))} className="text-violet-600 hover:underline font-medium">Select All</button>
                      <button onClick={() => setBusiness([])} className="text-gray-400 hover:underline">Clear</button>
                    </div>
                  </div>
                  <div className="p-4 space-y-4">
                    {CARD_CATEGORIES.map(cat => {
                      const cards = CARD_PERMISSION_BUSINESS.filter(c => c.category === cat)
                      if (!cards.length) return null
                      const allCatSelected = cards.every(c => business.includes(c.key))
                      return (
                        <div key={cat}>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{cat}</span>
                            <button onClick={() => setBusiness(prev => allCatSelected ? prev.filter(k => !cards.map(c=>c.key).includes(k)) : [...new Set([...prev, ...cards.map(c=>c.key)])])}
                              className="text-xs text-gray-400 hover:text-violet-600">{allCatSelected ? 'Deselect' : 'Select all'}</button>
                          </div>
                          <div className="grid grid-cols-3 gap-2">
                            {cards.map(card => {
                              const on = business.includes(card.key)
                              return (
                                <button key={card.key} onClick={() => toggleBusiness(card.key)}
                                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left ${on ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}>
                                  <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-violet-600 border-violet-600' : 'border-gray-300'}`}>
                                    {on && <Check size={8} className="text-white" strokeWidth={3} />}
                                  </div>
                                  {card.label}
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
                <div className="bg-white rounded-xl border border-gray-200">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                    <div>
                      <span className="text-sm font-bold text-gray-800">PCCP Stages</span>
                      <span className="ml-2 text-xs text-gray-400">{pccp.length}/{CARD_PERMISSION_PCCP.length}</span>
                    </div>
                    <div className="flex gap-3 text-xs">
                      <button onClick={() => setPccp(CARD_PERMISSION_PCCP.map(s => s.key))} className="text-violet-600 hover:underline font-medium">Select All</button>
                      <button onClick={() => setPccp([])} className="text-gray-400 hover:underline">Clear</button>
                    </div>
                  </div>
                  <div className="p-4 grid grid-cols-3 gap-2">
                    {CARD_PERMISSION_PCCP.map(stage => {
                      const on = pccp.includes(stage.key)
                      return (
                        <button key={stage.key} onClick={() => togglePccp(stage.key)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all text-left ${on ? 'border-violet-400 bg-violet-50 text-violet-700' : 'border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'}`}>
                          <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${on ? 'bg-violet-600 border-violet-600' : 'border-gray-300'}`}>
                            {on && <Check size={8} className="text-white" strokeWidth={3} />}
                          </div>
                          {stage.label}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            )
          )}

        </div>

        <div className="px-6 py-4 border-t flex gap-3 shrink-0">
          <button onClick={onClose}
            className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Role'}
          </button>
        </div>
      </div>
    </div>
  )
}

const SUPER_ADMIN_ROLE = { value: 'SUPER_ADMIN', label: 'Super Admin', color: 'bg-orange-100 text-orange-700', permissions: ALL_PERMISSIONS }

function RolesSettings() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editTarget, setEditTarget] = useState<any | null>(null)
  const [expandedRole, setExpandedRole] = useState<string | null>(null)
  const [showCreateUser, setShowCreateUser] = useState(false)
  const [editUser, setEditUser] = useState<any | null>(null)

  const { data: roles = [], isLoading: rolesLoading } = useQuery({
    queryKey: ['custom-roles'],
    queryFn: () => rolesApi.getAll().then(r => r.data.data ?? []),
  })

  const { data: allStaff = [], isLoading: staffLoading } = useQuery({
    queryKey: ['staff-all'],
    queryFn: () => staffApi.getAll().then(r => r.data.data as any[]),
  })

  const cardPermsResults = useQueries({
    queries: (roles as any[]).map((role: any) => ({
      queryKey: ['role-card-permissions', role.name],
      queryFn: () => roleCardPermissionsApi.get(role.name).then((r: any) => r.data.data),
    })),
  })

  function getProcessCount(roleName: string) {
    const idx = (roles as any[]).findIndex((r: any) => r.name === roleName)
    const data = cardPermsResults[idx]?.data as any
    return (data?.business?.length ?? 0) + (data?.pccp?.length ?? 0)
  }

  async function deleteRole(role: any) {
    if (!window.confirm(`Delete role "${role.displayName}"? This cannot be undone.`)) return
    try {
      await rolesApi.delete(role.id)
      toast.success('Role deleted')
      qc.invalidateQueries({ queryKey: ['custom-roles'] })
    } catch {
      toast.error('Failed to delete role')
    }
  }

  function permCount(perms: string[]) {
    return `${perms.length} permission${perms.length !== 1 ? 's' : ''}`
  }

  const saExpanded = expandedRole === 'SUPER_ADMIN'

  return (
    <div>
      <div className="mb-2">
        <h2 className="text-lg font-semibold text-gray-900">Staff Members</h2>
        <p className="text-sm text-gray-500 mt-0.5">Manage users and their assigned roles</p>
      </div>

      {/* ── Users section ── */}
      <div className="mb-8 mt-6">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users size={13} className="text-gray-400" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Users</span>
          </div>
          <button
            onClick={() => setShowCreateUser(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 border border-violet-200 hover:border-violet-300 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors">
            <UserPlus size={13} /> Add User
          </button>
        </div>

        {staffLoading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={18} className="animate-spin mr-2" /> Loading…
          </div>
        ) : allStaff.length === 0 ? (
          <div className="border border-dashed border-gray-200 rounded-xl px-6 py-8 text-center">
            <p className="text-sm text-gray-400">No users yet.</p>
            <button onClick={() => setShowCreateUser(true)}
              className="mt-2 text-sm text-violet-600 hover:underline font-medium flex items-center gap-1.5 mx-auto">
              <UserPlus size={14} /> Create your first user
            </button>
          </div>
        ) : (
          <div className="border border-gray-200 rounded-xl divide-y divide-gray-100 overflow-hidden">
            {(allStaff as any[]).map((u: any) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3">
                <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-xs font-bold shrink-0">
                  {(u.name || u.email || '?')[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">{u.name || '—'}</p>
                  <p className="text-xs text-gray-400 truncate">{u.email}</p>
                </div>
                <div className="flex flex-wrap gap-1 justify-end">
                  {(u.roles ?? []).map((r: string) => {
                    const roleObj = (roles as any[]).find((x: any) => x.name === r)
                    return (
                      <span key={r} className={`text-xs px-2 py-0.5 rounded-full font-medium ${roleObj?.color ?? 'bg-gray-100 text-gray-600'}`}>
                        {roleObj?.displayName ?? r}
                      </span>
                    )
                  })}
                </div>
                <button
                  onClick={() => setEditUser(u)}
                  className="p-1.5 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-gray-50 shrink-0 ml-1">
                  <Edit2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Roles & Permissions section ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck size={13} className="text-primary-500" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Roles & Permissions</span>
          </div>
          <button onClick={() => { setEditTarget(null); setShowModal(true) }}
            className="flex items-center gap-1.5 text-xs font-medium text-violet-600 hover:text-violet-700 border border-violet-200 hover:border-violet-300 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors">
            <Plus size={13} /> Add Role
          </button>
        </div>

        {/* Super Admin — always locked */}
        <div className="mb-2">
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <button
              onClick={() => setExpandedRole(saExpanded ? null : 'SUPER_ADMIN')}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-50 transition-colors">
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${SUPER_ADMIN_ROLE.color}`}>{SUPER_ADMIN_ROLE.label}</span>
              <span className="text-sm text-gray-500">{permCount(SUPER_ADMIN_ROLE.permissions)}</span>
              <Lock size={12} className="text-gray-300" />
              <span className="ml-auto text-xs text-gray-400">{saExpanded ? 'Hide' : 'View'} permissions</span>
            </button>
            {saExpanded && (
              <div className="border-t border-gray-100 px-4 py-3 bg-gray-50">
                <div className="flex flex-wrap gap-1.5">
                  {PERMISSION_GROUPS.flatMap(g => g.items).map(p => (
                    <span key={p.key} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{p.label}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {rolesLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading…
          </div>
        ) : (
          <div className="space-y-2">
            {(roles as any[]).map((role: any) => {
              const isExpanded = expandedRole === role.name
              return (
                <div key={role.id} className="border border-gray-200 rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3">
                    <button
                      onClick={() => setExpandedRole(isExpanded ? null : role.name)}
                      className="flex items-center gap-3 flex-1 text-left min-w-0">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${role.color ?? 'bg-gray-100 text-gray-600'}`}>
                        {role.displayName}
                      </span>
                      {role.description && <span className="text-xs text-gray-400 truncate">{role.description}</span>}
                      <span className="text-xs text-gray-400 ml-auto shrink-0">
                        {allStaff.filter((u: any) => u.roles?.includes(role.name)).length} users · {role.permissions?.length ?? 0} sys · {getProcessCount(role.name)} process
                      </span>
                    </button>
                    <button onClick={() => { setEditTarget(role); setShowModal(true) }}
                      className="p-1.5 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 shrink-0">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteRole(role)}
                      className="p-1.5 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-50 shrink-0">
                      <Trash2 size={14} />
                    </button>
                  </div>
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Permissions</p>
                      {(role.permissions ?? []).length === 0 ? (
                        <p className="text-xs text-gray-400 italic">No specific permissions — label only</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {PERMISSION_GROUPS.flatMap(g => g.items).filter(p => (role.permissions ?? []).includes(p.key)).map(p => (
                            <span key={p.key} className="text-xs bg-white border border-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                              {p.label}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showModal && (
        <RoleModal
          role={editTarget}
          onClose={() => setShowModal(false)}
          onDone={() => { setShowModal(false); qc.invalidateQueries({ queryKey: ['custom-roles'] }) }}
        />
      )}
      {showCreateUser && (
        <CreateUserModal
          roles={roles as any[]}
          onClose={() => setShowCreateUser(false)}
          onDone={() => {
            setShowCreateUser(false)
            qc.invalidateQueries({ queryKey: ['staff-all'] })
          }}
        />
      )}
      {editUser && (
        <EditUserModal
          user={editUser}
          roles={roles as any[]}
          onClose={() => setEditUser(null)}
          onDone={() => {
            setEditUser(null)
            qc.invalidateQueries({ queryKey: ['staff-all'] })
          }}
        />
      )}
    </div>
  )
}

// ─── Create User Modal ───────────────────────────────────────────────────────

function CreateUserModal({ roles, onClose, onDone }: { roles: any[]; onClose: () => void; onDone: () => void }) {
  const [name, setName]             = useState('')
  const [email, setEmail]           = useState('')
  const [phone, setPhone]           = useState('')
  const [password, setPassword]     = useState('')
  const [selectedRole, setSelectedRole] = useState(roles[0]?.name ?? '')
  const [showPw, setShowPw]         = useState(false)
  const [errors, setErrors]         = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: () => staffApi.create({ name, email: email || undefined, phone: phone || undefined, password, roles: selectedRole ? [selectedRole] : [] }),
    onSuccess: () => {
      const roleObj = roles.find(r => r.name === selectedRole)
      toast.success(`User "${name}" created${roleObj ? ` as ${roleObj.displayName}` : ''}`)
      onDone()
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to create user'
      toast.error(msg)
    },
  })

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email'
    if (!password) e.password = 'Password is required'
    else if (password.length < 6) e.password = 'Minimum 6 characters'
    if (!selectedRole) e.role = 'Please select a role'
    return e
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <UserPlus size={16} className="text-violet-600" />
            </div>
            <h2 className="text-sm font-bold text-gray-900">Add User</h2>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
            <input
              value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })) }}
              placeholder="e.g. Ravi Kumar"
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })) }}
              placeholder="user@example.com"
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 9922450055"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
                placeholder="Min. 6 characters"
                className={`w-full border rounded-lg px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none ${errors.password ? 'border-red-400' : 'border-gray-300'}`}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
            <select
              value={selectedRole}
              onChange={e => { setSelectedRole(e.target.value); setErrors(p => ({ ...p, role: '' })) }}
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none bg-white ${errors.role ? 'border-red-400' : 'border-gray-300'}`}
            >
              <option value="">— Select a role —</option>
              {roles.map(r => (
                <option key={r.name} value={r.name}>{r.displayName}</option>
              ))}
            </select>
            {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {mutation.isPending ? 'Creating…' : 'Create User'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Edit User Modal ─────────────────────────────────────────────────────────

function EditUserModal({ user, roles, onClose, onDone }: { user: any; roles: any[]; onClose: () => void; onDone: () => void }) {
  const [name, setName]             = useState(user.name ?? '')
  const [email, setEmail]           = useState(user.email ?? '')
  const [phone, setPhone]           = useState(user.phone ?? '')
  const [password, setPassword]     = useState('')
  const [selectedRole, setSelectedRole] = useState(user.roles?.[0] ?? '')
  const [showPw, setShowPw]         = useState(false)
  const [errors, setErrors]         = useState<Record<string, string>>({})

  const mutation = useMutation({
    mutationFn: () => {
      const payload: any = {
        name,
        email: email || undefined,
        phone: phone || undefined,
        roles: selectedRole ? [selectedRole] : [],
      }
      if (password) payload.password = password
      return staffApi.update(user.id, payload)
    },
    onSuccess: () => {
      toast.success(`User "${name}" updated`)
      onDone()
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || 'Failed to update user')
    },
  })

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email'
    if (password && password.length < 6) e.password = 'Minimum 6 characters'
    if (!selectedRole) e.role = 'Please select a role'
    return e
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length) { setErrors(errs); return }
    mutation.mutate()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center">
              <Edit2 size={16} className="text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">Edit User</h2>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
            <input
              value={name} onChange={e => { setName(e.target.value); setErrors(p => ({ ...p, name: '' })) }}
              placeholder="e.g. Ravi Kumar"
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email" value={email} onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: '' })) }}
              placeholder="user@example.com"
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
            />
            {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="tel" value={phone} onChange={e => setPhone(e.target.value)}
              placeholder="e.g. 9922450055"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password <span className="text-gray-400 font-normal">(leave blank to keep current)</span></label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'} value={password}
                onChange={e => { setPassword(e.target.value); setErrors(p => ({ ...p, password: '' })) }}
                placeholder="Min. 6 characters"
                className={`w-full border rounded-lg px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none ${errors.password ? 'border-red-400' : 'border-gray-300'}`}
              />
              <button type="button" onClick={() => setShowPw(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {errors.password && <p className="text-xs text-red-500 mt-1">{errors.password}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Role <span className="text-red-500">*</span></label>
            <select
              value={selectedRole}
              onChange={e => { setSelectedRole(e.target.value); setErrors(p => ({ ...p, role: '' })) }}
              className={`w-full border rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none bg-white ${errors.role ? 'border-red-400' : 'border-gray-300'}`}
            >
              <option value="">— Select a role —</option>
              {roles.map(r => (
                <option key={r.name} value={r.name}>{r.displayName}</option>
              ))}
            </select>
            {errors.role && <p className="text-xs text-red-500 mt-1">{errors.role}</p>}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="flex-1 px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 hover:bg-violet-700 rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {mutation.isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Process Permissions Settings ────────────────────────────────────────────

const CARD_PERMISSION_BUSINESS = [
  { key: 'pccp',               label: 'PCCP',               category: 'Production' },
  { key: 'psc',                label: 'PSC',                category: 'Production' },
  { key: 'discard',            label: 'Discard',            category: 'Production' },
  { key: 'extra-fab',          label: 'Extra Fabrication',  category: 'Production' },
  { key: 'cutting',            label: 'Cutting',            category: 'Production' },
  { key: 'conversion',         label: 'Conversion',         category: 'Production' },
  { key: 'testing-lab',        label: 'Testing Lab',        category: 'Quality' },
  { key: 'pdi',                label: 'PDI',                category: 'Quality' },
  { key: 'maintenance',        label: 'Maintenance',        category: 'Operations' },
  { key: 'vehicles',           label: 'Vehicles',           category: 'Operations' },
  { key: 'diesel-maintenance', label: 'Diesel Maintenance', category: 'Operations' },
  { key: 'extra-vehicles',     label: 'Extra Vehicles',     category: 'Operations' },
  { key: 'silo',               label: 'Silo',               category: 'Materials' },
  { key: 'silo-extraction',    label: 'Silo Extraction',    category: 'Materials' },
  { key: 'cement-bags',        label: 'Cement Bags',        category: 'Materials' },
  { key: 'store-material',     label: 'Store Material',     category: 'Materials' },
  { key: 'loading',            label: 'Loading',            category: 'Logistics' },
  { key: 'loaded-pipes',       label: 'Loaded Pipes',       category: 'Logistics' },
  { key: 'transport-report',   label: 'Transport Report',   category: 'Logistics' },
  { key: 'labour',             label: 'Labour',             category: 'HR' },
]

const CARD_PERMISSION_PCCP = [
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

const CARD_CATEGORIES = ['Production', 'Quality', 'Operations', 'Materials', 'Logistics', 'HR']

function CardPermissionsSettings() {
  const qc = useQueryClient()
  const [selectedRole, setSelectedRole] = useState<string | null>(null)
  const [business, setBusiness] = useState<string[]>([])
  const [pccp, setPccp]         = useState<string[]>([])
  const [dirty, setDirty]       = useState(false)

  const { data: customRolesData } = useQuery({
    queryKey: ['custom-roles'],
    queryFn: () => rolesApi.getAll().then(r => r.data.data as any[]),
  })

  // Combined list: built-in roles (except SUPER_ADMIN) + custom roles
  const allRoles = [
    ...BUILT_IN_ROLES.filter(r => r.value !== 'SUPER_ADMIN').map(r => ({
      id: r.value, displayName: r.label, description: 'Built-in role', isBuiltIn: true, color: r.color,
    })),
    ...(customRolesData ?? []).map((r: any) => ({
      id: r.name, displayName: r.displayName || r.name, description: r.description, isBuiltIn: false, color: null,
    })),
  ]

  const { isLoading: loadingPerms, data: permsData } = useQuery({
    queryKey: ['role-card-permissions', selectedRole],
    queryFn: () => roleCardPermissionsApi.get(selectedRole!).then(r => r.data.data),
    enabled: selectedRole !== null,
  })

  useEffect(() => {
    setBusiness([])
    setPccp([])
    setDirty(false)
  }, [selectedRole])

  useEffect(() => {
    if (permsData) {
      setBusiness((permsData as any).business ?? [])
      setPccp((permsData as any).pccp ?? [])
      setDirty(false)
    }
  }, [permsData])

  const saveMutation = useMutation({
    mutationFn: () => roleCardPermissionsApi.update(selectedRole!, { business, pccp }),
    onSuccess: () => {
      toast.success('Card permissions saved')
      qc.invalidateQueries({ queryKey: ['role-card-permissions', selectedRole] })
      setDirty(false)
    },
    onError: () => toast.error('Failed to save'),
  })

  const toggle = (list: string[], set: (v: string[]) => void, key: string) => {
    set(list.includes(key) ? list.filter(k => k !== key) : [...list, key])
    setDirty(true)
  }

  const selectedRoleObj = allRoles.find(r => r.id === selectedRole)

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Process Permissions</h2>
          <p className="text-sm text-gray-500 mt-0.5">Control which Business and PCCP processes each role can access on mobile</p>
        </div>
      </div>

      <div className="flex gap-5">
        {/* Role list */}
        <div className="w-56 shrink-0">
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="divide-y divide-gray-50 max-h-[600px] overflow-y-auto">
              {allRoles.map(r => (
                <button
                  key={r.id}
                  onClick={() => setSelectedRole(r.id)}
                  className={`w-full text-left px-4 py-3 transition-colors ${selectedRole === r.id ? 'bg-slate-900 text-white' : 'hover:bg-gray-50 text-gray-700'}`}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium truncate">{r.displayName}</span>
                    {r.isBuiltIn && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ${selectedRole === r.id ? 'bg-white/20 text-white/80' : (r.color ?? 'bg-gray-100 text-gray-500')}`}>
                        Built-in
                      </span>
                    )}
                  </div>
                  {r.description && !r.isBuiltIn && (
                    <div className={`text-xs mt-0.5 truncate ${selectedRole === r.id ? 'text-white/50' : 'text-gray-400'}`}>{r.description}</div>
                  )}
                </button>
              ))}
              {allRoles.length === 0 && <div className="px-4 py-6 text-center text-xs text-gray-400">No roles found</div>}
            </div>
          </div>
        </div>

        {/* Permissions */}
        <div className="flex-1 min-w-0">
          {loadingPerms ? (
            <div className="flex items-center justify-center h-48 bg-white rounded-xl border border-gray-200">
              <Loader2 size={20} className="animate-spin text-gray-400" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div>
                  {selectedRole ? (
                    <>
                      <p className="text-sm font-bold text-gray-900">{selectedRoleObj?.displayName || selectedRole}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{business.length} business · {pccp.length} PCCP enabled</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Select a role on the left to configure its access</p>
                  )}
                </div>
                {selectedRole && (
                  <button
                    onClick={() => saveMutation.mutate()}
                    disabled={!dirty || saveMutation.isPending}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${dirty ? 'bg-slate-900 text-white hover:bg-slate-800' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
                  >
                    <Save size={14} />
                    {saveMutation.isPending ? 'Saving…' : 'Save'}
                  </button>
                )}
              </div>

              {/* Business Cards */}
              <div className={`bg-white rounded-xl border border-gray-200 ${!selectedRole ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div>
                    <span className="text-sm font-bold text-gray-800">Business Cards</span>
                    <span className="ml-2 text-xs text-gray-400">{selectedRole ? `${business.length}/` : ''}{CARD_PERMISSION_BUSINESS.length}</span>
                  </div>
                  {selectedRole && (
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => { setBusiness(CARD_PERMISSION_BUSINESS.map(c => c.key)); setDirty(true) }} className="text-blue-600 hover:underline font-medium">Select All</button>
                      <span className="text-gray-300">·</span>
                      <button onClick={() => { setBusiness([]); setDirty(true) }} className="text-gray-400 hover:underline">Clear</button>
                    </div>
                  )}
                </div>
                <div className="p-4 space-y-4">
                  {CARD_CATEGORIES.map(cat => {
                    const cards = CARD_PERMISSION_BUSINESS.filter(c => c.category === cat)
                    if (!cards.length) return null
                    return (
                      <div key={cat}>
                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">{cat}</p>
                        <div className="grid grid-cols-3 gap-1.5">
                          {cards.map(card => {
                            const checked = selectedRole ? business.includes(card.key) : false
                            return (
                              <button
                                key={card.key}
                                disabled={!selectedRole}
                                onClick={() => selectedRole && toggle(business, setBusiness, card.key)}
                                className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all text-xs ${
                                  !selectedRole ? 'border-gray-200 text-gray-400 cursor-default' :
                                  checked ? 'border-blue-400 bg-blue-50 text-gray-900' : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                }`}
                              >
                                {checked
                                  ? <CheckSquare size={13} className="shrink-0 text-blue-500" />
                                  : <Square size={13} className="shrink-0 text-gray-300" />}
                                <span className="font-medium truncate">{card.label}</span>
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
              <div className={`bg-white rounded-xl border border-gray-200 ${!selectedRole ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                  <div>
                    <span className="text-sm font-bold text-gray-800">PCCP Stages</span>
                    <span className="ml-2 text-xs text-gray-400">{selectedRole ? `${pccp.length}/` : ''}{CARD_PERMISSION_PCCP.length}</span>
                  </div>
                  {selectedRole && (
                    <div className="flex gap-2 text-xs">
                      <button onClick={() => { setPccp(CARD_PERMISSION_PCCP.map(s => s.key)); setDirty(true) }} className="text-blue-600 hover:underline font-medium">Select All</button>
                      <span className="text-gray-300">·</span>
                      <button onClick={() => { setPccp([]); setDirty(true) }} className="text-gray-400 hover:underline">Clear</button>
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="grid grid-cols-4 gap-1.5">
                    {CARD_PERMISSION_PCCP.map(stage => {
                      const checked = selectedRole ? pccp.includes(stage.key) : false
                      return (
                        <button
                          key={stage.key}
                          disabled={!selectedRole}
                          onClick={() => selectedRole && toggle(pccp, setPccp, stage.key)}
                          className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border text-left transition-all text-xs ${
                            !selectedRole ? 'border-gray-200 text-gray-400 cursor-default' :
                            checked ? 'border-violet-400 bg-violet-50 text-gray-900' : 'border-gray-200 hover:border-gray-300 text-gray-600'
                          }`}
                        >
                          {checked
                            ? <CheckSquare size={13} className="shrink-0 text-violet-500" />
                            : <Square size={13} className="shrink-0 text-gray-300" />}
                          <span className="font-medium truncate">{stage.label}</span>
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

// ─── Tax Group Form Modal ───────────────────────────────────────────────────

const HSN_RE = /^\d{4}(\d{2}(\d{2})?)?$/

function validateTaxGroup(form: any) {
  const e: Record<string, string> = {}
  if (!form.name.trim()) e.name = 'Name is required'
  if (form.totalRate === '' || form.totalRate === null) e.totalRate = 'Rate is required'
  else if (parseFloat(form.totalRate) < 0 || parseFloat(form.totalRate) > 100) e.totalRate = 'Must be between 0 and 100'
  if (form.hsnCode && !HSN_RE.test(form.hsnCode)) e.hsnCode = 'Must be 4, 6 or 8 digits'
  if (form.cessRate !== '' && parseFloat(form.cessRate) < 0) e.cessRate = 'Cannot be negative'
  return e
}

// Defined outside modal so it keeps a stable reference across re-renders
function TaxField({ label, name, form, onChange, onBlur, errors, touched, type = 'text', step, readOnly, placeholder }: any) {
  const err = touched?.[name] && errors?.[name]
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type} step={step} placeholder={placeholder}
        value={form[name]}
        readOnly={readOnly}
        onChange={e => onChange(name, e.target.value)}
        onBlur={() => onBlur?.(name)}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:outline-none ${
          readOnly ? 'bg-gray-50 text-gray-500 border-gray-200' :
          err ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-primary-500'
        }`}
      />
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
    </div>
  )
}

interface TaxGroupFormProps {
  initial?: any
  onClose: () => void
  onSaved: () => void
}

function TaxGroupFormModal({ initial, onClose, onSaved }: TaxGroupFormProps) {
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    totalRate: initial?.totalRate ?? '',
    cgstRate: initial?.cgstRate ?? '',
    sgstRate: initial?.sgstRate ?? '',
    igstRate: initial?.igstRate ?? '',
    cessRate: initial?.cessRate ?? '0',
    hsnCode: initial?.hsnCode ?? '',
    inclusive: initial?.inclusive ?? false,
  })
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'intra' | 'inter'>('intra') // CGST+SGST vs IGST
  const [touched, setTouched] = useState<Record<string, boolean>>({})

  const set = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }))
  const touch = (k: string) => setTouched(t => ({ ...t, [k]: true }))
  const touchAll = () => setTouched({ name: true, totalRate: true, hsnCode: true, cessRate: true })
  const errors = validateTaxGroup(form)

  // Auto-split total rate into CGST/SGST when intra-state
  const handleTotalRate = (val: string) => {
    const total = parseFloat(val) || 0
    set('totalRate', val)
    if (mode === 'intra') {
      const half = (total / 2).toFixed(2)
      set('cgstRate', half)
      set('sgstRate', half)
      set('igstRate', '')
    } else {
      set('igstRate', String(total))
      set('cgstRate', '')
      set('sgstRate', '')
    }
  }

  const handleModeChange = (m: 'intra' | 'inter') => {
    setMode(m)
    const total = parseFloat(form.totalRate) || 0
    if (m === 'intra') {
      const half = (total / 2).toFixed(2)
      set('cgstRate', half)
      set('sgstRate', half)
      set('igstRate', '')
    } else {
      set('igstRate', String(total))
      set('cgstRate', '')
      set('sgstRate', '')
    }
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    touchAll()
    if (Object.keys(errors).length > 0) return
    setLoading(true)
    try {
      const payload = {
        ...form,
        totalRate: parseFloat(form.totalRate) || 0,
        cgstRate: parseFloat(form.cgstRate) || null,
        sgstRate: parseFloat(form.sgstRate) || null,
        igstRate: parseFloat(form.igstRate) || null,
        cessRate: parseFloat(form.cessRate) || 0,
      }
      if (initial) {
        await taxGroupApi.update(initial.id, payload)
        toast.success('Tax group updated')
      } else {
        await taxGroupApi.create(payload)
        toast.success('Tax group created')
      }
      onSaved()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-bold">{initial ? 'Edit' : 'New'} Tax Group</h2>
          <button onClick={onClose}><X size={20} className="text-gray-400" /></button>
        </div>

        <form onSubmit={submit} noValidate className="p-5 space-y-4">
          {/* Basic info */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <TaxField label="Tax Group Name *" name="name" placeholder="e.g. GST 18%"
                form={form} onChange={set} errors={errors} touched={touched} onBlur={touch} />
            </div>
            <TaxField label="HSN Code" name="hsnCode" placeholder="e.g. 8471"
              form={form} onChange={set} errors={errors} touched={touched} onBlur={touch} />
            <TaxField label="Total GST Rate (%)" name="totalRate" type="number" step="0.01"
              placeholder="18" form={form} onChange={(_n: string, v: string) => handleTotalRate(v)}
              errors={errors} touched={touched} onBlur={touch} />
          </div>

          {/* Transaction type toggle */}
          <div>
            <p className="text-xs font-medium text-gray-600 mb-2">Transaction Type</p>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {(['intra', 'inter'] as const).map(m => (
                <button key={m} type="button"
                  onClick={() => handleModeChange(m)}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${mode === m ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white' : 'text-gray-600 hover:bg-gray-50'}`}>
                  {m === 'intra' ? 'Intra-State (CGST + SGST)' : 'Inter-State (IGST)'}
                </button>
              ))}
            </div>
          </div>

          {/* Rate breakdown */}
          <div className="bg-blue-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-700 mb-3 uppercase tracking-wide">Rate Breakdown</p>
            <div className="grid grid-cols-2 gap-3">
              {mode === 'intra' ? (
                <>
                  <TaxField label="CGST Rate (%)" name="cgstRate" type="number" step="0.01" form={form} onChange={set} errors={errors} touched={touched} onBlur={touch} />
                  <TaxField label="SGST Rate (%)" name="sgstRate" type="number" step="0.01" form={form} onChange={set} errors={errors} touched={touched} onBlur={touch} />
                </>
              ) : (
                <div className="col-span-2">
                  <TaxField label="IGST Rate (%)" name="igstRate" type="number" step="0.01" form={form} onChange={set} errors={errors} touched={touched} onBlur={touch} />
                </div>
              )}
              <TaxField label="CESS Rate (%)" name="cessRate" type="number" step="0.01" placeholder="0" form={form} onChange={set} errors={errors} touched={touched} onBlur={touch} />
            </div>

            {/* Live preview */}
            {form.totalRate && (
              <div className="mt-3 pt-3 border-t border-blue-200 flex flex-wrap gap-2">
                {mode === 'intra' && form.cgstRate && (
                  <>
                    <span className="bg-white text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-200">
                      CGST {form.cgstRate}%
                    </span>
                    <span className="bg-white text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-200">
                      SGST {form.sgstRate}%
                    </span>
                  </>
                )}
                {mode === 'inter' && form.igstRate && (
                  <span className="bg-white text-blue-700 text-xs px-2 py-1 rounded-full border border-blue-200">
                    IGST {form.igstRate}%
                  </span>
                )}
                {parseFloat(form.cessRate) > 0 && (
                  <span className="bg-white text-orange-600 text-xs px-2 py-1 rounded-full border border-orange-200">
                    CESS {form.cessRate}%
                  </span>
                )}
                <span className="bg-gradient-to-r from-violet-600 to-blue-600 text-white text-xs px-2 py-1 rounded-full font-medium">
                  Total {form.totalRate}%
                </span>
              </div>
            )}
          </div>

          {/* Tax inclusive toggle */}
          <label className="flex items-center gap-3 cursor-pointer">
            <div onClick={() => set('inclusive', !form.inclusive)}
              className={`w-11 h-6 rounded-full transition-colors relative ${form.inclusive ? 'bg-gradient-to-r from-violet-600 to-blue-600' : 'bg-gray-300'}`}>
              <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.inclusive ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Tax Inclusive in Price</p>
              <p className="text-xs text-gray-500">Price already includes GST (MRP billing)</p>
            </div>
          </label>

          {/* Example calculation */}
          {form.totalRate && (
            <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-600">
              <p className="font-medium text-gray-800 mb-1">Example on ₹1,000</p>
              {form.inclusive ? (
                <>
                  <p>Base amount: ₹{(1000 / (1 + parseFloat(form.totalRate) / 100)).toFixed(2)}</p>
                  <p>GST ({form.totalRate}%): ₹{(1000 - 1000 / (1 + parseFloat(form.totalRate) / 100)).toFixed(2)}</p>
                  <p className="font-semibold text-gray-900">Total (inclusive): ₹1,000.00</p>
                </>
              ) : (
                <>
                  <p>Base amount: ₹1,000.00</p>
                  <p>GST ({form.totalRate}%): ₹{(1000 * parseFloat(form.totalRate) / 100).toFixed(2)}</p>
                  <p className="font-semibold text-gray-900">Total (+ tax): ₹{(1000 * (1 + parseFloat(form.totalRate) / 100)).toFixed(2)}</p>
                </>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-gray-300 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {initial ? 'Update' : 'Create'} Tax Group
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── Tax Settings Tab ────────────────────────────────────────────────────────
function TaxSettings() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<any>(null)
  const [expandedId, setExpandedId] = useState<number | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['tax-groups'],
    queryFn: () => taxGroupApi.getAll().then(r => r.data.data),
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => taxGroupApi.delete(id),
    onSuccess: () => {
      toast.success('Tax group deactivated')
      qc.invalidateQueries({ queryKey: ['tax-groups'] })
    },
    onError: () => toast.error('Failed to deactivate'),
  })

  const handleSaved = () => {
    qc.invalidateQueries({ queryKey: ['tax-groups'] })
    setShowForm(false)
    setEditing(null)
  }

  const gstSlabs = [
    {
      rate: 0,
      label: 'Exempt',
      split: 'No tax',
      color: 'from-gray-50 to-slate-50 border-gray-200',
      dot: 'bg-gray-400',
      text: 'text-gray-700',
      examples: 'Fresh fruits & vegetables, milk, eggs, bread, salt, unbranded cereals, medical services, education',
    },
    {
      rate: 5,
      label: 'Essential',
      split: 'CGST 2.5% + SGST 2.5%',
      color: 'from-green-50 to-emerald-50 border-green-200',
      dot: 'bg-green-500',
      text: 'text-green-700',
      examples: 'Packaged food, tea, coffee, edible oils, coal, fertilizers, life-saving drugs, economy class air/rail travel, small restaurants',
    },
    {
      rate: 12,
      label: 'Standard',
      split: 'CGST 6% + SGST 6%',
      color: 'from-yellow-50 to-amber-50 border-yellow-200',
      dot: 'bg-yellow-500',
      text: 'text-yellow-700',
      examples: 'Computers, processed food, business class travel, non-AC restaurants, medical equipment, mobile phones (some), ayurvedic medicines',
    },
    {
      rate: 18,
      label: 'Regular',
      split: 'CGST 9% + SGST 9%',
      color: 'from-orange-50 to-amber-50 border-orange-200',
      dot: 'bg-orange-500',
      text: 'text-orange-700',
      examples: 'Most FMCG, electronics, AC restaurants, IT/telecom services, financial services, capital goods, construction materials, hair care products',
    },
    {
      rate: 28,
      label: 'Luxury/Demerit',
      split: 'CGST 14% + SGST 14%',
      color: 'from-red-50 to-rose-50 border-red-200',
      dot: 'bg-red-500',
      text: 'text-red-700',
      examples: 'Cars, motorcycles, cement, tobacco, aerated drinks, luxury hotels, casinos, washing machines, ACs, high-end consumer goods',
    },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">GST & Tax Groups</h2>
          <p className="text-sm text-gray-500 mt-0.5">Manage GST slabs, HSN codes and tax configurations</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
          <Plus size={16} /> New Tax Group
        </button>
      </div>

      {/* GST slab quick reference */}
      <div className="mb-6">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">GST Slabs Reference (India)</p>
        <div className="grid grid-cols-5 gap-2">
          {gstSlabs.map(slab => (
            <div key={slab.rate}
              className={`bg-gradient-to-br ${slab.color} border rounded-xl p-3`}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className={`w-2 h-2 rounded-full ${slab.dot} flex-shrink-0`} />
                <span className={`text-xl font-black ${slab.text}`}>{slab.rate}%</span>
              </div>
              <p className={`text-xs font-bold ${slab.text} mb-1`}>{slab.label}</p>
              <p className="text-[10px] text-gray-500 leading-relaxed">{slab.examples}</p>
              <p className={`text-[10px] font-medium mt-1.5 ${slab.text} opacity-70`}>{slab.split}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tax groups list */}
      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin text-primary-600" /></div>
      ) : !data?.length ? (
        <div className="text-center py-12 text-gray-400">
          <Percent size={40} className="mx-auto mb-3 opacity-30" />
          <p>No tax groups yet. Create your first one.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data.map((tg: any) => (
            <div key={tg.id}
              className={`border rounded-xl overflow-hidden transition-all ${tg.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              {/* Row header */}
              <div className="flex items-center gap-4 px-4 py-3 bg-white">
                {/* Color dot by rate */}
                <div className={`w-3 h-3 rounded-full shrink-0 ${
                  tg.totalRate >= 28 ? 'bg-red-500' :
                  tg.totalRate >= 18 ? 'bg-orange-500' :
                  tg.totalRate >= 12 ? 'bg-yellow-500' :
                  tg.totalRate >= 5  ? 'bg-green-500' : 'bg-gray-400'
                }`} />

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{tg.name}</span>
                    {tg.hsnCode && (
                      <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded font-mono">
                        HSN: {tg.hsnCode}
                      </span>
                    )}
                    {tg.inclusive && (
                      <span className="bg-blue-100 text-blue-700 text-xs px-2 py-0.5 rounded">
                        Tax Inclusive
                      </span>
                    )}
                    {!tg.active && (
                      <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded">Inactive</span>
                    )}
                  </div>
                  <div className="flex gap-3 mt-0.5 text-xs text-gray-500">
                    {tg.cgstRate > 0 && <span>CGST {tg.cgstRate}%</span>}
                    {tg.sgstRate > 0 && <span>SGST {tg.sgstRate}%</span>}
                    {tg.igstRate > 0 && <span>IGST {tg.igstRate}%</span>}
                    {tg.cessRate > 0 && <span>CESS {tg.cessRate}%</span>}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-primary-700">{tg.totalRate}%</span>
                  <button onClick={() => setExpandedId(expandedId === tg.id ? null : tg.id)}
                    className="text-gray-400 hover:text-gray-600 p-1">
                    {expandedId === tg.id
                      ? <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m18 15-6-6-6 6"/></svg>
                      : <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6"/></svg>
                    }
                  </button>
                  <button onClick={() => { setEditing(tg); setShowForm(true) }}
                    className="p-1.5 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg">
                    <Pencil size={15} />
                  </button>
                  {tg.active && (
                    <button onClick={() => deleteMut.mutate(tg.id)}
                      className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded detail */}
              {expandedId === tg.id && (
                <div className="border-t bg-gray-50 px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">CGST</p>
                    <p className="font-semibold">{tg.cgstRate > 0 ? `${tg.cgstRate}%` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">SGST</p>
                    <p className="font-semibold">{tg.sgstRate > 0 ? `${tg.sgstRate}%` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">IGST</p>
                    <p className="font-semibold">{tg.igstRate > 0 ? `${tg.igstRate}%` : '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">CESS</p>
                    <p className="font-semibold">{tg.cessRate > 0 ? `${tg.cessRate}%` : '0%'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">HSN Code</p>
                    <p className="font-semibold font-mono">{tg.hsnCode || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">Tax Type</p>
                    <p className="font-semibold">{tg.inclusive ? 'Inclusive' : 'Exclusive'}</p>
                  </div>
                  <div className="col-span-2 bg-white rounded-lg p-3 border">
                    <p className="text-xs text-gray-500 mb-1">Example: ₹1,000 base price</p>
                    {tg.inclusive ? (
                      <p className="font-semibold text-gray-800">
                        Base: ₹{(1000 / (1 + tg.totalRate / 100)).toFixed(2)} +
                        GST: ₹{(1000 - 1000 / (1 + tg.totalRate / 100)).toFixed(2)} =
                        <span className="text-primary-700"> ₹1,000.00</span>
                      </p>
                    ) : (
                      <p className="font-semibold text-gray-800">
                        ₹1,000 + GST ₹{(1000 * tg.totalRate / 100).toFixed(2)} =
                        <span className="text-primary-700"> ₹{(1000 * (1 + tg.totalRate / 100)).toFixed(2)}</span>
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {(showForm || editing) && (
        <TaxGroupFormModal
          initial={editing}
          onClose={() => { setShowForm(false); setEditing(null) }}
          onSaved={handleSaved}
        />
      )}
    </div>
  )
}

function ReceiptSettings() {
  const { outletId } = useAuthStore()
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({
    receiptHeader: '',
    receiptFooter: '',
    printReceiptByDefault: true,
    showTaxBreakdown: true,
    showBarcodeOnReceipt: true,
  })

  const { data: allOutlets } = useQuery({
    queryKey: ['outlets-all'],
    queryFn: async () => {
      const res = await outletApi.getAll()
      return res.data.data as { id: number; name: string; code: string }[]
    },
    enabled: !outletId,
  })

  const resolvedOutletId: number | null = outletId ?? (allOutlets?.[0]?.id ?? null)

  const { data: outlet, isLoading } = useQuery({
    queryKey: ['outlet', resolvedOutletId],
    queryFn: async () => {
      const res = await outletApi.getById(resolvedOutletId!)
      return res.data.data
    },
    enabled: !!resolvedOutletId,
  })

  useEffect(() => {
    if (outlet && !editing) {
      setForm({
        receiptHeader: outlet.receiptHeader ?? '',
        receiptFooter: outlet.receiptFooter ?? '',
        printReceiptByDefault: outlet.printReceiptByDefault ?? true,
        showTaxBreakdown: outlet.showTaxBreakdown ?? true,
        showBarcodeOnReceipt: outlet.showBarcodeOnReceipt ?? true,
      })
    }
  }, [outlet, editing])

  const { mutate: save, isPending } = useMutation({
    mutationFn: () => outletApi.update(resolvedOutletId!, form),
    onSuccess: (res) => {
      toast.success('Receipt settings saved')
      qc.setQueryData(['outlet', resolvedOutletId], res.data.data)
      setEditing(false)
    },
    onError: () => toast.error('Failed to save receipt settings'),
  })

  const BOOL_OPTS = [
    { key: 'printReceiptByDefault', label: 'Print Receipt by Default' },
    { key: 'showTaxBreakdown',      label: 'Show Tax Breakdown' },
    { key: 'showBarcodeOnReceipt',  label: 'Show Barcode on Receipt' },
  ] as const

  if (isLoading) return (
    <div className="flex justify-center py-16">
      <Loader2 size={24} className="animate-spin text-primary-500" />
    </div>
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Receipt Settings</h2>
        {!editing && (
          <button onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-primary-600 border border-primary-200 rounded-lg hover:bg-primary-50 transition-colors">
            <Edit2 size={14} /> Edit
          </button>
        )}
      </div>

      {/* Header */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Header</label>
        {editing ? (
          <textarea rows={2} value={form.receiptHeader}
            placeholder="Thank you for shopping with us!"
            onChange={e => setForm(f => ({ ...f, receiptHeader: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
        ) : (
          <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 min-h-[2.5rem] whitespace-pre-wrap">
            {form.receiptHeader || <span className="text-gray-400 italic">Not set</span>}
          </p>
        )}
      </div>

      {/* Footer */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Footer</label>
        {editing ? (
          <textarea rows={2} value={form.receiptFooter}
            placeholder="Visit us again!"
            onChange={e => setForm(f => ({ ...f, receiptFooter: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
        ) : (
          <p className="text-sm text-gray-800 bg-gray-50 rounded-lg px-3 py-2 min-h-[2.5rem] whitespace-pre-wrap">
            {form.receiptFooter || <span className="text-gray-400 italic">Not set</span>}
          </p>
        )}
      </div>

      {/* Boolean options */}
      <div className="space-y-3">
        {BOOL_OPTS.map(opt => (
          <div key={opt.key} className="flex items-center justify-between">
            <span className="text-sm text-gray-700">{opt.label}</span>
            {editing ? (
              <input type="checkbox" checked={form[opt.key]}
                onChange={e => setForm(f => ({ ...f, [opt.key]: e.target.checked }))}
                className="w-4 h-4 text-primary-600 rounded cursor-pointer" />
            ) : (
              <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${form[opt.key] ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {form[opt.key] ? <Check size={11} /> : <X size={11} />}
                {form[opt.key] ? 'Yes' : 'No'}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      {editing && (
        <div className="flex gap-3 pt-2">
          <button onClick={() => save()} disabled={isPending}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-5 py-2 rounded-lg font-medium text-sm disabled:opacity-60">
            {isPending && <Loader2 size={14} className="animate-spin" />}
            Save Changes
          </button>
          <button onClick={() => { setEditing(false) }}
            className="px-5 py-2 rounded-lg text-sm font-medium text-gray-600 border border-gray-200 hover:bg-gray-50">
            Cancel
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Integrations ─────────────────────────────────────────────────────────────

const SMS_PROVIDERS = [
  { value: 'msg91', label: 'MSG91' },
  { value: 'twilio', label: 'Twilio' },
  { value: 'sns', label: 'Amazon SNS' },
]
const WHATSAPP_PROVIDERS = [
  { value: 'twilio', label: 'Twilio WhatsApp' },
  { value: 'waba', label: 'WhatsApp Business API' },
]

const SMS_FIELDS: Record<string, { key: string; label: string; type?: string }[]> = {
  msg91: [
    { key: 'apiKey', label: 'API Key', type: 'password' },
    { key: 'senderId', label: 'Sender ID (6-char)' },
  ],
  twilio: [
    { key: 'accountSid', label: 'Account SID' },
    { key: 'authToken', label: 'Auth Token', type: 'password' },
    { key: 'fromNumber', label: 'From Number (+91XXXXXXXXXX)' },
  ],
  sns: [
    { key: 'username', label: 'Access Key ID' },
    { key: 'password', label: 'Secret Access Key', type: 'password' },
    { key: 'senderId', label: 'Sender ID' },
  ],
}
const WHATSAPP_FIELDS: Record<string, { key: string; label: string; type?: string }[]> = {
  twilio: [
    { key: 'accountSid', label: 'Account SID' },
    { key: 'authToken', label: 'Auth Token', type: 'password' },
    { key: 'fromNumber', label: 'WhatsApp From Number' },
  ],
  waba: [
    { key: 'phoneNumberId', label: 'Phone Number ID' },
    { key: 'accessToken', label: 'Access Token', type: 'password' },
  ],
}

const DEFAULT_CHANNELS = {
  email:    { enabled: false, fromEmail: '', fromName: '', password: '', advanced: false, host: '', port: '587', username: '' },
  sms:      { enabled: false, provider: 'msg91',  apiKey: '', senderId: '', accountSid: '', authToken: '', fromNumber: '' },
  whatsapp: { enabled: false, provider: 'twilio', accountSid: '', authToken: '', fromNumber: '', phoneNumberId: '', accessToken: '' },
}

const TEMPLATE_DEFS = [
  {
    key: 'invoice_sent', label: 'Invoice Sent',
    desc: 'Sent to customer when an invoice is issued',
    vars: ['customerName', 'invoiceNumber', 'amount', 'dueDate', 'date', 'businessName', 'link'],
    defaults: {
      email: { subject: 'Invoice {{invoiceNumber}} from {{businessName}}', body: 'Dear {{customerName}},\n\nPlease find enclosed Invoice #{{invoiceNumber}} for ₹{{amount}} dated {{date}}.\n\nDue Date: {{dueDate}}\n\nThank you for your business!\n\n{{businessName}}' },
      sms: { body: 'Invoice #{{invoiceNumber}} for ₹{{amount}} from {{businessName}}. Due: {{dueDate}}.' },
      whatsapp: { body: 'Hi {{customerName}},\n\nYour Invoice *#{{invoiceNumber}}* for *₹{{amount}}* is ready.\nDue Date: {{dueDate}}\n\nThank you,\n{{businessName}}' },
    },
  },
  {
    key: 'payment_received', label: 'Payment Received',
    desc: 'Confirmation sent when a payment is received',
    vars: ['customerName', 'invoiceNumber', 'amount', 'transactionId', 'date', 'businessName'],
    defaults: {
      email: { subject: 'Payment Confirmed – ₹{{amount}} received', body: 'Dear {{customerName}},\n\nWe have received your payment of ₹{{amount}} against Invoice #{{invoiceNumber}}.\n\nTransaction ID: {{transactionId}}\nDate: {{date}}\n\nThank you,\n{{businessName}}' },
      sms: { body: 'Payment of ₹{{amount}} received for Invoice #{{invoiceNumber}}. Txn: {{transactionId}}. – {{businessName}}' },
      whatsapp: { body: 'Hi {{customerName}},\n\n✅ Payment of *₹{{amount}}* received for Invoice *#{{invoiceNumber}}*.\nTxn: {{transactionId}}\n\nThank you,\n{{businessName}}' },
    },
  },
  {
    key: 'order_confirmation', label: 'Order Confirmation',
    desc: 'Sent when a POS order is placed',
    vars: ['customerName', 'orderNumber', 'amount', 'date', 'businessName'],
    defaults: {
      email: { subject: 'Order Confirmed – #{{orderNumber}}', body: 'Dear {{customerName}},\n\nYour order #{{orderNumber}} has been confirmed.\n\nAmount: ₹{{amount}}\nDate: {{date}}\n\nThank you for shopping with us!\n\n{{businessName}}' },
      sms: { body: 'Order #{{orderNumber}} confirmed for ₹{{amount}}. Thank you! – {{businessName}}' },
      whatsapp: { body: 'Hi {{customerName}},\n\nYour order *#{{orderNumber}}* is confirmed! 🎉\nTotal: *₹{{amount}}*\n\nThank you,\n{{businessName}}' },
    },
  },
  {
    key: 'quotation_sent', label: 'Quotation Sent',
    desc: 'Sent to customer when a quotation is created',
    vars: ['customerName', 'quotationNumber', 'amount', 'validUntil', 'date', 'businessName', 'link'],
    defaults: {
      email: { subject: 'Quotation {{quotationNumber}} from {{businessName}}', body: 'Dear {{customerName}},\n\nPlease find enclosed Quotation #{{quotationNumber}} for ₹{{amount}}.\n\nValid Until: {{validUntil}}\n\nWe look forward to your business.\n\n{{businessName}}' },
      sms: { body: 'Quotation #{{quotationNumber}} for ₹{{amount}} from {{businessName}}. Valid till {{validUntil}}.' },
      whatsapp: { body: 'Hi {{customerName}},\n\nYour Quotation *#{{quotationNumber}}* for *₹{{amount}}* is ready.\nValid until: {{validUntil}}\n\n{{businessName}}' },
    },
  },
  {
    key: 'payment_reminder', label: 'Payment Reminder',
    desc: 'Reminder sent for pending or overdue invoices',
    vars: ['customerName', 'invoiceNumber', 'amount', 'dueDate', 'businessName', 'link'],
    defaults: {
      email: { subject: 'Payment Reminder – Invoice {{invoiceNumber}} due {{dueDate}}', body: 'Dear {{customerName}},\n\nThis is a friendly reminder that Invoice #{{invoiceNumber}} for ₹{{amount}} is due on {{dueDate}}.\n\nKindly arrange payment at the earliest.\n\nRegards,\n{{businessName}}' },
      sms: { body: 'Reminder: Invoice #{{invoiceNumber}} for ₹{{amount}} due on {{dueDate}}. – {{businessName}}' },
      whatsapp: { body: 'Hi {{customerName}},\n\n⚠️ Friendly reminder: Invoice *#{{invoiceNumber}}* for *₹{{amount}}* is due on *{{dueDate}}*.\n\nKindly arrange payment.\n\n{{businessName}}' },
    },
  },
  {
    key: 'bill_received', label: 'Bill Received',
    desc: 'Confirmation to vendor when a purchase bill is recorded',
    vars: ['vendorName', 'billNumber', 'amount', 'dueDate', 'date', 'businessName'],
    defaults: {
      email: { subject: 'Bill #{{billNumber}} received – {{businessName}}', body: 'Dear {{vendorName}},\n\nWe have recorded Bill #{{billNumber}} for ₹{{amount}} dated {{date}}.\n\nPayment due by: {{dueDate}}\n\nRegards,\n{{businessName}}' },
      sms: { body: 'Bill #{{billNumber}} for ₹{{amount}} recorded. Due: {{dueDate}}. – {{businessName}}' },
      whatsapp: { body: 'Hi {{vendorName}},\n\nBill *#{{billNumber}}* for *₹{{amount}}* recorded.\nPayment due: {{dueDate}}\n\n{{businessName}}' },
    },
  },
  {
    key: 'delivery_challan', label: 'Delivery Challan',
    desc: 'Sent to customer when goods are dispatched',
    vars: ['customerName', 'challanNumber', 'date', 'businessName', 'link'],
    defaults: {
      email: { subject: 'Delivery Challan #{{challanNumber}} – {{businessName}}', body: 'Dear {{customerName}},\n\nYour order has been dispatched!\n\nDelivery Challan: #{{challanNumber}}\nDate: {{date}}\n\nThank you,\n{{businessName}}' },
      sms: { body: 'Your order is dispatched! Challan #{{challanNumber}}. – {{businessName}}' },
      whatsapp: { body: 'Hi {{customerName}},\n\nYour delivery is on its way! 🚚\nChallan: *#{{challanNumber}}*\nDate: {{date}}\n\nThank you,\n{{businessName}}' },
    },
  },
  {
    key: 'low_stock_alert', label: 'Low Stock Alert',
    desc: 'Alert sent to admin/manager when a product hits reorder level',
    vars: ['productName', 'currentStock', 'reorderLevel', 'businessName'],
    defaults: {
      email: { subject: 'Low Stock Alert – {{productName}}', body: 'Hi,\n\n{{productName}} is running low on stock.\n\nCurrent Stock: {{currentStock}}\nReorder Level: {{reorderLevel}}\n\nPlease reorder soon.\n\n{{businessName}}' },
      sms: { body: 'Low Stock: {{productName}} has {{currentStock}} units left (reorder at {{reorderLevel}}). – {{businessName}}' },
      whatsapp: { body: '⚠️ *Low Stock Alert*\n\nProduct: {{productName}}\nCurrent Stock: {{currentStock}}\nReorder Level: {{reorderLevel}}\n\n{{businessName}}' },
    },
  },
]

type ChannelKey = 'email' | 'sms' | 'whatsapp'

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none ${checked ? 'bg-gradient-to-r from-violet-600 to-blue-600' : 'bg-gray-200'}`}>
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : 'translate-x-0.5'}`} />
    </button>
  )
}

function IntegrationsSettings() {
  const { outletId } = useAuthStore()
  const [subTab, setSubTab] = useState<'channels' | 'templates'>('channels')

  const { data: allOutlets } = useQuery({
    queryKey: ['outlets-all'],
    queryFn: async () => {
      const res = await outletApi.getAll()
      return res.data.data as { id: number; name: string; code: string }[]
    },
    enabled: !outletId,
  })

  const resolvedOutletId: number | null = outletId ?? (allOutlets?.[0]?.id ?? null)

  // ── Channels ─────────────────────────────────────────────────────────────
  const [channels, setChannels] = useState<typeof DEFAULT_CHANNELS>(JSON.parse(JSON.stringify(DEFAULT_CHANNELS)))
  const [showPass, setShowPass] = useState<Record<string, boolean>>({})
  const [savingCh, setSavingCh] = useState(false)
  const [testingCh, setTestingCh] = useState<string | null>(null)
  const [showAdvEmail, setShowAdvEmail] = useState(false)

  // ── Templates ────────────────────────────────────────────────────────────
  const [templates, setTemplates] = useState<Record<string, any>>(() => {
    const t: Record<string, any> = {}
    TEMPLATE_DEFS.forEach(d => { t[d.key] = JSON.parse(JSON.stringify(d.defaults)) })
    return t
  })
  const [selTmpl, setSelTmpl] = useState(TEMPLATE_DEFS[0].key)
  const [chTab, setChTab] = useState<ChannelKey>('email')
  const [savingTmpl, setSavingTmpl] = useState(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)

  // Load channel config from API
  const { data: channelData } = useQuery({
    queryKey: ['integration-channels', resolvedOutletId],
    queryFn: async () => {
      const res = await integrationApi.getChannels(resolvedOutletId!)
      return res.data.data
    },
    enabled: !!resolvedOutletId,
    retry: false,
  })
  useEffect(() => {
    if (channelData && typeof channelData === 'object') {
      setChannels(prev => ({
        email:     channelData.email     ? { ...prev.email,     ...channelData.email }     : prev.email,
        sms:       channelData.sms       ? { ...prev.sms,       ...channelData.sms }       : prev.sms,
        whatsapp:  channelData.whatsapp  ? { ...prev.whatsapp,  ...channelData.whatsapp }  : prev.whatsapp,
      }))
    }
  }, [channelData])

  // Load templates from API
  const { data: tmplApiData } = useQuery({
    queryKey: ['integration-templates', resolvedOutletId],
    queryFn: async () => {
      const res = await integrationApi.getTemplates(resolvedOutletId!)
      return res.data.data
    },
    enabled: !!resolvedOutletId,
    retry: false,
  })
  useEffect(() => {
    if (tmplApiData && Object.keys(tmplApiData).length > 0) {
      setTemplates((prev: any) => {
        const merged = { ...prev }
        Object.entries(tmplApiData).forEach(([k, v]) => { merged[k] = v })
        return merged
      })
    }
  }, [tmplApiData])

  const setChannel = (ch: ChannelKey, field: string, value: any) =>
    setChannels(p => ({ ...p, [ch]: { ...p[ch], [field]: value } }))

  const setTmplField = (field: string, value: string) =>
    setTemplates((p: any) => ({
      ...p,
      [selTmpl]: { ...p[selTmpl], [chTab]: { ...p[selTmpl]?.[chTab], [field]: value } },
    }))

  const insertVar = (varName: string) => {
    const el = bodyRef.current
    if (!el) return
    const token = `{{${varName}}}`
    const start = el.selectionStart ?? 0
    const end = el.selectionEnd ?? 0
    const body = templates[selTmpl]?.[chTab]?.body ?? ''
    setTmplField('body', body.slice(0, start) + token + body.slice(end))
    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const handleSaveChannels = async () => {
    setSavingCh(true)
    try {
      await integrationApi.saveChannels(resolvedOutletId!, channels)
      toast.success('Channel settings saved')
    } catch {
      toast.error('Failed to save channel settings')
    } finally {
      setSavingCh(false)
    }
  }

  const handleTestChannel = async (ch: string) => {
    setTestingCh(ch)
    try {
      await integrationApi.testChannel(resolvedOutletId!, ch)
      toast.success(`Test ${ch} sent successfully`)
    } catch (err: any) {
      const msg = err?.response?.data?.message || `Test ${ch} failed – check your settings`
      toast.error(msg, { duration: 6000 })
    } finally {
      setTestingCh(null)
    }
  }

  const handleSaveTemplate = async () => {
    setSavingTmpl(true)
    try {
      await integrationApi.saveTemplates(resolvedOutletId!, templates)
      toast.success('Templates saved')
    } catch {
      toast.error('Failed to save templates')
    } finally {
      setSavingTmpl(false)
    }
  }

  const tmplDef = TEMPLATE_DEFS.find(t => t.key === selTmpl)!
  const tmplData = templates[selTmpl] ?? tmplDef.defaults

  const nonEmailChannels = [
    {
      key: 'sms' as ChannelKey, label: 'SMS',
      desc: 'Send SMS alerts and transactional messages to customers',
      iconBg: 'bg-green-50', iconText: 'text-green-600', icon: <MessageSquare size={20} />,
      providers: SMS_PROVIDERS, fields: SMS_FIELDS,
    },
    {
      key: 'whatsapp' as ChannelKey, label: 'WhatsApp',
      desc: 'Reach customers on WhatsApp with invoices and updates',
      iconBg: 'bg-emerald-50', iconText: 'text-emerald-600', icon: <MessageCircle size={20} />,
      providers: WHATSAPP_PROVIDERS, fields: WHATSAPP_FIELDS,
    },
  ]

  const emailCfg = channels.email
  const emailDomain = emailCfg.fromEmail.includes('@') ? emailCfg.fromEmail.split('@')[1]?.toLowerCase() : ''
  const knownProviders: Record<string, string> = {
    'gmail.com': 'Gmail', 'googlemail.com': 'Gmail',
    'outlook.com': 'Outlook', 'hotmail.com': 'Outlook', 'live.com': 'Outlook', 'live.in': 'Outlook',
    'yahoo.com': 'Yahoo', 'ymail.com': 'Yahoo', 'yahoo.co.in': 'Yahoo',
    'zoho.com': 'Zoho', 'zohomail.com': 'Zoho',
    'icloud.com': 'iCloud', 'me.com': 'iCloud',
  }
  const detectedProvider = emailDomain ? (knownProviders[emailDomain] ?? `SMTP (${emailDomain})`) : null

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Integrations</h2>
        <p className="text-sm text-gray-500 mt-0.5">Configure communication channels and manage message templates for automated notifications.</p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {([['channels', 'Channels'], ['templates', 'Message Templates']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${subTab === key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── CHANNELS ──────────────────────────────────────────────────────── */}
      {subTab === 'channels' && (
        <div className="space-y-4">

          {/* ── Email card ─────────────────────────────────────── */}
          <div className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 bg-blue-50 text-blue-600">
                <Mail size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Email</p>
                <p className="text-xs text-gray-500 mt-0.5">Send invoices, confirmations and notifications via email</p>
              </div>
              <Toggle checked={emailCfg.enabled} onChange={v => setChannel('email', 'enabled', v)} />
            </div>

            {emailCfg.enabled && (
              <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-3 bg-gray-50/50">
                {/* From Email */}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">From Email Address</label>
                  <input
                    type="email"
                    placeholder="you@gmail.com"
                    value={emailCfg.fromEmail}
                    onChange={e => setChannel('email', 'fromEmail', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                  />
                  {detectedProvider && (
                    <p className="text-[11px] text-primary-600 mt-1">
                      Detected: {detectedProvider} — SMTP settings will be configured automatically
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Password */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">
                      Password / App Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPass['email-password'] ? 'text' : 'password'}
                        placeholder="App password"
                        value={emailCfg.password}
                        onChange={e => setChannel('email', 'password', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 pr-8"
                      />
                      <button type="button"
                        onClick={() => setShowPass(p => ({ ...p, 'email-password': !p['email-password'] }))}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                        {showPass['email-password'] ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                    </div>
                    {(emailDomain === 'gmail.com' || emailDomain === 'googlemail.com') && (
                      <p className="text-[11px] text-amber-600 mt-1">
                        Gmail requires an App Password — enable 2FA in Google Account first
                      </p>
                    )}
                  </div>

                  {/* From Name */}
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Display Name (From)</label>
                    <input
                      type="text"
                      placeholder="My Business"
                      value={emailCfg.fromName}
                      onChange={e => setChannel('email', 'fromName', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                    />
                  </div>
                </div>

                {/* Advanced toggle */}
                <button type="button"
                  onClick={() => setShowAdvEmail(v => !v)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700">
                  <span className={`transition-transform ${showAdvEmail ? 'rotate-90' : ''}`}>▶</span>
                  Advanced SMTP settings
                </button>

                {showAdvEmail && (
                  <div className="grid grid-cols-3 gap-3 p-3 bg-white border border-gray-200 rounded-lg">
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-gray-600 mb-1">SMTP Host</label>
                      <input
                        type="text"
                        placeholder={emailDomain ? `smtp.${emailDomain}` : 'smtp.gmail.com'}
                        value={emailCfg.host}
                        onChange={e => setChannel('email', 'host', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Port</label>
                      <input
                        type="text"
                        placeholder="587"
                        value={emailCfg.port}
                        onChange={e => setChannel('email', 'port', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs font-medium text-gray-600 mb-1">
                        Username <span className="text-gray-400 font-normal">(leave blank to use email address)</span>
                      </label>
                      <input
                        type="text"
                        placeholder={emailCfg.fromEmail || 'username@example.com'}
                        value={emailCfg.username}
                        onChange={e => setChannel('email', 'username', e.target.value)}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <button type="button"
                    onClick={() => handleTestChannel('email')}
                    disabled={testingCh === 'email'}
                    className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50">
                    {testingCh === 'email' ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    Send Test Email
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* ── SMS + WhatsApp cards ────────────────────────────── */}
          {nonEmailChannels.map(ch => {
            const cfg = channels[ch.key] as any
            const fields = ch.fields[cfg.provider] ?? []
            return (
              <div key={ch.key} className="border border-gray-200 rounded-xl overflow-hidden">
                <div className="flex items-center gap-4 p-4">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${ch.iconBg} ${ch.iconText}`}>
                    {ch.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">{ch.label}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{ch.desc}</p>
                  </div>
                  <Toggle checked={cfg.enabled} onChange={v => setChannel(ch.key, 'enabled', v)} />
                </div>

                {cfg.enabled && (
                  <div className="px-4 pb-4 border-t border-gray-100 pt-4 space-y-3 bg-gray-50/50">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Provider</label>
                      <select
                        value={cfg.provider}
                        onChange={e => setChannel(ch.key, 'provider', e.target.value)}
                        className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                      >
                        {ch.providers.map((p: any) => (
                          <option key={p.value} value={p.value}>{p.label}</option>
                        ))}
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {fields.map((f: any) => (
                        <div key={f.key}>
                          <label className="block text-xs font-medium text-gray-600 mb-1">{f.label}</label>
                          <div className="relative">
                            <input
                              type={f.type === 'password' && !showPass[`${ch.key}-${f.key}`] ? 'password' : 'text'}
                              value={cfg[f.key] ?? ''}
                              onChange={e => setChannel(ch.key, f.key, e.target.value)}
                              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 pr-8"
                            />
                            {f.type === 'password' && (
                              <button type="button"
                                onClick={() => setShowPass(p => ({ ...p, [`${ch.key}-${f.key}`]: !p[`${ch.key}-${f.key}`] }))}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                                {showPass[`${ch.key}-${f.key}`] ? <EyeOff size={13} /> : <Eye size={13} />}
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex justify-end">
                      <button type="button"
                        onClick={() => handleTestChannel(ch.key)}
                        disabled={testingCh === ch.key}
                        className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 disabled:opacity-50">
                        {testingCh === ch.key ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                        Send Test {ch.label}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}

          <button onClick={handleSaveChannels} disabled={savingCh}
            className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-6 py-2 rounded-lg font-medium text-sm disabled:opacity-50">
            {savingCh ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
            Save Channel Settings
          </button>
        </div>
      )}

      {/* ── TEMPLATES ─────────────────────────────────────────────────────── */}
      {subTab === 'templates' && (
        <div className="flex gap-4 min-h-[480px]">
          {/* Template list */}
          <div className="w-44 shrink-0 space-y-0.5">
            {TEMPLATE_DEFS.map(t => (
              <button key={t.key} onClick={() => setSelTmpl(t.key)}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${selTmpl === t.key ? 'bg-primary-50 text-primary-700' : 'text-gray-600 hover:bg-gray-50'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Template editor */}
          <div className="flex-1 border border-gray-200 rounded-xl overflow-hidden flex flex-col">
            {/* Template header */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-100">
              <p className="text-sm font-semibold text-gray-900">{tmplDef.label}</p>
              <p className="text-xs text-gray-500 mt-0.5">{tmplDef.desc}</p>
            </div>

            {/* Channel tabs */}
            <div className="flex gap-1 px-4 pt-3 border-b border-gray-100">
              {([['email', 'Email', <Mail size={12} />], ['sms', 'SMS', <MessageSquare size={12} />], ['whatsapp', 'WhatsApp', <MessageCircle size={12} />]] as const).map(([key, label, icon]) => (
                <button key={key} onClick={() => setChTab(key as ChannelKey)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-t-md transition-colors border-b-2 -mb-px ${chTab === key ? 'border-primary-600 text-primary-700 bg-primary-50/50' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  {icon}{label}
                </button>
              ))}
            </div>

            <div className="flex-1 p-4 space-y-3 overflow-y-auto">
              {/* Subject (email only) */}
              {chTab === 'email' && (
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Subject</label>
                  <input
                    value={tmplData?.email?.subject ?? ''}
                    onChange={e => setTmplField('subject', e.target.value)}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                    placeholder="Email subject line"
                  />
                </div>
              )}

              {/* Body */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <label className="text-xs font-medium text-gray-600">
                    {chTab === 'sms' ? 'Message Body' : chTab === 'whatsapp' ? 'WhatsApp Message' : 'Email Body'}
                  </label>
                  {chTab === 'sms' && (
                    <span className={`text-[10px] ${(tmplData?.sms?.body ?? '').length > 160 ? 'text-amber-600' : 'text-gray-400'}`}>
                      {(tmplData?.sms?.body ?? '').length} chars{(tmplData?.sms?.body ?? '').length > 160 ? ' (multi-part SMS)' : ''}
                    </span>
                  )}
                </div>
                <textarea
                  ref={bodyRef}
                  value={tmplData?.[chTab]?.body ?? ''}
                  onChange={e => setTmplField('body', e.target.value)}
                  rows={chTab === 'email' ? 8 : 6}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400 font-mono resize-none"
                  placeholder={`Enter ${chTab} message body…`}
                />
              </div>

              {/* Variables */}
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">Insert variable (click to insert at cursor):</p>
                <div className="flex flex-wrap gap-1.5">
                  {tmplDef.vars.map(v => (
                    <button key={v} type="button"
                      onClick={() => insertVar(v)}
                      className="px-2 py-0.5 text-[11px] font-mono bg-gray-100 hover:bg-primary-50 hover:text-primary-700 text-gray-600 rounded border border-gray-200 hover:border-primary-300 transition-colors">
                      {`{{${v}}}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Reset to default */}
              <div className="flex items-center justify-between pt-1">
                <button type="button"
                  onClick={() => {
                    const def = TEMPLATE_DEFS.find(t => t.key === selTmpl)
                    if (def) setTemplates((p: any) => ({ ...p, [selTmpl]: JSON.parse(JSON.stringify(def.defaults)) }))
                    toast.success('Template reset to default')
                  }}
                  className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
                  Reset to default
                </button>
                <button onClick={handleSaveTemplate} disabled={savingTmpl}
                  className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-5 py-1.5 rounded-lg font-medium text-sm disabled:opacity-50">
                  {savingTmpl ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                  Save Templates
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Templates Settings ───────────────────────────────────────────────────────

export interface InvoiceTemplateConfig {
  // ── Layout & Paper ──────────────────────────────
  layout: 'modern' | 'classic' | 'minimal'
  paperSize: 'a4' | '3inch' | '2inch' | 'custom'
  customWidthMm: number
  customHeightMm: number
  // ── Branding ────────────────────────────────────
  primaryColor: string
  accentColor: string
  logoUrl: string
  showLogo: boolean
  // ── Typography ──────────────────────────────────
  fontFamily: 'inter' | 'serif' | 'mono' | 'rounded'
  contentFontSize: 'sm' | 'md' | 'lg'
  bodyTextColor: string
  labelColor: string
  // ── Content ─────────────────────────────────────
  thankYouMessage: string
  bankDetails: string
  terms: string
  footerNote: string
  paymentTerms: string
  // ── Extra Sections ──────────────────────────────
  showSignatureLine: boolean
  showSeal: boolean
  // ── Column Visibility ───────────────────────────
  showSerial: boolean
  showHsn: boolean
  showUnit: boolean
  showTaxRate: boolean
  showDiscPercent: boolean
  showTaxableAmount: boolean
  showCgstSgst: boolean
  // ── GST Compliance ──────────────────────────────
  showPlaceOfSupply: boolean
  showReverseCharge: boolean
  reverseChargeApplicable: boolean
  // ── Additional Meta ─────────────────────────────
  showDeliveryAddress: boolean
  showPoNumber: boolean
  showEwayBill: boolean
  showSalesperson: boolean
  salespersonLabel: string
  // ── Date & Time ─────────────────────────────────
  showIssueDate: boolean
  showDueDate: boolean
  showTime: boolean
  // ── Quotation-Specific ──────────────────────────
  validityDays: number
  showSubject: boolean
  defaultSubject: string
}

export type QuotationTemplateConfig = InvoiceTemplateConfig
export type PurchaseOrderTemplateConfig = InvoiceTemplateConfig

export interface TemplatesConfig {
  invoice: InvoiceTemplateConfig
  quotation: QuotationTemplateConfig
  purchaseOrder: PurchaseOrderTemplateConfig
}

export const DEFAULT_INVOICE_TEMPLATE: InvoiceTemplateConfig = {
  layout: 'modern',
  paperSize: 'a4',
  customWidthMm: 210,
  customHeightMm: 297,
  primaryColor: '#1e293b',
  accentColor: '#3b82f6',
  logoUrl: '',
  showLogo: false,
  fontFamily: 'inter',
  contentFontSize: 'md',
  bodyTextColor: '#1e293b',
  labelColor: '#64748b',
  thankYouMessage: 'Thank you for your business!',
  bankDetails: '',
  terms: '',
  footerNote: '',
  paymentTerms: '',
  showSignatureLine: false,
  showSeal: false,
  showSerial: true,
  showHsn: false,
  showUnit: false,
  showTaxRate: true,
  showDiscPercent: true,
  showTaxableAmount: false,
  showCgstSgst: false,
  showPlaceOfSupply: false,
  showReverseCharge: false,
  reverseChargeApplicable: false,
  showDeliveryAddress: false,
  showPoNumber: false,
  showEwayBill: false,
  showSalesperson: false,
  salespersonLabel: 'Sales Executive',
  showIssueDate: true,
  showDueDate: true,
  showTime: false,
  validityDays: 30,
  showSubject: false,
  defaultSubject: '',
}

export const DEFAULT_QUOTATION_TEMPLATE: QuotationTemplateConfig = {
  ...DEFAULT_INVOICE_TEMPLATE,
  thankYouMessage: 'We hope to receive your valued order!',
  terms: '1. Prices are valid for the stated validity period.\n2. Delivery within 7–10 working days after order confirmation.\n3. Payment as per agreed terms.\n4. Subject to local jurisdiction.',
  showSignatureLine: true,
  showSalesperson: true,
  showSubject: true,
  defaultSubject: 'Quotation for Supply of Goods / Services',
  paymentTerms: '50% advance, balance on delivery',
}

export const DEFAULT_PURCHASE_ORDER_TEMPLATE: PurchaseOrderTemplateConfig = {
  ...DEFAULT_INVOICE_TEMPLATE,
  thankYouMessage: 'Please confirm receipt of this Purchase Order.',
  terms: '1. Goods must be delivered as per the schedule mentioned.\n2. Invoices must reference this PO number.\n3. Payment will be processed within agreed terms.\n4. Subject to quality inspection on receipt.',
  showSignatureLine: true,
  showPoNumber: true,
  showDeliveryAddress: true,
  paymentTerms: 'Net 30 days from invoice date',
}

export const DEFAULT_TEMPLATES_CONFIG: TemplatesConfig = {
  invoice: DEFAULT_INVOICE_TEMPLATE,
  quotation: DEFAULT_QUOTATION_TEMPLATE,
  purchaseOrder: DEFAULT_PURCHASE_ORDER_TEMPLATE,
}

/** Parse stored JSON → TemplatesConfig. Handles both old single-config and new wrapped formats. */
export function parseTemplatesConfig(raw: string | null | undefined): TemplatesConfig {
  if (!raw) return DEFAULT_TEMPLATES_CONFIG
  try {
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      if ('invoice' in parsed || 'quotation' in parsed || 'purchaseOrder' in parsed) {
        return {
          invoice:       { ...DEFAULT_INVOICE_TEMPLATE,        ...(parsed.invoice       ?? {}) },
          quotation:     { ...DEFAULT_QUOTATION_TEMPLATE,      ...(parsed.quotation     ?? {}) },
          purchaseOrder: { ...DEFAULT_PURCHASE_ORDER_TEMPLATE, ...(parsed.purchaseOrder ?? {}) },
        }
      }
      // Old format — single InvoiceTemplateConfig stored directly
      return { invoice: { ...DEFAULT_INVOICE_TEMPLATE, ...parsed }, quotation: DEFAULT_QUOTATION_TEMPLATE, purchaseOrder: DEFAULT_PURCHASE_ORDER_TEMPLATE }
    }
  } catch { /* ignore */ }
  return DEFAULT_TEMPLATES_CONFIG
}

const LAYOUTS = [
  {
    key: 'modern', label: 'Modern', desc: 'Colored header, logo space, clean professional',
    preview: (color: string, lbl: string) => (
      <div className="w-full rounded overflow-hidden border border-gray-200 text-[7px] font-sans">
        <div className="px-2 py-1.5 flex justify-between items-center" style={{ background: color }}>
          <span className="text-white font-bold text-[8px]">{lbl}</span>
          <span className="bg-green-400 text-white px-1 rounded text-[6px]">SENT</span>
        </div>
        <div className="bg-gray-50 px-2 py-1 grid grid-cols-3 gap-1 border-b">
          {['Bill To','Issue Date','Valid Till'].map(l => <div key={l}><div className="text-gray-400" style={{fontSize:5}}>{l}</div><div className="text-gray-700 font-medium" style={{fontSize:6}}>—</div></div>)}
        </div>
        <div className="px-2 py-1">
          <div className="flex text-gray-400 border-b pb-0.5 mb-0.5" style={{fontSize:5}}>{['#','Item','Qty','Amt'].map(h=><div key={h} className="flex-1 last:text-right">{h}</div>)}</div>
          {[1,2].map(i=><div key={i} className="flex text-gray-600" style={{fontSize:6}}>{[i,'Product','2','₹1k'].map((v,j)=><div key={j} className="flex-1 last:text-right">{v}</div>)}</div>)}
        </div>
        <div className="px-2 py-1 flex justify-end border-t"><div className="font-bold text-gray-900" style={{fontSize:6}}>Total ₹2.4k</div></div>
      </div>
    ),
  },
  {
    key: 'classic', label: 'Classic', desc: 'Traditional black header, formal letter-style',
    preview: (_: string, lbl: string) => (
      <div className="w-full rounded overflow-hidden border border-gray-300 text-[7px] font-mono">
        <div className="bg-gray-900 px-2 py-1.5 flex justify-between items-center">
          <span className="text-white font-bold text-[8px]">{lbl}</span>
          <span className="text-gray-400 text-[6px]">NO-001</span>
        </div>
        <div className="px-2 py-1 border-b grid grid-cols-2 gap-1">
          <div><div className="text-gray-400" style={{fontSize:5}}>Bill To</div><div className="text-gray-700 font-bold" style={{fontSize:6}}>Customer</div></div>
          <div className="text-right"><div className="text-gray-400" style={{fontSize:5}}>Date</div><div className="text-gray-700" style={{fontSize:6}}>09/04/2026</div></div>
        </div>
        <div className="px-2 py-1">
          <div className="flex border-b pb-0.5 mb-0.5 text-gray-600" style={{fontSize:5}}>{['#','Item','Qty','Amt'].map(h=><div key={h} className="flex-1 last:text-right">{h}</div>)}</div>
          {[1,2].map(i=><div key={i} className="flex text-gray-700" style={{fontSize:6}}>{[i,'Product','2','₹1k'].map((v,j)=><div key={j} className="flex-1 last:text-right">{v}</div>)}</div>)}
        </div>
        <div className="px-2 py-1 border-t-2 border-gray-900 flex justify-end"><div className="font-bold text-gray-900" style={{fontSize:6}}>TOTAL: ₹2.4k</div></div>
      </div>
    ),
  },
  {
    key: 'minimal', label: 'Minimal', desc: 'Clean white, ultra-simple, no header color',
    preview: (_: string, lbl: string) => (
      <div className="w-full rounded overflow-hidden border border-gray-200 text-[7px] font-sans">
        <div className="px-2 py-1.5 border-b flex justify-between items-end">
          <div><div className="text-gray-900 font-black text-[9px]">{lbl}</div><div className="text-gray-400" style={{fontSize:5}}>NO-001 · 09/04/2026</div></div>
        </div>
        <div className="px-2 py-1 border-b"><div className="text-gray-400" style={{fontSize:5}}>Bill To</div><div className="text-gray-700 font-semibold" style={{fontSize:6}}>Customer</div></div>
        <div className="px-2 py-1">{[1,2].map(i=><div key={i} className="flex text-gray-600 border-b border-dashed border-gray-100 py-0.5" style={{fontSize:6}}><div className="flex-1">Item {i}</div><div>₹1k</div></div>)}</div>
        <div className="px-2 py-1 flex justify-end"><div className="font-bold text-gray-900" style={{fontSize:6}}>Total ₹2.4k</div></div>
      </div>
    ),
  },
]

const FONT_FAMILIES = [
  { key: 'inter',   label: 'Inter',      desc: 'Clean modern sans-serif — best for digital',  sample: 'The quick brown fox', style: { fontFamily: 'Inter, sans-serif' } },
  { key: 'serif',   label: 'Times',      desc: 'Classic serif — formal & traditional',         sample: 'The quick brown fox', style: { fontFamily: 'Times New Roman, serif' } },
  { key: 'mono',    label: 'Monospace',  desc: 'Fixed-width — great for thermal receipts',    sample: 'The quick brown fox', style: { fontFamily: 'Courier New, monospace' } },
  { key: 'rounded', label: 'Nunito',     desc: 'Friendly rounded sans — modern & approachable', sample: 'The quick brown fox', style: { fontFamily: 'Nunito, Trebuchet MS, sans-serif' } },
] as const

const FONT_SIZES = [
  { key: 'sm', label: 'Small',  desc: '11 px base — compact, fits more on page' },
  { key: 'md', label: 'Medium', desc: '13 px base — comfortable reading size' },
  { key: 'lg', label: 'Large',  desc: '15 px base — easier to read, fewer items per page' },
] as const

const PAPER_SIZES = [
  { key: 'a4',     label: 'A4',     desc: '210 × 297 mm — Standard invoice / tax document', icon: '📄' },
  { key: '3inch',  label: '3 Inch', desc: '76 mm wide — Wide thermal receipt / challan',    icon: '🧾' },
  { key: '2inch',  label: '2 Inch', desc: '58 mm wide — Narrow thermal receipt',            icon: '🖨️' },
  { key: 'custom', label: 'Custom', desc: 'Set your own width & height in mm',              icon: '⚙️' },
] as const

function TplToggle({ on, onChange }: { on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div onClick={() => onChange(!on)}
      className={`w-10 h-5 rounded-full transition-colors relative shrink-0 cursor-pointer ${on ? 'bg-primary-500' : 'bg-gray-300'}`}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${on ? 'left-5' : 'left-0.5'}`} />
    </div>
  )
}

function OptionRow({ label, desc, on, onChange }: { label: string; desc: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50">
      <div>
        <p className="text-sm font-medium text-gray-700">{label}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <TplToggle on={on} onChange={onChange} />
    </div>
  )
}

function TemplatesSettings() {
  const { outletId } = useAuthStore()
  const qc = useQueryClient()
  const [saving, setSaving] = useState(false)
  const [docType, setDocType] = useState<'invoice' | 'quotation' | 'purchaseOrder'>('invoice')
  const [invoiceCfg, setInvoiceCfg] = useState<InvoiceTemplateConfig>(DEFAULT_INVOICE_TEMPLATE)
  const [quotationCfg, setQuotationCfg] = useState<QuotationTemplateConfig>(DEFAULT_QUOTATION_TEMPLATE)
  const [purchaseOrderCfg, setPurchaseOrderCfg] = useState<PurchaseOrderTemplateConfig>(DEFAULT_PURCHASE_ORDER_TEMPLATE)
  const [activeSection, setActiveSection] = useState<'layout' | 'brand' | 'content' | 'columns' | 'fields'>('layout')

  const cfg: InvoiceTemplateConfig = docType === 'invoice' ? invoiceCfg : docType === 'quotation' ? quotationCfg : purchaseOrderCfg
  const set = (key: keyof InvoiceTemplateConfig, value: any) => {
    if (docType === 'invoice') setInvoiceCfg(p => ({ ...p, [key]: value }))
    else if (docType === 'quotation') setQuotationCfg(p => ({ ...p, [key]: value }))
    else setPurchaseOrderCfg(p => ({ ...p, [key]: value }))
  }

  const { data: allOutlets } = useQuery({
    queryKey: ['outlets-all'],
    queryFn: async () => {
      const res = await outletApi.getAll()
      return res.data.data as { id: number; name: string; code: string }[]
    },
    enabled: !outletId,
  })

  const resolvedOutletId: number | null = outletId ?? (allOutlets?.[0]?.id ?? null)

  const { data: outlet, isLoading } = useQuery({
    queryKey: ['outlet', resolvedOutletId],
    queryFn: async () => { const res = await outletApi.getById(resolvedOutletId!); return res.data.data },
    enabled: !!resolvedOutletId,
  })

  useEffect(() => {
    if (outlet?.invoiceTemplate) {
      const parsed = parseTemplatesConfig(outlet.invoiceTemplate)
      setInvoiceCfg(parsed.invoice)
      setQuotationCfg(parsed.quotation)
      setPurchaseOrderCfg(parsed.purchaseOrder)
    }
  }, [outlet])

  async function handleSave() {
    setSaving(true)
    try {
      const config: TemplatesConfig = { invoice: invoiceCfg, quotation: quotationCfg, purchaseOrder: purchaseOrderCfg }
      await outletApi.update(resolvedOutletId!, { invoiceTemplate: JSON.stringify(config) })
      qc.invalidateQueries({ queryKey: ['outlet', resolvedOutletId] })
      toast.success('Templates saved!')
    } catch { toast.error('Failed to save templates') }
    finally { setSaving(false) }
  }

  const sections = [
    { key: 'layout',  label: 'Layout',   icon: <LayoutTemplate size={13} /> },
    { key: 'brand',   label: 'Branding', icon: <Palette size={13} /> },
    { key: 'content', label: 'Content',  icon: <AlignLeft size={13} /> },
    { key: 'columns', label: 'Columns',  icon: <FileText size={13} /> },
    { key: 'fields',  label: 'Fields',   icon: <Hash size={13} /> },
  ] as const

  const docLabel = docType === 'invoice' ? 'INVOICE' : docType === 'quotation' ? 'QUOTATION' : 'PURCHASE ORDER'

  if (isLoading) return <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-gray-400" /></div>

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-gray-900">Document Templates</h2>
          <p className="text-sm text-gray-500 mt-0.5">Customise how your documents look when shared or printed.</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-full p-1">
          {([
            { key: 'invoice',       label: 'Invoice' },
            { key: 'quotation',     label: 'Quotation' },
            { key: 'purchaseOrder', label: 'Purchase Order' },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setDocType(t.key)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all ${docType === t.key ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6 items-start">

        {/* ── Editor ── */}
        <div className="space-y-4" style={{ width: '593px', minWidth: '593px' }}>

          {/* Section tabs */}
          <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
            {sections.map(s => (
              <button key={s.key} onClick={() => setActiveSection(s.key as any)}
                className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-all ${activeSection === s.key ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {s.icon} {s.label}
              </button>
            ))}
          </div>

          {/* ── Layout ── */}
          {activeSection === 'layout' && (
            <div className="space-y-5">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Paper / Print Size</p>
                <div className="grid grid-cols-2 gap-2">
                  {PAPER_SIZES.map(p => (
                    <button key={p.key} onClick={() => set('paperSize', p.key)}
                      className={`p-3 rounded-xl border-2 text-left transition-all ${cfg.paperSize === p.key ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-base">{p.icon}</span>
                        <span className={`text-xs font-bold ${cfg.paperSize === p.key ? 'text-primary-700' : 'text-gray-700'}`}>{p.label}</span>
                      </div>
                      <p className="text-[10px] text-gray-400 leading-tight">{p.desc}</p>
                    </button>
                  ))}
                </div>
                {cfg.paperSize === 'custom' && (
                  <div className="grid grid-cols-2 gap-3 p-3 bg-gray-50 rounded-lg border">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Width (mm)</label>
                      <input type="number" value={cfg.customWidthMm} onChange={e => set('customWidthMm', parseInt(e.target.value) || 80)} min={40} max={300}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none" />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Height (mm)</label>
                      <input type="number" value={cfg.customHeightMm} onChange={e => set('customHeightMm', parseInt(e.target.value) || 120)} min={60} max={600}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none" />
                      <p className="text-[10px] text-gray-400">Set 0 for auto height</p>
                    </div>
                  </div>
                )}
              </div>

              {(cfg.paperSize === 'a4' || cfg.paperSize === 'custom') && (
                <div className="space-y-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Visual Layout</p>
                  <div className="grid grid-cols-3 gap-3">
                    {LAYOUTS.map(l => (
                      <button key={l.key} onClick={() => set('layout', l.key as any)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${cfg.layout === l.key ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                        <div className="mb-2">{l.preview(cfg.primaryColor, docLabel)}</div>
                        <p className={`text-xs font-bold ${cfg.layout === l.key ? 'text-primary-700' : 'text-gray-700'}`}>{l.label}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5 leading-tight">{l.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {(cfg.paperSize === '2inch' || cfg.paperSize === '3inch') && (
                <div className="p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <p className="text-xs font-medium text-amber-700">📝 Compact thermal layout active</p>
                  <p className="text-[11px] text-amber-600 mt-0.5">A receipt-style layout is used automatically for {cfg.paperSize === '3inch' ? '76 mm (3-inch)' : '58 mm (2-inch)'} paper. The visual layout selector applies to A4/Custom only.</p>
                </div>
              )}
            </div>
          )}

          {/* ── Branding ── */}
          {activeSection === 'brand' && (
            <div className="space-y-5">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Branding & Colours</p>
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 flex items-center gap-2"><Image size={14} /> Business Logo</label>
                <div className="flex items-center gap-3">
                  <TplToggle on={cfg.showLogo} onChange={v => set('showLogo', v)} />
                  <span className="text-sm text-gray-600">Show logo on {docType === 'purchaseOrder' ? 'Purchase Order' : docType}</span>
                </div>
                {cfg.showLogo && (
                  <div className="space-y-2">
                    <input type="url" value={cfg.logoUrl} onChange={e => set('logoUrl', e.target.value)}
                      placeholder="https://your-domain.com/logo.png"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none" />
                    {cfg.logoUrl && (
                      <div className="flex items-center gap-3 p-2 bg-gray-50 rounded-lg border">
                        <img src={cfg.logoUrl} alt="Logo" className="h-10 object-contain rounded" onError={e => { (e.target as HTMLImageElement).style.display = 'none' }} />
                        <p className="text-xs text-gray-400">Logo preview</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Header Colour</label>
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                    <input type="color" value={cfg.primaryColor} onChange={e => set('primaryColor', e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent" />
                    <span className="text-sm font-mono text-gray-600">{cfg.primaryColor}</span>
                  </div>
                  <p className="text-[11px] text-gray-400">Header bar & title background</p>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Accent Colour</label>
                  <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                    <input type="color" value={cfg.accentColor} onChange={e => set('accentColor', e.target.value)} className="w-7 h-7 rounded cursor-pointer border-0 p-0 bg-transparent" />
                    <span className="text-sm font-mono text-gray-600">{cfg.accentColor}</span>
                  </div>
                  <p className="text-[11px] text-gray-400">Status badges & highlights</p>
                </div>
              </div>
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-500">Quick Presets</p>
                <div className="flex gap-2 flex-wrap">
                  {[
                    { label: 'Slate',  primary: '#1e293b', accent: '#3b82f6' },
                    { label: 'Indigo', primary: '#312e81', accent: '#6366f1' },
                    { label: 'Teal',   primary: '#134e4a', accent: '#14b8a6' },
                    { label: 'Rose',   primary: '#881337', accent: '#f43f5e' },
                    { label: 'Amber',  primary: '#78350f', accent: '#f59e0b' },
                    { label: 'Violet', primary: '#4c1d95', accent: '#8b5cf6' },
                    { label: 'Forest', primary: '#14532d', accent: '#22c55e' },
                    { label: 'Navy',   primary: '#1e3a5f', accent: '#0ea5e9' },
                  ].map(p => (
                    <button key={p.label} onClick={() => { set('primaryColor', p.primary); set('accentColor', p.accent) }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium text-gray-600 hover:border-gray-400 transition-colors"
                      style={{ borderColor: cfg.primaryColor === p.primary ? p.primary : undefined, background: cfg.primaryColor === p.primary ? p.primary + '15' : undefined }}>
                      <span className="w-3 h-3 rounded-full inline-block" style={{ background: p.primary }} />
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Content ── */}
          {activeSection === 'content' && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{docType === 'purchaseOrder' ? 'Purchase Order' : docLabel} Content</p>

              {/* ── Typography ── */}
              <div className="space-y-3 pb-4 border-b border-gray-100">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide flex items-center gap-1.5"><Type size={12} /> Font & Typography</p>

                {/* Font Family */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Font Family</label>
                  <div className="grid grid-cols-2 gap-2">
                    {FONT_FAMILIES.map(f => (
                      <button key={f.key} onClick={() => set('fontFamily', f.key)}
                        className={`p-2.5 rounded-xl border-2 text-left transition-all ${cfg.fontFamily === f.key ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300 bg-white'}`}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className={`text-xs font-bold ${cfg.fontFamily === f.key ? 'text-primary-700' : 'text-gray-700'}`}>{f.label}</span>
                          {cfg.fontFamily === f.key && <Check size={10} className="text-primary-500" />}
                        </div>
                        <p className="text-[10px] text-gray-400 leading-tight mb-1">{f.desc}</p>
                        <p className="text-[11px] text-gray-600 leading-none" style={f.style}>{f.sample}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Font Size */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700">Base Font Size</label>
                  <div className="flex gap-2">
                    {FONT_SIZES.map(s => (
                      <button key={s.key} onClick={() => set('contentFontSize', s.key)}
                        className={`flex-1 py-2 px-3 rounded-lg border-2 text-center transition-all ${cfg.contentFontSize === s.key ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <p className={`text-xs font-bold ${cfg.contentFontSize === s.key ? 'text-primary-700' : 'text-gray-700'}`}>{s.label}</p>
                        <p className="text-[10px] text-gray-400 leading-tight mt-0.5">{s.desc}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Text Colors */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-gray-700 flex items-center gap-1.5"><Baseline size={13} /> Text Colours</label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Body Text</label>
                      <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                        <input type="color" value={cfg.bodyTextColor} onChange={e => set('bodyTextColor', e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent" />
                        <span className="text-xs font-mono text-gray-600">{cfg.bodyTextColor}</span>
                      </div>
                      <p className="text-[10px] text-gray-400">Main content & values</p>
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-medium text-gray-600">Labels / Captions</label>
                      <div className="flex items-center gap-2 border border-gray-200 rounded-lg px-3 py-2">
                        <input type="color" value={cfg.labelColor} onChange={e => set('labelColor', e.target.value)} className="w-6 h-6 rounded cursor-pointer border-0 p-0 bg-transparent" />
                        <span className="text-xs font-mono text-gray-600">{cfg.labelColor}</span>
                      </div>
                      <p className="text-[10px] text-gray-400">Field labels & captions</p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-gray-500">Quick Presets</p>
                    <div className="flex gap-2 flex-wrap">
                      {[
                        { label: 'Dark',      body: '#1e293b', label_: '#64748b' },
                        { label: 'Charcoal',  body: '#374151', label_: '#6b7280' },
                        { label: 'Navy',      body: '#1e3a5f', label_: '#5b8ab5' },
                        { label: 'Forest',    body: '#14532d', label_: '#6da87e' },
                        { label: 'Warm',      body: '#292524', label_: '#78716c' },
                      ].map(p => (
                        <button key={p.label} onClick={() => { set('bodyTextColor', p.body); set('labelColor', p.label_) }}
                          className="flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-medium text-gray-600 hover:border-gray-400 transition-colors"
                          style={{ borderColor: cfg.bodyTextColor === p.body ? p.body : undefined, background: cfg.bodyTextColor === p.body ? p.body + '12' : undefined }}>
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: p.body }} />
                          {p.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {(docType === 'quotation' || docType === 'purchaseOrder') && (
                <>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium text-gray-700">Default Subject Line</label>
                      <TplToggle on={cfg.showSubject} onChange={v => set('showSubject', v)} />
                    </div>
                    {cfg.showSubject && (
                      <input type="text" value={cfg.defaultSubject} onChange={e => set('defaultSubject', e.target.value)}
                        placeholder={docType === 'purchaseOrder' ? 'Purchase Order for Supply of Goods' : 'Quotation for Supply of Goods / Services'}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none" />
                    )}
                    <p className="text-[11px] text-gray-400">Pre-filled subject shown on all {docType === 'purchaseOrder' ? 'purchase orders' : 'quotations'}</p>
                  </div>
                  {docType === 'quotation' && (
                    <div className="space-y-1.5">
                      <label className="text-sm font-medium text-gray-700">Validity Period (Days)</label>
                      <input type="number" value={cfg.validityDays} onChange={e => set('validityDays', parseInt(e.target.value) || 30)} min={1} max={365}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none" />
                      <p className="text-[11px] text-gray-400">Quotation is valid for this many days from issue date</p>
                    </div>
                  )}
                </>
              )}

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Thank You / Closing Message</label>
                <input type="text" value={cfg.thankYouMessage} onChange={e => set('thankYouMessage', e.target.value)}
                  placeholder={docType === 'quotation' ? 'We hope to receive your valued order!' : docType === 'purchaseOrder' ? 'Please confirm receipt of this Purchase Order.' : 'Thank you for your business!'}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Payment Terms</label>
                <input type="text" value={cfg.paymentTerms} onChange={e => set('paymentTerms', e.target.value)}
                  placeholder="e.g. 50% advance, balance on delivery"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Bank Details</label>
                <textarea value={cfg.bankDetails} onChange={e => set('bankDetails', e.target.value)} rows={3}
                  placeholder={"Bank: HDFC Bank\nAccount No: 1234567890\nIFSC: HDFC0001234\nBranch: MG Road"}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none resize-none" />
                <p className="text-[11px] text-gray-400">Shown at the bottom for payment reference</p>
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Terms & Conditions</label>
                <textarea value={cfg.terms} onChange={e => set('terms', e.target.value)} rows={4}
                  placeholder={"1. Goods once sold will not be taken back.\n2. Interest @18% p.a. after due date.\n3. Subject to local jurisdiction."}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none resize-none" />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-700">Footer Note</label>
                <input type="text" value={cfg.footerNote} onChange={e => set('footerNote', e.target.value)}
                  placeholder="E. & O. E. — Errors and Omissions Excepted"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none" />
              </div>
              <div className="space-y-2 pt-1">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Extra Sections</p>
                <OptionRow key="sig" label="Authorised Signatory Line" desc={'Adds signature box — "For [Business Name]"'} on={cfg.showSignatureLine} onChange={v => set('showSignatureLine', v)} />
                <OptionRow key="seal" label="Company Seal / Stamp Box" desc="Adds an empty box for company stamp" on={cfg.showSeal} onChange={v => set('showSeal', v)} />
              </div>
            </div>
          )}

          {/* ── Columns ── */}
          {activeSection === 'columns' && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Line-Item Table Columns</p>
              <p className="text-xs text-gray-400">Always shown: Item Description · Qty · Rate · Amount</p>
              <div className="space-y-2">
                {([
                  { key: 'showSerial',        label: 'Sr. No.',              desc: 'Serial number for each line item' },
                  { key: 'showUnit',           label: 'Unit / UOM',           desc: 'Unit of measurement (Nos, Kg, Ltr, Mtr, Box, etc.)' },
                  { key: 'showHsn',            label: 'HSN / SAC Code',       desc: 'GST-mandated Harmonised System Nomenclature code for goods / SAC for services' },
                  { key: 'showDiscPercent',    label: 'Discount %',           desc: 'Line-level discount percentage applied to rate' },
                  { key: 'showTaxableAmount',  label: 'Taxable Amount',       desc: 'Value of supply before GST — mandatory for B2B tax invoices' },
                  { key: 'showTaxRate',        label: 'GST Rate %',           desc: 'GST rate per line (5%, 12%, 18%, 28%)' },
                  { key: 'showCgstSgst',       label: 'CGST + SGST Split',    desc: 'Separate CGST & SGST columns instead of combined GST (intra-state supplies)' },
                ] as { key: keyof InvoiceTemplateConfig; label: string; desc: string }[]).map(opt => (
                  <OptionRow key={opt.key} label={opt.label} desc={opt.desc} on={!!cfg[opt.key]} onChange={v => set(opt.key, v)} />
                ))}
              </div>
              {cfg.showCgstSgst && (
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200 text-xs text-blue-700">
                  💡 CGST + SGST split applies to intra-state (within same state) supplies. For inter-state supplies use IGST (single GST Rate% column).
                </div>
              )}
            </div>
          )}

          {/* ── Fields ── */}
          {activeSection === 'fields' && (
            <div className="space-y-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Additional Fields & Compliance</p>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mt-1">GST Compliance</p>
                <OptionRow label="Place of Supply" desc="Required on GST invoices — state where goods/services are delivered" on={cfg.showPlaceOfSupply} onChange={v => set('showPlaceOfSupply', v)} />
                <OptionRow label="Reverse Charge Indicator" desc='Shows "Tax payable on reverse charge: Yes / No" field (mandatory when applicable)' on={cfg.showReverseCharge} onChange={v => set('showReverseCharge', v)} />
                {cfg.showReverseCharge && (
                  <div className="pl-3 flex items-center gap-2">
                    <input type="checkbox" checked={cfg.reverseChargeApplicable} onChange={e => set('reverseChargeApplicable', e.target.checked)}
                      className="w-4 h-4 rounded text-primary-500" id="rca" />
                    <label htmlFor="rca" className="text-sm text-gray-600">Reverse charge applicable (defaults to Yes on this template)</label>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mt-1">Date & Time</p>
                <OptionRow label="Issue Date" desc="Show issue date on the document (uncheck to hide it)" on={cfg.showIssueDate} onChange={v => set('showIssueDate', v)} />
                <OptionRow label="Due Date" desc="Show payment due date on the invoice" on={cfg.showDueDate ?? true} onChange={v => set('showDueDate', v)} />
                <OptionRow label="Show Time" desc="Display time alongside the issue date" on={cfg.showTime} onChange={v => set('showTime', v)} />
              </div>

              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mt-1">Logistics & Reference</p>
                <OptionRow label="Delivery / Ship-To Address" desc="Separate shipping address field when different from billing" on={cfg.showDeliveryAddress} onChange={v => set('showDeliveryAddress', v)} />
                <OptionRow label="P.O. Number & Date" desc="Customer Purchase Order reference number and date" on={cfg.showPoNumber} onChange={v => set('showPoNumber', v)} />
                <OptionRow label="E-Way Bill Number" desc="Required for movement of goods valued > ₹50,000 under GST" on={cfg.showEwayBill} onChange={v => set('showEwayBill', v)} />
                <OptionRow label="Salesperson / Executive" desc="Name of the sales executive responsible for this document" on={cfg.showSalesperson} onChange={v => set('showSalesperson', v)} />
                {cfg.showSalesperson && (
                  <div className="pl-3 space-y-1">
                    <label className="text-xs font-medium text-gray-600">Label text</label>
                    <input type="text" value={cfg.salespersonLabel} onChange={e => set('salespersonLabel', e.target.value)}
                      placeholder="Sales Executive"
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary-400 focus:outline-none" />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Save */}
          <div className="pt-2 border-t flex items-center justify-between">
            <button onClick={() => {
              if (docType === 'invoice') setInvoiceCfg(DEFAULT_INVOICE_TEMPLATE)
              else if (docType === 'quotation') setQuotationCfg(DEFAULT_QUOTATION_TEMPLATE)
              else setPurchaseOrderCfg(DEFAULT_PURCHASE_ORDER_TEMPLATE)
              toast(`Reset ${docType === 'purchaseOrder' ? 'Purchase Order' : docType} template to defaults`)
            }} className="text-xs text-gray-400 hover:text-gray-600 underline underline-offset-2">
              Reset {docType === 'purchaseOrder' ? 'Purchase Order' : docType} to defaults
            </button>
            <button onClick={handleSave} disabled={saving}
              className="flex items-center gap-2 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white px-5 py-2 rounded-lg font-medium text-sm disabled:opacity-50 transition-colors">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Save All Templates
            </button>
          </div>
        </div>

        {/* ── Live Preview ── */}
        <div className="flex-1 sticky top-4" style={{ minWidth: '360px' }}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Live Preview</p>
          <p className="text-[10px] text-gray-400 mb-2">{docType === 'invoice' ? 'Invoice' : docType === 'quotation' ? 'Quotation' : 'Purchase Order'} · {PAPER_SIZES.find(p => p.key === cfg.paperSize)?.label}</p>
          <DocumentPreview cfg={cfg} docType={docType} outletName={outlet?.name ?? 'Your Business'} gstin={outlet?.gstin ?? ''} />
          <p className="text-[10px] text-gray-400 text-center mt-2">Preview uses sample data</p>
        </div>
      </div>
    </div>
  )
}

function DocumentPreview({ cfg, docType, outletName, gstin }: {
  cfg: InvoiceTemplateConfig; docType: 'invoice' | 'quotation' | 'purchaseOrder'; outletName: string; gstin: string
}) {
  const docLabel  = docType === 'invoice' ? 'TAX INVOICE' : docType === 'quotation' ? 'QUOTATION' : 'PURCHASE ORDER'
  const numLabel  = docType === 'invoice' ? 'INV-2026-001' : docType === 'quotation' ? 'QT-2026-001' : 'PO-2026-001'
  const date2Lbl  = docType === 'invoice' ? 'Due Date' : docType === 'quotation' ? 'Valid Till' : 'Required By'
  const date2Val  = '09/05/2026'

  // ── Typography derived from config ────────────────────────────────────────
  const fontFamilyMap: Record<string, string> = {
    inter:   'Inter, system-ui, sans-serif',
    serif:   'Times New Roman, Georgia, serif',
    mono:    'Courier New, Courier, monospace',
    rounded: 'Nunito, Trebuchet MS, sans-serif',
  }
  const fontFamily = fontFamilyMap[cfg.fontFamily] ?? fontFamilyMap.inter
  const bodyColor  = cfg.bodyTextColor ?? '#1e293b'
  const lblColor   = cfg.labelColor    ?? '#64748b'
  const zoomScale  = { sm: 0.82, md: 1, lg: 1.22 }[cfg.contentFontSize] ?? 1

  const items = [
    { sr: 1, name: 'Product Alpha', hsn: '8471', unit: 'Nos', qty: 2, rate: 500, disc: 5, taxable: 950,  tax: 18, cgst: 85.5, sgst: 85.5, total: 1121 },
    { sr: 2, name: 'Service Beta',  hsn: '9983', unit: 'Hrs', qty: 1, rate: 1400, disc: 0, taxable: 1400, tax: 18, cgst: 126,  sgst: 126,  total: 1652 },
  ]
  const sub = 2350; const taxAmt = 423; const grand = 2773

  const thC = 'px-1.5 py-1 text-[7px] font-semibold'
  const tdC = 'px-1.5 py-1 text-[8px]'

  // Thermal compact layout
  if (cfg.paperSize === '2inch' || cfg.paperSize === '3inch') {
    const w = cfg.paperSize === '3inch' ? 'w-56' : 'w-44'
    return (
      <div className={`${w} mx-auto rounded overflow-hidden border border-gray-200 bg-white shadow-sm`}
           style={{ fontFamily, fontSize: 7, color: bodyColor, zoom: zoomScale }}>
        <div className="px-2 py-1.5 text-center border-b">
          {cfg.showLogo && cfg.logoUrl && <img src={cfg.logoUrl} alt="logo" className="h-5 object-contain mx-auto mb-1" />}
          <div className="font-bold text-[9px]" style={{ color: bodyColor }}>{outletName}</div>
          {gstin && <div style={{ fontSize: 6, color: lblColor }}>GSTIN: {gstin}</div>}
          <div className="font-bold mt-0.5" style={{ fontSize: 7, color: lblColor }}>{docLabel}</div>
        </div>
        <div className="px-2 py-1 border-b" style={{ fontSize: 6 }}>
          <div className="flex justify-between"><span style={{ color: lblColor }}>No:</span><span>{numLabel}</span></div>
          <div className="flex justify-between"><span style={{ color: lblColor }}>Date:</span><span>09/04/2026</span></div>
          <div className="flex justify-between"><span style={{ color: lblColor }}>To:</span><span className="font-semibold">John Customer</span></div>
          {cfg.showPlaceOfSupply && <div className="flex justify-between"><span style={{ color: lblColor }}>POS:</span><span>Maharashtra</span></div>}
        </div>
        <div className="px-2 py-1 border-b">
          <div className="flex justify-between border-b border-dashed pb-0.5 mb-0.5" style={{ fontSize: 6, color: lblColor }}>
            <span className="flex-1">Item</span><span className="w-5 text-center">Qty</span><span>Amt</span>
          </div>
          {items.map((it, i) => (
            <div key={i} className="flex" style={{ fontSize: 6, color: bodyColor }}>
              <span className="flex-1">{it.name}</span><span className="w-5 text-center">{it.qty}</span><span>₹{it.total}</span>
            </div>
          ))}
        </div>
        <div className="px-2 py-1 text-right border-b" style={{ fontSize: 6 }}>
          <div style={{ color: lblColor }}>Subtotal: ₹{sub}</div>
          {cfg.showCgstSgst ? <>
            <div style={{ color: lblColor }}>CGST: ₹{(taxAmt/2).toFixed(0)}</div>
            <div style={{ color: lblColor }}>SGST: ₹{(taxAmt/2).toFixed(0)}</div>
          </> : <div style={{ color: lblColor }}>GST (18%): ₹{taxAmt}</div>}
          <div className="font-bold" style={{ fontSize: 8, color: bodyColor }}>TOTAL: ₹{grand}</div>
        </div>
        {cfg.paymentTerms && <div className="px-2 py-0.5" style={{ fontSize: 6, color: lblColor }}>Terms: {cfg.paymentTerms}</div>}
        {cfg.thankYouMessage && <div className="px-2 py-1 text-center" style={{ fontSize: 6, color: lblColor }}>{cfg.thankYouMessage}</div>}
        {cfg.showSignatureLine && <div className="px-2 pb-1 flex justify-end"><div className="border-t border-gray-400 pt-0.5 text-center w-16" style={{ fontSize: 6, color: lblColor }}>Authorised</div></div>}
      </div>
    )
  }

  const MetaRow = ({ l, v, time }: { l: string; v: string; time?: string }) => (
    <div className="px-2 py-1.5 border-r last:border-r-0 border-gray-100">
      <div className="uppercase text-[6px] tracking-wide" style={{ color: lblColor }}>{l}</div>
      <div className="font-semibold text-[8px]" style={{ color: bodyColor }}>{v}</div>
      {time && <div className="text-[6px] mt-0.5" style={{ color: lblColor }}>{time}</div>}
    </div>
  )

  const TotalsBlock = () => (
    <div className="px-3 py-1.5 border-t border-gray-100 flex justify-end">
      <div className="text-right space-y-0.5 text-[7px]">
        <div style={{ color: lblColor }}>Subtotal: ₹{sub}</div>
        {cfg.showCgstSgst ? <>
          <div style={{ color: lblColor }}>CGST (9%): ₹{(taxAmt/2).toFixed(0)}</div>
          <div style={{ color: lblColor }}>SGST (9%): ₹{(taxAmt/2).toFixed(0)}</div>
        </> : <div style={{ color: lblColor }}>GST (18%): ₹{taxAmt}</div>}
        <div className="font-bold text-[9px] border-t border-gray-200 pt-0.5" style={{ color: bodyColor }}>Total: ₹{grand}</div>
      </div>
    </div>
  )

  const FooterBlock = () => (
    <>
      {cfg.paymentTerms && <div className="px-3 py-1 border-t text-[7px]" style={{ color: lblColor }}><span className="font-semibold">Payment Terms: </span>{cfg.paymentTerms}</div>}
      {cfg.bankDetails && <div className="px-3 py-1.5 border-t text-[7px] whitespace-pre-wrap" style={{ color: lblColor }}>{cfg.bankDetails}</div>}
      {cfg.terms && <div className="px-3 py-1.5 border-t text-[7px] whitespace-pre-wrap" style={{ color: lblColor, opacity: 0.75 }}>{cfg.terms}</div>}
      <div className="px-3 py-1.5 flex justify-between border-t items-end">
        {cfg.showSeal ? <div className="border border-dashed border-gray-300 w-12 h-8 rounded flex items-center justify-center text-[6px] text-gray-300">SEAL</div> : <div />}
        {cfg.showSignatureLine && <div className="text-center text-[7px] border-t border-gray-400 pt-1 w-20" style={{ color: lblColor }}>Authorised Signatory</div>}
      </div>
      {cfg.thankYouMessage && <div className="px-3 py-1 border-t text-center text-[7px]" style={{ color: lblColor }}>{cfg.thankYouMessage}</div>}
      {cfg.footerNote && <div className="px-3 pb-1 text-center text-[6px]" style={{ color: lblColor, opacity: 0.7 }}>{cfg.footerNote}</div>}
    </>
  )

  const ItemsTable = () => (
    <table className="w-full">
      <thead><tr className={cfg.layout === 'classic' ? 'bg-gray-100' : ''} style={cfg.layout !== 'classic' ? { background: cfg.primaryColor + '18' } : {}}>
        {cfg.showSerial && <th className={`${thC} text-center w-5`} style={{ color: lblColor }}>#</th>}
        <th className={thC} style={{ color: lblColor }}>Product / Description</th>
        {cfg.showHsn && <th className={thC} style={{ color: lblColor }}>HSN/SAC</th>}
        {cfg.showUnit && <th className={thC} style={{ color: lblColor }}>Unit</th>}
        <th className={`${thC} text-right`} style={{ color: lblColor }}>Qty</th>
        <th className={`${thC} text-right`} style={{ color: lblColor }}>Rate</th>
        {cfg.showDiscPercent && <th className={`${thC} text-right`} style={{ color: lblColor }}>Disc%</th>}
        {cfg.showTaxableAmount && <th className={`${thC} text-right`} style={{ color: lblColor }}>Taxable</th>}
        {cfg.showCgstSgst
          ? <><th className={`${thC} text-right`} style={{ color: lblColor }}>CGST%</th><th className={`${thC} text-right`} style={{ color: lblColor }}>SGST%</th></>
          : cfg.showTaxRate && <th className={`${thC} text-right`} style={{ color: lblColor }}>GST%</th>}
        <th className={`${thC} text-right`} style={{ color: lblColor }}>Amount</th>
      </tr></thead>
      <tbody>{items.map((it, i) => (
        <tr key={i} className="border-t border-gray-50">
          {cfg.showSerial && <td className={`${tdC} text-center`} style={{ color: lblColor }}>{it.sr}</td>}
          <td className={`${tdC} font-medium`} style={{ color: bodyColor }}>{it.name}</td>
          {cfg.showHsn && <td className={`${tdC} text-center`} style={{ color: lblColor }}>{it.hsn}</td>}
          {cfg.showUnit && <td className={`${tdC} text-center`} style={{ color: lblColor }}>{it.unit}</td>}
          <td className={`${tdC} text-right`} style={{ color: lblColor }}>{it.qty}</td>
          <td className={`${tdC} text-right`} style={{ color: lblColor }}>₹{it.rate}</td>
          {cfg.showDiscPercent && <td className={`${tdC} text-right text-green-600`}>{it.disc}%</td>}
          {cfg.showTaxableAmount && <td className={`${tdC} text-right`} style={{ color: lblColor }}>₹{it.taxable}</td>}
          {cfg.showCgstSgst
            ? <><td className={`${tdC} text-right`} style={{ color: lblColor }}>{it.tax / 2}%</td><td className={`${tdC} text-right`} style={{ color: lblColor }}>{it.tax / 2}%</td></>
            : cfg.showTaxRate && <td className={`${tdC} text-right`} style={{ color: lblColor }}>{it.tax}%</td>}
          <td className={`${tdC} text-right font-semibold`} style={{ color: bodyColor }}>₹{it.total}</td>
        </tr>
      ))}</tbody>
    </table>
  )

  if (cfg.layout === 'classic') return (
    <div className="rounded-lg overflow-hidden border border-gray-300 bg-white shadow-sm" style={{ fontFamily, fontSize: 8, color: bodyColor, zoom: zoomScale }}>
      <div className="bg-gray-900 px-3 py-2 flex justify-between items-start">
        <div>
          <div className="text-white font-bold text-[10px]">{docLabel}</div>
          <div className="text-gray-400 text-[7px]">{outletName}</div>
        </div>
        <div className="text-right">
          <div className="text-gray-300 text-[7px]">{numLabel}</div>
          {cfg.showIssueDate && <div className="text-gray-400 text-[7px]">09/04/2026{cfg.showTime ? ' · 02:30 PM' : ''}</div>}
        </div>
      </div>
      {(gstin || cfg.showPlaceOfSupply || cfg.showReverseCharge) && (
        <div className="flex flex-wrap gap-x-3 px-3 py-0.5 bg-gray-50 border-b text-[6px]" style={{ color: lblColor }}>
          {gstin && <span>GSTIN: {gstin}</span>}
          {cfg.showPlaceOfSupply && <span>POS: Maharashtra (27)</span>}
          {cfg.showReverseCharge && <span>RC: {cfg.reverseChargeApplicable ? 'Yes' : 'No'}</span>}
        </div>
      )}
      <div className="px-3 py-1.5 grid grid-cols-2 gap-2 border-b text-[7px]">
        <div>
          <div style={{ color: lblColor }}>Bill To</div>
          <div className="font-bold" style={{ color: bodyColor }}>John Customer</div>
          <div className="text-[6px]" style={{ color: lblColor }}>GSTIN: 27AABCU9603R1Z9</div>
          {cfg.showDeliveryAddress && <div className="text-[6px] mt-0.5" style={{ color: lblColor }}>Ship To: Same as billing</div>}
        </div>
        <div className="text-right">
          {cfg.showPoNumber && <div className="text-[6px]" style={{ color: lblColor }}>PO: PO-2026-042</div>}
          {cfg.showEwayBill && <div className="text-[6px]" style={{ color: lblColor }}>E-Way: 12345678</div>}
          {cfg.showSalesperson && <div className="text-[6px]" style={{ color: lblColor }}>{cfg.salespersonLabel}: Rahul S.</div>}
          {cfg.showIssueDate && <div className="text-[6px]" style={{ color: lblColor }}>Date: 09/04/2026{cfg.showTime ? ' · 02:30 PM' : ''}</div>}
          {(cfg.showDueDate ?? true) && <div className="text-[6px]" style={{ color: lblColor }}>{date2Lbl}: {date2Val}</div>}
          {(docType === 'quotation' || docType === 'purchaseOrder') && cfg.showSubject && cfg.defaultSubject && <div className="italic text-[6px] mt-0.5" style={{ color: lblColor }}>{cfg.defaultSubject}</div>}
        </div>
      </div>
      <ItemsTable />
      <div className="px-3 py-1.5 border-t-2 border-gray-800 flex justify-end">
        <div className="text-right space-y-0.5 text-[7px]">
          <div style={{ color: lblColor }}>Subtotal: ₹{sub}</div>
          {cfg.showCgstSgst ? <>
            <div style={{ color: lblColor }}>CGST (9%): ₹{(taxAmt/2).toFixed(0)}</div>
            <div style={{ color: lblColor }}>SGST (9%): ₹{(taxAmt/2).toFixed(0)}</div>
          </> : <div style={{ color: lblColor }}>GST (18%): ₹{taxAmt}</div>}
          <div className="font-bold text-[9px]" style={{ color: bodyColor }}>TOTAL: ₹{grand}</div>
        </div>
      </div>
      <FooterBlock />
    </div>
  )

  if (cfg.layout === 'minimal') return (
    <div className="rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm" style={{ fontFamily, fontSize: 8, color: bodyColor, zoom: zoomScale }}>
      <div className="px-3 py-2.5 border-b flex justify-between items-end">
        <div>
          {cfg.showLogo && cfg.logoUrl && <img src={cfg.logoUrl} alt="logo" className="h-5 mb-0.5 object-contain" />}
          <div className="font-black text-[13px] tracking-tight" style={{ color: bodyColor }}>{docLabel}</div>
          <div className="text-[7px]" style={{ color: lblColor }}>{outletName}</div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[7px]" style={{ color: lblColor }}>{numLabel}</div>
          {cfg.showIssueDate && <div className="text-[7px]" style={{ color: lblColor }}>09/04/2026{cfg.showTime ? ' · 02:30 PM' : ''}</div>}
        </div>
      </div>
      {(gstin || cfg.showPlaceOfSupply) && (
        <div className="flex gap-x-3 px-3 py-0.5 border-b text-[6px]" style={{ color: lblColor }}>
          {gstin && <span>GSTIN: {gstin}</span>}
          {cfg.showPlaceOfSupply && <span>POS: Maharashtra (27)</span>}
        </div>
      )}
      <div className="grid grid-cols-2 px-3 py-1.5 border-b gap-2 text-[7px]">
        <div>
          <div style={{ color: lblColor }}>Bill To</div>
          <div className="font-semibold" style={{ color: bodyColor }}>John Customer</div>
          {cfg.showDeliveryAddress && <div className="text-[6px] mt-0.5" style={{ color: lblColor }}>Ship To: 123 Main St</div>}
        </div>
        <div className="text-right">
          {cfg.showIssueDate && <div style={{ color: lblColor }}>Issue: 09/04/2026{cfg.showTime ? <span className="ml-1 opacity-70">02:30 PM</span> : ''}</div>}
          {(cfg.showDueDate ?? true) && <div style={{ color: lblColor }}>{date2Lbl}: {date2Val}</div>}
          {cfg.showPoNumber && <div className="text-[6px]" style={{ color: lblColor }}>PO: PO-2026-042</div>}
          {(docType === 'quotation' || docType === 'purchaseOrder') && cfg.showSubject && cfg.defaultSubject && <div className="italic text-[6px] mt-0.5" style={{ color: lblColor }}>{cfg.defaultSubject}</div>}
        </div>
      </div>
      <ItemsTable />
      <TotalsBlock />
      <FooterBlock />
    </div>
  )

  // Modern (default)
  return (
    <div className="rounded-lg overflow-hidden border border-gray-200 bg-white shadow-sm" style={{ fontFamily, fontSize: 8, color: bodyColor, zoom: zoomScale }}>
      <div className="px-3 py-2.5 flex justify-between items-start" style={{ background: cfg.primaryColor }}>
        <div>
          {cfg.showLogo && cfg.logoUrl
            ? <img src={cfg.logoUrl} alt="logo" className="h-5 object-contain mb-0.5" />
            : <div className="text-white/70 text-[7px]">{outletName}</div>}
          <div className="text-white font-black text-[12px] tracking-tight">{docLabel}</div>
        </div>
        <div className="text-right">
          <div className="text-white/80 text-[7px]">{numLabel}</div>
          {cfg.showIssueDate && <div className="text-white/60 text-[7px]">09/04/2026{cfg.showTime ? ' · 02:30 PM' : ''}</div>}
          {(cfg.showDueDate ?? true) && <div className="text-white/50 text-[6px]">Due: 09/05/2026</div>}
        </div>
      </div>
      {(gstin || cfg.showPlaceOfSupply || cfg.showReverseCharge || cfg.showEwayBill) && (
        <div className="flex flex-wrap gap-x-3 px-2 py-0.5 bg-gray-50 border-b text-[6px]" style={{ color: lblColor }}>
          {gstin && <span>GSTIN: {gstin}</span>}
          {cfg.showPlaceOfSupply && <span>POS: Maharashtra (27)</span>}
          {cfg.showReverseCharge && <span>RC: {cfg.reverseChargeApplicable ? 'Yes' : 'No'}</span>}
          {cfg.showEwayBill && <span>E-Way: 12345678</span>}
        </div>
      )}
      <div className={`grid border-b border-gray-100 grid-cols-${1 + (cfg.showIssueDate ? 1 : 0) + ((cfg.showDueDate ?? true) ? 1 : 0)}`}>
        <MetaRow l="Bill To" v="John Customer" />
        {cfg.showIssueDate && <MetaRow l="Issue Date" v="09/04/2026" time={cfg.showTime ? '02:30 PM' : undefined} />}
        {(cfg.showDueDate ?? true) && <MetaRow l={date2Lbl} v={date2Val} />}
      </div>
      {(cfg.showPoNumber || cfg.showSalesperson || cfg.showDeliveryAddress || ((docType === 'quotation' || docType === 'purchaseOrder') && cfg.showSubject && cfg.defaultSubject)) && (
        <div className="flex flex-wrap gap-x-4 px-2 py-1 border-b text-[6px]" style={{ color: lblColor }}>
          {cfg.showPoNumber && <span>PO: PO-2026-042</span>}
          {cfg.showSalesperson && <span>{cfg.salespersonLabel}: Rahul S.</span>}
          {cfg.showDeliveryAddress && <span>Ship To: Same as billing</span>}
          {(docType === 'quotation' || docType === 'purchaseOrder') && cfg.showSubject && cfg.defaultSubject && <span className="italic">Sub: {cfg.defaultSubject}</span>}
        </div>
      )}
      <ItemsTable />
      <TotalsBlock />
      <FooterBlock />
    </div>
  )
}

// ── Third-Party Service Rates ─────────────────────────────────────────────────

const SERVICE_RATES_KEY = 'ppp_service_rates'

const RATE_FIELDS = [
  {
    group: 'Fabrication',
    fields: [
      { key: 'fabrication_per_kg', label: 'Fabrication', unit: 'per Kg' },
    ],
  },
  {
    group: 'Spinning',
    fields: [
      { key: 'spinning_small_per_pipe', label: 'Spinning – Small Bed', unit: 'per Pipe' },
      { key: 'spinning_large_per_pipe', label: 'Spinning – Large Bed', unit: 'per Pipe' },
    ],
  },
  {
    group: 'Transport',
    fields: [
      { key: 'transport_per_km',   label: 'Transport', unit: 'per Km' },
      { key: 'transport_per_trip', label: 'Transport', unit: 'per Trip' },
    ],
  },
  {
    group: 'Labour',
    fields: [
      { key: 'labour_per_day',  label: 'Labour', unit: 'per Day' },
      { key: 'labour_per_hour', label: 'Labour', unit: 'per Hour' },
    ],
  },
]

type ServiceRates = Record<string, string>

function ServiceRatesSettings() {
  const allKeys = RATE_FIELDS.flatMap(g => g.fields.map(f => f.key))
  const defaultRates = Object.fromEntries(allKeys.map(k => [k, '']))

  const loadSaved = (): ServiceRates => {
    try {
      const s = localStorage.getItem(SERVICE_RATES_KEY)
      return s ? { ...defaultRates, ...JSON.parse(s) } : defaultRates
    } catch { return defaultRates }
  }

  const [rates, setRates] = useState<ServiceRates>(loadSaved)
  const [editing, setEditing] = useState(() => {
    // Start in edit mode if nothing has been saved yet
    const s = localStorage.getItem(SERVICE_RATES_KEY)
    return !s
  })
  const [saveFlash, setSaveFlash] = useState(false)

  function handleSave() {
    localStorage.setItem(SERVICE_RATES_KEY, JSON.stringify(rates))
    setSaveFlash(true)
    setTimeout(() => setSaveFlash(false), 2000)
    setEditing(false)
    toast.success('Service rates saved')
  }

  function handleEdit() {
    setRates(loadSaved())
    setEditing(true)
  }

  function handleCancel() {
    setRates(loadSaved())
    setEditing(false)
  }

  const fmt = (val: string) =>
    val && Number(val) > 0
      ? `₹ ${parseFloat(val).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : '—'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

        {/* Card header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <IndianRupee size={18} className="text-violet-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-semibold text-gray-900">Third Party Service Rates</p>
            <p className="text-sm text-gray-500">Used for cost calculations across the system</p>
          </div>
          {!editing && (
            <button
              onClick={handleEdit}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-gray-900 hover:bg-gray-100 transition-colors"
            >
              <Pencil size={14} /> Edit
            </button>
          )}
        </div>

        {/* Body */}
        <div className="divide-y divide-gray-100">
          {RATE_FIELDS.map(group => (
            <div key={group.group} className="px-6 py-6 flex gap-4">
              <div className="w-0.5 rounded-full bg-violet-500 self-stretch flex-shrink-0" />
              <div className="flex-1">
              <p className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-5">{group.group}</p>

              {editing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  {group.fields.map(f => (
                    <div key={f.key}>
                      <label className="block text-sm font-medium text-gray-600 mb-1.5">
                        {f.label} <span className="text-gray-400">({f.unit})</span>
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base font-medium">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={rates[f.key]}
                          onChange={e => setRates(prev => ({ ...prev, [f.key]: e.target.value }))}
                          placeholder="0.00"
                          className="w-full pl-8 pr-3 py-2.5 text-base border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400 transition-colors"
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {group.fields.map(f => (
                    <div key={f.key} className="bg-gray-50 rounded-xl px-4 py-3.5 flex flex-col gap-1">
                      <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                        {f.label} <span className="normal-case">({f.unit})</span>
                      </span>
                      <span className={`text-lg font-semibold ${rates[f.key] && Number(rates[f.key]) > 0 ? 'text-gray-900' : 'text-gray-300'}`}>
                        {fmt(rates[f.key])}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        {editing && (
          <div className="px-6 py-4 bg-gray-50/60 border-t border-gray-100 flex items-center justify-end gap-3">
            <button
              onClick={handleCancel}
              className="px-4 py-2.5 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-base font-semibold transition-all shadow-sm ${
                saveFlash ? 'bg-green-500 text-white' : 'bg-violet-600 hover:bg-violet-700 text-white'
              }`}
            >
              {saveFlash ? <Check size={15} /> : <Save size={15} />}
              {saveFlash ? 'Saved' : 'Save Rates'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ── TDS Sections Settings ─────────────────────────────────────────────────────

const DEFAULT_SECTIONS = [
  { sectionCode: '194C', description: 'Contractors & Sub-contractors', rate: 1, threshold: 30000 },
  { sectionCode: '194J', description: 'Professional / Technical Services', rate: 10, threshold: 30000 },
  { sectionCode: '194I', description: 'Rent', rate: 10, threshold: 240000 },
  { sectionCode: '194H', description: 'Commission / Brokerage', rate: 5, threshold: 15000 },
]

function TDSSectionsSettings() {
  const [sections, setSections] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState<any | null>(null)
  const [form, setForm]         = useState({ sectionCode: '', description: '', rate: '', threshold: '' })

  function load() {
    setLoading(true)
    tdsApi.getSections()
      .then(r => setSections(r.data.data ?? []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  function openNew() {
    setEditing(null)
    setForm({ sectionCode: '', description: '', rate: '', threshold: '' })
    setShowForm(true)
  }

  function openEdit(s: any) {
    setEditing(s)
    setForm({ sectionCode: s.sectionCode, description: s.description, rate: String(s.rate), threshold: String(s.threshold) })
    setShowForm(true)
  }

  async function handleSave() {
    const payload = {
      sectionCode: form.sectionCode,
      description: form.description,
      rate: parseFloat(form.rate) || 0,
      threshold: parseFloat(form.threshold) || 0,
      isActive: true,
    }
    try {
      if (editing) {
        await tdsApi.updateSection(editing.id, payload)
        toast.success('Section updated')
      } else {
        await tdsApi.createSection(payload)
        toast.success('Section created')
      }
      setShowForm(false)
      load()
    } catch { toast.error('Failed to save') }
  }

  async function handleDelete(id: number) {
    if (!confirm('Delete this TDS section?')) return
    try { await tdsApi.deleteSection(id); toast.success('Deleted'); load() }
    catch { toast.error('Failed to delete') }
  }

  async function seedDefaults() {
    for (const s of DEFAULT_SECTIONS) {
      await tdsApi.createSection({ ...s, isActive: true }).catch(() => {})
    }
    toast.success('Default sections added')
    load()
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <Wrench size={16} className="text-violet-600" />
          </div>
          <div className="flex-1">
            <p className="text-base font-semibold text-gray-900">TDS Sections</p>
            <p className="text-sm text-gray-500">Configure Income Tax TDS sections and applicable rates</p>
          </div>
          <div className="flex items-center gap-2">
            {sections.length === 0 && !loading && (
              <button onClick={seedDefaults} className="px-3.5 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
                Add Defaults
              </button>
            )}
            <button onClick={openNew} className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
              <Plus size={14} /> Add Section
            </button>
          </div>
        </div>

        {/* Add / Edit form */}
        {showForm && (
          <div className="px-6 py-5 border-b border-gray-100 bg-violet-50/40">
            <p className="text-sm font-semibold text-gray-800 mb-4">{editing ? 'Edit Section' : 'New TDS Section'}</p>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Section Code *</label>
                <input value={form.sectionCode} onChange={e => setForm(p => ({...p, sectionCode: e.target.value}))}
                  placeholder="e.g. 194C"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Rate (%) *</label>
                <input type="number" value={form.rate} onChange={e => setForm(p => ({...p, rate: e.target.value}))}
                  placeholder="e.g. 1"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400" />
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Description *</label>
                <input value={form.description} onChange={e => setForm(p => ({...p, description: e.target.value}))}
                  placeholder="e.g. Contractors & Sub-contractors"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Threshold Limit (₹)</label>
                <input type="number" value={form.threshold} onChange={e => setForm(p => ({...p, threshold: e.target.value}))}
                  placeholder="e.g. 30000"
                  className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-400/50 focus:border-violet-400" />
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">Cancel</button>
              <button onClick={handleSave} className="flex items-center gap-1.5 px-5 py-2 bg-violet-600 hover:bg-violet-700 text-white text-sm font-semibold rounded-xl transition-colors shadow-sm">
                <Save size={13} /> {editing ? 'Update' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {/* List */}
        {loading ? (
          <div className="py-12 flex justify-center"><Loader2 size={24} className="animate-spin text-violet-400" /></div>
        ) : sections.length === 0 ? (
          <div className="py-14 text-center">
            <p className="text-sm text-gray-400 mb-3">No TDS sections configured yet</p>
            <button onClick={seedDefaults} className="text-violet-600 text-sm font-medium hover:underline">Add common defaults (194C, 194J, 194I, 194H)</button>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {['Section','Description','Rate','Threshold','Status',''].map(h => (
                  <th key={h} className={`px-5 py-3 text-xs font-semibold text-gray-700 uppercase tracking-wider ${h === '' || h === 'Rate' || h === 'Threshold' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {sections.map(s => (
                <tr key={s.id} className="hover:bg-gray-50/60 transition-colors">
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold">{s.sectionCode}</span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-700">{s.description}</td>
                  <td className="px-5 py-3.5 text-right font-semibold text-gray-800">{parseFloat(s.rate).toFixed(2)}%</td>
                  <td className="px-5 py-3.5 text-right text-gray-600">₹ {parseFloat(s.threshold).toLocaleString('en-IN')}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${s.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {s.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => openEdit(s)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"><Pencil size={13} className="text-gray-500" /></button>
                      <button onClick={() => handleDelete(s.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"><Trash2 size={13} className="text-red-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
