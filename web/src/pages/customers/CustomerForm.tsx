import { useState, useRef, useEffect } from 'react'
import { X, Loader2, ChevronDown, Plus, PlusCircle, MapPin } from 'lucide-react'
import toast from 'react-hot-toast'
import { customerApi } from '@/services/api'
import { Customer } from '@/types'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'

interface Props {
  customer: Customer | null
  onClose: () => void
  onSaved: () => void
}

type Errors = Partial<Record<string, string>>

// ─── Country codes ────────────────────────────────────────────────────────────
const COUNTRIES = [
  { code: '+91',  flag: '🇮🇳', name: 'India' },
  { code: '+1',   flag: '🇺🇸', name: 'USA / Canada' },
  { code: '+44',  flag: '🇬🇧', name: 'UK' },
  { code: '+61',  flag: '🇦🇺', name: 'Australia' },
  { code: '+971', flag: '🇦🇪', name: 'UAE' },
  { code: '+966', flag: '🇸🇦', name: 'Saudi Arabia' },
  { code: '+65',  flag: '🇸🇬', name: 'Singapore' },
  { code: '+60',  flag: '🇲🇾', name: 'Malaysia' },
  { code: '+977', flag: '🇳🇵', name: 'Nepal' },
  { code: '+94',  flag: '🇱🇰', name: 'Sri Lanka' },
  { code: '+880', flag: '🇧🇩', name: 'Bangladesh' },
  { code: '+92',  flag: '🇵🇰', name: 'Pakistan' },
  { code: '+49',  flag: '🇩🇪', name: 'Germany' },
  { code: '+33',  flag: '🇫🇷', name: 'France' },
  { code: '+81',  flag: '🇯🇵', name: 'Japan' },
  { code: '+86',  flag: '🇨🇳', name: 'China' },
  { code: '+55',  flag: '🇧🇷', name: 'Brazil' },
  { code: '+27',  flag: '🇿🇦', name: 'South Africa' },
  { code: '+254', flag: '🇰🇪', name: 'Kenya' },
  { code: '+234', flag: '🇳🇬', name: 'Nigeria' },
]

