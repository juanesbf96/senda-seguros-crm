'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import {
  Bot, Send, AlertTriangle, Bell, CheckSquare, Users,
  FileText, DollarSign, TrendingUp, Zap, RefreshCw, Clock, Sparkles,
} from 'lucide-react'

interface Alerta {
  id: string
  tipo: 'renovacion' | 'cobro' | 'tarea' | 'diligencia' | 'siniestro'
  titulo: string
  subtitulo: string
  urgente: boolean
  href?: string
}

interface Resumen {
  clientes: number
  polizasActivas: number
  renovacionesMes: number
  cobrosPendientes: number
  tareasPendientes: number
  prospectos: number
  primaTotalActiva: number
  siniestrosAbiertos: number
}

interface ChatMsg {
  role: 'user' | 'assistant'
  text: string
}

const SUGERENCIAS = [
  '¿Cuántos clientes tengo?',
  '¿Qué pólizas vencen esta semana?',
  '¿Cuánto vale mi prima total activa?',
  '¿Cuáles son mis cobros vencidos?',
  '¿Cuántas tareas tengo pendientes?',
  '¿Cuántos siniestros están abiertos?',
]

function MsgText({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : p.split('\n').map((line, j, arr) => (
              <span key={`${i}-${j}`}>{line}{j < arr.length - 1 ? <br /> : null}</span>
            ))
      )}
    </span>
  )
}

