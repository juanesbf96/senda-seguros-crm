'use client'
import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Tarea, PrioridadTarea } from '@/types'
import { Plus, Search, Pencil, Trash2, CheckSquare, Square, AlertCircle, ArrowUp, Minus, CheckCircle2, Clock, X, Filter, Check } from 'lucide-react'
import Link from 'next/link'
import TareaModal from './TareaModal'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { usePermissions } from '@/contexts/PermissionsContext'

const PRIORIDAD_ICON: Record<PrioridadTarea, React.ElementType> = {
  normal: Minus, alta: ArrowUp, urgente: AlertCircle,
}
const PRIORIDAD_CLS: Record<PrioridadTarea, string> = {
  normal: 'text-ink-400', alta: 'text-warning', urgente: 'text-error',
}

type TabKey = 'pendientes' | 'hoy' | 'sin_fecha' | 'vencidas' | 'completadas'

function today() { return new Date().toISOString().split('T')[0] }
function tomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]
}
function formatFecha(s: string | null) {
  if (!s) return null
  return new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export default function TareasList({ clienteId }: { clienteId?: string }) {
  const { currentWorkspace } = useWorkspace()
  const { can } = usePermissions()
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('pendientes')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Tarea | undefined>()
  const [filterPrioridades, setFilterPrioridades] = useState<Set<PrioridadTarea>>(new Set())
  const [showFilterMenu, setShowFilterMenu] = useState(false)
  const filterRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showFilterMenu) return
    function handleClick(e: MouseEvent) {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setShowFilterMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showFilterMenu])

  async function load() {
    let q = supabase.from('tareas').select('*, cliente:clientes(id, nombre)').order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    if (clienteId) q = q.eq('client_id', clienteId)
    else q = q.eq('workspace_id', currentWorkspace?.id || '')
    const { data } = await q
    setTareas((data || []) as Tarea[])
    setLoading(false)
  }

  useEffect(() => { load() }, [clienteId, currentWorkspace?.id])

  async function toggleComplete(t: Tarea) {
    await supabase.from('tareas').update({ completada: !t.completada }).eq('id', t.id)
    setTareas(prev => prev.map(x => x.id === t.id ? { ...x, completada: !x.completada } : x))
  }

  async function deleteTarea(id: string) {
    if (!confirm('¿Eliminar esta tarea?')) return
    await supabase.from('tareas').delete().eq('id', id)
    setTareas(prev => prev.filter(t => t.id !== id))
  }

  const td = today(), tm = tomorrow()

  function matchTab(t: Tarea) {
    if (activeTab === 'completadas') return t.completada
    if (t.completada) return false
    if (activeTab === 'vencidas')  return !!t.fecha_vencimiento && t.fecha_vencimiento < td
    if (activeTab === 'hoy')       return t.fecha_vencimiento === td || t.fecha_vencimiento === tm
    if (activeTab === 'sin_fecha') return !t.fecha_vencimiento
    // pendientes: tiene fecha futura (no vencida, no hoy/mañana)
    return !!t.fecha_vencimiento && t.fecha_vencimiento > tm
  }

  const counts: Record<TabKey, number> = {
    pendientes: tareas.filter(t => !t.completada && !!t.fecha_vencimiento && t.fecha_vencimiento > tm).length,
    hoy:        tareas.filter(t => !t.completada && (t.fecha_vencimiento === td || t.fecha_vencimiento === tm)).length,
    sin_fecha:  tareas.filter(t => !t.completada && !t.fecha_vencimiento).length,
    vencidas:   tareas.filter(t => !t.completada && !!t.fecha_vencimiento && t.fecha_vencimiento < td).length,
    completadas: tareas.filter(t => t.completada).length,
  }

  const filtered = tareas.filter(t => {
    const matchSearch = !search || t.titulo.toLowerCase().includes(search.toLowerCase()) ||
      t.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
      t.cliente?.nombre?.toLowerCase().includes(search.toLowerCase())
    const matchPrioridad = filterPrioridades.size === 0 || filterPrioridades.has(t.prioridad)
    return matchTab(t) && matchSearch && matchPrioridad
  })

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'pendientes',  label: 'Pendientes' },
    { key: 'hoy',         label: 'Hoy / Mañana' },
    { key: 'sin_fecha',   label: 'Sin fecha' },
    { key: 'vencidas',    label: 'Vencidas' },
    { key: 'completadas', label: 'Completadas' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div>
      {/* Header (standalone page) */}
      {!clienteId && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-ink-700">Tareas</h1>
            <p className="text-ink-400 text-sm mt-1">
              {counts.vencidas > 0 && <span className="text-error font-medium mr-2">{counts.vencidas} vencida{counts.vencidas > 1 ? 's' : ''}</span>}
              {counts.hoy > 0 && <span className="text-ink-700 font-medium mr-2">{counts.hoy} para hoy/mañana</span>}
              {counts.pendientes} pendiente{counts.pendientes !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {/* Filter dropdown */}
            <div className="relative" ref={filterRef}>
              <button
                onClick={() => setShowFilterMenu(v => !v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  filterPrioridades.size > 0
                    ? 'bg-primary-50 border border-primary-300 text-primary-700'
                    : 'bg-cream-200 border border-ink-300 text-ink-500 hover:bg-ink-200'
                }`}>
                <Filter className="w-4 h-4" />
                Prioridad
                {filterPrioridades.size > 0 && (
                  <span className="bg-primary-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                    {filterPrioridades.size}
                  </span>
                )}
              </button>

              {showFilterMenu && (
                <div className="absolute right-0 top-full mt-1.5 bg-white border border-ink-200 rounded-xl shadow-lg z-30 w-44 py-1.5 text-sm">
                  <p className="px-3 py-1 text-[11px] font-semibold text-ink-400 uppercase tracking-wide">Prioridad</p>
                  {([
                    { key: 'normal' as PrioridadTarea,  label: 'Normal',  icon: Minus,        cls: 'text-ink-400' },
                    { key: 'alta' as PrioridadTarea,    label: 'Alta',    icon: ArrowUp,      cls: 'text-warning' },
                    { key: 'urgente' as PrioridadTarea, label: 'Urgente', icon: AlertCircle,  cls: 'text-error'   },
                  ]).map(({ key, label, icon: Icon, cls }) => {
                    const isActive = filterPrioridades.has(key)
                    return (
                      <button key={key}
                        onClick={() => setFilterPrioridades(prev => {
                          const next = new Set(prev)
                          next.has(key) ? next.delete(key) : next.add(key)
                          return next
                        })}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-cream-100 transition-colors">
                        <Icon className={`w-4 h-4 ${cls}`} />
                        <span className="flex-1 text-left text-ink-600">{label}</span>
                        {isActive && <Check className="w-3.5 h-3.5 text-primary-500" />}
                      </button>
                    )
                  })}
                  {filterPrioridades.size > 0 && (
                    <>
                      <div className="border-t border-cream-200 my-1" />
                      <button
                        onClick={() => { setFilterPrioridades(new Set()); setShowFilterMenu(false) }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-cream-100 text-ink-400 hover:text-error transition-colors text-xs">
                        <X className="w-3.5 h-3.5" />
                        Limpiar filtro
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {can('tareas_crear') && (
              <button onClick={() => { setEditing(undefined); setShowModal(true) }}
                className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                <Plus className="w-4 h-4" /> Nueva tarea
              </button>
            )}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-ink-200">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={[
              'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key ? 'border-primary-500 text-primary-500' : 'border-transparent text-ink-400 hover:text-ink-600',
            ].join(' ')}>
            {label}
            {counts[key] > 0 && (
              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                key === 'vencidas' ? 'bg-error-soft text-error' :
                key === 'hoy' ? 'bg-warning-soft text-ink-700' :
                activeTab === key ? 'bg-primary-100 text-primary-700' : 'bg-cream-200 text-ink-400'
              }`}>{counts[key]}</span>
            )}
          </button>
        ))}
        {clienteId && can('tareas_crear') && (
          <button onClick={() => { setEditing(undefined); setShowModal(true) }}
            className="ml-auto flex items-center gap-1.5 text-xs text-primary-500 hover:text-primary-700 font-medium pb-2">
            <Plus className="w-3.5 h-3.5" /> Agregar tarea
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar tarea..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400" />
      </div>

      {/* List */}
      <div className="space-y-2">
        {filtered.map(t => {
          const PriIcon = PRIORIDAD_ICON[t.prioridad]
          const isOverdue = !t.completada && !!t.fecha_vencimiento && t.fecha_vencimiento < td
          const isToday = t.fecha_vencimiento === td
          const isTomorrow = t.fecha_vencimiento === tm
          return (
            <div key={t.id} className={[
              'bg-white rounded-xl border p-3.5 flex items-start gap-3 group transition-colors',
              t.completada ? 'opacity-60 border-cream-200' :
              isOverdue ? 'border-error/30 bg-error-soft/30' :
              isToday ? 'border-warning/30 bg-warning-soft/30' : 'border-ink-200',
            ].join(' ')}>
              <button onClick={() => toggleComplete(t)} disabled={!can('tareas_editar_todas') && !can('tareas_completar_propias')} className="mt-0.5 flex-shrink-0 text-ink-300 hover:text-primary-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed">
                {t.completada
                  ? <CheckCircle2 className="w-5 h-5 text-primary-500" />
                  : <Square className="w-5 h-5" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className={`font-medium text-sm ${t.completada ? 'line-through text-ink-400' : 'text-ink-700'}`}>
                    {t.titulo}
                  </span>
                  <PriIcon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${PRIORIDAD_CLS[t.prioridad]}`} />
                </div>
                {t.descripcion && (
                  <p className="text-xs text-ink-400 mt-0.5 line-clamp-1">{t.descripcion}</p>
                )}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {t.fecha_vencimiento && (
                    <span className={`text-xs font-medium flex items-center gap-1 ${
                      isOverdue ? 'text-error' : isToday ? 'text-ink-700' : isTomorrow ? 'text-warning' : 'text-ink-400'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {isToday ? 'Hoy' : isTomorrow ? 'Mañana' : formatFecha(t.fecha_vencimiento)}
                      {isOverdue && ' (vencida)'}
                    </span>
                  )}
                  {!clienteId && t.cliente && (
                    <Link href={`/clientes/${t.client_id}`} className="text-xs text-primary-500 hover:underline">
                      {t.cliente.nombre}
                    </Link>
                  )}
                  {t.asignado_a && can('tareas_asignar') && (
                    <span className="text-xs text-ink-400 bg-cream-200 px-1.5 py-0.5 rounded">
                      → {t.asignado_a}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => { setEditing(t); setShowModal(true) }}
                  className="text-ink-400 hover:text-ink-600 transition-colors p-1">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                {can('tareas_editar_todas') && (
                  <button onClick={() => deleteTarea(t.id)}
                    className="text-ink-400 hover:text-error transition-colors p-1">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-ink-400">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay tareas en esta categoría</p>
          </div>
        )}
      </div>

      {showModal && (
        <TareaModal tarea={editing} clienteId={clienteId}
          onClose={() => setShowModal(false)}
          onSaved={(fechaVencimiento?: string | null) => {
            setShowModal(false)
            load()
            // Auto-switch to the tab where the saved task will appear
            if (!editing) { // only on create, not edit
              const td2 = today(), tm2 = tomorrow()
              if (!fechaVencimiento) setActiveTab('sin_fecha')
              else if (fechaVencimiento < td2) setActiveTab('vencidas')
              else if (fechaVencimiento === td2 || fechaVencimiento === tm2) setActiveTab('hoy')
              else setActiveTab('pendientes')
            }
          }} />
      )}
    </div>
  )
}
