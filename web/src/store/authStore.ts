import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { User } from '@/types'

interface AuthState {
  user: User | null
  accessToken: string | null
  refreshToken: string | null
  outletId: number | null
  isAuthenticated: boolean
  setAuth: (user: User, accessToken: string, refreshToken: string) => void
  logout: () => void
  hasRole: (role: string) => boolean
  hasPermission: (key: string) => boolean
  setOutOfOffice: (value: boolean) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      outletId: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        localStorage.setItem('accessToken', accessToken)
        set({ user, accessToken, refreshToken, outletId: user.outletId || null, isAuthenticated: true })
      },

      logout: () => {
        localStorage.removeItem('accessToken')
        set({ user: null, accessToken: null, refreshToken: null, outletId: null, isAuthenticated: false })
      },

      hasRole: (role: string) => {
        const { user } = get()
        return user?.roles?.includes(role) ?? false
      },

      hasPermission: (key: string) => {
        const { user } = get()
        if (!user) return false
        if (user.roles.includes('SUPER_ADMIN')) return true
        return user.permissions?.includes(key) ?? false
      },

      setOutOfOffice: (value: boolean) => {
        const { user } = get()
        if (user) set({ user: { ...user, outOfOffice: value } })
      },
    }),
    { name: 'pos-auth' }
  )
)
