import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
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
      className="relative min-h-screen flex overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #0f1e4a 0%, #1a3480 45%, #1e1b5e 100%)' }}
    >
      {/* ── Global decorative grid ── */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      {/* ══════════════════════════════════════════════════════
          LEFT PANEL — Engraved pipe showcase
      ══════════════════════════════════════════════════════ */}
      <div
        className="hidden lg:flex lg:w-[58%] relative flex-col items-center justify-center"
        style={{
          background: 'linear-gradient(160deg, #0c1840 0%, #0e2060 40%, #111b55 100%)',
          borderRight: '1px solid rgba(255,255,255,0.07)',
        }}
      >
        {/* Corner arc decorations */}
        <svg className="absolute top-0 left-0 pointer-events-none" width="260" height="260" viewBox="0 0 260 260" fill="none">
          {[80,160,240].map(r => (
            <path key={r} d={`M 0 ${r} A ${r} ${r} 0 0 1 ${r} 0`} stroke="rgba(255,255,255,0.05)" strokeWidth="1.2" fill="none" />
          ))}
        </svg>
        <svg className="absolute bottom-0 right-0 pointer-events-none rotate-180" width="260" height="260" viewBox="0 0 260 260" fill="none">
          {[80,160,240].map(r => (
            <path key={r} d={`M 0 ${r} A ${r} ${r} 0 0 1 ${r} 0`} stroke="rgba(255,255,255,0.04)" strokeWidth="1.2" fill="none" />
          ))}
        </svg>

        {/* Dot field top-right */}
        <div className="absolute top-16 right-12 w-28 h-36 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(100,140,255,0.12) 1.5px, transparent 1.5px)',
            backgroundSize: '16px 16px',
          }}
        />
        <div className="absolute bottom-16 left-10 w-24 h-28 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(rgba(100,140,255,0.10) 1.5px, transparent 1.5px)',
            backgroundSize: '16px 16px',
          }}
        />

        {/* ── Engraved image frame ── */}
        <div className="relative flex flex-col items-center px-14 py-10 w-full max-w-xl">

          {/* Outer relief frame — simulates metal plaque */}
          <div
            className="relative w-full rounded-3xl p-[3px]"
            style={{
              background: 'linear-gradient(145deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.03) 40%, rgba(0,0,0,0.25) 100%)',
              boxShadow:
                '0 2px 0 rgba(255,255,255,0.08) inset,' +
                '0 -2px 0 rgba(0,0,0,0.4) inset,' +
                '0 20px 60px rgba(0,0,0,0.5),' +
                '0 4px 16px rgba(0,0,60,0.6)',
            }}
          >
            {/* Inner recess — the "engraved" cavity */}
            <div
              className="relative w-full rounded-[22px] overflow-hidden flex items-center justify-center"
              style={{
                background: 'linear-gradient(160deg, #0a1535 0%, #0d1d4a 60%, #0c1840 100%)',
                boxShadow:
                  'inset 0 6px 30px rgba(0,0,0,0.7),' +
                  'inset 0 -4px 20px rgba(0,0,0,0.45),' +
                  'inset 4px 0 20px rgba(0,0,0,0.4),' +
                  'inset -4px 0 20px rgba(0,0,0,0.3)',
                minHeight: '340px',
                padding: '32px 24px 24px',
              }}
            >
              {/* Subtle concentric ring behind image */}
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                {[300, 420, 520].map((d, i) => (
                  <div key={i} className="absolute rounded-full border"
                    style={{
                      width: d, height: d,
                      borderColor: `rgba(80,120,255,${0.06 - i * 0.015})`,
                    }}
                  />
                ))}
              </div>

              {/* Radial glow behind the pipe */}
              <div className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'radial-gradient(ellipse 70% 55% at 50% 55%, rgba(30,80,200,0.22) 0%, transparent 70%)',
                }}
              />

              {/* The pipe image — treated to look engraved/embedded */}
              <img
                src="/pp-pipe-hero.png"
                alt="P&P PCCP Pipe"
                className="relative z-10 w-full max-w-[420px] object-contain drop-shadow-2xl"
                style={{
                  filter: 'brightness(0.90) saturate(0.82) contrast(1.08) drop-shadow(0 12px 40px rgba(0,0,30,0.9)) drop-shadow(0 4px 12px rgba(0,20,80,0.7))',
                  transform: 'perspective(900px) rotateY(-3deg) rotateX(2deg)',
                }}
              />

              {/* Vignette overlay — deepens the "carved into surface" look */}
              <div className="absolute inset-0 pointer-events-none rounded-[22px]"
                style={{
                  background: 'radial-gradient(ellipse 90% 85% at 50% 50%, transparent 38%, rgba(5,10,30,0.75) 100%)',
                }}
              />

              {/* Bottom spec strip */}
              <div className="absolute bottom-0 left-0 right-0 px-6 py-4 flex items-center justify-between"
                style={{
                  background: 'linear-gradient(to top, rgba(5,12,40,0.95) 0%, transparent 100%)',
                }}
              >
                <div>
                  <p className="text-[10px] font-bold text-blue-300/70 uppercase tracking-[0.2em]">Bureau of Indian Standards</p>
                  <p className="text-xs font-semibold text-white/50 mt-0.5">IS 13476 &nbsp;|&nbsp; IS 5316</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-bold text-blue-300/70 uppercase tracking-[0.2em]">Product</p>
                  <p className="text-xs font-semibold text-white/50 mt-0.5">PCCP Pipe</p>
                </div>
              </div>
            </div>
          </div>

          {/* Caption beneath frame */}
          <div className="mt-8 text-center space-y-1.5">
            <p className="text-sm font-bold text-white/80 tracking-wide">
              Manufacturer of PSC, PCCP, BWSC &amp; RCC Pipes
            </p>
            <p className="text-[11px] text-blue-300/50 tracking-widest uppercase">
              Gat No. 156, At Post Hotgi · Solapur, Maharashtra
            </p>
          </div>

          {/* Certified badges row */}
          <div className="mt-5 flex items-center gap-3">
            {['IS 13476', 'IS 5316', 'IS 784'].map(std => (
              <div key={std} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.10)',
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.07), inset 0 -1px 0 rgba(0,0,0,0.2)',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(100,160,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                </svg>
                <span className="text-[10px] font-bold text-blue-200/60 tracking-widest">{std}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          RIGHT PANEL — Login form
      ══════════════════════════════════════════════════════ */}
      <div className="flex-1 flex items-center justify-center p-6 lg:p-10">
        {/* Subtle right-panel glow */}
        <div className="absolute inset-0 pointer-events-none lg:left-[58%]"
          style={{
            background: 'radial-gradient(ellipse 80% 60% at 50% 40%, rgba(124,58,237,0.12) 0%, transparent 70%)',
          }}
        />

        <div
          className="relative z-10 w-full max-w-[400px]"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(18px)',
            transition: 'opacity 0.7s ease-out, transform 0.7s ease-out',
          }}
        >
          {/* Logo + brand */}
          <div className="flex items-center gap-3 mb-10">
            <img src="/pp-logo.png" alt="P&P Pipe Products" className="w-20 h-14 object-contain shrink-0" />
            <div>
              <h1 className="text-xl font-extrabold text-white tracking-tight leading-tight">
                P&amp;P Pipe Products
              </h1>
              <p className="text-sm text-white/55 mt-0.5">
                Production &amp; Sales Management
              </p>
            </div>
          </div>

          {/* Mobile-only: show product name strip */}
          <div className="lg:hidden mb-8 px-4 py-3 rounded-xl flex items-center gap-3"
            style={{
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.10)',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08), inset 0 -1px 0 rgba(0,0,0,0.2)',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(100,160,255,0.7)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            <span className="text-[11px] font-semibold text-blue-200/70 tracking-widest uppercase">Certified PCCP · BWSC · PSC · RCC Pipes</span>
          </div>

          <h2 className="text-[2rem] font-extrabold text-white tracking-tight leading-snug">
            Welcome back
          </h2>
          <p className="text-white/55 text-sm mt-1.5 mb-9">
            Sign in to your account to continue
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2 tracking-wide">Email</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(255,255,255,0.50)" strokeWidth="1.8"
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
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl text-white text-[15px] placeholder-white/30 outline-none transition-all duration-200 border"
                  style={{
                    background: 'rgba(255,255,255,0.09)',
                    borderColor: errors.email ? '#fca5a5' : 'rgba(255,255,255,0.18)',
                  }}
                  onFocus={e => !errors.email && (e.currentTarget.style.borderColor = 'rgba(255,255,255,1)')}
                  onBlur={e => !errors.email && (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
                />
              </div>
              {errors.email && <p className="text-[#fca5a5] text-xs mt-1.5">{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-semibold text-white mb-2 tracking-wide">Password</label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
                    stroke="rgba(255,255,255,0.50)" strokeWidth="1.8"
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
                  className="w-full pl-10 pr-11 py-3.5 rounded-xl text-white text-[15px] placeholder-white/30 outline-none transition-all duration-200 border"
                  style={{
                    background: 'rgba(255,255,255,0.09)',
                    borderColor: errors.password ? '#fca5a5' : 'rgba(255,255,255,0.18)',
                  }}
                  onFocus={e => !errors.password && (e.currentTarget.style.borderColor = 'rgba(255,255,255,1)')}
                  onBlur={e => !errors.password && (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)')}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/50 hover:text-white/90 transition-colors"
                  tabIndex={-1}
                >
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              {errors.password && <p className="text-[#fca5a5] text-xs mt-1.5">{errors.password.message}</p>}
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
                className="relative w-full h-[52px] rounded-[14px] text-white font-bold text-[15px] tracking-wide flex items-center justify-center gap-2 transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-110 active:scale-[0.98]"
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
                  <>Sign In <ArrowRight size={18} /></>
                )}
              </button>
            </div>
          </form>

          <p className="text-center text-[11px] text-white/35 mt-6">
            Default: admin@pppipeproducts.com / admin
          </p>
        </div>
      </div>
    </div>
  )
}
