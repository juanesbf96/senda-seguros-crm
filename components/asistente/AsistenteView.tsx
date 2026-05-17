'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import {
  Bot, Send, AlertTriangle, Bell, CheckSquare, Users,
  FileText, DollarSign, TrendingUp, Zap, RefreshCw, Clock,
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
  role: 'user' | 'bot'
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

async function responder(q: string): Promise<string> {
  const ql = q.toLowerCase()

  // ── Clientes ────────────────────────────────────────────
  if (ql.includes('cliente')) {
    const { count } = await supabase.from('clientes').select('id', { count: 'exact', head: true })
    if (ql.includes('nuevo') || ql.includes('este mes')) {
      const ini = new Date(); ini.setDate(1); ini.setHours(0,0,0,0)
      const { count: c2 } = await supabase.from('clientes').select('id', { count: 'exact', head: true })
        .gte('created_at', ini.toISOString())
      return `Tienes **${count ?? 0}** clientes en total. Este mes ingresaron **${c2 ?? 0}** clientes nuevos.`
    }
    return `Tienes **${count ?? 0}** clientes registrados en el CRM.`
  }

  // ── Pólizas ────────────────────────────────────────────
  if (ql.includes('póliza') || ql.includes('poliza')) {
    if (ql.includes('venc') || ql.includes('semana') || ql.includes('mes')) {
      const hoy = new Date()
      const en30 = new Date(hoy); en30.setDate(hoy.getDate() + (ql.includes('semana') ? 7 : 30))
      const { data } = await supabase.from('polizas').select('numero_poliza, aseguradora, ramo, cliente:clientes(nombre)')
        .eq('estado', 'activa').eq('eliminada', false)
        .gte('fecha_fin', hoy.toISOString().split('T')[0])
        .lte('fecha_fin', en30.toISOString().split('T')[0])
        .order('fecha_fin').limit(5)
      if (!data || data.length === 0) return `No hay pólizas que venzan en los próximos ${ql.includes('semana') ? '7' : '30'} días. ¡Todo al día!`
      const lista = (data as any[]).map(p => `• ${p.cliente?.nombre || '?'} – ${p.aseguradora} ${p.ramo} (${p.numero_poliza || 'S/N'})`).join('\n')
      return `Hay **${data.length}** póliza(s) por vencer:\n${lista}`
    }
    const { count } = await supabase.from('polizas').select('id', { count: 'exact', head: true }).eq('estado', 'activa').eq('eliminada', false)
    return `Tienes **${count ?? 0}** pólizas activas en el CRM.`
  }

  // ── Prima total ────────────────────────────────────────
  if (ql.includes('prima')) {
    const { data } = await supabase.from('polizas').select('prima').eq('estado', 'activa').eq('eliminada', false)
    const total = (data || []).reduce((s, p) => s + (p.prima || 0), 0)
    const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(total)
    return `La prima total de las pólizas activas asciende a **${fmt}**.`
  }

  // ── Cobros ────────────────────────────────────────────
  if (ql.includes('cobro') || ql.includes('pago')) {
    if (ql.includes('vencid') || ql.includes('atrasa')) {
      const { data } = await supabase.from('cobros').select('concepto, valor, cliente:clientes(nombre)').eq('estado', 'vencido').limit(5)
      const total = (data || []).reduce((s: number, c: any) => s + (c.valor || 0), 0)
      const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(total)
      if (!data || data.length === 0) return 'No tienes cobros vencidos. ¡Todo al día!'
      return `Tienes **${data.length}** cobro(s) vencido(s) por **${fmt}**.`
    }
    const { count } = await supabase.from('cobros').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente')
    const { data: vals } = await supabase.from('cobros').select('valor').eq('estado', 'pendiente')
    const total = (vals || []).reduce((s: number, c: any) => s + (c.valor || 0), 0)
    const fmt = new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(total)
    return `Tienes **${count ?? 0}** cobros pendientes por un total de **${fmt}**.`
  }

  // ── Tareas ────────────────────────────────────────────
  if (ql.includes('tarea')) {
    const { count } = await supabase.from('tareas').select('id', { count: 'exact', head: true }).eq('completada', false)
    const { count: urgentes } = await supabase.from('tareas').select('id', { count: 'exact', head: true }).eq('completada', false).eq('prioridad', 'urgente')
    return `Tienes **${count ?? 0}** tareas pendientes, de las cuales **${urgentes ?? 0}** son urgentes.`
  }

  // ── Siniestros ────────────────────────────────────────
  if (ql.includes('siniestro')) {
    const { count } = await supabase.from('siniestros').select('id', { count: 'exact', head: true })
      .not('estado', 'in', '("cerrado","rechazado")')
    return `Hay **${count ?? 0}** siniestro(s) activos (reportados, en estudio o en pago).`
  }

  // ── Prospectos ────────────────────────────────────────
  if (ql.includes('prospecto')) {
    const { count } = await supabase.from('prospectos').select('id', { count: 'exact', head: true })
      .not('etapa', 'in', '("cerrado_ganado","cerrado_perdido")')
    return `Tienes **${count ?? 0}** prospectos activos en el pipeline.`
  }

  // ── Vendedores ────────────────────────────────────────
  if (ql.includes('vendedor')) {
    const { count } = await supabase.from('vendedores').select('id', { count: 'exact', head: true }).eq('activo', true)
    return `Tienes **${count ?? 0}** vendedores activos.`
  }

  // ── Diligencias ────────────────────────────────────────
  if (ql.includes('diligencia')) {
    const { count } = await supabase.from('diligencias').select('id', { count: 'exact', head: true })
      .not('estado', 'in', '("completada","cancelada")')
    return `Hay **${count ?? 0}** diligencias pendientes o en proceso.`
  }

  return 'No entendí la pregunta. Puedes preguntar sobre clientes, pólizas, primas, cobros, tareas, siniestros, prospectos o diligencias.'
}

