import { useState, useMemo, useEffect } from 'react'
import { Search, X, ToggleLeft, ToggleRight, ShieldCheck, ShieldOff, Shield, Loader2, Save, ChevronDown } from 'lucide-react'
import { PERMISSION_GROUPS } from '@/pages/staff/StaffPage'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { rolesApi } from '@/services/api'
import toast from 'react-hot-toast'

interface Role {
  id: number
  name: string
  displayName: string
  permissions: string[]
}

export default function PermissionsSettings() {
  const qc = useQueryClient()
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null)
  const [enabled, setEnabled] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [groupFilter, setGroupFilter] = useState<string | null>(null)
  const [dirty, setDirty] = useState(false)

  const { data: rolesData, isLoading: rolesLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: async () => {
      const res = await rolesApi.getAll()
      return res.data.data as Role[]
    },
  })

  const selectedRole = rolesData?.find(r => r.id === selectedRoleId) ?? null

  useEffect(() => {
    if (selectedRole) {
      setEnabled(new Set(selectedRole.permissions ?? []))
      setDirty(false)
    }
  }, [selectedRoleId, rolesData])

  const saveMutation = useMutation({
    mutationFn: () =>
      rolesApi.update(selectedRoleId!, {
        name: selectedRole!.name,
        displayName: selectedRole!.displayName,
        permissions: [...enabled],
      }),
    onSuccess: () => {
      toast.success(`Permissions saved for ${selectedRole?.displayName}`)
      qc.invalidateQueries({ queryKey: ['roles'] })
      setDirty(false)
    },
    onError: () => toast.error('Failed to save permissions'),
  })

  const allItems = useMemo(
    () => PERMISSION_GROUPS.flatMap(g => g.items.map(i => ({ ...i, group: g.group, groupIcon: g.icon }))),
    []
  )

  const enabledCount = enabled.size
  const totalCount = allItems.length

  function toggle(key: string) {
    setEnabled(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
    setDirty(true)
  }

  function toggleGroup(keys: string[]) {
    const allOn = keys.every(k => enabled.has(k))
    setEnabled(prev => {
      const next = new Set(prev)
      if (allOn) keys.forEach(k => next.delete(k))
      else keys.forEach(k => next.add(k))
      return next
    })
    setDirty(true)
  }

  function enableAll() {
    setEnabled(new Set(allItems.map(i => i.key)))
    setDirty(true)
  }

  function disableAll() {
    setEnabled(new Set())
    setDirty(true)
  }

  const q = search.trim().toLowerCase()
  const visibleGroups = PERMISSION_GROUPS
    .filter(g => !groupFilter || g.group === groupFilter)
    .map(g => ({
      ...g,
      items: g.items.filter(i =>
        !q ||
        i.label.toLowerCase().includes(q) ||
        i.desc.toLowerCase().includes(q) ||
        i.key.toLowerCase().includes(q)
      ),
    }))
    .filter(g => g.items.length > 0)

  if (rolesLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-400">
        <Loader2 size={24} className="animate-spin mr-2" /> Loading roles…
      </div>
    )
  }

  return (
    <div className="space-y-5">

      {/* ── Role selector ── */}
      <div className="flex items-center gap-3 p-4 bg-violet-50 border border-violet-100 rounded-2xl">
        <Shield size={18} className="text-violet-500 shrink-0" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-violet-700 mb-1">Select Role</p>
          <div className="relative">
            <select
              value={selectedRoleId ?? ''}
              onChange={e => setSelectedRoleId(e.target.value ? Number(e.target.value) : null)}
              className="w-full appearance-none bg-white border border-violet-200 rounded-xl px-3 py-2 text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-violet-300 pr-8"
            >
              <option value="">— Choose a role to edit its permissions —</option>
              {rolesData?.map(r => (
                <option key={r.id} value={r.id}>{r.displayName || r.name}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        </div>
        {selectedRole && dirty && (
          <button
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending}
            className="flex items-center gap-1.5 px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-xl hover:bg-violet-700 disabled:opacity-60 transition-colors shrink-0"
          >
            {saveMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save
          </button>
        )}
      </div>

      {!selectedRole ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-300">
          <Shield size={40} className="mb-3" />
          <p className="text-sm text-gray-400">Select a role above to view and edit its permissions</p>
        </div>
      ) : (
        <>
          {/* ── Stats strip ── */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Total Permissions', value: totalCount,               icon: <Shield size={16} className="text-violet-500" />,       cls: 'bg-violet-50 border-violet-100' },
              { label: 'Granted',           value: enabledCount,             icon: <ShieldCheck size={16} className="text-emerald-500" />, cls: 'bg-emerald-50 border-emerald-100' },
              { label: 'Not Granted',       value: totalCount - enabledCount, icon: <ShieldOff size={16} className="text-red-400" />,       cls: 'bg-red-50 border-red-100' },
            ].map(s => (
              <div key={s.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${s.cls}`}>
                <div className="w-9 h-9 rounded-lg bg-white flex items-center justify-center shadow-sm shrink-0">{s.icon}</div>
                <div>
                  <p className="text-xl font-extrabold text-gray-800 leading-none">{s.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                </div>
              </div>
            ))}
          </div>

          {/* ── Toolbar ── */}
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[220px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search permissions…"
                className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-violet-300 bg-white shadow-sm"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={13} />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-1.5">
              <button
                onClick={() => setGroupFilter(null)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${!groupFilter ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'}`}
              >
                All Groups
              </button>
              {PERMISSION_GROUPS.map(g => (
                <button
                  key={g.group}
                  onClick={() => setGroupFilter(groupFilter === g.group ? null : g.group)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${groupFilter === g.group ? 'bg-gradient-to-r from-violet-500 to-blue-500 text-white shadow-sm' : 'bg-gray-50 border border-gray-200 text-gray-600 hover:bg-gray-100'}`}
                >
                  {g.icon} {g.group}
                </button>
              ))}
            </div>

            <div className="ml-auto flex items-center gap-2">
              <button
                onClick={enableAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl hover:bg-emerald-100 transition-colors"
              >
                <ShieldCheck size={13} /> Grant All
              </button>
              <button
                onClick={disableAll}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 rounded-xl hover:bg-red-100 transition-colors"
              >
                <ShieldOff size={13} /> Revoke All
              </button>
            </div>
          </div>

          {/* ── Permission groups ── */}
          {visibleGroups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-300">
              <Search size={36} className="mb-3" />
              <p className="text-sm text-gray-400">No permissions match your search</p>
            </div>
          ) : (
            <div className="space-y-4">
              {visibleGroups.map(group => {
                const keys = group.items.map(i => i.key)
                const groupGranted = keys.filter(k => enabled.has(k)).length
                const allOn = keys.every(k => enabled.has(k))
                const someOn = keys.some(k => enabled.has(k))

                return (
                  <div key={group.group} className="border border-gray-100 rounded-2xl overflow-hidden shadow-sm">
                    <div className={`flex items-center justify-between px-5 py-3 ${!someOn ? 'bg-gray-50/80' : allOn ? 'bg-emerald-50/60' : 'bg-amber-50/40'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-base">{group.icon}</span>
                        <span className="text-sm font-bold text-gray-800">{group.group}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          !someOn ? 'bg-gray-100 text-gray-500' : allOn ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {groupGranted}/{keys.length} granted
                        </span>
                      </div>
                      <button
                        onClick={() => toggleGroup(keys)}
                        className={`text-xs font-semibold px-3 py-1.5 rounded-lg border transition-colors ${
                          allOn
                            ? 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {allOn ? 'Revoke All' : 'Grant All'}
                      </button>
                    </div>

                    <div className="divide-y divide-gray-50">
                      {group.items.map(item => {
                        const isGranted = enabled.has(item.key)
                        return (
                          <div
                            key={item.key}
                            className={`flex items-center gap-4 px-5 py-3.5 transition-colors ${!isGranted ? 'bg-gray-50/80 opacity-60' : 'bg-white hover:bg-emerald-50/20'}`}
                          >
                            <div className={`w-2 h-2 rounded-full shrink-0 ${isGranted ? 'bg-emerald-400' : 'bg-gray-300'}`} />
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-semibold ${!isGranted ? 'text-gray-400' : 'text-gray-800'}`}>
                                  {item.label}
                                </span>
                                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                  {item.key}
                                </span>
                              </div>
                              <p className="text-xs text-gray-500 mt-0.5">{item.desc}</p>
                            </div>
                            <span className={`text-xs font-medium px-2.5 py-1 rounded-full shrink-0 ${
                              isGranted ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'
                            }`}>
                              {isGranted ? 'Granted' : 'Not Granted'}
                            </span>
                            <button
                              onClick={() => toggle(item.key)}
                              className={`shrink-0 transition-colors ${isGranted ? 'text-emerald-500 hover:text-red-400' : 'text-gray-300 hover:text-emerald-500'}`}
                              title={isGranted ? 'Revoke this permission' : 'Grant this permission'}
                            >
                              {isGranted
                                ? <ToggleRight size={32} strokeWidth={1.5} className="text-emerald-500" />
                                : <ToggleLeft  size={32} strokeWidth={1.5} />
                              }
                            </button>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* ── Floating save bar ── */}
          {dirty && (
            <div className="sticky bottom-4 flex justify-end">
              <div className="flex items-center gap-3 bg-white border border-violet-200 shadow-lg rounded-2xl px-4 py-3">
                <p className="text-sm text-gray-600">Unsaved changes for <strong>{selectedRole.displayName || selectedRole.name}</strong></p>
                <button
                  onClick={() => {
                    setEnabled(new Set(selectedRole.permissions ?? []))
                    setDirty(false)
                  }}
                  className="px-3 py-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50"
                >
                  Discard
                </button>
                <button
                  onClick={() => saveMutation.mutate()}
                  disabled={saveMutation.isPending}
                  className="flex items-center gap-1.5 px-4 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-60 transition-colors"
                >
                  {saveMutation.isPending ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  Save Permissions
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
