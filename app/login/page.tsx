'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Shield, Eye, EyeOff, Loader2, Mail, Lock } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'

function LoginContent() {
  const params = useSearchParams()
  const inviteToken = params.get('invite')
  const redirectUrl = params.get('redirect')

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberMe, setRememberMe] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const NETWORK_ERROR_MSG = 'No se pudo conectar con el servidor. Verifica tu conexión a internet e inténtalo de nuevo.'

    let signInError: Error | null = null
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      signInError = error
    } catch {
      setError(NETWORK_ERROR_MSG)
      setLoading(false)
      return
    }

    if (signInError) {
      const msg = signInError.message?.toLowerCase() ?? ''
      const isNetworkError = msg.includes('fetch') || msg.includes('network') || signInError.name === 'AuthRetryableFetchError'
      setError(isNetworkError ? NETWORK_ERROR_MSG : 'Correo o contraseña incorrectos')
      setLoading(false)
      return
    }

    if (rememberMe) localStorage.removeItem('noRemember')
    else            localStorage.setItem('noRemember', '1')
    sessionStorage.setItem('session_started', '1')

    if (inviteToken)      window.location.href = `/invitacion?token=${inviteToken}`
    else if (redirectUrl) window.location.href = redirectUrl
    else                  window.location.href = '/'
  }

  return (
    <div className="min-h-screen flex bg-cream-50">
      {/* ── Left panel · Form ─────────────────────────────────────── */}
      <div className="w-full lg:w-[480px] flex flex-col px-8 py-10 lg:px-14 lg:py-12">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-auto">
          <div className="w-9 h-9 bg-ink-700 rounded-lg flex items-center justify-center">
            <Shield className="w-4 h-4 text-primary-400" />
          </div>
          <div>
            <p className="font-bold text-ink-700 text-sm leading-none tracking-tight">SENDA</p>
            <p className="text-[10px] text-ink-400 uppercase tracking-widest mt-0.5">Seguros · CRM</p>
          </div>
        </div>

        {/* Form */}
        <div className="my-auto py-10">
          <h1 className="text-3xl font-semibold text-ink-700 mb-2 tracking-tight text-center">
            Bienvenido de vuelta
          </h1>
          <p className="text-sm text-ink-400 mb-10 text-center">
            {inviteToken ? 'Inicia sesión para aceptar tu invitación' : 'Ingresa a tu cuenta para continuar'}
          </p>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <Label htmlFor="email">Correo electrónico</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="tu@correo.com"
                leftIcon={<Mail className="w-4 h-4" />}
              />
            </div>

            <div>
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                leftIcon={<Lock className="w-4 h-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(p => !p)}
                    aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    className="text-ink-400 hover:text-ink-600 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                }
              />
            </div>

            <label className="flex items-center gap-2.5 cursor-pointer select-none px-1">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="w-4 h-4 rounded border-ink-200 text-primary-500 focus:ring-primary-300 focus:ring-2 cursor-pointer accent-primary-500"
              />
              <span className="text-xs text-ink-500">Mantener sesión iniciada</span>
            </label>

            {error && (
              <div className="text-xs text-error bg-error-soft/40 border border-error/20 rounded-2xl px-4 py-3">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading} size="lg" className="w-full">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Iniciar sesión'}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-ink-400 mt-auto">
          ¿No tienes cuenta?{' '}
          <Link
            href={inviteToken ? `/registro?invite=${inviteToken}` : '/registro'}
            className="text-primary-700 hover:text-primary-800 font-semibold underline-offset-4 hover:underline"
          >
            Crear una
          </Link>
        </div>
      </div>

      {/* ── Right panel · Imagen limpia ───────────────────────────── */}
      <div className="hidden lg:block flex-1 relative p-4">
        <div className="relative w-full h-full rounded-[32px] overflow-hidden shadow-card">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1600&q=80"
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
          {/* Subtle warm tint */}
          <div className="absolute inset-0 bg-gradient-to-tr from-ink-700/10 via-transparent to-primary-500/10" />
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-cream-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
