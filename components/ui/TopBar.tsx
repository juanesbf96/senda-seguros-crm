'use client'
import { useEffect, useRef, useState, useCallback } from 'react'
import { MessageSquare, Bell, LogOut, Settings, ExternalLink, ChevronRight, X, ArrowLeftRight, Search } from 'lucide-react'
import { supabase } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const EMOJIS = [
  '😊','🙂','😎','🤓','🧑‍💼','👨‍💼','👩‍💼','👨‍💻','👩‍💻',
  '🦸','🤵','👑','🚀','⭐','🌟','🔥','💼','🎯','🏆','💡',
]
const EMOJI_KEY = 'senda-user-emoji'
const DEFAULT_EMOJI = '🙂'

interface Notif {
  id: string
  tipo: 'renovacion' | 'cobro' | 'tarea' | 'diligencia'
  titulo: string
  subtitulo: string
  href: string
  urgente: boolean
}

const TIPO_COLOR: Record<Notif['tipo'], string> = {
  renovacion: 'bg-warning-soft text-ink-700',
  cobro:      'bg-error-soft text-error',
  tarea:      'bg-primary-100 text-primary-800',
  diligencia: 'bg-cream-200 text-ink-700',
}
const TIPO_LABEL: Record<Notif['tipo'], string> = {
  renovacion: 'Renovación',
  cobro:      'Cobro vencido',
  tarea:      'Tarea urgente',
  diligencia: 'Diligencia',
}

function useOutside(ref: React.RefObject<HTMLDivElement | null>, cb: () => void) {
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) cb()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [ref, cb])
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute top-12 right-0 w-80 bg-white rounded-2xl shadow-lifted border border-cream-200 z-[70] overflow-hidden animate-fade-in">
      {children}
    </div>
  )
}

