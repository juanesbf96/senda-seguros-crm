'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Shield, RotateCcw, ChevronDown, ChevronRight, Info, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react'

interface PermRow {
  role: string
  permission_key: string
  enabled: boolean
  label: string
  category: string
  description: string | null
}

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string; desc: string }> = {
  supervisor: {
    label: 'Supervisor',
    color: 'text-info',
    bg: 'bg-info/20',
    desc: 'Acceso casi completo. No puede editar datos de la agencia por defecto.',
  },
  agente: {
    label: 'Agente',
    color: 'text-ink-700',
    bg: 'bg-warning-soft',
    desc: 'Acceso restringido. Puede ver todo pero solo editar/gestionar lo que le pertenece.',
  },
}

const CATEGORY_ORDER = [
  'Clientes', 'Pólizas', 'Tareas', 'Finanzas', 'Siniestros',
  'Solicitudes', 'Metas', 'Dashboard', 'Configuración', 'Pipeline',
]

export default function PermisosRolesView() {
  const { currentWorkspace } = useWorkspace()
  const [perms, setPerms] = useState<PermRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [activeRole, setActiveRole] = useState<'supervisor' | 'agente'>('agente')
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!currentWorkspace) return
    setLoading(true)
    const { data, error: err } = await supabase.rpc('get_workspace_permissions', {
      p_workspace_id: currentWorkspace.id,
    })
    if (err) {
      setError('Error al cargar permisos: ' + err.message)
    } else {
      setPerms(Array.isArray(data) ? data : [])
    }
    setLoading(false)
  }, [currentWorkspace?.id])

  useEffect(() => { load() }, [load])

  async function toggle(row: PermRow) {
    if (!currentWorkspace) return
    const key = `${row.role}_${row.permission_key}`
    setSaving(key)
    setError('')

    // Optimistic update
    setPerms(prev => prev.map(p =>
      p.role === row.role && p.permission_key === row.permission_key
        ? { ...p, enabled: !p.enabled }
        : p
    ))

    const { error: err } = await supabase.rpc('update_workspace_permission', {
      p_workspace_id: currentWorkspace.id,
      p_role: row.role,
      p_permission_key: row.permission_key,
      p_enabled: !row.enabled,
    })

    if (err) {
      setError('Error al guardar: ' + err.message)
      // Revert
      setPerms(prev => prev.map(p =>
        p.role === row.role && p.permission_key === row.permission_key
          ? { ...p, enabled: row.enabled }
          : p
      ))
    }
    setSaving(null)
  }

  async function resetRole(role: string) {
    if (!currentWorkspace) return
    if (!confirm(`¿Resetear todos los permisos de ${ROLE_LABELS[role].label} a los valores predeterminados?`)) return
    setSaving(`reset_${role}`)
    setError('')
    const { error: err } = await supabase.rpc('reset_role_permissions', {
      p_workspace_id: currentWorkspace.id,
      p_role: role,
    })
    if (err) {
      setError('Error al resetear: ' + err.message)
    } else {
      await load()
    }
    setSaving(null)
  }

  function toggleCategory(cat: string) {
    setCollapsed(prev => ({ ...prev, [cat]: !prev[cat] }))
  }

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <Loader2 className="w-6 h-6 text-primary-500 animate-spin" />
    </div>
  )

  const rolePerms = perms.filter(p => p.role === activeRole)
  const categories = CATEGORY_ORDER.filter(cat => rolePerms.some(p => p.category === cat))
  const enabledCount = rolePerms.filter(p => p.enabled).length
  const totalCount = rolePerms.length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="bg-white rounded-xl border border-ink-200 p-5">
        <div className="flex items-start gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
            <Shield className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <h3 className="font-semibold text-ink-700">Permisos por rol</h3>
            <p className="text-sm text-ink-400 mt-0.5">
              Configura qué puede hacer cada rol en tu workspace. Los administradores siempre tienen acceso completo.
            </p>
          </div>
        </div>

        {/* Role selector */}
        <div className="flex gap-2">
          {(['supervisor', 'agente'] as const).map(role => {
            const rp = perms.filter(p => p.role === role)
            const enabled = rp.filter(p => p.enabled).length
            const total = rp.length
            const info = ROLE_LABELS[role]
            return (
              <button
                key={role}
                onClick={() => setActiveRole(role)}
                className={`flex-1 text-left p-4 rounded-xl border-2 transition-all ${
                  activeRole === role
                    ? 'border-violet-400 bg-violet-50'
                    : 'border-ink-200 hover:border-ink-300 bg-white'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-semibold px-2 py-0.5 rounded-full ${info.bg} ${info.color}`}>
                    {info.label}
                  </span>
                  <span className="text-xs text-ink-400">{enabled}/{total} activos</span>
                </div>
                <p className="text-xs text-ink-400 mt-1">{info.desc}</p>
                {/* Progress bar */}
                <div className="mt-2 h-1.5 bg-cream-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-400 rounded-full transition-all"
                    style={{ width: `${total > 0 ? (enabled / total) * 100 : 0}%` }}
                  />
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {error && (
        <div className="bg-error-soft border border-error/30 rounded-xl p-3 text-sm text-error">
          {error}
        </div>
      )}

      {/* Permissions by category */}
      <div className="space-y-3">
        {categories.map(cat => {
          const catPerms = rolePerms.filter(p => p.category === cat)
          const isCollapsed = collapsed[cat]
          const allEnabled = catPerms.every(p => p.enabled)
          const someEnabled = catPerms.some(p => p.enabled)

          return (
            <div key={cat} className="bg-white rounded-xl border border-ink-200 overflow-hidden">
              {/* Category header */}
              <button
                onClick={() => toggleCategory(cat)}
                className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-cream-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {isCollapsed
                    ? <ChevronRight className="w-4 h-4 text-ink-400" />
                    : <ChevronDown className="w-4 h-4 text-ink-400" />
                  }
                  <span className="font-semibold text-ink-700 text-sm">{cat}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    allEnabled
                      ? 'bg-primary-100 text-primary-700'
                      : someEnabled
                      ? 'bg-warning-soft text-ink-700'
                      : 'bg-cream-200 text-ink-400'
                  }`}>
                    {catPerms.filter(p => p.enabled).length}/{catPerms.length}
                  </span>
                </div>
              </button>

              {/* Permission rows */}
              {!isCollapsed && (
                <div className="divide-y divide-cream-200 border-t border-cream-200">
                  {catPerms.map(perm => {
                    const savingKey = `${perm.role}_${perm.permission_key}`
                    const isSaving = saving === savingKey
                    return (
                      <div
                        key={perm.permission_key}
                        className="flex items-center gap-4 px-5 py-3.5 hover:bg-cream-100/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-ink-700">{perm.label}</p>
                          {perm.description && (
                            <p className="text-xs text-ink-400 mt-0.5 flex items-center gap-1">
                              <Info className="w-3 h-3 flex-shrink-0" />
                              {perm.description}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => toggle(perm)}
                          disabled={isSaving}
                          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all min-w-[90px] justify-center ${
                            perm.enabled
                              ? 'bg-primary-50 border-primary-200 text-primary-700 hover:bg-primary-100'
                              : 'bg-cream-200 border-ink-200 text-ink-400 hover:bg-ink-200'
                          } disabled:opacity-60`}
                        >
                          {isSaving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : perm.enabled ? (
                            <><ToggleRight className="w-4 h-4 text-primary-500" /> Activo</>
                          ) : (
                            <><ToggleLeft className="w-4 h-4 text-ink-400" /> Inactivo</>
                          )}
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Reset button */}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => resetRole(activeRole)}
          disabled={saving?.startsWith('reset')}
          className="flex items-center gap-2 px-4 py-2 text-sm text-ink-500 border border-ink-200 rounded-lg hover:bg-cream-100 transition-colors disabled:opacity-50"
        >
          {saving?.startsWith('reset')
            ? <Loader2 className="w-4 h-4 animate-spin" />
            : <RotateCcw className="w-4 h-4" />
          }
          Restablecer permisos de {ROLE_LABELS[activeRole].label}
        </button>
      </div>

      {/* Info box */}
      <div className="bg-info/10 border border-info/30 rounded-xl p-4 text-sm text-info">
        <strong>Nota:</strong> Los cambios de permisos aplican inmediatamente. El usuario afectado verá los nuevos permisos la próxima vez que recargue el CRM. Los administradores siempre tienen acceso completo y no se pueden restringir.
      </div>
    </div>
  )
}
