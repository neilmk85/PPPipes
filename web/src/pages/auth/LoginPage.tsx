import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Eye, EyeOff, ArrowRight, Loader2 } from 'lucide-react'
import { authApi } from '@/services/api'
import { useAuthStore } from '@/store/authStore'

const loginSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password required'),
})
type LoginForm = z.infer<typeof loginSchema>

export default function LoginPage() {
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)
  const [loading, setLoading] = useState(false)
  const [showPass, setShowPass] = useState(false)
  const [visible, setVisible] = useState(false)
  const [loginError, setLoginError] = useState('')

  const { register, handleSubmit, formState: { errors }, watch } = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@pppipeproducts.com',
      password: 'admin',
    },
  })

  const watchedFields = watch(['email', 'password'])
  useEffect(() => { setLoginError('') }, [watchedFields[0], watchedFields[1]])

  // fade-in on mount
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 40)
    return () => clearTimeout(t)
  }, [])

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    setLoginError('')
    try {
      const res = await authApi.login(data.email, data.password)
      const { data: auth } = res.data
      setAuth(
        {
          id: auth.userId,
          name: auth.name,
          email: auth.email,
          roles: Array.from(auth.roles),
          permissions: Array.from(auth.permissions ?? []),
          active: true,
          outletId: auth.outletId,
          outletName: auth.outletName,
        },
        auth.accessToken,
        auth.refreshToken,
      )
      navigate('/dashboard')
    } catch (err: any) {
      const msg: string = err.response?.data?.message ?? ''
      if (msg === 'User not found') {
        setLoginError('No account found with this email address.')
      } else if (msg === 'Invalid credentials') {
        setLoginError('Incorrect password. Please try again.')
      } else {
        setLoginError('Login failed. Please check your email and password.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="relative min-h-screen flex items-center justify-center overflow-hidden p-6"
      style={{
        background: 'linear-gradient(to bottom, #1e3a8a 0%, #1d4ed8 55%, #312e81 100%)',
      }}
    >
      {/* ── Decorative blobs ── */}
      <div className="absolute -left-16 top-[4%] w-56 h-56 rounded-full"
        style={{ background: 'rgba(124,58,237,0.22)', filter: 'blur(2px)' }} />
      <div className="absolute -right-10 top-[18%] w-44 h-44 rounded-full"
        style={{ background: 'rgba(37,99,235,0.25)', filter: 'blur(2px)' }} />
      <div className="absolute left-[30%] bottom-[8%] w-60 h-60 rounded-full"
        style={{ background: 'rgba(124,58,237,0.15)', filter: 'blur(4px)' }} />
      <div className="absolute -right-8 bottom-[22%] w-36 h-36 rounded-full"
        style={{ background: 'rgba(96,165,250,0.12)', filter: 'blur(2px)' }} />

      {/* ── Radial glows ── */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(124,58,237,0.18) 0%, transparent 70%)',
        }} />
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background:
            'radial-gradient(ellipse 70% 60% at 100% 100%, rgba(37,99,235,0.22) 0%, transparent 70%)',
        }} />

      {/* ── Grid lines ── */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
        }}
      />

      {/* ── Dot pattern (top-right) ── */}
      <div
        className="absolute top-20 right-4 w-32 h-40 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.07) 2px, transparent 2px)',
          backgroundSize: '18px 18px',
        }}
      />

      {/* ── Arc decoration (bottom-left) ── */}
      <svg
        className="absolute bottom-0 left-0 pointer-events-none"
        width="220" height="220" viewBox="0 0 220 220"
        fill="none"
      >
        {[70, 140, 210].map((r) => (
          <path
            key={r}
            d={`M 0 ${r} A ${r} ${r} 0 0 1 ${r} 0`}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth="1.5"
            fill="none"
          />
        ))}
      </svg>

      {/* ── Diagonal lines (top-left) ── */}
      <svg
        className="absolute top-0 left-0 pointer-events-none"
        width="300" height="300" viewBox="0 0 300 300"
        fill="none"
      >
        {[0, 60, 120, 180, 240, 300].map((offset) => (
          <line
            key={offset}
            x1={offset} y1="0" x2="0" y2={offset}
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}
      </svg>

      {/* ── Main content ── */}
      <div
        className="relative z-10 w-full max-w-md flex flex-col items-center"
        style={{
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
        }}
      >
        {/* ── Pipe hero image — floats above the form on the gradient bg ── */}
        <img
          src="/images/p%26p_login_img.png"
          alt="P&P PCCP Pipe"
          className="w-full md:w-[480px] pointer-events-none select-none object-contain"
          style={{
            filter: 'drop-shadow(0 20px 48px rgba(0,0,40,0.65)) drop-shadow(0 6px 16px rgba(0,10,80,0.50))',
            transform: 'perspective(900px) rotateY(-5deg) rotateX(3deg)',
          }}
        />

        {/* ── Logo row ── */}
        <div className="flex items-center gap-3 mb-4 w-full">
          <img src="/pp-logo.png" alt="P&P Pipe Products" className="w-20 h-14 object-contain shrink-0" />
          <div>
            <h1 className="text-xl font-extrabold text-white tracking-tight leading-tight">
              P&amp;P Pipe Products
            </h1>
            <p className="text-sm text-white/60 mt-0.5">
              Production &amp; Sales Management
            </p>
          </div>
        </div>

        <div className="w-full mb-2" />

        {/* ── Form ── */}
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 w-full">

          {/* Email */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2 tracking-wide">
              Email
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.55)" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
              </span>
              <input
                {...register('email')}
                type="email"
                placeholder="admin@pppipeproducts.com"
                autoComplete="email"
                className="
                  w-full pl-10 pr-4 py-3.5 rounded-xl text-white text-[15px]
                  placeholder-white/35 outline-none transition-all duration-200
                  border focus:border-white
                "
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  borderColor: errors.email
                    ? '#fca5a5'
                    : 'rgba(255,255,255,0.20)',
                }}
                onFocus={e => !errors.email && (e.currentTarget.style.borderColor = 'rgba(255,255,255,1)')}
                onBlur={e => !errors.email && (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.20)')}
              />
            </div>
            {errors.email && (
              <p className="text-[#fca5a5] text-xs mt-1.5">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-semibold text-white mb-2 tracking-wide">
              Password
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.55)" strokeWidth="1.8"
                  strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </span>
              <input
                {...register('password')}
                type={showPass ? 'text' : 'password'}
                placeholder="••••••••"
                autoComplete="current-password"
                className="
                  w-full pl-10 pr-11 py-3.5 rounded-xl text-white text-[15px]
                  placeholder-white/35 outline-none transition-all duration-200
                  border
                "
                style={{
                  background: 'rgba(255,255,255,0.10)',
                  borderColor: errors.password
                    ? '#fca5a5'
                    : 'rgba(255,255,255,0.20)',
                }}
                onFocus={e => !errors.password && (e.currentTarget.style.borderColor = 'rgba(255,255,255,1)')}
                onBlur={e => !errors.password && (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.20)')}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/55 hover:text-white/90 transition-colors"
                tabIndex={-1}
              >
                {showPass
                  ? <EyeOff size={18} />
                  : <Eye size={18} />}
              </button>
            </div>
            {errors.password && (
              <p className="text-[#fca5a5] text-xs mt-1.5">{errors.password.message}</p>
            )}
          </div>

          {/* Login error */}
          {loginError && (
            <div className="flex items-center gap-2 px-3.5 py-2.5 rounded-xl"
              style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.35)' }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                stroke="#fca5a5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
              <p className="text-[#fca5a5] text-sm">{loginError}</p>
            </div>
          )}

          {/* Sign In button */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="
                relative w-full h-[52px] rounded-[14px] text-white font-bold text-[15px]
                tracking-wide flex items-center justify-center gap-2
                transition-all duration-200
                disabled:opacity-60 disabled:cursor-not-allowed
                hover:brightness-110 active:scale-[0.98]
              "
              style={{
                background: loading
                  ? 'rgba(255,255,255,0.15)'
                  : 'linear-gradient(to right, #7c3aed, #2563eb)',
                boxShadow: loading ? 'none' : '0 8px 24px rgba(124,58,237,0.50)',
              }}
            >
              {loading ? (
                <Loader2 size={20} className="animate-spin" />
              ) : (
                <>
                  Sign In
                  <ArrowRight size={18} />
                </>
              )}
            </button>
          </div>
        </form>

        {/* Hint */}
        <p className="text-center text-[11px] text-white/40 mt-6">
          Default: admin@pppipeproducts.com / admin
        </p>
      </div>
    </div>
  )
}
