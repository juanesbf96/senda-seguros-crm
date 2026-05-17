'use client'
import { useEffect, useState, useCallback } from 'react'
import { Calendar, dateFnsLocalizer, View, SlotInfo } from 'react-big-calendar'
import { format, parse, startOfWeek, getDay, startOfMonth, endOfMonth, addMonths, subMonths } from 'date-fns'
import { es } from 'date-fns/locale'
import 'react-big-calendar/lib/css/react-big-calendar.css'
import { supabase } from '@/lib/supabase/client'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { AgendaEvento } from '@/types'
import { ChevronLeft, ChevronRight, Plus, Calendar as CalIcon } from 'lucide-react'
import AgendaEventoModal from './AgendaEventoModal'

const locales = { es }
const localizer = dateFnsLocalizer({ format, parse, startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 1 }), getDay, locales })

// ── Colores por origen ──────────────────────────────────────────────
const CRM_COLORS = {
  tarea:      { color: '#f59e0b', border: '#d97706' },
  renovacion: { color: '#ef4444', border: '#dc2626' },
  cobro:      { color: '#3b82f6', border: '#2563eb' },
  prospecto:  { color: '#8b5cf6', border: '#7c3aed' },
}

interface CalEvent {
  id: string
  title: string
  start: Date
  end: Date
  allDay?: boolean
  resource: {
    color: string
    border: string
    tipo: string
    origen: 'propio' | 'tarea' | 'renovacion' | 'cobro' | 'prospecto'
    raw?: AgendaEvento
    link?: string
  }
}

const VIEWS: { key: View; label: string }[] = [
  { key: 'month', label: 'Mes' },
  { key: 'week',  label: 'Semana' },
  { key: 'day',   label: 'Día' },
]

