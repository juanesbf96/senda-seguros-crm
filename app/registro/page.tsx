'use client'
import { useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Shield, Eye, EyeOff, MailCheck, Loader2 } from 'lucide-react'
import Link from 'next/link'

function RegistroContent() {
  const params = useSearchParams()
  const inviteToken = params.get('invite')

  const [nombre, setNombre] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [verificationSent, setVerificationSent] = useState(false)

  async function handleRegistro(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres')
      return
    }
    setLoading(true)
    setError('')

    const signUpOptions: Parameters<typeof supabase.auth.signUp>[0]['options'] = {
      data: { nombre },
    }

    if (inviteToken) {
      signUpOptions.emailRedirectTo = `${window.location.origin}/invitacion?token=${inviteToken}`
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: signUpOptions,
    })

    if (error) {
      const msg = error.message || ''
      if (msg.includes('already registered') || msg.includes('already been registered')) {
        setError('Este correo ya tiene una cuenta registrada')
      } else if (msg.includes('Password should')) {
        setError('La contraseña debe tener al menos 6 caracteres')
      } else {
        setError(msg || 'Error al crear la cuenta. Intenta de nuevo.')
      }
      setLoading(false)
      return
    }

    // Si no hay sesión inmediata, Supabase requiere confirmación por correo
    if (!data.session) {
      setVerificationSent(true)
      return
    }

    sessionStorage.setItem('session_started', '1')
    if (inviteToken) {
      window.location.href = `/invitacion?token=${inviteToken}`
    } else {
      window.location.href = '/'
    }
  }

  if (verificationSent) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-sm p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <MailCheck className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">Revisa tu correo</h1>
          <p className="text-sm text-slate-500 mb-2">
            Te enviamos un enlace de verificación a
          </p>
          <p className="text-sm font-medium text-slate-800 mb-6">{email}</p>
          <p className="text-xs text-slate-400 mb-6">
            Haz clic en el enlace del correo para activar tu cuenta
            {inviteToken ? ' y aceptar tu invitación.' : ' y acceder al CRM.'}
            {' '}Revisa también tu carpeta de spam.
          </p>
          <Link
            href="/login"
            className="inline-block w-full bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            Ir al inicio de sesión
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-sm p-8">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-900 leading-tight">Senda Seguros</p>
            <p className="text-xs text-slate-500">CRM</p>
          </div>
        </div>

        <h1 className="text-xl font-bold text-slate-900 mb-1">Crear cuenta</h1>
        <p className="text-sm text-slate-500 mb-6">
          {inviteToken ? 'Crea tu cuenta para aceptar la invitación' : 'Configura tu acceso al CRM'}
        </p>

        <form onSubmit={handleRegistro} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nombre completo
            </label>
            <input
              type="text"
              value={nombre}
              onChange={e => setNombre(e.target.value)}
              required
              autoComplete="name"
              placeholder="Tu nombre"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Correo electrónico
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="tu@correo.com"
              className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                autoComplete="new-password"
                placeholder="Mínimo 6 caracteres"
                className="w-full px-3 py-2.5 pr-10 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
              <button
                type="button"
                onClick={() => setShowPassword(p => !p)}
                aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            {loading ? 'Creando cuenta...' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-6">
          ¿Ya tienes cuenta?{' '}
          <Link
            href={inviteToken ? `/login?invite=${inviteToken}` : '/login'}
            className="text-emerald-600 hover:underline font-medium"
          >
            Iniciar sesión
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function RegistroPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    }>
      <RegistroContent />
    </Suspense>
  )
}
