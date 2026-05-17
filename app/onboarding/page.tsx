'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Shield, Briefcase, ChevronRight, Sparkles } from 'lucide-react'

export default function OnboardingPage() {
  const [step, setStep] = useState<'name' | 'done'>('name')
  const [workspaceName, setWorkspaceName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userNombre, setUserNombre] = useState('')
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const nombre = user.user_metadata?.nombre || user.email?.split('@')[0] || 'Mi'
      setUserNombre(nombre)
      setWorkspaceName(`${nombre} Workspace`)

      // Buscar workspace PROPIO (owner) — no membresías de otros workspaces
      // Esto evita que un usuario invitado a otro workspace lo confunda con el suyo
      const { data: ownWs } = await supabase
        .from('workspaces')
        .select('id, name, setup_completed')
        .eq('owner_id', user.id)
        .limit(1)
        .maybeSingle()

      if (ownWs) {
        setWorkspaceId(ownWs.id)
        // Si ya completó el onboarding, ir directo al CRM
        if (ownWs.setup_completed) {
          window.location.href = '/'
          return
        }
        // Pre-llenar con el nombre actual del workspace
        if (ownWs.name) setWorkspaceName(ownWs.name)
      }
    }
    init()
  }, [])

  async function handleSetup() {
    if (!workspaceName.trim()) {
      setError('El nombre del workspace es obligatorio')
      return
    }
    setLoading(true)
    setError('')

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    try {
      let finalWorkspaceId = workspaceId

      // Usar función RPC del servidor (SECURITY DEFINER — bypasea RLS)
      const { data: rpcData, error: rpcErr } = await supabase
        .rpc('setup_user_workspace', { p_name: workspaceName.trim() })

      if (rpcErr) throw rpcErr
      finalWorkspaceId = (rpcData as any)?.workspace_id || finalWorkspaceId

      setStep('done')
      setTimeout(() => { window.location.href = '/' }, 1800)
    } catch (e: any) {
      setError(e.message || 'Error al configurar el workspace')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-sm p-8 text-center">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <Sparkles className="w-8 h-8 text-emerald-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900 mb-2">¡Todo listo!</h1>
          <p className="text-sm text-slate-500">Redirigiendo a tu CRM...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm w-full max-w-md p-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 bg-emerald-600 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-slate-900 leading-tight">Senda Seguros</p>
            <p className="text-xs text-slate-500">CRM</p>
          </div>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">
            ¡Bienvenido{userNombre ? `, ${userNombre}` : ''}!
          </h1>
          <p className="text-sm text-slate-500">
            Configura tu workspace. Este es tu espacio privado de trabajo donde vivirán todos tus clientes, pólizas y gestiones.
          </p>
        </div>

        {/* Nombre del workspace */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-1.5 flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-slate-400" />
            Nombre de tu workspace
          </label>
          <input
            type="text"
            value={workspaceName}
            onChange={e => setWorkspaceName(e.target.value)}
            placeholder="Ej: Sara Lopera Workspace"
            maxLength={60}
            className="w-full px-3 py-2.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <p className="text-xs text-slate-400 mt-1.5">
            Puedes cambiarlo en cualquier momento desde Configuración.
          </p>
        </div>

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-4">
            {error}
          </p>
        )}

        <button
          onClick={handleSetup}
          disabled={loading || !workspaceName.trim()}
          className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-300 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
        >
          {loading ? 'Configurando...' : (
            <>Comenzar a usar el CRM <ChevronRight className="w-4 h-4" /></>
          )}
        </button>
      </div>
    </div>
  )
}