export default function TopBar({ hq = 'seg' }: { hq?: 'seg' | 'mkt' }) {
  const router = useRouter()

  const [openPanel, setOpenPanel] = useState<'mensajes' | 'notifs' | 'perfil' | null>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const [emoji,       setEmoji]       = useState(DEFAULT_EMOJI)
  const [userName,    setUserName]    = useState('')
  const [userEmail,   setUserEmail]   = useState('')
  const [pickingEmoji, setPickingEmoji] = useState(false)

  const [notifs,   setNotifs]   = useState<Notif[]>([])
  const [loadingN, setLoadingN] = useState(false)

  useOutside(wrapRef, () => { setOpenPanel(null); setPickingEmoji(false) })

  useEffect(() => {
    const saved = localStorage.getItem(EMOJI_KEY)
    if (saved && EMOJIS.includes(saved)) setEmoji(saved)

    supabase.auth.getUser().then(({ data }) => {
      const meta = data.user?.user_metadata || {}
      setUserName(meta.nombre || meta.full_name || meta.name || '')
      setUserEmail(data.user?.email ?? '')
    })
  }, [])

  const loadNotifs = useCallback(async () => {
    setLoadingN(true)
    const hoy  = new Date()
    const en30 = new Date(hoy); en30.setDate(hoy.getDate() + 30)
    const en7  = new Date(hoy); en7.setDate(hoy.getDate() + 7)

    const [
      { data: renovs }, { data: cobrosV }, { data: tareasU }, { data: diligU },
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
    // Helper para nombre de cliente desde relación supabase (puede venir como objeto o array)
    const clienteNombre = (c: unknown): string => {
      if (!c) return ''
      if (Array.isArray(c)) return c[0]?.nombre || ''
      return (c as { nombre?: string }).nombre || ''
    }
    ;(renovs || []).forEach((r: { id: string; aseguradora: string; ramo: string; fecha_fin: string; cliente?: unknown }) => {
      const dias = Math.ceil((new Date(r.fecha_fin).getTime() - hoy.getTime()) / 86400000)
      items.push({ id: r.id, tipo: 'renovacion', urgente: dias <= 7,
        titulo: `${r.aseguradora} ${r.ramo}`,
        subtitulo: `Vence en ${dias} día${dias !== 1 ? 's' : ''} · ${clienteNombre(r.cliente)}`,
        href: '/renovaciones' })
    })
    ;(cobrosV || []).forEach((c: { id: string; concepto: string; valor: number; cliente?: unknown }) => {
      const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(c.valor)
      items.push({ id: c.id, tipo: 'cobro', urgente: true,
        titulo: c.concepto, subtitulo: `${clienteNombre(c.cliente)} · ${fmt}`, href: '/cobros' })
    })
    ;(tareasU || []).forEach((t: { id: string; titulo: string; fecha_vencimiento?: string }) => {
      items.push({ id: t.id, tipo: 'tarea', urgente: true,
        titulo: t.titulo,
        subtitulo: t.fecha_vencimiento ? `Vence: ${new Date(t.fecha_vencimiento).toLocaleDateString('es-CO')}` : 'Sin fecha',
        href: '/tareas' })
    })
    ;(diligU || []).forEach((d: { id: string; descripcion: string; fecha_limite?: string }) => {
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
      setOpenPanel(panel); setPickingEmoji(false)
      if (panel === 'notifs') loadNotifs()
    }
  }

  function changeEmoji(e: string) {
    setEmoji(e); localStorage.setItem(EMOJI_KEY, e); setPickingEmoji(false)
  }

  async function logout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  function switchHQ() {
    setOpenPanel(null)
    router.push(hq === 'seg' ? '/mkt' : '/')
  }

  const urgentes = notifs.filter(n => n.urgente).length
  const isSeg = hq === 'seg'
  const firstName = userName.split(' ')[0] || ''

  return (
    <header className="sticky top-0 z-40 h-16 px-6 flex items-center gap-4 border-b border-cream-200/60 bg-white/55 backdrop-blur-xl">
      {/* Search */}
      <div className="hidden md:flex items-center gap-2 h-10 px-4 rounded-pill bg-cream-100 border border-cream-200 w-72">
        <Search className="w-4 h-4 text-ink-400 flex-shrink-0" />
        <input
          type="text"
          placeholder="Buscar clientes, pólizas..."
          className="flex-1 bg-transparent outline-none text-sm text-ink-700 placeholder:text-ink-300"
        />
        <kbd className="hidden lg:inline text-[10px] text-ink-400 bg-white border border-cream-200 px-1.5 py-0.5 rounded">⌘K</kbd>
      </div>

      <div ref={wrapRef} className="ml-auto flex items-center gap-2">
        {/* HQ Switcher */}
        <button
          onClick={switchHQ}
          title={isSeg ? 'Cambiar a MKT HQ' : 'Cambiar a SEG HQ'}
          className={cn(
            'h-10 px-3.5 rounded-pill flex items-center gap-2 font-semibold text-xs tracking-wide transition-all',
            isSeg
              ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-soft'
              : 'bg-info text-white hover:opacity-90 shadow-soft',
          )}
        >
          <span>{isSeg ? '⚡ SEG' : '🚀 MKT'}</span>
          <ArrowLeftRight className="w-3.5 h-3.5 opacity-70" />
        </button>

        {/* Mensajes */}
        <div className="relative">
          <button onClick={() => toggle('mensajes')} title="Mensajes"
            className={cn(
              'w-10 h-10 rounded-pill flex items-center justify-center transition-all',
              openPanel === 'mensajes'
                ? 'bg-ink-700 text-white'
                : 'bg-cream-100 text-ink-500 hover:bg-cream-200 hover:text-ink-700',
            )}>
            <MessageSquare className="w-4 h-4" />
          </button>
          {openPanel === 'mensajes' && (
            <Panel>
              <div className="px-4 py-3 border-b border-cream-200 flex items-center justify-between">
                <h3 className="font-semibold text-ink-700 text-sm">Mensajes</h3>
                <button onClick={() => setOpenPanel(null)} className="text-ink-400 hover:text-ink-700"><X className="w-4 h-4" /></button>
              </div>
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-primary-100 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare className="w-6 h-6 text-primary-700" />
                </div>
                <p className="text-sm font-medium text-ink-700 mb-1">Centro de mensajes</p>
                <p className="text-xs text-ink-400 mb-4">Próximamente conectado con WhatsApp y redes.</p>
                <Link href="/asistente" onClick={() => setOpenPanel(null)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-pill text-sm font-medium transition-colors">
                  Asistente virtual <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            </Panel>
          )}
        </div>

        {/* Notificaciones */}
        <div className="relative">
          <button onClick={() => toggle('notifs')} title="Notificaciones"
            className={cn(
              'w-10 h-10 rounded-pill flex items-center justify-center transition-all relative',
              openPanel === 'notifs'
                ? 'bg-ink-700 text-white'
                : 'bg-cream-100 text-ink-500 hover:bg-cream-200 hover:text-ink-700',
            )}>
            <Bell className="w-4 h-4" />
            {urgentes > 0 && openPanel !== 'notifs' && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-error text-white text-[10px] font-bold rounded-full flex items-center justify-center leading-none ring-2 ring-white">
                {urgentes > 9 ? '9+' : urgentes}
              </span>
            )}
          </button>
          {openPanel === 'notifs' && (
            <Panel>
              <div className="px-4 py-3 border-b border-cream-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-ink-700 text-sm">Notificaciones</h3>
                  {urgentes > 0 && (
                    <span className="bg-error-soft text-error text-xs font-semibold px-1.5 py-0.5 rounded-full">{urgentes}</span>
                  )}
                </div>
                <button onClick={() => setOpenPanel(null)} className="text-ink-400 hover:text-ink-700"><X className="w-4 h-4" /></button>
              </div>
              {loadingN ? (
                <div className="p-4 space-y-2">
                  {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-cream-100 rounded-xl animate-pulse" />)}
                </div>
              ) : notifs.length === 0 ? (
                <div className="p-8 text-center">
                  <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-2">
                    <Bell className="w-5 h-5 text-primary-700" />
                  </div>
                  <p className="text-sm text-ink-400">¡Sin alertas! Todo al día.</p>
                </div>
              ) : (
                <div className="max-h-80 overflow-y-auto divide-y divide-cream-100">
                  {notifs.map(n => (
                    <Link key={n.id} href={n.href} onClick={() => setOpenPanel(null)}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-cream-50 transition-colors">
                      <span className={cn('text-[10px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 mt-0.5', TIPO_COLOR[n.tipo])}>
                        {TIPO_LABEL[n.tipo]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-ink-700 truncate">{n.titulo}</p>
                        <p className="text-xs text-ink-400 truncate">{n.subtitulo}</p>
                      </div>
                      {n.urgente && <span className="w-2 h-2 bg-error rounded-full flex-shrink-0 mt-1.5" />}
                    </Link>
                  ))}
                </div>
              )}
              <div className="px-4 py-2.5 border-t border-cream-200">
                <Link href="/asistente" onClick={() => setOpenPanel(null)}
                  className="flex items-center justify-center gap-1 text-xs text-primary-700 hover:text-primary-800 font-medium">
                  Ver centro de operaciones <ChevronRight className="w-3 h-3" />
                </Link>
              </div>
            </Panel>
          )}
        </div>

        {/* Perfil */}
        <div className="relative">
          <button onClick={() => toggle('perfil')} title="Mi perfil"
            className={cn(
              'h-10 pl-1 pr-4 rounded-pill flex items-center gap-2 transition-all',
              openPanel === 'perfil'
                ? 'bg-ink-700 text-white'
                : 'bg-cream-100 text-ink-700 hover:bg-cream-200',
            )}>
            <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-base leading-none shadow-soft">
              {emoji}
            </span>
            {firstName && <span className="text-xs font-semibold">{firstName}</span>}
          </button>

          {openPanel === 'perfil' && (
            <Panel>
              <div className="px-4 py-3 border-b border-cream-200 flex items-center justify-between">
                <h3 className="font-semibold text-ink-700 text-sm">Mi perfil</h3>
                <button onClick={() => setOpenPanel(null)} className="text-ink-400 hover:text-ink-700"><X className="w-4 h-4" /></button>
              </div>

              {!pickingEmoji ? (
                <>
                  <div className="px-4 py-4 flex items-center gap-3">
                    <button onClick={() => setPickingEmoji(true)} title="Cambiar emoji"
                      className="w-14 h-14 rounded-2xl bg-cream-100 hover:bg-cream-200 flex items-center justify-center text-3xl transition-colors flex-shrink-0 relative group">
                      {emoji}
                      <span className="absolute inset-0 bg-ink-700/20 rounded-2xl opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs font-medium transition-opacity">
                        ✏️
                      </span>
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-ink-700 truncate">{userName || 'Usuario'}</p>
                      <p className="text-xs text-ink-400 truncate">{userEmail}</p>
                      <button onClick={() => setPickingEmoji(true)}
                        className="text-xs text-primary-700 hover:text-primary-800 font-medium mt-0.5">
                        Cambiar emoji →
                      </button>
                    </div>
                  </div>

                  <div className="px-4 pb-3 space-y-1">
                    <Link href="/perfil" onClick={() => setOpenPanel(null)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ink-700 hover:bg-cream-100 transition-colors">
                      <span className="text-base">👤</span> Ver mi perfil
                    </Link>
                    <Link href="/configuracion" onClick={() => setOpenPanel(null)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-ink-700 hover:bg-cream-100 transition-colors">
                      <Settings className="w-4 h-4 text-ink-400" /> Configuración
                    </Link>
                    <div className="border-t border-cream-200 pt-1 mt-1">
                      <button onClick={logout}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-error hover:bg-error-soft/50 transition-colors">
                        <LogOut className="w-4 h-4" /> Cerrar sesión
                      </button>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="px-4 py-3 border-b border-cream-200 flex items-center justify-between">
                    <p className="text-xs font-medium text-ink-500">Elige tu emoji</p>
                    <button onClick={() => setPickingEmoji(false)} className="text-xs text-ink-400 hover:text-ink-700">Cancelar</button>
                  </div>
                  <div className="p-4 grid grid-cols-5 gap-2">
                    {EMOJIS.map(e => (
                      <button key={e} onClick={() => changeEmoji(e)}
                        className={cn(
                          'w-full aspect-square rounded-xl text-2xl flex items-center justify-center transition-all hover:scale-110',
                          emoji === e ? 'bg-primary-100 ring-2 ring-primary-400' : 'hover:bg-cream-100',
                        )}>
                        {e}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </Panel>
          )}
        </div>
      </div>
    </header>
  )
}