export default function AsistenteView() {
  const { currentWorkspace } = useWorkspace()
  const [resumen, setResumen]       = useState<Resumen | null>(null)
  const [alertas, setAlertas]       = useState<Alerta[]>([])
  const [contexto, setContexto]     = useState<string>('')
  const [msgs, setMsgs]             = useState<ChatMsg[]>([
    { role: 'assistant', text: '¡Hola! Soy tu asistente de Senda Seguros con IA. Puedo entender preguntas en lenguaje natural sobre tus clientes, pólizas, cobros, tareas y más. ¿En qué te puedo ayudar?' }
  ])
  const [input, setInput]           = useState('')
  const [thinking, setThinking]     = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [groqOk, setGroqOk]         = useState<boolean | null>(null)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])
  useEffect(() => { if (currentWorkspace) loadResumen() }, [currentWorkspace])

  async function loadResumen() {
    if (!currentWorkspace) return
    setLoadingData(true)
    const wid = currentWorkspace.id
    const hoy = new Date()
    const en7  = new Date(hoy); en7.setDate(hoy.getDate() + 7)
    const en30 = new Date(hoy); en30.setDate(hoy.getDate() + 30)

    const [
      { count: clientes },
      { count: polizasActivas },
      { data: primaData },
      { count: cobrosPend },
      { data: cobrosDetalle },
      { count: tareasPend },
      { data: tareasDetalle },
      { count: prospectos },
      { count: siniestros },
      { data: renovs },
      { data: cobrosVenc },
      { data: tareasUrg },
      { data: diligUrg },
      { data: miembros },
    ] = await Promise.all([
      supabase.from('clientes').select('id', { count: 'exact', head: true }).eq('workspace_id', wid),
      supabase.from('polizas').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).eq('estado', 'activa').eq('eliminada', false),
      supabase.from('polizas').select('prima').eq('workspace_id', wid).eq('estado', 'activa').eq('eliminada', false),
      supabase.from('cobros').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).eq('estado', 'pendiente'),
      supabase.from('cobros').select('concepto, valor, estado, fecha_vencimiento, cliente:clientes(nombre)').eq('workspace_id', wid).in('estado', ['pendiente', 'vencido']).order('fecha_vencimiento').limit(20),
      supabase.from('tareas').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).eq('completada', false),
      supabase.from('tareas').select('titulo, prioridad, fecha_vencimiento, asignado_a').eq('workspace_id', wid).eq('completada', false).order('fecha_vencimiento').limit(15),
      supabase.from('prospectos').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).not('etapa', 'in', '("cerrado_ganado","cerrado_perdido")'),
      supabase.from('siniestros').select('id', { count: 'exact', head: true }).eq('workspace_id', wid).not('estado', 'in', '("cerrado","rechazado")'),
      // Alertas
      supabase.from('polizas').select('id, numero_poliza, aseguradora, ramo, fecha_fin, prima, cliente:clientes(nombre)').eq('workspace_id', wid)
        .eq('estado', 'activa').eq('eliminada', false)
        .gte('fecha_fin', hoy.toISOString().split('T')[0])
        .lte('fecha_fin', en30.toISOString().split('T')[0])
        .order('fecha_fin').limit(10),
      supabase.from('cobros').select('id, concepto, valor, fecha_vencimiento, cliente:clientes(nombre)').eq('workspace_id', wid)
        .eq('estado', 'vencido').order('fecha_vencimiento').limit(10),
      supabase.from('tareas').select('id, titulo, fecha_vencimiento').eq('workspace_id', wid)
        .eq('completada', false).eq('prioridad', 'urgente').limit(5),
      supabase.from('diligencias').select('id, descripcion, tipo, fecha_limite').eq('workspace_id', wid)
        .not('estado', 'in', '("completada","cancelada")')
        .lte('fecha_limite', en7.toISOString().split('T')[0]).limit(5),
      supabase.rpc('get_workspace_members', { p_workspace_id: wid }),
    ])

    const primaTotalActiva = (primaData || []).reduce((s, p) => s + (p.prima || 0), 0)
    const renovMes = (renovs || []).length

    setResumen({
      clientes: clientes || 0, polizasActivas: polizasActivas || 0,
      renovacionesMes: renovMes, cobrosPendientes: cobrosPend || 0,
      tareasPendientes: tareasPend || 0, prospectos: prospectos || 0,
      primaTotalActiva, siniestrosAbiertos: siniestros || 0,
    })

    // ── Alertas ──────────────────────────────────────────────
    const newAlertas: Alerta[] = []
    ;(renovs || []).forEach((r: any) => {
      const dias = Math.ceil((new Date(r.fecha_fin).getTime() - hoy.getTime()) / 86400000)
      newAlertas.push({
        id: r.id, tipo: 'renovacion', urgente: dias <= 7,
        titulo: `Póliza por renovar en ${dias} día(s)`,
        subtitulo: `${r.cliente?.nombre || '?'} – ${r.aseguradora} ${r.ramo}`,
        href: '/renovaciones',
      })
    })
    ;(cobrosVenc || []).forEach((c: any) => {
      newAlertas.push({
        id: c.id, tipo: 'cobro', urgente: true,
        titulo: `Cobro vencido: ${c.concepto}`,
        subtitulo: `${c.cliente?.nombre || '?'} – ${new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(c.valor)}`,
        href: '/cobros',
      })
    })
    ;(tareasUrg || []).forEach((t: any) => {
      newAlertas.push({
        id: t.id, tipo: 'tarea', urgente: true,
        titulo: t.titulo,
        subtitulo: t.fecha_vencimiento ? `Vence: ${new Date(t.fecha_vencimiento).toLocaleDateString('es-CO')}` : 'Sin fecha límite',
        href: '/tareas',
      })
    })
    ;(diligUrg || []).forEach((d: any) => {
      newAlertas.push({
        id: d.id, tipo: 'diligencia', urgente: true,
        titulo: d.descripcion,
        subtitulo: `Límite: ${d.fecha_limite ? new Date(d.fecha_limite).toLocaleDateString('es-CO') : '—'}`,
        href: '/diligencias',
      })
    })
    setAlertas(newAlertas)

    // ── Contexto para la IA ─────────────────────────────────
    const fmtCOP = (v: number) =>
      new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(v)

    const miembrosStr = (miembros || []).map((m: any) =>
      `  - ${m.nombre || m.email} (${m.role})`
    ).join('\n') || '  (sin datos)'

    const cobrosStr = (cobrosDetalle || []).map((c: any) =>
      `  - ${c.cliente?.nombre || '?'}: ${c.concepto} ${fmtCOP(c.valor || 0)} [${c.estado}]${c.fecha_vencimiento ? ` vence ${c.fecha_vencimiento}` : ''}`
    ).join('\n') || '  (ninguno)'

    const tareasStr = (tareasDetalle || []).map((t: any) =>
      `  - [${t.prioridad}] ${t.titulo}${t.fecha_vencimiento ? ` (vence ${t.fecha_vencimiento})` : ''}`
    ).join('\n') || '  (ninguna)'

    const renovsStr = (renovs || []).map((r: any) => {
      const dias = Math.ceil((new Date(r.fecha_fin).getTime() - hoy.getTime()) / 86400000)
      return `  - ${r.cliente?.nombre || '?'}: ${r.aseguradora} ${r.ramo} – vence en ${dias} días (${r.fecha_fin}) prima ${fmtCOP(r.prima || 0)}`
    }).join('\n') || '  (ninguna próximamente)'

    const ctx = `
RESUMEN GENERAL:
- Total clientes: ${clientes || 0}
- Pólizas activas: ${polizasActivas || 0}
- Prima total activa: ${fmtCOP(primaTotalActiva)}
- Pólizas por renovar en 30 días: ${renovMes}
- Cobros pendientes: ${cobrosPend || 0}
- Tareas pendientes: ${tareasPend || 0}
- Prospectos activos: ${prospectos || 0}
- Siniestros abiertos: ${siniestros || 0}

EQUIPO (asesores y roles):
${miembrosStr}

COBROS PENDIENTES Y VENCIDOS:
${cobrosStr}

TAREAS PENDIENTES:
${tareasStr}

PÓLIZAS QUE VENCEN EN LOS PRÓXIMOS 30 DÍAS:
${renovsStr}
`.trim()

    setContexto(ctx)
    setLoadingData(false)
  }

  async function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q || thinking) return
    setInput('')

    const newUserMsg: ChatMsg = { role: 'user', text: q }
    const updatedMsgs = [...msgs, newUserMsg]
    setMsgs(updatedMsgs)
    setThinking(true)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/asistente', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token || ''}`,
        },
        body: JSON.stringify({
          contexto,
          // Enviamos historial (últimos 10 mensajes) para que Groq recuerde el contexto de la conversación
          messages: updatedMsgs.slice(-10).map(m => ({
            role: m.role,
            content: m.text,
          })),
        }),
      })

      const data = await resp.json()
      setGroqOk(resp.ok)

      if (!resp.ok) {
        setMsgs(prev => [...prev, { role: 'assistant', text: `⚠️ ${data.error || 'Error al conectar con la IA.'}` }])
      } else {
        setMsgs(prev => [...prev, { role: 'assistant', text: data.respuesta }])
      }
    } catch {
      setGroqOk(false)
      setMsgs(prev => [...prev, { role: 'assistant', text: '⚠️ No se pudo conectar con el asistente. Verifica tu conexión.' }])
    } finally {
      setThinking(false)
    }
  }

  const fmtCOP = (v: number) =>
    new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact', maximumFractionDigits: 1 }).format(v)

  const TIPO_ICON: Record<Alerta['tipo'], React.ReactNode> = {
    renovacion: <Bell className="w-4 h-4" />,
    cobro:      <DollarSign className="w-4 h-4" />,
    tarea:      <CheckSquare className="w-4 h-4" />,
    diligencia: <AlertTriangle className="w-4 h-4" />,
    siniestro:  <FileText className="w-4 h-4" />,
  }
  const TIPO_COLOR: Record<Alerta['tipo'], string> = {
    renovacion: 'text-amber-600 bg-amber-50',
    cobro:      'text-red-600 bg-red-50',
    tarea:      'text-blue-600 bg-blue-50',
    diligencia: 'text-orange-600 bg-orange-50',
    siniestro:  'text-purple-600 bg-purple-50',
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Bot className="w-6 h-6 text-emerald-600" /> Asistente virtual
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Centro de operaciones y consultas inteligentes
            {groqOk === true && (
              <span className="ml-2 inline-flex items-center gap-1 text-emerald-600 text-xs font-medium">
                <Sparkles className="w-3 h-3" /> IA activa
              </span>
            )}
          </p>
        </div>
        <button onClick={loadResumen} disabled={loadingData}
          className="flex items-center gap-2 text-slate-500 hover:text-slate-700 px-3 py-2 rounded-lg border border-slate-200 hover:border-slate-300 text-sm transition-colors">
          <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Resumen + Alertas */}
        <div className="lg:col-span-1 space-y-4">

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-emerald-500" /> Resumen rápido
            </h2>
            {loadingData ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => <div key={i} className="h-8 bg-slate-100 rounded animate-pulse" />)}
              </div>
            ) : resumen && (
              <div className="space-y-2">
                {[
                  { icon: Users,       label: 'Clientes',          val: resumen.clientes.toLocaleString(),        color: 'text-blue-600 bg-blue-50' },
                  { icon: FileText,    label: 'Pólizas activas',   val: resumen.polizasActivas.toLocaleString(),  color: 'text-emerald-600 bg-emerald-50' },
                  { icon: TrendingUp,  label: 'Prima activa',       val: fmtCOP(resumen.primaTotalActiva),         color: 'text-violet-600 bg-violet-50' },
                  { icon: Bell,        label: 'Renovar en 30d',    val: resumen.renovacionesMes.toLocaleString(), color: 'text-amber-600 bg-amber-50' },
                  { icon: DollarSign,  label: 'Cobros pendientes', val: resumen.cobrosPendientes.toLocaleString(),color: 'text-red-600 bg-red-50' },
                  { icon: CheckSquare, label: 'Tareas pendientes', val: resumen.tareasPendientes.toLocaleString(),color: 'text-slate-600 bg-slate-50' },
                ].map(({ icon: Icon, label, val, color }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs text-slate-600">{label}</span>
                    </div>
                    <span className="text-sm font-semibold text-slate-900">{val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> Alertas pendientes
              {alertas.length > 0 && (
                <span className="ml-auto bg-red-100 text-red-700 text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  {alertas.length}
                </span>
              )}
            </h2>
            {loadingData ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-slate-100 rounded animate-pulse" />)}
              </div>
            ) : alertas.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-2">
                  <CheckSquare className="w-5 h-5 text-emerald-600" />
                </div>
                <p className="text-sm text-slate-500">¡Sin alertas! Todo al día.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {alertas.map(a => (
                  <a key={a.id} href={a.href}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors hover:shadow-sm ${a.urgente ? 'border-red-100 bg-red-50/50' : 'border-slate-100 bg-slate-50/50'}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${TIPO_COLOR[a.tipo]}`}>
                      {TIPO_ICON[a.tipo]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-800 truncate">{a.titulo}</p>
                      <p className="text-xs text-slate-500 truncate">{a.subtitulo}</p>
                    </div>
                    {a.urgente && <span className="w-2 h-2 bg-red-500 rounded-full flex-shrink-0 mt-1" />}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Chat */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 flex flex-col" style={{ minHeight: '500px', maxHeight: '70vh' }}>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-900">Asistente CRM</p>
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                En línea · IA Groq (Llama 3.3) · datos reales
              </p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                    <Bot className="w-4 h-4 text-emerald-600" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-emerald-600 text-white rounded-tr-sm'
                    : 'bg-slate-100 text-slate-800 rounded-tl-sm'
                }`}>
                  <MsgText text={m.text} />
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5">
                  {[0,1,2].map(j => (
                    <span key={j} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${j*150}ms` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <div className="px-4 py-2 border-t border-slate-100">
            <div className="flex gap-2 flex-wrap">
              {SUGERENCIAS.slice(0, 3).map(s => (
                <button key={s} onClick={() => send(s)} disabled={thinking}
                  className="flex items-center gap-1 text-xs text-slate-500 hover:text-emerald-600 border border-slate-200 hover:border-emerald-300 px-2.5 py-1 rounded-full transition-colors disabled:opacity-50">
                  <Clock className="w-3 h-3" /> {s}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 pt-2">
            <div className="flex gap-2 items-end">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Pregúntame algo del CRM..."
                disabled={thinking}
                className="flex-1 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none disabled:opacity-60"
              />
              <button onClick={() => send()} disabled={!input.trim() || thinking}
                className="w-10 h-10 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
