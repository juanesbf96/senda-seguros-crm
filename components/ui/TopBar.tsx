'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { MessageSquare, Bell, LogOut, Settings, ExternalLink, ChevronRight, X } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

// ── Emojis disponibles para el perfil ────────────────────────────────────────
const EMOJIS = [
  '😊','🙂','😎','🤓','🧑‍💼','👨‍💼','👩‍💼','👨‍💻','👩‍💻',
  '🦸','🤵','👑','🚀','⭐','🌟','🔥','💼','🎯','🏆','💡',
]

const EMOJI_KEY = 'senda-user-emoji'
const DEFAULT_EMOJI = '🙂'

// ── Tipos alertas ─────────────────────────────────────────────────────────────
interface Notif {
  id: string
  tipo: 'renovacion' | 'cobro' | 'tarea' | 'diligencia'
  titulo: string
  subtitulo: string
  href: string
  urgente: boolean
}

const TIPO_COLOR: Record<Notif['tipo'], string> = {
  renovacion: 'bg-amber-100 text-amber-700',
  cobro:      'bg-red-100 text-red-700',
  tarea:      'bg-blue-100 text-blue-700',
  diligencia: 'bg-orange-100 text-orange-700',
}
const TIPO_LABEL: Record<Notif['tipo'], string> = {
  renovacion: 'Renovación',
  cobro:      'Cobro vencido',
  tarea:      'Tarea urgente',
  diligencia: 'Diligencia',
}

// ── Hook: cerrar al click fuera ────────────────────────────────────────────────
function useOutside(ref: React.RefObject<HTMLDivElement | null>, cb: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cb()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, cb])
}