function MsgText({ text }: { text: string }) {
  // Render **bold** markdown simply
  const parts = text.split(/(\*\*[^*]+\*\*)/)
  return (
    <span>
      {parts.map((p, i) =>
        p.startsWith('**') && p.endsWith('**')
          ? <strong key={i}>{p.slice(2, -2)}</strong>
          : p.split('\n').map((line, j) => <span key={`${i}-${j}`}>{line}{j < p.split('\n').length - 1 ? <br /> : null}</span>)
      )}
    </span>
  )
}

export default function AsistenteView() {
  const [resumen, setResumen]     = useState<Resumen | null>(null)
  const [alertas, setAlertas]     = useState<Alerta[]>([])
  const [msgs, setMsgs]           = useState<ChatMsg[]>([
    { role: 'bot', text: '¡Hola! Soy tu asistente de Senda Seguros. Puedo consultarte información del CRM en tiempo real. ¿En qué te puedo ayudar?' }
  ])
  const [input, setInput]         = useState('')
  const [thinking, setThinking]   = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [msgs])

  useEffect(() => { loadResumen() }, [])

  async function loadResumen() {
    setLoadingData(true)
    const hoy = new Date()
    const en7 = new Date(hoy); en7.setDate(hoy.getDate() + 7)
    const en30 = new Date(hoy); en30.setDate(hoy.getDate() + 30)

    const [
      { count: clientes },
      { count: polizasActivas },
      { data: primaData },
      { count: cobrosPend },
      { count: tareasPend },
      { count: prospectos },
      { count: siniestros },
      { data: renovs },
      { data: cobrosVenc },
      { data: tareasUrg },
      { data: diligUrg },
    ] = await Promise.all([
      supabase.from('clientes').select('id', { count: 'exact', head: true }),
      supabase.from('polizas').select('id', { count: 'exact', head: true }).eq('estado', 'activa').eq('eliminada', false),
      supabase.from('polizas').select('prima').eq('estado', 'activa').eq('eliminada', false),
      supabase.from('cobros').select('id', { count: 'exact', head: true }).eq('estado', 'pendiente'),
      supabase.from('tareas').select('id', { count: 'exact', head: true }).eq('completada', false),
      supabase.from('prospectos').select('id', { count: 'exact', head: true }).not('etapa', 'in', '("cerrado_ganado","cerrado_perdido")'),
      supabase.from('siniestros').select('id', { count: 'exact', head: true }).not('estado', 'in', '("cerrado","rechazado")'),
      // Alertas
      supabase.from('polizas').select('id, numero_poliza, aseguradora, ramo, fecha_fin, cliente:clientes(nombre)')
        .eq('estado', 'activa').eq('eliminada', false)
        .gte('fecha_fin', hoy.toISOString().split('T')[0])
        .lte('fecha_fin', en30.toISOString().split('T')[0])
        .order('fecha_fin').limit(5),
      supabase.from('cobros').select('id, concepto, valor, fecha_vencimiento, cliente:clientes(nombre)')
        .eq('estado', 'vencido').order('fecha_vencimiento').limit(5),
      supabase.from('tareas').select('id, titulo, fecha_vencimiento')
        .eq('completada', false).eq('prioridad', 'urgente').limit(5),
      supabase.from('diligencias').select('id, descripcion, tipo, fecha_limite')
        .not('estado', 'in', '("completada","cancelada")')
        .lte('fecha_limite', en7.toISOString().split('T')[0]).limit(5),
    ])

    const primaTotalActiva = (primaData || []).reduce((s, p) => s + (p.prima || 0), 0)
    const renovMes = (renovs || []).filter(r => {
      const ff = new Date((r as any).fecha_fin)
      return ff <= en30
    }).length

    setResumen({
      clientes: clientes || 0, polizasActivas: polizasActivas || 0,
      renovacionesMes: renovMes, cobrosPendientes: cobrosPend || 0,
      tareasPendientes: tareasPend || 0, prospectos: prospectos || 0,
      primaTotalActiva, siniestrosAbiertos: siniestros || 0,
    })

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
    setLoadingData(false)
  }

  async function send(text?: string) {
    const q = (text ?? input).trim()
    if (!q) return
    setInput('')
    setMsgs(prev => [...prev, { role: 'user', text: q }])
    setThinking(true)
    const resp = await responder(q)
    setThinking(false)
    setMsgs(prev => [...prev, { role: 'bot', text: resp }])
  }

  const fmtCOP = (v: number) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', notation: 'compact', maximumFractionDigits: 1 }).format(v)

  const TIPO_ICON: Record<Alerta['tipo'], React.ReactNode> = {
    renovacion: <Bell className="w-4 h-4" />,
    cobro:      <DollarSign className="w-4 h-4" />,
    tarea:      <CheckSquare className="w-4 h-4" />,
    diligencia: <AlertTriangle className="w-4 h-4" />,
    siniestro:  <FileText className="w-4 h-4" />,
  }
  const TIPO_COLOR: Record<Alerta['tipo'], string> = {
    renovacion: 'text-ink-700 bg-warning-soft',
    cobro:      'text-error bg-error-soft',
    tarea:      'text-info bg-info/10',
    diligencia: 'text-orange-600 bg-orange-50',
    siniestro:  'text-purple-600 bg-purple-50',
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-700 flex items-center gap-2">
            <Bot className="w-6 h-6 text-primary-500" /> Asistente virtual
          </h1>
          <p className="text-ink-400 text-sm mt-1">Centro de operaciones y consultas inteligentes</p>
        </div>
        <button onClick={loadResumen} disabled={loadingData}
          className="flex items-center gap-2 text-ink-400 hover:text-ink-600 px-3 py-2 rounded-lg border border-ink-200 hover:border-ink-300 text-sm transition-colors">
          <RefreshCw className={`w-4 h-4 ${loadingData ? 'animate-spin' : ''}`} /> Actualizar
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* LEFT: Resumen + Alertas */}
        <div className="lg:col-span-1 space-y-4">

          {/* Resumen rápido */}
          <div className="bg-white rounded-xl border border-ink-200 p-4">
            <h2 className="text-sm font-semibold text-ink-600 mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary-500" /> Resumen rápido
            </h2>
            {loadingData ? (
              <div className="space-y-2">
                {[...Array(6)].map((_, i) => <div key={i} className="h-8 bg-cream-200 rounded animate-pulse" />)}
              </div>
            ) : resumen && (
              <div className="space-y-2">
                {[
                  { icon: Users,      label: 'Clientes',          val: resumen.clientes.toLocaleString(),        color: 'text-info bg-info/10' },
                  { icon: FileText,   label: 'Pólizas activas',   val: resumen.polizasActivas.toLocaleString(),  color: 'text-primary-500 bg-primary-50' },
                  { icon: TrendingUp, label: 'Prima activa',       val: fmtCOP(resumen.primaTotalActiva),         color: 'text-violet-600 bg-violet-50' },
                  { icon: Bell,       label: 'Renovar en 30d',    val: resumen.renovacionesMes.toLocaleString(), color: 'text-ink-700 bg-warning-soft' },
                  { icon: DollarSign, label: 'Cobros pendientes', val: resumen.cobrosPendientes.toLocaleString(),color: 'text-error bg-error-soft' },
                  { icon: CheckSquare,label: 'Tareas pendientes', val: resumen.tareasPendientes.toLocaleString(),color: 'text-ink-500 bg-cream-100' },
                ].map(({ icon: Icon, label, val, color }) => (
                  <div key={label} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-cream-100">
                    <div className="flex items-center gap-2">
                      <div className={`w-6 h-6 rounded flex items-center justify-center ${color}`}>
                        <Icon className="w-3.5 h-3.5" />
                      </div>
                      <span className="text-xs text-ink-500">{label}</span>
                    </div>
                    <span className="text-sm font-semibold text-ink-700">{val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Alertas */}
          <div className="bg-white rounded-xl border border-ink-200 p-4">
            <h2 className="text-sm font-semibold text-ink-600 mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-error" /> Alertas pendientes
              {alertas.length > 0 && (
                <span className="ml-auto bg-error-soft text-error text-xs font-semibold px-1.5 py-0.5 rounded-full">
                  {alertas.length}
                </span>
              )}
            </h2>
            {loadingData ? (
              <div className="space-y-2">
                {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-cream-200 rounded animate-pulse" />)}
              </div>
            ) : alertas.length === 0 ? (
              <div className="text-center py-6">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-2">
                  <CheckSquare className="w-5 h-5 text-primary-500" />
                </div>
                <p className="text-sm text-ink-400">¡Sin alertas! Todo al día.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {alertas.map(a => (
                  <a key={a.id} href={a.href}
                    className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors hover:shadow-sm ${a.urgente ? 'border-error/20 bg-error-soft/50' : 'border-cream-200 bg-cream-100/50'}`}>
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${TIPO_COLOR[a.tipo]}`}>
                      {TIPO_ICON[a.tipo]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-ink-700 truncate">{a.titulo}</p>
                      <p className="text-xs text-ink-400 truncate">{a.subtitulo}</p>
                    </div>
                    {a.urgente && <span className="w-2 h-2 bg-error rounded-full flex-shrink-0 mt-1" />}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Chat */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-ink-200 flex flex-col" style={{ minHeight: '500px', maxHeight: '70vh' }}>
          <div className="px-5 py-4 border-b border-cream-200 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
              <Bot className="w-5 h-5 text-primary-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-700">Asistente CRM</p>
              <p className="text-xs text-primary-500 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary-500 inline-block" /> En línea · responde con datos reales
              </p>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {msgs.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                {m.role === 'bot' && (
                  <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                    <Bot className="w-4 h-4 text-primary-500" />
                  </div>
                )}
                <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'bg-primary-500 text-white rounded-tr-sm'
                    : 'bg-cream-200 text-ink-700 rounded-tl-sm'
                }`}>
                  <MsgText text={m.text} />
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-primary-500" />
                </div>
                <div className="bg-cream-200 rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1.5">
                  {[0,1,2].map(j => <span key={j} className="w-2 h-2 bg-ink-400 rounded-full animate-bounce" style={{ animationDelay: `${j*150}ms` }} />)}
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          {/* Sugerencias */}
          <div className="px-4 py-2 border-t border-cream-200">
            <div className="flex gap-2 flex-wrap">
              {SUGERENCIAS.slice(0, 3).map(s => (
                <button key={s} onClick={() => send(s)}
                  className="flex items-center gap-1 text-xs text-ink-400 hover:text-primary-500 border border-ink-200 hover:border-primary-300 px-2.5 py-1 rounded-full transition-colors">
                  <Clock className="w-3 h-3" /> {s}
                </button>
              ))}
            </div>
          </div>

          {/* Input */}
          <div className="p-4 pt-2">
            <div className="flex gap-2 items-end">
              <input
                value={input} onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }}
                placeholder="Pregúntame algo del CRM..."
                className="flex-1 border border-ink-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400 resize-none"
              />
              <button onClick={() => send()} disabled={!input.trim() || thinking}
                className="w-10 h-10 bg-primary-500 hover:bg-primary-700 disabled:bg-ink-200 text-white rounded-xl flex items-center justify-center transition-colors flex-shrink-0">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  )
}
