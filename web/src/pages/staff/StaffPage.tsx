import { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Plus, Search, Edit2, Key, ToggleLeft, ToggleRight, X, Loader2,
  User, Users, Mail, Phone, Building2, Eye, EyeOff, Check, AlertCircle,
  UserCheck, UserX, Trash2, CreditCard, MapPin, Shield, Star,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { staffApi, rolesApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

// ─── Permissions ───────────────────────────────────────────────────────────────

export const PERMISSION_GROUPS = [
  {
    group: 'Point of Sale',
    icon: '🛒',
    items: [
      { key: 'POS_ACCESS',                 label: 'POS Access',               desc: 'Open and use the POS screen' },
      { key: 'PROCESS_SALES',              label: 'Process Sales',             desc: 'Complete sales transactions' },
      { key: 'PROCESS_RETURNS',            label: 'Process Returns',           desc: 'Accept returns and issue refunds' },
      { key: 'APPLY_DISCOUNTS',            label: 'Apply Discounts',           desc: 'Apply item and bill discounts' },
      { key: 'OPEN_PRICE',                 label: 'Open Price Edit',           desc: 'Override item price at time of sale' },
    ],
  },
  {
    group: 'Products & Catalogue',
    icon: '📦',
    items: [
      { key: 'VIEW_PRODUCTS',              label: 'View Products',             desc: 'Browse the product catalogue' },
      { key: 'MANAGE_PRODUCTS',            label: 'Manage Products',           desc: 'Add, edit and delete products' },
      { key: 'IMPORT_PRODUCTS',            label: 'Import Products',           desc: 'Bulk-import products via CSV' },
      { key: 'PRINT_BARCODES',             label: 'Print Barcodes',            desc: 'Print product barcode labels' },
    ],
  },
  {
    group: 'Inventory',
    icon: '🏬',
    items: [
      { key: 'VIEW_INVENTORY',             label: 'View Inventory',            desc: 'View stock levels and adjustments' },
      { key: 'MANAGE_INVENTORY',           label: 'Manage Inventory',          desc: 'Adjust stock quantities' },
      { key: 'VIEW_CATEGORIES',            label: 'View Categories',           desc: 'View product categories' },
      { key: 'MANAGE_CATEGORIES',          label: 'Manage Categories',         desc: 'Add and edit product categories' },
      { key: 'VIEW_UOM',                   label: 'View UOM',                  desc: 'View units of measure' },
      { key: 'MANAGE_UOM',                 label: 'Manage UOM',                desc: 'Manage UOM conversions' },
      { key: 'VIEW_TRANSFERS',             label: 'View Transfers',            desc: 'View stock transfer records' },
      { key: 'MANAGE_TRANSFERS',           label: 'Manage Transfers',          desc: 'Create and approve stock transfers' },
      { key: 'BULK_PURCHASE',              label: 'Bulk Purchase',             desc: 'Create bulk purchase / stock intake' },
    ],
  },
  {
    group: 'Customers',
    icon: '👥',
    items: [
      { key: 'VIEW_CUSTOMERS',             label: 'View Customers',            desc: 'View customer list and profiles' },
      { key: 'MANAGE_CUSTOMERS',           label: 'Manage Customers',          desc: 'Add and edit customer records' },
      { key: 'IMPORT_CUSTOMERS',           label: 'Import Customers',          desc: 'Bulk-import customers via CSV' },
    ],
  },
  {
    group: 'Sales & Orders',
    icon: '🧾',
    items: [
      { key: 'VIEW_ORDERS',                label: 'View Orders',               desc: 'View retail/POS order history' },
      { key: 'MANAGE_ORDERS',              label: 'Manage Orders',             desc: 'Create and modify retail orders' },
      { key: 'VIEW_SALES_ORDERS',          label: 'View Sales Orders',         desc: 'View B2B sales orders' },
      { key: 'MANAGE_SALES_ORDERS',        label: 'Manage Sales Orders',       desc: 'Create and manage B2B sales orders' },
      { key: 'VIEW_INVOICES',              label: 'View Invoices',             desc: 'View sales invoices' },
      { key: 'MANAGE_INVOICES',            label: 'Manage Invoices',           desc: 'Create and manage invoices' },
      { key: 'VIEW_QUOTATIONS',            label: 'View Quotations',           desc: 'View sales quotations' },
      { key: 'MANAGE_QUOTATIONS',          label: 'Manage Quotations',         desc: 'Create and manage quotations' },
      { key: 'VIEW_DELIVERY_CHALLANS',     label: 'View Delivery Challans',    desc: 'View delivery challans' },
      { key: 'MANAGE_DELIVERY_CHALLANS',   label: 'Manage Delivery Challans',  desc: 'Create and manage delivery challans' },
      { key: 'VIEW_CREDIT_NOTES',          label: 'View Credit Notes',         desc: 'View credit notes' },
      { key: 'MANAGE_CREDIT_NOTES',        label: 'Manage Credit Notes',       desc: 'Create and manage credit notes' },
      { key: 'VIEW_RETURNS',               label: 'View Sales Returns',        desc: 'View sales return records' },
      { key: 'MANAGE_RETURNS',             label: 'Manage Sales Returns',      desc: 'Process sales returns' },
    ],
  },
  {
    group: 'Payments',
    icon: '💳',
    items: [
      { key: 'VIEW_PAYMENTS',              label: 'View Payments',             desc: 'View payment records' },
      { key: 'MANAGE_PAYMENTS',            label: 'Manage Payments',           desc: 'Record and reconcile payments received' },
      { key: 'VIEW_PRICE_LISTS',           label: 'View Price Lists',          desc: 'View pricing rules and lists' },
      { key: 'MANAGE_PRICE_LISTS',         label: 'Manage Price Lists',        desc: 'Create and manage price lists' },
    ],
  },
  {
    group: 'Purchases',
    icon: '🏪',
    items: [
      { key: 'VIEW_PURCHASES',             label: 'View Purchases',            desc: 'View purchase orders and bills' },
      { key: 'MANAGE_PURCHASES',           label: 'Manage Purchases',          desc: 'Create and manage purchase orders' },
      { key: 'DIRECT_PURCHASE',            label: 'Direct Purchase',           desc: 'Create direct/walk-in purchases' },
      { key: 'VIEW_VENDORS',               label: 'View Vendors',              desc: 'View vendor list and profiles' },
      { key: 'MANAGE_VENDORS',             label: 'Manage Vendors',            desc: 'Add and edit vendor records' },
      { key: 'IMPORT_VENDORS',             label: 'Import Vendors',            desc: 'Bulk-import vendors via CSV' },
      { key: 'VIEW_PURCHASE_RETURNS',      label: 'View Purchase Returns',     desc: 'View purchase return records' },
      { key: 'MANAGE_PURCHASE_RETURNS',    label: 'Manage Purchase Returns',   desc: 'Create purchase returns' },
      { key: 'VIEW_VENDOR_CREDITS',        label: 'View Vendor Credits',       desc: 'View vendor credit notes' },
    ],
  },
  {
    group: 'Production',
    icon: '🏭',
    items: [
      { key: 'VIEW_PRODUCTION_ORDERS',     label: 'View Production Orders',    desc: 'View production orders' },
      { key: 'MANAGE_PRODUCTION_ORDERS',   label: 'Manage Production Orders',  desc: 'Create and manage production orders' },
      { key: 'VIEW_PRODUCTION_ENTRIES',    label: 'View Production Entries',   desc: 'View recorded production entries' },
      { key: 'MANAGE_PRODUCTION_ENTRIES',  label: 'Manage Production Entries', desc: 'Record and edit production entries' },
      { key: 'VIEW_PIPE_CONFIGS',          label: 'View Pipe Configs',         desc: 'View pipe configurations' },
      { key: 'MANAGE_PIPE_CONFIGS',        label: 'Manage Pipe Configs',       desc: 'Add and edit pipe configurations' },
      { key: 'VIEW_MACHINES',              label: 'View Machines',             desc: 'View machine list' },
      { key: 'MANAGE_MACHINES',            label: 'Manage Machines',           desc: 'Add and edit machines' },
      { key: 'MANAGE_SHIFT_TEMPLATES',     label: 'Manage Shift Templates',    desc: 'Configure production shift templates' },
      { key: 'MANAGE_OVERHEAD_CONFIGS',    label: 'Manage Overhead Configs',   desc: 'Configure production overhead costs' },
      { key: 'VIEW_PRODUCTION_REPORTS',    label: 'Production Reports',        desc: 'View production performance reports' },
    ],
  },
  {
    group: 'Business Operations',
    icon: '🔧',
    items: [
      { key: 'VIEW_BUSINESS',              label: 'View Business Ops',         desc: 'Access the business operations hub' },
      { key: 'MANAGE_CEMENT_BAGS',         label: 'Cement Bags',               desc: 'Record daily cement bag consumption' },
      { key: 'MANAGE_VEHICLES',            label: 'Vehicles',                  desc: 'Record vehicle usage and diesel' },
      { key: 'MANAGE_DIESEL',              label: 'Diesel Maintenance',        desc: 'Record diesel consumption by process' },
      { key: 'MANAGE_MAINTENANCE',         label: 'Maintenance',               desc: 'Record machine maintenance entries' },
      { key: 'MANAGE_SILO',                label: 'Silo / Extraction',         desc: 'Record silo levels and extractions' },
      { key: 'MANAGE_STORE_MATERIAL',      label: 'Store Room Material',       desc: 'Record store room material issues' },
      { key: 'MANAGE_EXTRA_VEHICLES',      label: 'Extra Vehicles',            desc: 'Record hired/external vehicle usage' },
      { key: 'MANAGE_TESTING_LAB',         label: 'Testing Lab',               desc: 'Record quality test results' },
      { key: 'MANAGE_CONVERSION',          label: 'Pipe Conversion',           desc: 'Record pipe type conversions' },
      { key: 'MANAGE_DISCARD',             label: 'Discard / Rejection',       desc: 'Record pipe discards and rejections' },
      { key: 'MANAGE_PDI',                 label: 'PDI',                       desc: 'Record pre-dispatch inspections' },
      { key: 'MANAGE_LOADING',             label: 'Loading Records',           desc: 'Record pipe loading and dispatch' },
      { key: 'MANAGE_LABOUR',              label: 'Labour',                    desc: 'Record contractor and labour entries' },
      { key: 'VIEW_TRANSPORT_REPORT',      label: 'Transport Report',          desc: 'View transport payment reports' },
    ],
  },
  {
    group: 'Expenses',
    icon: '💸',
    items: [
      { key: 'VIEW_EXPENSES',              label: 'View Expenses',             desc: 'View expense records' },
      { key: 'MANAGE_EXPENSES',            label: 'Manage Expenses',           desc: 'Add and edit expense entries' },
      { key: 'VIEW_EXPENSE_CATEGORIES',    label: 'View Expense Categories',   desc: 'View expense categories' },
      { key: 'MANAGE_EXPENSE_CATEGORIES',  label: 'Manage Expense Categories', desc: 'Create and manage expense categories' },
    ],
  },
  {
    group: 'Reports & Finance',
    icon: '📊',
    items: [
      { key: 'VIEW_REPORTS',               label: 'View Reports',              desc: 'Access the reports module' },
      { key: 'VIEW_SALES_REPORT',          label: 'Sales Report',              desc: 'View sales performance reports' },
      { key: 'VIEW_PURCHASE_REPORT',       label: 'Purchase Report',           desc: 'View purchase reports' },
      { key: 'VIEW_INVENTORY_REPORT',      label: 'Inventory Report',          desc: 'View inventory valuation reports' },
      { key: 'VIEW_GST_REPORT',            label: 'GST Report',                desc: 'View GSTR-1, GSTR-3B and HSN reports' },
      { key: 'VIEW_PAYMENT_REPORT',        label: 'Payment Report',            desc: 'View payment collection reports' },
      { key: 'VIEW_DEBTORS_REPORT',        label: 'Debtors Report',            desc: 'View outstanding receivables' },
      { key: 'VIEW_CREDITORS_REPORT',      label: 'Creditors Report',          desc: 'View outstanding payables' },
    ],
  },
  {
    group: 'Shifts',
    icon: '🕐',
    items: [
      { key: 'VIEW_SHIFTS',                label: 'View Shifts',               desc: 'View shift summaries and history' },
      { key: 'MANAGE_SHIFTS',              label: 'Manage Shifts',             desc: 'Open and close shifts' },
    ],
  },
  {
    group: 'Administration',
    icon: '⚙️',
    items: [
      { key: 'MANAGE_DISCOUNTS',           label: 'Manage Discounts',          desc: 'Create discount rules and coupons' },
      { key: 'MANAGE_STAFF',               label: 'Manage Staff',              desc: 'Add and manage staff accounts' },
      { key: 'MANAGE_ROLES',               label: 'Manage Roles',              desc: 'Create and edit custom roles / designations' },
      { key: 'MANAGE_INCENTIVES',          label: 'Manage Incentives',         desc: 'Configure staff incentive rules' },
      { key: 'VIEW_ACTIVITY_LOGS',         label: 'Activity Logs',             desc: 'View system audit and activity logs' },
      { key: 'MANAGE_SETTINGS',            label: 'System Settings',           desc: 'Access and change system settings' },
    ],
  },
]

const ALL_PERMISSIONS = PERMISSION_GROUPS.flatMap(g => g.items.map(i => i.key))

// ─── Built-in roles (display only, not editable) ───────────────────────────────

export const BUILT_IN_ROLES: {
  value: string; label: string; color: string; permissions: string[]
}[] = [
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

// ─── Helpers ───────────────────────────────────────────────────────────────────

function getRoleColor(value: string, customRoles: any[]): string {
  const builtin = BUILT_IN_ROLES.find(r => r.value === value)
  if (builtin) return builtin.color
  const custom = customRoles.find(r => r.name === value)
  return custom?.color ?? 'bg-gray-100 text-gray-600'
}

function getRoleLabel(value: string, customRoles: any[]): string {
  const builtin = BUILT_IN_ROLES.find(r => r.value === value)
  if (builtin) return builtin.label
  const custom = customRoles.find(r => r.name === value)
  return custom?.displayName ?? value
}

function RoleBadge({ role, customRoles }: { role: string; customRoles: any[] }) {
  const color = getRoleColor(role, customRoles)
  const label = getRoleLabel(role, customRoles)
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
  )
}

// ─── Staff Form Modal ──────────────────────────────────────────────────────────

interface StaffMember {
  id: number
  name: string
  email: string
  phone?: string
  secondaryPhone?: string
  emergencyContact?: string
  panNumber?: string
  address?: string
  city?: string
  roles: string[]
  outletId?: number
  outletName?: string
  active: boolean
}

function StaffModal({
  staff, onClose, onDone
}: {
  staff: StaffMember | null
  onClose: () => void
  onDone: () => void
}) {
  const isEdit = !!staff
  const { outletId } = useAuthStore()

  const [name, setName] = useState(staff?.name ?? '')
  const [email, setEmail] = useState(staff?.email ?? '')
  const [phone, setPhone] = useState(staff?.phone ?? '')
  const [secondaryPhone, setSecondaryPhone] = useState(staff?.secondaryPhone ?? '')
  const [emergencyContact, setEmergencyContact] = useState(staff?.emergencyContact ?? '')
  const [panNumber, setPanNumber] = useState(staff?.panNumber ?? '')
  const [address, setAddress] = useState(staff?.address ?? '')
  const [city, setCity] = useState(staff?.city ?? '')
  const [selectedRoles, setSelectedRoles] = useState<string[]>(staff?.roles?.length ? staff.roles : ['CASHIER'])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  const { data: customRoles = [] } = useQuery({
    queryKey: ['custom-roles'],
    queryFn: () => rolesApi.getAll().then(r => r.data.data ?? []),
    staleTime: 60_000,
  })

  // All available roles: built-in (excluding SUPER_ADMIN) + custom
  const allRoles = [
    ...BUILT_IN_ROLES.filter(r => r.value !== 'SUPER_ADMIN').map(r => ({
      value: r.value, label: r.label, color: r.color, isBuiltIn: true,
    })),
    ...(customRoles as any[]).map(r => ({
      value: r.name, label: r.displayName, color: r.color ?? 'bg-gray-100 text-gray-600', isBuiltIn: false,
    })),
  ]

  function toggleRole(value: string) {
    setSelectedRoles(prev =>
      prev.includes(value)
        ? prev.length > 1 ? prev.filter(r => r !== value) : prev
        : [...prev, value]
    )
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!name.trim()) e.name = 'Name is required'
    if (!email.trim()) e.email = 'Email is required'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Invalid email address'
    if (!isEdit) {
      if (!password) e.password = 'Password is required'
      else if (password.length < 6) e.password = 'Password must be at least 6 characters'
      if (password !== confirmPassword) e.confirmPassword = 'Passwords do not match'
    }
    setErrors(e)
    return Object.keys(e).length === 0
  }

  async function handleSubmit() {
    if (!validate()) return
    setLoading(true)
    try {
      const payload: any = {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim() || undefined,
        secondaryPhone: secondaryPhone.trim() || undefined,
        emergencyContact: emergencyContact.trim() || undefined,
        panNumber: panNumber.trim().toUpperCase() || undefined,
        address: address.trim() || undefined,
        city: city.trim() || undefined,
        roles: selectedRoles,
        outletId: outletId ?? undefined,
      }
      if (!isEdit) payload.password = password
      if (isEdit) {
        await staffApi.update(staff!.id, payload)
        toast.success('Staff member updated')
      } else {
        await staffApi.create(payload)
        toast.success('Staff member created')
      }
      onDone()
    } catch (err: any) {
      const fieldErrors = err.response?.data?.errors ?? {}
      if (Object.keys(fieldErrors).length > 0) {
        setErrors(fieldErrors)
      } else {
        toast.error(err.response?.data?.message ?? 'Failed to save')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-7 py-4 border-b shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 text-xl font-bold shrink-0">
              {name ? name.charAt(0).toUpperCase() : <User size={22} />}
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
              <p className="text-xs text-gray-500 mt-0.5">{isEdit ? `Editing ${staff.name}` : 'Create a new staff account'}</p>
            </div>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="overflow-auto flex-1 px-7 py-5 space-y-5">

          {/* Name + Email */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Full Name <span className="text-red-500">*</span></label>
              <div className="relative">
                <User size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Rahul Sharma"
                  className={`w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none ${errors.name ? 'border-red-400' : 'border-gray-200'}`} />
              </div>
              {errors.name && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.name}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="rahul@example.com"
                  className={`w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none ${errors.email ? 'border-red-400' : 'border-gray-200'}`} />
              </div>
              {errors.email && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.email}</p>}
            </div>
          </div>

          {/* Phone + Secondary Phone */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+91 98765 43210"
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Secondary Phone</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="tel" value={secondaryPhone} onChange={e => setSecondaryPhone(e.target.value)} placeholder="Alternate number"
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Emergency Contact + PAN */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Emergency Contact</label>
              <div className="relative">
                <Phone size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="tel" value={emergencyContact} onChange={e => setEmergencyContact(e.target.value)} placeholder="Emergency contact number"
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">PAN Number</label>
              <div className="relative">
                <CreditCard size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={panNumber} onChange={e => setPanNumber(e.target.value.toUpperCase())} placeholder="ABCDE1234F"
                  maxLength={10}
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm font-mono tracking-wider uppercase focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Address + City */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Postal Address</label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-3 text-gray-400" />
                <textarea value={address} onChange={e => setAddress(e.target.value)} placeholder="House no., street, area…"
                  rows={2}
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none resize-none" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
              <div className="relative">
                <MapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input value={city} onChange={e => setCity(e.target.value)} placeholder="e.g. Mumbai"
                  className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Roles */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Roles <span className="text-red-500">*</span></label>
              <span className="text-xs text-gray-400">Select one or more</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {allRoles.map(r => {
                const active = selectedRoles.includes(r.value)
                return (
                  <button key={r.value} onClick={() => toggleRole(r.value)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl border text-left transition-colors ${
                      active ? 'border-primary-500 bg-primary-50' : 'border-gray-200 hover:border-gray-300'
                    }`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                      active ? 'bg-gradient-to-r from-violet-600 to-blue-600 border-primary-600' : 'border-gray-300'
                    }`}>
                      {active && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${r.color}`}>{r.label}</span>
                    {!r.isBuiltIn && (
                      <span className="ml-auto text-xs text-primary-400 font-medium">custom</span>
                    )}
                  </button>
                )
              })}
            </div>
            {selectedRoles.length > 0 && (
              <div className="mt-3 bg-gray-50 rounded-xl p-3">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Selected roles</p>
                <div className="flex flex-wrap gap-1.5">
                  {selectedRoles.map(rv => {
                    const found = allRoles.find(r => r.value === rv)
                    return (
                      <span key={rv} className={`text-xs px-2 py-0.5 rounded-full font-medium ${found?.color ?? 'bg-gray-100 text-gray-600'}`}>
                        {found?.label ?? rv}
                      </span>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Password */}
          {!isEdit && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} value={password}
                    onChange={e => setPassword(e.target.value)} placeholder="Minimum 6 characters"
                    className={`w-full border rounded-xl pl-9 pr-10 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none ${errors.password ? 'border-red-400' : 'border-gray-200'}`} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {errors.password && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.password}</p>}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password <span className="text-red-500">*</span></label>
                <div className="relative">
                  <Key size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter password"
                    className={`w-full border rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none ${errors.confirmPassword ? 'border-red-400' : 'border-gray-200'}`} />
                </div>
                {errors.confirmPassword && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.confirmPassword}</p>}
              </div>
            </div>
          )}
        </div>

        <div className="px-7 py-4 border-t flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={handleSubmit} disabled={loading}
            className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 size={15} className="animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Staff'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Reset Password Modal ──────────────────────────────────────────────────────

function ResetPasswordModal({ staff, onClose, onDone }: { staff: StaffMember; onClose: () => void; onDone: () => void }) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleReset() {
    if (!password) { setError('Password is required'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setError(''); setLoading(true)
    try {
      await staffApi.resetPassword(staff.id, password)
      toast.success(`Password reset for ${staff.name}`)
      onDone()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to reset password')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-bold text-gray-900 flex items-center gap-2"><Key size={18} className="text-primary-600" /> Reset Password</h3>
            <p className="text-xs text-gray-500 mt-0.5">For {staff.name}</p>
          </div>
          <button onClick={onClose}><X size={18} className="text-gray-400" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                placeholder="Minimum 6 characters"
                className="w-full border border-gray-300 rounded-lg px-3 py-2.5 pr-10 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
              <button type="button" onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
            <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="Re-enter new password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none" />
          </div>
          {error && <p className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} /> {error}</p>}
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={handleReset} disabled={loading}
            className="flex-1 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
            {loading && <Loader2 size={15} className="animate-spin" />} Reset Password
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Staff Card ────────────────────────────────────────────────────────────────

function StaffCard({ s, customRoles, onEdit, onResetPwd, onToggleActive }: {
  s: StaffMember; customRoles: any[]
  onEdit: () => void; onResetPwd: () => void; onToggleActive: () => void
}) {
  return (
    <div className={`bg-white border rounded-xl p-4 flex items-start gap-4 ${s.active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 ${s.active ? 'bg-primary-100 text-primary-600' : 'bg-gray-100 text-gray-400'}`}>
        {s.name?.charAt(0)?.toUpperCase() ?? <User size={20} />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-gray-900">{s.name ?? '—'}</span>
          {(s.roles ?? []).map(r => <RoleBadge key={r} role={r} customRoles={customRoles} />)}
          {!s.active && <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactive</span>}
        </div>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-gray-500"><Mail size={11} /> {s.email}</span>
          {s.phone && <span className="flex items-center gap-1 text-xs text-gray-500"><Phone size={11} /> {s.phone}</span>}
          {s.outletName && <span className="flex items-center gap-1 text-xs text-gray-500"><Building2 size={11} /> {s.outletName}</span>}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button onClick={onEdit} title="Edit" className="p-2 text-gray-400 hover:text-primary-600 rounded-lg hover:bg-gray-50 transition-colors"><Edit2 size={15} /></button>
        <button onClick={onResetPwd} title="Reset password" className="p-2 text-gray-400 hover:text-amber-600 rounded-lg hover:bg-gray-50 transition-colors"><Key size={15} /></button>
        <button onClick={onToggleActive} title={s.active ? 'Deactivate' : 'Activate'}
          className={`p-2 rounded-lg hover:bg-gray-50 transition-colors ${s.active ? 'text-green-500 hover:text-red-500' : 'text-gray-400 hover:text-green-500'}`}>
          {s.active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
        </button>
      </div>
    </div>
  )
}

// ─── Role / Designation ────────────────────────────────────────────────────────

const ROLE_COLORS = [
  { label: 'Green',   dot: 'bg-green-500',   value: 'bg-green-100 text-green-700'   },
  { label: 'Blue',    dot: 'bg-blue-500',    value: 'bg-blue-100 text-blue-700'     },
  { label: 'Purple',  dot: 'bg-purple-500',  value: 'bg-purple-100 text-purple-700' },
  { label: 'Violet',  dot: 'bg-violet-500',  value: 'bg-violet-100 text-violet-700' },
  { label: 'Teal',    dot: 'bg-teal-500',    value: 'bg-teal-100 text-teal-700'     },
  { label: 'Cyan',    dot: 'bg-cyan-500',    value: 'bg-cyan-100 text-cyan-700'     },
  { label: 'Rose',    dot: 'bg-rose-500',    value: 'bg-rose-100 text-rose-700'     },
  { label: 'Amber',   dot: 'bg-amber-500',   value: 'bg-amber-100 text-amber-700'   },
  { label: 'Lime',    dot: 'bg-lime-500',    value: 'bg-lime-100 text-lime-700'     },
  { label: 'Pink',    dot: 'bg-pink-500',    value: 'bg-pink-100 text-pink-700'     },
  { label: 'Orange',  dot: 'bg-orange-500',  value: 'bg-orange-100 text-orange-700' },
  { label: 'Slate',   dot: 'bg-slate-400',   value: 'bg-slate-100 text-slate-700'   },
]

function RoleDesignationModal({ role, onClose, onDone }: {
  role: any | null; onClose: () => void; onDone: () => void
}) {
  const isEdit = !!role
  const qc = useQueryClient()
  const [displayName, setDisplayName] = useState(role?.displayName ?? '')
  const [name, setName]               = useState(role?.name ?? '')
  const [color, setColor]             = useState(role?.color ?? ROLE_COLORS[0].value)
  const [permissions, setPermissions] = useState<string[]>(() => {
    if (!role?.permissions) return []
    try { return typeof role.permissions === 'string' ? JSON.parse(role.permissions) : role.permissions }
    catch { return [] }
  })
  const [loading, setLoading]         = useState(false)
  const [errors, setErrors]           = useState<Record<string, string>>({})
  const [nameEdited, setNameEdited]   = useState(isEdit)

  // Auto-generate role key from display name
  useEffect(() => {
    if (!nameEdited && displayName) {
      setName(displayName.trim().toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''))
    }
  }, [displayName, nameEdited])

  // Escape to close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  function togglePermission(key: string) {
    setPermissions(prev => prev.includes(key) ? prev.filter(p => p !== key) : [...prev, key])
  }
  function toggleGroup(keys: string[]) {
    const allOn = keys.every(k => permissions.includes(k))
    setPermissions(prev => allOn ? prev.filter(p => !keys.includes(p)) : [...new Set([...prev, ...keys])])
  }

  async function handleSubmit() {
    const e: Record<string, string> = {}
    if (!displayName.trim()) e.displayName = 'Display name is required'
    if (!name.trim()) e.name = 'Role key is required'
    setErrors(e)
    if (Object.keys(e).length) return
    setLoading(true)
    try {
      const payload = {
        name: name.trim(),
        displayName: displayName.trim(),
        color: color || null,
        permissions: JSON.stringify(permissions),
      }
      if (isEdit) { await rolesApi.update(role.id, payload); toast.success('Role updated') }
      else        { await rolesApi.create(payload);           toast.success('Role created') }
      qc.invalidateQueries({ queryKey: ['custom-roles'] })
      onDone()
    } catch (err: any) {
      toast.error(err.response?.data?.message ?? 'Failed to save role')
    } finally { setLoading(false) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b shrink-0">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{isEdit ? 'Edit Role / Designation' : 'New Role / Designation'}</h2>
            <p className="text-xs text-gray-500 mt-0.5">Define a custom role and its access permissions</p>
          </div>
          <button onClick={onClose}><X size={20} className="text-gray-400 hover:text-gray-600" /></button>
        </div>

        <div className="overflow-auto flex-1 px-6 py-5 space-y-5">
          {/* Display name + Role key */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name <span className="text-red-500">*</span></label>
              <input value={displayName} onChange={e => setDisplayName(e.target.value)}
                placeholder="e.g. Supervisor"
                className={`w-full border rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none ${errors.displayName ? 'border-red-400' : 'border-gray-200'}`} />
              {errors.displayName && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.displayName}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Role Key <span className="text-red-500">*</span></label>
              <input value={name}
                onChange={e => { setName(e.target.value.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '')); setNameEdited(true) }}
                placeholder="e.g. SUPERVISOR"
                className={`w-full border rounded-xl px-3 py-2.5 text-sm font-mono tracking-wide focus:ring-2 focus:ring-violet-400 focus:outline-none ${errors.name ? 'border-red-400' : 'border-gray-200'}`} />
              <p className="text-xs text-gray-400 mt-1">Auto-generated from display name. Used internally.</p>
              {errors.name && <p className="text-xs text-red-500 mt-1 flex items-center gap-1"><AlertCircle size={11} />{errors.name}</p>}
            </div>
          </div>

          {/* Badge color */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Badge Color</label>
            <div className="flex flex-wrap gap-2">
              {ROLE_COLORS.map(c => (
                <button key={c.value} onClick={() => setColor(c.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-all ${c.value} ${
                    color === c.value ? 'border-violet-500 ring-2 ring-violet-300 shadow-sm' : 'border-transparent hover:border-gray-300'
                  }`}>
                  {color === c.value && <Check size={11} />}
                  {c.label}
                </button>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-400">Preview:</span>
              <span className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${color}`}>{displayName || 'Role Name'}</span>
            </div>
          </div>

          {/* Permissions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Permissions</label>
              <span className="text-xs text-gray-400">{permissions.length} of {PERMISSION_GROUPS.flatMap(g => g.items).length} selected</span>
            </div>
            <div className="space-y-2">
              {PERMISSION_GROUPS.map(group => {
                const keys = group.items.map(i => i.key)
                const allOn  = keys.every(k => permissions.includes(k))
                const someOn = keys.some(k => permissions.includes(k))
                return (
                  <div key={group.group} className="border border-gray-100 rounded-xl overflow-hidden">
                    {/* Group header — click to toggle all */}
                    <button onClick={() => toggleGroup(keys)}
                      className={`w-full flex items-center justify-between px-4 py-2.5 text-left transition-colors ${
                        allOn ? 'bg-violet-50' : someOn ? 'bg-violet-50/40' : 'bg-gray-50'
                      }`}>
                      <span className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                        <span>{group.icon}</span>{group.group}
                      </span>
                      <span className={`text-xs font-normal ${allOn ? 'text-violet-600' : 'text-gray-400'}`}>
                        {keys.filter(k => permissions.includes(k)).length}/{keys.length}
                      </span>
                    </button>
                    <div className="grid grid-cols-2 gap-1 p-2 bg-white">
                      {group.items.map(item => {
                        const on = permissions.includes(item.key)
                        return (
                          <button key={item.key} onClick={() => togglePermission(item.key)}
                            className={`flex items-start gap-2 p-2 rounded-lg text-left transition-colors ${on ? 'bg-violet-50' : 'hover:bg-gray-50'}`}>
                            <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                              on ? 'bg-gradient-to-r from-violet-600 to-blue-600 border-violet-600' : 'border-gray-300'
                            }`}>
                              {on && <Check size={10} className="text-white" strokeWidth={3} />}
                            </div>
                            <div>
                              <p className={`text-xs font-medium ${on ? 'text-violet-700' : 'text-gray-700'}`}>{item.label}</p>
                              <p className="text-[11px] text-gray-400 mt-0.5">{item.desc}</p>
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
        </div>

        <div className="px-6 py-4 border-t flex gap-3 shrink-0">
          <button onClick={onClose} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium hover:bg-gray-50">Cancel</button>
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

function RolesContent({ onNew, onEdit }: { onNew: () => void; onEdit: (role: any) => void }) {
  const qc = useQueryClient()
  const { data: customRoles = [], isLoading } = useQuery({
    queryKey: ['custom-roles'],
    queryFn: () => rolesApi.getAll().then(r => r.data.data ?? []),
  })

  async function deleteRole(id: number) {
    if (!window.confirm('Delete this role? Staff assigned to it will lose this designation.')) return
    try {
      await rolesApi.delete(id); toast.success('Role deleted')
      qc.invalidateQueries({ queryKey: ['custom-roles'] })
    } catch { toast.error('Failed to delete role') }
  }

  const allPermItems = PERMISSION_GROUPS.flatMap(g => g.items)

  function parsePerms(raw: any): string[] {
    if (!raw) return []
    if (Array.isArray(raw)) return raw
    try { return JSON.parse(raw) } catch { return [] }
  }

  return (
    <div className="space-y-5">
      {/* System / built-in roles */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-blue-500 px-5 py-3.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-white flex items-center gap-2">
            <Shield size={15} /> System Roles
          </span>
          <span className="text-xs text-white/60">Read-only · Cannot be modified</span>
        </div>
        <div className="p-4 space-y-3">
          {BUILT_IN_ROLES.filter(r => r.value !== 'SUPER_ADMIN').map(r => (
            <div key={r.value} className="flex items-start gap-4 px-4 py-3 rounded-xl bg-gray-50/60 border border-gray-100">
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 mt-0.5 min-w-[72px] text-center ${r.color}`}>{r.label}</span>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap gap-1.5">
                  {r.permissions.map(p => {
                    const item = allPermItems.find(i => i.key === p)
                    return item ? (
                      <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">{item.label}</span>
                    ) : null
                  })}
                </div>
              </div>
              <span className="text-xs text-gray-400 shrink-0 mt-1">{r.permissions.length} permissions</span>
            </div>
          ))}
        </div>
      </div>

      {/* Custom roles */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-blue-500 px-5 py-3.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-white flex items-center gap-2">
            <Star size={15} /> Custom Roles / Designations
          </span>
          <button onClick={onNew}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/20 hover:bg-white/30 text-white text-xs font-semibold rounded-lg transition-colors">
            <Plus size={13} /> New Role
          </button>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-10 text-gray-400">
              <Loader2 size={20} className="animate-spin mr-2" /> Loading…
            </div>
          ) : (customRoles as any[]).length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-300">
              <Star size={40} className="mb-3" />
              <p className="text-sm text-gray-400 font-medium">No custom roles yet</p>
              <p className="text-xs text-gray-400 mt-1">Create roles specific to your organisation</p>
              <button onClick={onNew}
                className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-violet-600 to-blue-600 text-white text-sm font-medium rounded-xl hover:from-violet-700 hover:to-blue-700 transition-all">
                <Plus size={14} /> Create First Role
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {(customRoles as any[]).map(r => (
                <div key={r.id} className="flex items-start gap-4 px-4 py-3 rounded-xl bg-gray-50/60 border border-gray-100">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold shrink-0 mt-0.5 min-w-[72px] text-center ${r.color ?? 'bg-gray-100 text-gray-700'}`}>{r.displayName}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-mono text-gray-400 mb-1.5">{r.name}</p>
                    <div className="flex flex-wrap gap-1.5">
                      {parsePerms(r.permissions).length === 0 ? (
                        <span className="text-xs text-gray-400 italic">No permissions assigned</span>
                      ) : parsePerms(r.permissions).map(p => {
                        const item = allPermItems.find(i => i.key === p)
                        return item ? (
                          <span key={p} className="text-xs px-2 py-0.5 rounded-full bg-white border border-gray-200 text-gray-600">{item.label}</span>
                        ) : null
                      })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-gray-400 mr-1">{parsePerms(r.permissions).length} perms</span>
                    <button onClick={() => onEdit(r)} className="p-2 text-gray-400 hover:text-violet-600 rounded-lg hover:bg-violet-50 transition-colors">
                      <Edit2 size={14} />
                    </button>
                    <button onClick={() => deleteRole(r.id)} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Staff Tab ─────────────────────────────────────────────────────────────────

function StaffTab() {
  const qc = useQueryClient()
  const { outletId } = useAuthStore()
  const [activeTab, setActiveTab]     = useState<'staff' | 'roles'>('staff')
  const [search, setSearch]           = useState('')
  const [roleFilter, setRoleFilter]   = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [showModal, setShowModal]     = useState(false)
  const [editTarget, setEditTarget]   = useState<StaffMember | null>(null)
  const [resetTarget, setResetTarget] = useState<StaffMember | null>(null)
  const [showRoleModal, setShowRoleModal] = useState(false)
  const [editRole, setEditRole]       = useState<any>(null)

  const { data: staffList = [], isLoading } = useQuery({
    queryKey: ['staff-all', outletId],
    queryFn: () => (outletId ? staffApi.getByOutlet(outletId) : staffApi.getAll()).then(r => r.data.data ?? []),
  })

  const { data: customRoles = [] } = useQuery({
    queryKey: ['custom-roles'],
    queryFn: () => rolesApi.getAll().then(r => r.data.data ?? []),
    staleTime: 60_000,
  })

  async function toggleActive(s: StaffMember) {
    try {
      await staffApi.toggleActive(s.id)
      toast.success(s.active ? `${s.name} deactivated` : `${s.name} activated`)
      qc.invalidateQueries({ queryKey: ['staff-all'] })
      qc.invalidateQueries({ queryKey: ['staff-list'] })
    } catch { toast.error('Failed to update status') }
  }

  const allRoleOptions = [
    ...BUILT_IN_ROLES.map(r => ({ value: r.value, label: r.label })),
    ...(customRoles as any[]).map(r => ({ value: r.name, label: r.displayName })),
  ]

  const staffArr = staffList as StaffMember[]
  const activeCount = staffArr.filter(s => s.active).length
  const inactiveCount = staffArr.length - activeCount
  const rolesInUse = new Set(staffArr.flatMap(s => s.roles ?? [])).size

  const filtered = staffArr.filter(s => {
    const matchSearch = !search ||
      (s.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (s.email ?? '').toLowerCase().includes(search.toLowerCase()) ||
      s.phone?.includes(search)
    const matchRole = roleFilter === 'ALL' || (s.roles ?? []).includes(roleFilter)
    const matchStatus = statusFilter === 'ALL' ||
      (statusFilter === 'ACTIVE' && s.active) ||
      (statusFilter === 'INACTIVE' && !s.active)
    return matchSearch && matchRole && matchStatus
  })

  const statStrip = [
    { label: 'Total Staff',  value: staffArr.length },
    { label: 'Active',       value: activeCount,   cls: 'text-emerald-300' },
    { label: 'Inactive',     value: inactiveCount, cls: inactiveCount > 0 ? 'text-amber-300' : undefined },
    { label: 'Roles in Use', value: rolesInUse },
  ]

  return (
    <>
      {/* ── Hero ── */}
      <div className="bg-gradient-to-br from-violet-700 via-violet-600 to-blue-600 rounded-2xl shadow-[0_8px_40px_rgba(109,40,217,0.30)] overflow-hidden">
        <div className="px-6 pt-6 pb-4 flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0">
              <Users size={24} className="text-amber-300" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white leading-tight">Staff Management</h1>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <p className="text-sm text-white/60">Manage accounts · Assign roles · Control access</p>
                <div className="w-px h-4 bg-white/20 shrink-0 hidden sm:block" />
                {([
                  { key: 'staff', label: 'Staff Members',      icon: <Users size={13} /> },
                  { key: 'roles', label: 'Role / Designation',  icon: <Shield size={13} /> },
                ] as const).map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    className={`flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-xl border transition-colors whitespace-nowrap ${
                      activeTab === t.key
                        ? 'bg-white text-violet-700 border-white shadow-sm'
                        : 'border-white/30 text-white/80 hover:text-white hover:bg-white/10'
                    }`}>
                    {t.icon}{t.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
          {activeTab === 'staff' && (
            <button onClick={() => { setEditTarget(null); setShowModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-amber-900 text-sm font-bold rounded-xl transition-colors shrink-0 mt-1">
              <Plus size={15} /> Add Staff Member
            </button>
          )}
          {activeTab === 'roles' && (
            <button onClick={() => { setEditRole(null); setShowRoleModal(true) }}
              className="flex items-center gap-2 px-4 py-2 bg-amber-400 hover:bg-amber-300 text-amber-900 text-sm font-bold rounded-xl transition-colors shrink-0 mt-1">
              <Plus size={15} /> New Role / Designation
            </button>
          )}
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-4 divide-x divide-white/10 border-t border-white/10 mt-2">
          {statStrip.map(st => (
            <div key={st.label} className="px-5 py-3 text-center">
              <p className={`text-xl font-bold ${st.cls ?? 'text-white'}`}>{st.value}</p>
              <p className="text-xs text-white/50 mt-0.5">{st.label}</p>
            </div>
          ))}
        </div>
      </div>

      {activeTab === 'roles' && (
        <RolesContent
          onNew={() => { setEditRole(null); setShowRoleModal(true) }}
          onEdit={r => { setEditRole(r); setShowRoleModal(true) }}
        />
      )}

      {activeTab === 'staff' && <>

      {/* ── Filters ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-3 flex-wrap">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by name, email or phone…"
            className="pl-9 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:ring-2 focus:ring-violet-400 focus:outline-none w-64" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          <button onClick={() => setRoleFilter('ALL')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${roleFilter === 'ALL' ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
            All Roles
          </button>
          {allRoleOptions.map(r => (
            <button key={r.value} onClick={() => setRoleFilter(r.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${roleFilter === r.value ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
              {r.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5 ml-auto">
          {[{ key: 'ALL', label: 'All' }, { key: 'ACTIVE', label: 'Active' }, { key: 'INACTIVE', label: 'Inactive' }].map(s => (
            <button key={s.key} onClick={() => setStatusFilter(s.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${statusFilter === s.key ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'}`}>
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Staff List ── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-violet-600 to-blue-500 px-5 py-3.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-white flex items-center gap-2">
            <Users size={15} /> Staff Members
          </span>
          <span className="text-xs text-white/70">{filtered.length} {filtered.length === 1 ? 'member' : 'members'}</span>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-16 text-gray-400"><Loader2 size={24} className="animate-spin mr-2" /> Loading staff…</div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <User size={40} className="mb-3" />
              <p className="text-sm text-gray-400">{search || roleFilter !== 'ALL' || statusFilter !== 'ALL' ? 'No staff match your filters' : 'No staff members yet'}</p>
              {!search && roleFilter === 'ALL' && statusFilter === 'ALL' && (
                <button onClick={() => { setEditTarget(null); setShowModal(true) }}
                  className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 text-white text-sm font-medium rounded-xl">
                  <Plus size={15} /> Add First Staff Member
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map(s => (
                <StaffCard key={s.id} s={s} customRoles={customRoles as any[]}
                  onEdit={() => { setEditTarget(s); setShowModal(true) }}
                  onResetPwd={() => setResetTarget(s)}
                  onToggleActive={() => toggleActive(s)} />
              ))}
            </div>
          )}
        </div>
      </div>

      </> /* end activeTab === 'staff' */ }

      {showModal && (
        <StaffModal staff={editTarget} onClose={() => setShowModal(false)}
          onDone={() => { setShowModal(false); qc.invalidateQueries({ queryKey: ['staff-all'] }); qc.invalidateQueries({ queryKey: ['staff-list'] }) }} />
      )}
      {resetTarget && (
        <ResetPasswordModal staff={resetTarget} onClose={() => setResetTarget(null)} onDone={() => setResetTarget(null)} />
      )}
      {showRoleModal && (
        <RoleDesignationModal
          role={editRole}
          onClose={() => { setShowRoleModal(false); setEditRole(null) }}
          onDone={() => { setShowRoleModal(false); setEditRole(null) }}
        />
      )}
    </>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function StaffPage() {
  return (
    <div className="min-h-screen bg-gray-50/60 p-6 space-y-6">
      <StaffTab />
    </div>
  )
}