export default function AgendaView() {
  const { currentWorkspace } = useWorkspace()
  const [events,    setEvents]    = useState<CalEvent[]>([])
  const [loading,   setLoading]   = useState(true)
  const [view,      setView]      = useState<View>('month')
  const [date,      setDate]      = useState(new Date())
  const [modal,     setModal]     = useState<{ open: boolean; evento?: Partial<AgendaEvento>; fecha?: Date }>({ open: false })

  // ── Carga todos los eventos (propios + CRM) ──────────────────────
  const load = useCallback(async () => {
    if (!currentWorkspace) return
    const wid = currentWorkspace.id
    const rangeStart = subMonths(startOfMonth(date), 1)
    const rangeEnd   = addMonths(endOfMonth(date), 1)

    const [propiosRes, tareasRes, polizasRes, cobrosRes, prospectosRes] = await Promise.all([
      supabase.from('agenda_eventos')
        .select('*, cliente:clientes(id,nombre), poliza:polizas(id,numero_poliza,aseguradora), prospecto:prospectos(id,nombre)')
        .eq('workspace_id', wid)
        .gte('fecha_inicio', rangeStart.toISOString())
        .lte('fecha_fin',    rangeEnd.toISOString()),

      supabase.from('tareas')
        .select('id, titulo, fecha_vencimiento, completada, prioridad')
        .eq('workspace_id', wid)
        .eq('completada', false)
        .not('fecha_vencimiento', 'is', null)
        .gte('fecha_vencimiento', rangeStart.toISOString().slice(0,10))
        .lte('fecha_vencimiento', rangeEnd.toISOString().slice(0,10)),

      supabase.from('polizas')
        .select('id, numero_poliza, aseguradora, ramo, fecha_fin')
        .eq('workspace_id', wid)
        .eq('eliminada', false)
        .not('fecha_fin', 'is', null)
        .gte('fecha_fin', rangeStart.toISOString().slice(0,10))
        .lte('fecha_fin', rangeEnd.toISOString().slice(0,10)),

      supabase.from('cobros')
        .select('id, concepto, valor, fecha_vencimiento, estado')
        .eq('workspace_id', wid)
        .eq('estado', 'pendiente')
        .not('fecha_vencimiento', 'is', null)
        .gte('fecha_vencimiento', rangeStart.toISOString().slice(0,10))
        .lte('fecha_vencimiento', rangeEnd.toISOString().slice(0,10)),

      supabase.from('prospecto_actividades')
        .select('id, descripcion, tipo, fecha, prospecto:prospectos(id,nombre)')
        .eq('workspace_id', wid)
        .gte('fecha', rangeStart.toISOString())
        .lte('fecha', rangeEnd.toISOString()),
    ])

    const calEvents: CalEvent[] = []

    // Propios
    ;(propiosRes.data || []).forEach((e: AgendaEvento) => {
      calEvents.push({
        id: e.id,
        title: e.titulo,
        start: new Date(e.fecha_inicio),
        end:   new Date(e.fecha_fin),
        allDay: e.todo_el_dia,
        resource: { color: e.color, border: e.color, tipo: e.tipo, origen: 'propio', raw: e },
      })
    })

    // Tareas
    ;(tareasRes.data || []).forEach((t: any) => {
      const d = new Date(t.fecha_vencimiento)
      calEvents.push({
        id: `tarea-${t.id}`,
        title: `✓ ${t.titulo}`,
        start: d, end: d, allDay: true,
        resource: { ...CRM_COLORS.tarea, tipo: 'tarea', origen: 'tarea', link: '/tareas' },
      })
    })

    // Vencimientos de pólizas
    ;(polizasRes.data || []).forEach((p: any) => {
      const d = new Date(p.fecha_fin)
      calEvents.push({
        id: `poliza-${p.id}`,
        title: `⚠ ${p.aseguradora} · ${p.ramo}`,
        start: d, end: d, allDay: true,
        resource: { ...CRM_COLORS.renovacion, tipo: 'renovacion', origen: 'renovacion', link: '/polizas' },
      })
    })

    // Cobros por vencer
    ;(cobrosRes.data || []).forEach((c: any) => {
      const d = new Date(c.fecha_vencimiento)
      calEvents.push({
        id: `cobro-${c.id}`,
        title: `$ ${c.concepto}`,
        start: d, end: d, allDay: true,
        resource: { ...CRM_COLORS.cobro, tipo: 'cobro', origen: 'cobro', link: '/cobros' },
      })
    })

    // Actividades prospectos
    ;(prospectosRes.data || []).forEach((a: any) => {
      const d = new Date(a.fecha)
      calEvents.push({
        id: `prospecto-act-${a.id}`,
        title: `◆ ${a.prospecto?.nombre || 'Prospecto'} · ${a.descripcion}`,
        start: d, end: new Date(d.getTime() + 30 * 60000),
        resource: { ...CRM_COLORS.prospecto, tipo: 'prospecto', origen: 'prospecto', link: '/prospectos' },
      })
    })

    setEvents(calEvents)
    setLoading(false)
  }, [date, currentWorkspace])

  useEffect(() => { load() }, [load])

  // ── Handlers ─────────────────────────────────────────────────────
  function onSelectSlot(slot: SlotInfo) {
    setModal({ open: true, fecha: slot.start instanceof Date ? slot.start : new Date(slot.start) })
  }

  function onSelectEvent(ev: CalEvent) {
    if (ev.resource.origen === 'propio' && ev.resource.raw) {
      setModal({ open: true, evento: ev.resource.raw })
    }
    // CRM events: could navigate to their section
  }

  // ── Custom event renderer ─────────────────────────────────────────
  function EventComponent({ event }: { event: CalEvent }) {
    return (
      <div
        className="text-white text-xs px-1.5 py-0.5 rounded truncate font-medium leading-snug"
        style={{ background: event.resource.color, borderLeft: `3px solid ${event.resource.border}` }}
        title={event.title}
      >
        {event.title}
      </div>
    )
  }

  // ── Navigation label ──────────────────────────────────────────────
  function navLabel() {
    if (view === 'month') return format(date, 'MMMM yyyy', { locale: es })
    if (view === 'week')  return `Semana del ${format(startOfWeek(date, { weekStartsOn: 1 }), 'd MMM', { locale: es })}`
    return format(date, "EEEE d 'de' MMMM", { locale: es })
  }

  function navigate(dir: 'prev' | 'next' | 'today') {
    if (dir === 'today') { setDate(new Date()); return }
    const delta = dir === 'next' ? 1 : -1
    if (view === 'month') setDate(d => addMonths(d, delta))
    else if (view === 'week') setDate(d => new Date(d.getTime() + delta * 7 * 86400000))
    else setDate(d => new Date(d.getTime() + delta * 86400000))
  }

  const messages = {
    month: 'Mes', week: 'Semana', day: 'Día', today: 'Hoy',
    previous: 'Anterior', next: 'Siguiente',
    allDay: 'Todo el día', date: 'Fecha', time: 'Hora', event: 'Evento',
    noEventsInRange: 'Sin eventos',
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4">

      {/* ── Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 capitalize">{navLabel()}</h1>
          <div className="flex items-center gap-3 mt-1">
            {/* Leyenda */}
            {[
              { label: 'Mis eventos', color: '#10b981' },
              { label: 'Tareas',      color: CRM_COLORS.tarea.color },
              { label: 'Venc. pólizas', color: CRM_COLORS.renovacion.color },
              { label: 'Cobros',      color: CRM_COLORS.cobro.color },
              { label: 'Prospectos',  color: CRM_COLORS.prospecto.color },
            ].map(l => (
              <span key={l.label} className="flex items-center gap-1 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full" style={{ background: l.color }} />
                {l.label}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* View toggle */}
          <div className="flex border border-slate-200 rounded-lg overflow-hidden">
            {VIEWS.map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className={`px-3 py-1.5 text-sm transition-colors ${view === v.key ? 'bg-emerald-600 text-white' : 'text-slate-500 hover:bg-slate-50'}`}>
                {v.label}
              </button>
            ))}
          </div>

          {/* Navigation */}
          <div className="flex items-center gap-1">
            <button onClick={() => navigate('prev')}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button onClick={() => navigate('today')}
              className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 transition-colors">
              Hoy
            </button>
            <button onClick={() => navigate('next')}
              className="p-2 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <button onClick={() => setModal({ open: true })}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Nuevo evento
          </button>
        </div>
      </div>

      {/* ── Calendar ─────────────────────────────────────────── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
        </div>
      ) : (
        <div className="flex-1 bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <Calendar
            localizer={localizer}
            events={events}
            view={view}
            date={date}
            onView={setView}
            onNavigate={setDate}
            onSelectSlot={onSelectSlot}
            onSelectEvent={onSelectEvent}
            selectable
            messages={messages}
            culture="es"
            components={{ event: EventComponent as any }}
            style={{ height: '100%' }}
            popup
            eventPropGetter={(event: CalEvent) => ({
              style: {
                background: 'transparent',
                border: 'none',
                padding: '1px 2px',
              }
            })}
            dayPropGetter={(d: Date) => {
              const isToday = d.toDateString() === new Date().toDateString()
              return {
                style: {
                  background: isToday ? '#f0fdf4' : undefined,
                }
              }
            }}
          />
        </div>
      )}

      {/* ── Modal ─────────────────────────────────────────────── */}
      {modal.open && (
        <AgendaEventoModal
          evento={modal.evento}
          fechaInicial={modal.fecha}
          onClose={() => setModal({ open: false })}
          onSaved={() => { setModal({ open: false }); load() }}
          onDeleted={() => { setModal({ open: false }); load() }}
        />
      )}
    </div>
  )
}