// ── Panel wrapper ─────────────────────────────────────────────────────────────
function Panel({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div className="absolute top-14 right-0 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-[70] overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
      {children}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
export default function TopBar() {
  const router = useRouter()

  const [openPanel, setOpenPanel] = useState<'mensajes' | 'notifs' | 'perfil' | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  // Perfil
  const [emoji,    setEmoji]    = useState(DEFAULT_EMOJI)
  const [userName, setUserName] = useState('')
  const [userEmail,setUserEmail]= useState('')
  const [pickingEmoji, setPickingEmoji] = useState(false)

  // Notificaciones
  const [notifs,   setNotifs]   = useState<Notif[]>([])
  const [loadingN, setLoadingN] = useState(false)

  useOutside(wrapRef, () => { setOpenPanel(null); setPickingEmoji(false) })

  // Cargar emoji guardado y datos del usuario
  useEffect(() => {
    const saved = localStorage.getItem(EMOJI_KEY)
    if (saved && EMOJIS.includes(saved)) setEmoji(saved)

    supabase.auth.getUser().then(({ data }) => {
      setUserName(data.user?.user_metadata?.nombre ?? '')
      setUserEmail(data.user?.email ?? '')
    })
  }, [])

  // Cargar notificaciones reales del CRM
  const loadNotifs = useCallback(async () => {
    setLoadingN(true)
    const hoy  = new Date()
    const en30 = new Date(hoy); en30.setDate(hoy.getDate() + 30)
    const en7  = new Date(hoy); en7.setDate(hoy.getDate() + 7)

    const [
      { data: renovs },
      { data: cobrosV },
      { data: tareasU },
      { data: diligU },
    ] = await Promise.all([
      supabase.from('polizas').select('id, aseguradora, ramo, fecha_fin, cliente:clientes(nombre)')
        .eq('estado', 'activa').eq('eliminada', false)
        .gte('fecha_fin', hoy.toISOString().split('T')[0])
        .lte('fecha_fin', en30.toISOString().split('T')[0])
        .order('fecha_fin').limit(8),
      supabase.from('cobros').select('id, concepto, valor, cliente:clientes(nombre)')
        .eq('estado', 'vencido').order('created_at', { ascending: false }).limit(5),
      supabase.from('tareas').select('id, titulo, fecha_vencimiento')
        .eq('completada', false).eq('prioridad', 'urgente').limit(5),
      supabase.from('diligencias').select('id, descripcion, fecha_limite')
        .not('estado', 'in', '("completada","cancelada")')
        .lte('fecha_limite', en7.toISOString().split('T')[0]).limit(5),
    ])

    const items: Notif[] = []
    ;(renovs || []).forEach((r: any) => {
      const dias = Math.ceil((new Date(r.fecha_fin).getTime() - hoy.getTime()) / 86400000)
      items.push({ id: r.id, tipo: 'renovacion', urgente: dias <= 7,
        titulo: `${r.aseguradora} ${r.ramo}`,
        subtitulo: `Vence en ${dias} día${dias !== 1 ? 's' : ''} · ${r.cliente?.nombre || ''}`,
        href: '/renovaciones' })
    })
    ;(cobrosV || []).forEach((c: any) => {
      const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(c.valor)
      items.push({ id: c.id, tipo: 'cobro', urgente: true,
        titulo: c.concepto, subtitulo: `${c.cliente?.nombre || ''} · ${fmt}`, href: '/cobros' })
    })
    ;(tareasU || []).forEach((t: any) => {
      items.push({ id: t.id, tipo: 'tarea', urgente: true,
        titulo: t.titulo,
        subtitulo: t.fecha_vencimiento ? `Vence: ${new Date(t.fecha_vencimiento).toLocaleDateString('es-CO')}` : 'Sin fecha',
        href: '/tareas' })
    })
    ;(diligU || []).forEach((d: any) => {
      items.push({ id: d.id, tipo: 'diligencia', urgente: true,
        titulo: d.descripcion,
        subtitulo: `Límite: ${d.fecha_limite ? new Date(d.fecha_limite).toLocaleDateString('es-CO') : '—'}`,
        href: '/diligencias' })
    })

    setNotifs(items)
    setLoadingN(false)
  }, [])

  function toggle(panel: 'mensajes' | 'notifs' | 'perfil') {
    if (openPanel === panel) { setOpenPanel(null); setPickingEmoji(false) }
    else {
      setOpenPanel(panel)
      setPickingEmoji(false)
      if (panel === 'notifs') loadNotifs()
    }
  }

  function changeEmoji(e: string) {
    setEmoji(e)
    localStorage.setItem(EMOJI_KEY, e)
    setPickingEmoji(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const urgentes = notifs.filter(n => n.urgente).length

  return (
    <div ref={wrapRef} className="fixed top-4 right-5 z-[60] flex items-center gap-2.5">

      {/* ── MENSAJES ── */}
      <div className="relative">
        <button onClick={() => toggle('mensajes')} title="Mensajes"
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 transition-all duration-150 ${
            openPanel === 'mensajes'
              ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-200'
              : 'bg-white border-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
          }`}>
          <MessageSquare className="w-4 h-4" />
        </button>

        {openPanel === 'mensajes' && (
          <Panel onClose={() => setOpenPanel(null)}>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm">Mensajes</h3>
              <button onClick={() => setOpenPanel(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-3">
                <MessageSquare className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-sm font-medium text-slate-700 mb-1">Mensajería CRM</p>
              <p className="text-xs text-slate-400 mb-4">Usa el Asistente virtual para consultas rápidas sobre tus datos del CRM.</p>
              <Link href="/asistente" onClick={() => setOpenPanel(null)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-colors">
                Abrir Asistente <ExternalLink className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Panel>
        )}
      </div>

      {/* ── NOTIFICACIONES ── */}
      <div className="relative">
        <button onClick={() => toggle('notifs')} title="Notificaciones"
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 transition-all duration-150 ${
            openPanel === 'notifs'
              ? 'bg-emerald-600 border-emerald-500 text-white shadow-emerald-200'
              : 'bg-white border-white text-slate-600 hover:border-emerald-300 hover:text-emerald-600'
          }`}>
          <Bell className="w-4 h-4" />
          {urgentes > 0 && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none">
              {urgentes > 9 ? '9+' : urgentes}
            </span>
          )}
        </button>

        {openPanel === 'notifs' && (
          <Panel onClose={() => setOpenPanel(null)}>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 text-sm">Notificaciones</h3>
                {urgentes > 0 && (
                  <span className="bg-red-100 text-red-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">{urgentes}</span>
                )}
              </div>
              <button onClick={() => setOpenPanel(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>

            {loadingN ? (
              <div className="p-4 space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded-xl animate-pulse" />)}
              </div>
            ) : notifs.length === 0 ? (
              <div className="p-8 text-center">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                  <Bell className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-sm text-slate-500">¡Sin alertas! Todo al día.</p>
              </div>
            ) : (
              <div className="max-h-80 overflow-y-auto divide-y divide-slate-50">
                {notifs.map(n => (
                  <Link key={n.id} href={n.href} onClick={() => setOpenPanel(null)}
                    className="flex items-start gap-3 px-4 py-3 hover:bg-slate-50 transition-colors">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5 ${TIPO_COLOR[n.tipo]}`}>
                      {TIPO_LABEL[n.tipo]}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{n.titulo}</p>
                      <p className="text-xs text-slate-400 truncate">{n.subtitulo}</p>
                    </div>
                    {n.urgente && <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1.5" />}
                  </Link>
                ))}
              </div>
            )}

            <div className="px-4 py-2.5 border-t border-slate-100">
              <Link href="/asistente" onClick={() => setOpenPanel(null)}
                className="flex items-center justify-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 font-medium">
                Ver centro de operaciones <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
          </Panel>
        )}
      </div>

      {/* ── PERFIL ── */}
      <div className="relative">
        <button onClick={() => toggle('perfil')} title="Mi perfil"
          className={`w-10 h-10 rounded-full flex items-center justify-center shadow-lg border-2 transition-all duration-150 text-lg leading-none ${
            openPanel === 'perfil'
              ? 'border-emerald-500 shadow-emerald-200 bg-emerald-50'
              : 'bg-white border-white hover:border-emerald-300'
          }`}>
          {emoji}
        </button>

        {openPanel === 'perfil' && (
          <Panel onClose={() => setOpenPanel(null)}>
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm">Mi perfil</h3>
              <button onClick={() => setOpenPanel(null)} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>

            {!pickingEmoji ? (
              <>
                {/* Avatar + datos */}
                <div className="px-4 py-4 flex items-center gap-3">
                  <button onClick={() => setPickingEmoji(true)} title="Cambiar emoji"
                    className="w-14 h-14 rounded-2xl bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-3xl transition-colors flex-shrink-0 relative group">
                    {emoji}
                    <span className="absolute inset-0 bg-black/20 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition-opacity">
                      ✏️
                    </span>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{userName || 'Usuario'}</p>
                    <p className="text-xs text-slate-400 truncate">{userEmail}</p>
                    <button onClick={() => setPickingEmoji(true)}
                      className="text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-0.5">
                      Cambiar emoji →
                    </button>
                  </div>
                </div>

                <div className="px-4 pb-3 space-y-1">
                  <Link href="/perfil" onClick={() => setOpenPanel(null)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors">
                    <span className="text-base">👤</span> Ver mi perfil
                  </Link>
                  <Link href="/configuracion" onClick={() => setOpenPanel(null)}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-slate-700 hover:bg-slate-100 transition-colors">
                    <Settings className="w-4 h-4 text-slate-500" /> Configuración
                  </Link>
                  <div className="border-t border-slate-100 pt-1 mt-1">
                    <button onClick={logout}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors">
                      <LogOut className="w-4 h-4" /> Cerrar sesión
                    </button>
                  </div>
                </div>
              </>
            ) : (
              <>
                <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-xs font-medium text-slate-600">Elige tu emoji</p>
                  <button onClick={() => setPickingEmoji(false)} className="text-xs text-slate-400 hover:text-slate-600">Cancelar</button>
                </div>
                <div className="p-4 grid grid-cols-5 gap-2">
                  {EMOJIS.map(e => (
                    <button key={e} onClick={() => changeEmoji(e)}
                      className={`w-full aspect-square rounded-xl text-2xl flex items-center justify-center transition-all hover:scale-110 ${
                        emoji === e ? 'bg-emerald-100 ring-2 ring-emerald-400' : 'hover:bg-slate-100'
                      }`}>
                      {e}
                    </button>
                  ))}
                </div>
                <div className="px-4 pb-3">
                  <p className="text-xs text-slate-400 text-center">Próximamente podrás subir una foto de perfil</p>
                </div>
              </>
            )}
          </Panel>
        )}
      </div>

    </div>
  )
}
