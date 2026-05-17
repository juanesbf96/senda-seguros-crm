'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { Users, UserPlus, Mail, Trash2, Shield, Eye, User, Clock, X, Check, Copy, RefreshCw, MessageCircle, Link as LinkIcon } from 'lucide-react'

interface Member {
  id: string
  user_id: string
  role: 'admin' | 'supervisor' | 'agente'
  joined_at: string
  email?: string
  nombre?: string
}

interface Invitation {
  id: string
  email: string
  role: string
  expires_at: string
  created_at: string
  token: string
}

const ROLE_CONFIG = {
  admin:      { label: 'Administrador', icon: Shield,    cls: 'bg-red-100 text-red-700' },
  supervisor: { label: 'Supervisor',    icon: Eye,       cls: 'bg-amber-100 text-amber-700' },
  agente:     { label: 'Agente',        icon: User,      cls: 'bg-blue-100 text-blue-700' },
}

export default function WorkspaceMembersView() {
  const { currentWorkspace, currentRole, isAdmin, refreshWorkspaces } = useWorkspace()
  const [members, setMembers] = useState<Member[]>([])
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'supervisor' | 'agente'>('agente')
  const [inviting, setInviting] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [copiedToken, setCopiedToken] = useState<string | null>(null)
  const [inviteSuccessLink, setInviteSuccessLink] = useState<string | null>(null)
  const [copiedSuccess, setCopiedSuccess] = useState(false)
  const [wsName, setWsName] = useState(currentWorkspace?.name || '')
  const [savingName, setSavingName] = useState(false)
  const [nameSaved, setNameSaved] = useState(false)

  useEffect(() => {
    if (currentWorkspace) {
      setWsName(currentWorkspace.name)
      loadData()
    }
  }, [currentWorkspace?.id])

  async function loadData() {
    if (!currentWorkspace) return
    setLoading(true)

    // Usar RPCs SECURITY DEFINER para leer miembros e invitaciones con email real
    const [{ data: membersData }, { data: invData }] = await Promise.all([
      supabase.rpc('get_workspace_members',    { p_workspace_id: currentWorkspace.id }),
      supabase.rpc('get_workspace_invitations', { p_workspace_id: currentWorkspace.id }),
    ])

    setMembers(Array.isArray(membersData) ? membersData as Member[] : [])
    setInvitations(Array.isArray(invData) ? invData as Invitation[] : [])
    setLoading(false)
  }

  async function saveWorkspaceName() {
    if (!currentWorkspace || !wsName.trim()) return
    setSavingName(true)
    await supabase
      .from('workspaces')
      .update({ name: wsName.trim() })
      .eq('id', currentWorkspace.id)
    await refreshWorkspaces()
    setSavingName(false)
    setNameSaved(true)
    setTimeout(() => setNameSaved(false), 2000)
  }

  async function sendInvitation() {
    if (!currentWorkspace || !inviteEmail.trim()) return
    setInviting(true)
    setInviteError('')

    // Usamos RPC SECURITY DEFINER para evitar bloqueos de RLS en el INSERT
    const { data, error } = await supabase.rpc('create_workspace_invitation', {
      p_workspace_id: currentWorkspace.id,
      p_email:        inviteEmail.trim().toLowerCase(),
      p_role:         inviteRole,
    })

    if (error || data?.error) {
      setInviteError(error?.message || data?.error || 'Error al generar la invitación')
    } else {
      const link = `${window.location.origin}/invitacion?token=${data.token}`
      setInviteSuccessLink(link)
      setShowInviteForm(false)
      setInviteEmail('')
      setInviteRole('agente')
      loadData()
    }
    setInviting(false)
  }

  async function changeRole(memberId: string, newRole: 'admin' | 'supervisor' | 'agente') {
    await supabase
      .from('workspace_members')
      .update({ role: newRole })
      .eq('id', memberId)
    loadData()
  }

  async function removeMember(memberId: string) {
    if (!confirm('¿Remover este miembro del workspace?')) return
    await supabase.from('workspace_members').delete().eq('id', memberId)
    loadData()
  }

  async function cancelInvitation(invId: string) {
    await supabase.from('workspace_invitations').delete().eq('id', invId)
    loadData()
  }

  function copyInviteLink(token: string) {
    const link = `${window.location.origin}/invitacion?token=${token}`
    navigator.clipboard.writeText(link).then(() => {
      setCopiedToken(token)
      setTimeout(() => setCopiedToken(null), 2000)
    })
  }

  if (!currentWorkspace) return null

  return (
    <div className="space-y-6">
      {/* Nombre del workspace */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Shield className="w-4 h-4 text-emerald-600" /> Nombre del workspace
        </h3>
        <div className="flex gap-3">
          <input
            value={wsName}
            onChange={e => setWsName(e.target.value)}
            placeholder="Nombre del workspace"
            className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
          <button
            onClick={saveWorkspaceName}
            disabled={savingName || wsName === currentWorkspace.name}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {nameSaved ? <Check className="w-4 h-4" /> : savingName ? <RefreshCw className="w-4 h-4 animate-spin" /> : null}
            {nameSaved ? 'Guardado' : 'Guardar'}
          </button>
        </div>
      </div>

      {/* Miembros */}
      <div className="bg-white rounded-xl border border-slate-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-slate-800 flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" /> Miembros ({members.length})
          </h3>
          {isAdmin && (
            <button
              onClick={() => setShowInviteForm(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Invitar
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {members.map(m => {
              const cfg = ROLE_CONFIG[m.role]
              const Icon = cfg.icon
              return (
                <div key={m.id} className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 border border-slate-100">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <User className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {m.nombre || `Usuario ${m.user_id.substring(0, 8)}...`}
                    </p>
                    <p className="text-xs text-slate-400">
                      Unido {new Date(m.joined_at).toLocaleDateString('es-CO')}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.cls}`}>
                    <Icon className="w-3 h-3" />{cfg.label}
                  </span>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <select
                        value={m.role}
                        onChange={e => changeRole(m.id, e.target.value as any)}
                        className="text-xs border border-slate-200 rounded px-1.5 py-1 text-slate-600 focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      >
                        <option value="agente">Agente</option>
                        <option value="supervisor">Supervisor</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button
                        onClick={() => removeMember(m.id)}
                        className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Invitaciones pendientes */}
      {invitations.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <h3 className="font-semibold text-slate-800 mb-4 flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-500" /> Invitaciones pendientes ({invitations.length})
          </h3>
          <div className="space-y-2">
            {invitations.map(inv => (
              <div key={inv.id} className="flex items-center gap-3 p-3 rounded-lg bg-amber-50 border border-amber-100">
                <Mail className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">{inv.email}</p>
                  <p className="text-xs text-slate-400">
                    Expira {new Date(inv.expires_at).toLocaleDateString('es-CO')}
                    {' · '}<span className="capitalize">{inv.role}</span>
                  </p>
                </div>
                <button
                  onClick={() => copyInviteLink(inv.token)}
                  className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium px-2 py-1 rounded-lg hover:bg-emerald-50 transition-colors"
                >
                  {copiedToken === inv.token ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copiedToken === inv.token ? 'Copiado' : 'Copiar link'}
                </button>
                {isAdmin && (
                  <button
                    onClick={() => cancelInvitation(inv.id)}
                    className="p-1 text-slate-400 hover:text-red-600 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: link de invitación generado */}
      {inviteSuccessLink && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                <Check className="w-4 h-4 text-emerald-600" /> Link de invitación generado
              </h3>
              <button onClick={() => { setInviteSuccessLink(null); setCopiedSuccess(false) }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-500">Comparte este enlace con la persona que quieres invitar. Es válido por 7 días.</p>
              <div className="flex gap-2">
                <input
                  readOnly
                  value={inviteSuccessLink}
                  className="flex-1 px-3 py-2 text-xs border border-slate-200 rounded-lg bg-slate-50 text-slate-700 truncate focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  onClick={e => (e.target as HTMLInputElement).select()}
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(inviteSuccessLink).then(() => {
                      setCopiedSuccess(true)
                      setTimeout(() => setCopiedSuccess(false), 2000)
                    })
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors flex-shrink-0"
                >
                  {copiedSuccess ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  {copiedSuccess ? 'Copiado' : 'Copiar'}
                </button>
              </div>
              <button
                onClick={() => {
                  const text = encodeURIComponent(
                    `Te invito a unirte a ${currentWorkspace?.name} en Senda Seguros CRM. Acepta tu invitación aquí: ${inviteSuccessLink}`
                  )
                  window.open(`https://wa.me/?text=${text}`, '_blank')
                }}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                Enviar por WhatsApp
              </button>
            </div>
            <div className="p-5 border-t border-slate-200">
              <button
                onClick={() => { setInviteSuccessLink(null); setCopiedSuccess(false) }}
                className="w-full px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de invitación */}
      {showInviteForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
            <div className="flex items-center justify-between p-5 border-b border-slate-200">
              <h3 className="font-semibold text-slate-800">Invitar miembro</h3>
              <button onClick={() => setShowInviteForm(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Correo electrónico</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={e => setInviteEmail(e.target.value)}
                  placeholder="correo@ejemplo.com"
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Rol</label>
                <select
                  value={inviteRole}
                  onChange={e => setInviteRole(e.target.value as any)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <option value="agente">Agente — ve todo, edita lo suyo</option>
                  <option value="supervisor">Supervisor — ve y edita todo</option>
                  <option value="admin">Administrador — control total</option>
                </select>
              </div>
              <div className="bg-blue-50 rounded-lg p-3 text-xs text-blue-700">
                Se generará un enlace de invitación que podrás copiar y enviar por WhatsApp, correo o como prefieras. El enlace es válido por 7 días.
              </div>
              {inviteError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{inviteError}</p>
              )}
            </div>
            <div className="flex gap-3 p-5 border-t border-slate-200">
              <button onClick={() => setShowInviteForm(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors">
                Cancelar
              </button>
              <button onClick={sendInvitation} disabled={inviting || !inviteEmail.trim()}
                className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors">
                {inviting ? 'Generando...' : 'Generar link de invitación'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
