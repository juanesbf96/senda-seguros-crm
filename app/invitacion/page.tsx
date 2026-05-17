'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { Shield, CheckCircle2, XCircle, Loader2, UserPlus, LogIn } from 'lucide-react'
import Link from 'next/link'

function InvitacionContent() {
  const params = useSearchParams()
  const token = params.get('token')
  const [status, setStatus] = useState<'loading' | 'found' | 'accepted' | 'error'>('loading')
  const [invitation, setInvitation] = useState<any>(null)
  const [error, setError] = useState('')
  const [accepting, setAccepting] = useState(false)
  const [user, setUser] = useState<any>(null)

  useEffect(() => {
    if (!token) { setStatus('error'); setError('Token inválido'); return }
    init()
  }, [token])

  async function init() {
    // Get current user (may be null if not logged in)
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    setUser(currentUser)

    // Use SECURITY DEFINER RPC to read invitation — works for both
    // authenticated and unauthenticated users (direct SELECT fails RLS for guests)
    const { data: invData, error: invErr } = await supabase
      .rpc('get_invitation_by_token', { p_token: token! })

    if (invErr || !invData) {
      setStatus('error')
      setError('La invitación no existe, ya fue usada, o expiró.')
      return
    }

    setInvitation(invData)
    setStatus('found')
  }

  async function acceptInvitation() {
    if (!user) return
    setAccepting(true)
    setError('')

    try {
      // Use SECURITY DEFINER RPC — direct INSERT into workspace_members
      // fails RLS because the invitee is not yet an admin of that workspace.
      const { data, error: rpcErr } = await supabase
        .rpc('accept_workspace_invitation', { p_token: token! })

      if (rpcErr) throw rpcErr
      if (data?.error) throw new Error(data.error)

      setStatus('accepted')
      setTimeout(() => { window.location.href = '/' }, 2000)
    } catch (e: any) {
      setError(e.message || 'Error al aceptar la invitación')
    } finally {
      setAccepting(false)
    }
  }

  const ROLE_LABELS: Record<string, string> = {
    admin: 'Administrador',
    supervisor: 'Supervisor',
    agente: 'Agente',
  }

  if (status === 'loading') {
    return (
      <div className="flex flex-col items-center gap-3 py-8">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <p className="text-sm text-slate-500">Verificando invitación...</p>
      </div>
    )
  }

  if (status === 'accepted') {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-slate-900 mb-2">¡Invitación aceptada!</h2>
        <p className="text-sm text-slate-500">Redirigiendo al CRM...</p>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="text-center py-8">
        <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-slate-900 mb-2">Invitación inválida</h2>
        <p className="text-sm text-slate-500 mb-6">{error}</p>
        <Link href="/login" className="text-emerald-600 text-sm hover:underline">
          Ir al inicio de sesión
        </Link>
      </div>
    )
  }

  // status === 'found'
  return (
    <div className="py-2">
      <h2 className="text-lg font-bold text-slate-900 mb-2">Te han invitado a un workspace</h2>
      <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-6">
        <p className="text-sm text-slate-500 mb-1">Workspace</p>
        <p className="font-semibold text-slate-900">{invitation?.workspace?.name}</p>
        <div className="mt-2 pt-2 border-t border-slate-100">
          <p className="text-sm text-slate-500 mb-1">Tu rol</p>
          <span className="inline-block bg-emerald-100 text-emerald-700 text-xs font-semibold px-2.5 py-1 rounded-full">
            {ROLE_LABELS[invitation?.role] || invitation?.role}
          </span>
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {user ? (
        // Authenticated: show accept button
        <button
          onClick={acceptInvitation}
          disabled={accepting}
          className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {accepting ? 'Aceptando...' : 'Aceptar invitación'}
        </button>
      ) : (
        // Not authenticated: show register / login CTAs
        <div className="space-y-3">
          <p className="text-sm text-slate-500 text-center mb-4">
            Para aceptar esta invitación necesitas una cuenta en Senda Seguros CRM.
          </p>
          <Link
            href={`/registro?invite=${token}`}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <UserPlus className="w-4 h-4" />
            Crear cuenta
          </Link>
          <Link
            href={`/login?invite=${token}`}
            className="w-full flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 py-2.5 rounded-lg text-sm font-medium transition-colors"
          >
            <LogIn className="w-4 h-4" />
            Ya tengo cuenta — Iniciar sesión
          </Link>
        </div>
      )}
    </div>
  )
}

export default function InvitacionPage() {
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
        <Suspense fallback={
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 text-emerald-600 animate-spin" />
          </div>
        }>
          <InvitacionContent />
        </Suspense>
      </div>
    </div>
  )
}