// ─── Phone field with inline country code dropdown ────────────────────────────
function PhoneField({ label = 'Phone *', dialCode, onDialChange, phone, onPhoneChange, error, touched, onBlur }: {
  label?: string
  dialCode: string
  onDialChange: (code: string) => void
  phone: string
  onPhoneChange: (v: string) => void
  error?: string
  touched?: boolean
  onBlur?: () => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const selected = COUNTRIES.find(c => c.code === dialCode) ?? COUNTRIES[0]
  const filtered = search
    ? COUNTRIES.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.code.includes(search))
    : COUNTRIES
  const hasErr = touched && error

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <div className={`flex border rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-primary-500 ${hasErr ? 'border-red-400' : 'border-gray-300'}`} ref={ref}>
        {/* Dial code button */}
        <button
          type="button"
          onClick={() => { setOpen(o => !o); setSearch('') }}
          className="flex items-center gap-1 px-3 py-2 bg-gray-50 border-r border-gray-300 hover:bg-gray-100 shrink-0 text-sm font-medium text-gray-700 select-none"
        >
          <span className="text-base leading-none">{selected.flag}</span>
          <span>{selected.code}</span>
          <ChevronDown size={13} className="text-gray-400" />
        </button>

        {/* Number input */}
        <input
          type="tel"
          value={phone}
          onChange={e => onPhoneChange(e.target.value.replace(/\D/g, ''))}
          onBlur={onBlur}
          placeholder="9876543210"
          maxLength={15}
          className="flex-1 px-3 py-2 text-sm outline-none bg-white"
        />

        {/* Dropdown */}
        {open && (
          <div className="absolute z-50 mt-10 w-72 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden"
            style={{ top: 'auto' }}>
            <div className="p-2 border-b">
              <input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search country..."
                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400"
              />
            </div>
            <ul className="max-h-52 overflow-auto">
              {filtered.map(c => (
                <li key={c.code}>
                  <button
                    type="button"
                    onClick={() => { onDialChange(c.code); setOpen(false); setSearch('') }}
                    className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-primary-50 text-left ${c.code === dialCode ? 'bg-primary-50 font-semibold' : ''}`}
                  >
                    <span className="text-base">{c.flag}</span>
                    <span className="flex-1 text-gray-800">{c.name}</span>
                    <span className="text-gray-400 font-mono">{c.code}</span>
                  </button>
                </li>
              ))}
              {filtered.length === 0 && (
                <li className="px-4 py-3 text-sm text-gray-400 text-center">No results</li>
              )}
            </ul>
          </div>
        )}
      </div>
      {hasErr && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  )
}

// ─── Validators ───────────────────────────────────────────────────────────────
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const GSTIN_RE = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/

function validatePhone(phone: string, dialCode: string, required = false): string | undefined {
  if (!phone.trim()) return required ? 'Phone is required' : undefined
  const digits = phone.replace(/\D/g, '')
  if (dialCode === '+91' && !/^[6-9]\d{9}$/.test(digits)) return 'Enter a valid 10-digit Indian mobile number'
  if (digits.length < 6) return 'Phone number too short'
  return undefined
}

function validate(form: any, dialCode: string, dialCode2: string): Errors {
  const e: Errors = {}
  if (!form.name.trim()) e.name = 'Name is required'
  else if (form.name.trim().length < 2) e.name = 'Name must be at least 2 characters'

  const phoneErr = validatePhone(form.phone, dialCode, true)
  if (phoneErr) e.phone = phoneErr

  const phone2Err = validatePhone(form.phone2, dialCode2, false)
  if (phone2Err) e.phone2 = phone2Err

  if (form.email && !EMAIL_RE.test(form.email)) e.email = 'Enter a valid email address'
  if (form.gstin && !GSTIN_RE.test(form.gstin.toUpperCase())) e.gstin = 'Invalid GSTIN (e.g. 27AABCU9603R1ZX)'
  if (form.creditLimit < 0) e.creditLimit = 'Cannot be negative'
  if (form.discountPercent < 0 || form.discountPercent > 100) e.discountPercent = 'Must be between 0 and 100'
  return e
}

// ─── Generic field ────────────────────────────────────────────────────────────
function Field({ label, name, type = 'text', form, setForm, errors, touched, onBlur, ...props }: any) {
  const err = touched?.[name] && errors?.[name]
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        value={(form as any)[name]}
        onChange={(e) => {
          const val = type === 'number' ? (e.target.value === '' ? '' : parseFloat(e.target.value)) : e.target.value
          setForm({ ...form, [name]: val })
        }}
        onBlur={() => onBlur?.(name)}
        className={`w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:outline-none ${
          err ? 'border-red-400 focus:ring-red-300' : 'border-gray-300 focus:ring-primary-500'
        }`}
        {...props}
      />
      {err && <p className="mt-1 text-xs text-red-500">{err}</p>}
    </div>
  )
}

// ─── Site address types ───────────────────────────────────────────────────────
interface SiteAddress {
  label: string
  address: string
  city: string
  state: string
  pincode: string
}

const emptySite = (): SiteAddress => ({ label: '', address: '', city: '', state: '', pincode: '' })

function parseSites(raw: any): SiteAddress[] {
  if (!raw) return []
  if (Array.isArray(raw)) return raw
  try { return JSON.parse(raw) } catch { return [] }
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CustomerForm({ customer, onClose, onSaved }: Props) {
  // Parse existing phone: split dial code from number if stored as +91XXXXXXXXXX
  const parsePhone = (raw: string) => {
    if (!raw) return { dialCode: '+91', phone: '' }
    const match = COUNTRIES.find(c => raw.startsWith(c.code))
    if (match) return { dialCode: match.code, phone: raw.slice(match.code.length) }
    return { dialCode: '+91', phone: raw }
  }
  const parsed = parsePhone(customer?.phone || '')
  const parsed2 = parsePhone(customer?.phone2 || '')

  const [form, setForm] = useState({
    name: customer?.name || '',
    email: customer?.email || '',
    address: customer?.address || '',
    city: customer?.city || '',
    state: customer?.state || '',
    gstin: customer?.gstin || '',
    creditLimit: customer?.creditLimit || 0,
    discountPercent: customer?.discountPercent || 0,
    phone: parsed.phone,
    phone2: parsed2.phone,
  })
  const [siteAddresses, setSiteAddresses] = useState<SiteAddress[]>(() => parseSites((customer as any)?.siteAddresses))
  const [dialCode, setDialCode] = useState(parsed.dialCode)
  const [dialCode2, setDialCode2] = useState(parsed2.dialCode)
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  const [loading, setLoading] = useState(false)
  const [isDirty, setIsDirty] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const mountedRef = useRef(false)
  useEffect(() => {
    if (!mountedRef.current) { mountedRef.current = true; return }
    setIsDirty(true)
  }, [form, siteAddresses])
  const { isBlocked, confirmLeave, cancelLeave } = useUnsavedChanges(isDirty)

  const errors = validate(form, dialCode, dialCode2)
  const hasErrors = Object.keys(errors).length > 0

  const touch = (name: string) => setTouched(t => ({ ...t, [name]: true }))
  const touchAll = () => setTouched(Object.fromEntries([...Object.keys(form), 'phone', 'phone2'].map(k => [k, true])))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    touchAll()
    if (hasErrors) return
    const invalidPincode = siteAddresses.some(
      s => s.pincode.trim() !== '' && !/^\d{6}$/.test(s.pincode.trim())
    )
    if (invalidPincode) {
      toast.error('Site address pincode must be a 6-digit number')
      return
    }
    setLoading(true)
    try {
      const payload = {
        ...form,
        phone: dialCode + form.phone,
        phone2: form.phone2 ? dialCode2 + form.phone2 : '',
        siteAddresses,
      }
      if (customer) {
        await customerApi.update(customer.id, payload)
        toast.success('Customer updated')
      } else {
        await customerApi.create(payload)
        toast.success('Customer created')
      }
      onSaved()
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  const fp = { form, setForm, errors, touched, onBlur: touch }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold">{customer ? 'Edit Customer' : 'Add Customer'}</h2>
          <button onClick={() => isDirty ? setShowConfirm(true) : onClose()}><X size={20} className="text-gray-400" /></button>
        </div>
        <form onSubmit={handleSubmit} noValidate className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Name *" name="name" {...fp} />
            <div className="relative">
              <PhoneField
                dialCode={dialCode}
                onDialChange={setDialCode}
                phone={form.phone}
                onPhoneChange={v => setForm(f => ({ ...f, phone: v }))}
                error={errors.phone}
                touched={touched.phone}
                onBlur={() => touch('phone')}
              />
            </div>
          </div>
          <div className="relative">
            <PhoneField
              label="Secondary Phone"
              dialCode={dialCode2}
              onDialChange={setDialCode2}
              phone={form.phone2}
              onPhoneChange={v => setForm(f => ({ ...f, phone2: v }))}
              error={errors.phone2}
              touched={touched.phone2}
              onBlur={() => touch('phone2')}
            />
          </div>
          <Field label="Email" name="email" type="email" placeholder="customer@email.com" {...fp} />
          <Field label="Address" name="address" {...fp} />
          <div className="grid grid-cols-2 gap-4">
            <Field label="City" name="city" {...fp} />
            <Field label="State" name="state" {...fp} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="GSTIN (B2B)" name="gstin" placeholder="27AABCU9603R1ZX" {...fp} />
            <Field label="Credit Limit (₹)" name="creditLimit" type="number" step="0.01" min="0" {...fp} />
          </div>
          <Field label="Discount %" name="discountPercent" type="number" step="0.1" min="0" max="100" {...fp} />

          {/* ── Site / Delivery Addresses ── */}
          <div className="border-t border-dashed border-gray-200 pt-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-sm font-semibold text-gray-700">Site / Delivery Addresses</p>
                <p className="text-xs text-gray-400 mt-0.5">Add multiple project or delivery sites for this customer</p>
              </div>
              <button type="button" onClick={() => setSiteAddresses(s => [...s, emptySite()])}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-violet-600 border border-violet-200 bg-violet-50 hover:bg-violet-100 rounded-lg transition-colors">
                <PlusCircle size={13} /> Add Site
              </button>
            </div>

            {siteAddresses.length === 0 ? (
              <button type="button" onClick={() => setSiteAddresses([emptySite()])}
                className="w-full border-2 border-dashed border-gray-200 rounded-xl py-4 text-sm text-gray-400 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50/40 transition-all flex items-center justify-center gap-2">
                <PlusCircle size={15} /> Click to add a site address
              </button>
            ) : (
              <div className="space-y-3">
                {siteAddresses.map((site, i) => (
                  <div key={i} className="relative border border-gray-200 rounded-xl p-4 bg-gray-50/50 space-y-3">
                    <button type="button" onClick={() => setSiteAddresses(s => s.filter((_, idx) => idx !== i))}
                      className="absolute top-3 right-3 w-6 h-6 rounded-full bg-red-50 border border-red-200 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors">
                      <X size={11} />
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-full bg-violet-100 text-violet-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <input type="text" value={site.label}
                        onChange={e => setSiteAddresses(s => s.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))}
                        placeholder="Site label (e.g. Main Site, Warehouse, Project A)"
                        className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:ring-2 focus:ring-violet-300 focus:outline-none bg-white" />
                    </div>
                    <input type="text" value={site.address}
                      onChange={e => setSiteAddresses(s => s.map((x, idx) => idx === i ? { ...x, address: e.target.value } : x))}
                      placeholder="Street / Plot / Survey address"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-violet-300 focus:outline-none bg-white" />
                    <div className="grid grid-cols-3 gap-2">
                      {(['city', 'state', 'pincode'] as const).map(field => (
                        <input key={field} type="text" value={site[field]}
                          onChange={e => setSiteAddresses(s => s.map((x, idx) => idx === i ? { ...x, [field]: e.target.value } : x))}
                          placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-violet-300 focus:outline-none bg-white" />
                      ))}
                    </div>
                  </div>
                ))}
                <button type="button" onClick={() => setSiteAddresses(s => [...s, emptySite()])}
                  className="w-full border border-dashed border-gray-300 rounded-xl py-2.5 text-xs font-medium text-gray-400 hover:border-violet-300 hover:text-violet-500 hover:bg-violet-50/40 transition-all flex items-center justify-center gap-1.5">
                  <Plus size={13} /> Add another site
                </button>
              </div>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={() => isDirty ? setShowConfirm(true) : onClose()}
              className="flex-1 border border-gray-300 py-2.5 rounded-lg font-medium text-sm hover:bg-gray-50">
              Cancel
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 text-white py-2.5 rounded-lg font-medium text-sm flex items-center justify-center gap-2">
              {loading && <Loader2 size={16} className="animate-spin" />}
              {customer ? 'Update' : 'Create'} Customer
            </button>
          </div>
        </form>
      </div>
      <UnsavedChangesDialog open={showConfirm} onConfirm={onClose} onCancel={() => setShowConfirm(false)} />
      <UnsavedChangesDialog open={isBlocked} onConfirm={confirmLeave} onCancel={cancelLeave} />
    </div>
  )
}
