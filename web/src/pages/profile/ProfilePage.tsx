import { useState, useEffect } from 'react'
import {
  User, Mail, Phone, Building2, Shield, Clock,
  Pencil, Save, X, KeyRound, BadgeCheck, Hash,
  Percent, Loader2, ChevronLeft,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { profileApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'
import toast from 'react-hot-toast'
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges'
import { UnsavedChangesDialog } from '@/components/UnsavedChangesDialog'

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-orange-100 text-orange-700 border-orange-200',
  ADMIN:       'bg-red-100 text-red-700 border-red-200',
  MANAGER:     'bg-purple-100 text-purple-700 border-purple-200',
  CASHIER:     'bg-blue-100 text-blue-700 border-blue-200',
  ACCOUNTANT:  'bg-green-100 text-green-700 border-green-200',
}

function Field({ icon, label, value }: { icon: React.ReactNode; label: string; value?: string | null }) {
  return (
    <div className="flex items-start gap-3 py-3.5 border-b border-gray-100 last:border-0">
      <span className="mt-0.5 text-gray-400 shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-400 uppercase tracking-wide font-medium mb-0.5">{label}</p>
        <p className="text-sm text-gray-900 font-medium">{value || <span className="text-gray-300 font-normal">—</span>}</p>
      </div>
    </div>
  )
}

export default function ProfilePage() {
  const navigate = useNavigate()
  const { user: authUser } = useAuthStore()

  const [profile, setProfile]   = useState<any>(null)
  const [loading, setLoading]   = useState(true)
  const [editing, setEditing]   = useState(false)
  const [saving, setSaving]     = useState(false)
  const [showPw, setShowPw]     = useState(false)

  const [form, setForm] = useState({ name: '', phone: '' })
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' })
  const [isDirty, setIsDirty] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const { isBlocked: ppIsBlocked, confirmLeave: ppConfirmLeave, cancelLeave: ppCancelLeave } = useUnsavedChanges(isDirty && editing)

  const initials = profile?.name
    ? profile.name.split(' ').map((w: string) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  useEffect(() => {
    profileApi.get()
      .then(r => {
        const d = r.data.data
        setProfile(d)
        setForm({ name: d.name ?? '', phone: d.phone ?? '' })
      })
      .catch(() => toast.error('Failed to load profile'))
      .finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    if (!form.name.trim()) { toast.error('Name is required'); return }
    const ph = form.phone.trim()
    if (ph) {
      const validIndian = /^[6-9]\d{9}$/.test(ph)
      const validGeneric = /^\d{6,15}$/.test(ph)
      if (!validIndian && !validGeneric) {
        toast.error('Enter a valid phone number (10 digits for Indian numbers)')
        return
      }
    }
    setSaving(true)
    try {
      const res = await profileApi.update(form)
      setProfile(res.data.data)
      setEditing(false)
      setIsDirty(false)
      toast.success('Profile updated')
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Failed to update profile')
    } finally { setSaving(false) }
  }

  const handleCancel = () => {
    if (isDirty) { setShowConfirm(true); return }
    setForm({ name: profile?.name ?? '', phone: profile?.phone ?? '' })
    setEditing(false)
    setIsDirty(false)
  }

  const doCancel = () => {
    setForm({ name: profile?.name ?? '', phone: profile?.phone ?? '' })
    setEditing(false)
    setIsDirty(false)
    setShowConfirm(false)
  }

  const handlePasswordChange = async () => {
    if (!pwForm.current)              { toast.error('Enter current password'); return }
    if (pwForm.newPw.length < 6)      { toast.error('New password must be at least 6 characters'); return }
    if (pwForm.newPw !== pwForm.confirm) { toast.error('Passwords do not match'); return }
    setSaving(true)
    try {
      await profileApi.update({ currentPassword: pwForm.current, newPassword: pwForm.newPw })
      setPwForm({ current: '', newPw: '', confirm: '' })
      setShowPw(false)
      toast.success('Password changed successfully')
    } catch (e: any) {
      toast.error(e.response?.data?.message ?? 'Incorrect current password')
    } finally { setSaving(false) }
  }

  const fmt = (dt: string) => {
    if (!dt) return null
    return new Date(dt).toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-gray-300" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 transition-colors">
          <ChevronLeft size={20} />
        </button>
        <div>
          <h1 className="text-xl font-bold text-gray-900">My Profile</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage your account details and security</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left — Avatar + Roles */}
        <div className="flex flex-col gap-4">
          {/* Avatar card */}
          <div className="bg-white rounded-2xl border p-6 flex flex-col items-center text-center">
            <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center text-white text-2xl font-bold mb-3 shadow-lg">
              {initials}
            </div>
            <p className="text-base font-bold text-gray-900">{profile?.name}</p>
            <p className="text-xs text-gray-400 mt-0.5">{profile?.email}</p>
            {profile?.outletName && (
              <span className="mt-2 inline-flex items-center gap-1 text-xs bg-gray-100 text-gray-600 px-2.5 py-1 rounded-full">
                <Building2 size={11} />
                {profile.outletName}
              </span>
            )}
          </div>

          {/* Roles */}
          <div className="bg-white rounded-2xl border p-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Assigned Roles</p>
            <div className="flex flex-wrap gap-1.5">
              {(profile?.roles ?? []).map((r: string) => (
                <span key={r} className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium border ${ROLE_COLORS[r] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                  <Shield size={10} />
                  {r.replace('_', ' ')}
                </span>
              ))}
            </div>
          </div>

          {/* Last login */}
          {profile?.lastLogin && (
            <div className="bg-white rounded-2xl border p-4">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Last Login</p>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Clock size={13} className="text-gray-400 shrink-0" />
                {fmt(profile.lastLogin)}
              </div>
            </div>
          )}
        </div>

        {/* Right — Details */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {/* Profile info */}
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-900">Personal Information</h2>
              {!editing ? (
                <button onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium">
                  <Pencil size={13} /> Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button onClick={handleCancel} disabled={saving}
                    className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 font-medium">
                    <X size={13} /> Cancel
                  </button>
                  <button onClick={handleSave} disabled={saving}
                    className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium">
                    {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    Save
                  </button>
                </div>
              )}
            </div>

            <div className="px-5">
              {editing ? (
                <div className="py-4 space-y-4">
                  <div>
                    <label className="block text-[11px] text-gray-400 uppercase tracking-wide font-medium mb-1.5">Full Name</label>
                    <input
                      value={form.name}
                      onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setIsDirty(true) }}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                      placeholder="Enter full name"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] text-gray-400 uppercase tracking-wide font-medium mb-1.5">Phone Number</label>
                    <input
                      value={form.phone}
                      onChange={e => { setForm(f => ({ ...f, phone: e.target.value })); setIsDirty(true) }}
                      className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                      placeholder="Enter phone number"
                    />
                  </div>
                  <p className="text-xs text-gray-400">Email and employee code cannot be changed here.</p>
                </div>
              ) : (
                <>
                  <Field icon={<User size={15} />}     label="Full Name"      value={profile?.name} />
                  <Field icon={<Mail size={15} />}     label="Email Address"  value={profile?.email} />
                  <Field icon={<Phone size={15} />}    label="Phone"          value={profile?.phone} />
                  <Field icon={<Hash size={15} />}     label="Employee Code"  value={profile?.employeeCode} />
                  <Field icon={<Building2 size={15} />} label="Outlet"        value={profile?.outletName} />
                  <Field icon={<Percent size={15} />}  label="Max Discount"   value={profile?.maxDiscountPercent != null ? `${profile.maxDiscountPercent}%` : null} />
                  <Field icon={<BadgeCheck size={15} />} label="Account Status" value={profile?.active ? 'Active' : 'Inactive'} />
                </>
              )}
            </div>
          </div>

          {/* Change Password */}
          <div className="bg-white rounded-2xl border overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b bg-gray-50">
              <h2 className="text-sm font-semibold text-gray-900">Change Password</h2>
              {!showPw && (
                <button onClick={() => setShowPw(true)}
                  className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium">
                  <KeyRound size={13} /> Change
                </button>
              )}
            </div>

            {showPw ? (
              <div className="px-5 py-4 space-y-3">
                <div>
                  <label className="block text-[11px] text-gray-400 uppercase tracking-wide font-medium mb-1.5">Current Password</label>
                  <input type="password" value={pwForm.current}
                    onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                    placeholder="Enter current password" />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-400 uppercase tracking-wide font-medium mb-1.5">New Password</label>
                  <input type="password" value={pwForm.newPw}
                    onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                    placeholder="Min 6 characters" />
                </div>
                <div>
                  <label className="block text-[11px] text-gray-400 uppercase tracking-wide font-medium mb-1.5">Confirm New Password</label>
                  <input type="password" value={pwForm.confirm}
                    onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-400"
                    placeholder="Repeat new password" />
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button onClick={() => { setShowPw(false); setPwForm({ current: '', newPw: '', confirm: '' }) }}
                    className="px-3 py-2 text-xs font-medium text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50">
                    Cancel
                  </button>
                  <button onClick={handlePasswordChange} disabled={saving}
                    className="px-4 py-2 text-xs font-medium bg-gradient-to-r from-violet-600 to-blue-600 text-white rounded-lg hover:from-violet-700 hover:to-blue-700 disabled:opacity-50 flex items-center gap-1.5">
                    {saving ? <Loader2 size={12} className="animate-spin" /> : <KeyRound size={12} />}
                    Update Password
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-5 py-4">
                <p className="text-sm text-gray-400">••••••••</p>
                <p className="text-xs text-gray-400 mt-1">Click "Change" to update your password.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      <UnsavedChangesDialog open={showConfirm} onConfirm={doCancel} onCancel={() => setShowConfirm(false)} />
      <UnsavedChangesDialog open={ppIsBlocked} onConfirm={ppConfirmLeave} onCancel={ppCancelLeave} />
    </div>
  )
}
