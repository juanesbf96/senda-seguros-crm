'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Tarea, PrioridadTarea } from '@/types'
import { Plus, Search, Pencil, Trash2, CheckSquare, Square, AlertCircle, ArrowUp, Minus, CheckCircle2, Clock } from 'lucide-react'
import Link from 'next/link'
import TareaModal from './TareaModal'

const PRIORIDAD_ICON: Record<PrioridadTarea, React.ElementType> = {
  normal: Minus, alta: ArrowUp, urgente: AlertCircle,
}
const PRIORIDAD_CLS: Record<PrioridadTarea, string> = {
  normal: 'text-slate-400', alta: 'text-amber-500', urgente: 'text-red-500',
}

type TabKey = 'pendientes' | 'hoy' | 'vencidas' | 'completadas'

function today() { return new Date().toISOString().split('T')[0] }
function tomorrow() {
  const d = new Date(); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]
}
function formatFecha(s: string | null) {
  if (!s) return null
  return new Date(s + 'T00:00:00').toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })
}

export default function TareasList({ clienteId }: { clienteId?: string }) {
  const [tareas, setTareas] = useState<Tarea[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<TabKey>('pendientes')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Tarea | undefined>()

  async function load() {
    let q = supabase.from('tareas').select('*, cliente:clientes(id, nombre)').order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    if (clienteId) q = q.eq('client_id', clienteId)
    const { data } = await q
    setTareas((data || []) as Tarea[])
    setLoading(false)
  }

  useEffect(() => { load() }, [clienteId])

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
    if (activeTab === 'vencidas') return !!t.fecha_vencimiento && t.fecha_vencimiento < td
    if (activeTab === 'hoy') return t.fecha_vencimiento === td || t.fecha_vencimiento === tm
    // pendientes: no vencida, no hoy/mañana, or sin fecha
    return !t.fecha_vencimiento || t.fecha_vencimiento > tm
  }

  const counts: Record<TabKey, number> = {
    pendientes: tareas.filter(t => !t.completada && (!t.fecha_vencimiento || t.fecha_vencimiento > tm)).length,
    hoy:        tareas.filter(t => !t.completada && (t.fecha_vencimiento === td || t.fecha_vencimiento === tm)).length,
    vencidas:   tareas.filter(t => !t.completada && !!t.fecha_vencimiento && t.fecha_vencimiento < td).length,
    completadas: tareas.filter(t => t.completada).length,
  }

  const filtered = tareas.filter(t => {
    const matchSearch = !search || t.titulo.toLowerCase().includes(search.toLowerCase()) ||
      t.descripcion?.toLowerCase().includes(search.toLowerCase()) ||
      t.cliente?.nombre?.toLowerCase().includes(search.toLowerCase())
    return matchTab(t) && matchSearch
  })

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'pendientes', label: 'Pendientes' },
    { key: 'hoy',        label: 'Hoy / Mañana' },
    { key: 'vencidas',   label: 'Vencidas' },
    { key: 'completadas', label: 'Completadas' },
  ]

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div>
      {/* Header (standalone page) */}
      {!clienteId && (
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Tareas</h1>
            <p className="text-slate-500 text-sm mt-1">
              {counts.vencidas > 0 && <span className="text-red-600 font-medium mr-2">{counts.vencidas} vencida{counts.vencidas > 1 ? 's' : ''}</span>}
              {counts.hoy > 0 && <span className="text-amber-600 font-medium mr-2">{counts.hoy} para hoy/mañana</span>}
              {counts.pendientes} pendiente{counts.pendientes !== 1 ? 's' : ''}
            </p>
          </div>
          <button onClick={() => { setEditing(undefined); setShowModal(true) }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Nueva tarea
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-4 border-b border-slate-200">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={[
              'flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}>
            {label}
            {counts[key] > 0 && (
              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                key === 'vencidas' ? 'bg-red-100 text-red-700' :
                key === 'hoy' ? 'bg-amber-100 text-amber-700' :
                activeTab === key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>{counts[key]}</span>
            )}
          </button>
        ))}
        {clienteId && (
          <button onClick={() => { setEditing(undefined); setShowModal(true) }}
            className="ml-auto flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium pb-2">
            <Plus className="w-3.5 h-3.5" /> Agregar tarea
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar tarea..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
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
              t.completada ? 'opacity-60 border-slate-100' :
              isOverdue ? 'border-red-200 bg-red-50/30' :
              isToday ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200',
            ].join(' ')}>
              <button onClick={() => toggleComplete(t)} className="mt-0.5 flex-shrink-0 text-slate-300 hover:text-emerald-600 transition-colors">
                {t.completada
                  ? <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                  : <Square className="w-5 h-5" />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2 flex-wrap">
                  <span className={`font-medium text-sm ${t.completada ? 'line-through text-slate-400' : 'text-slate-800'}`}>
                    {t.titulo}
                  </span>
                  <PriIcon className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${PRIORIDAD_CLS[t.prioridad]}`} />
                </div>
                {t.descripcion && (
                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">{t.descripcion}</p>
                )}
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  {t.fecha_vencimiento && (
                    <span className={`text-xs font-medium flex items-center gap-1 ${
                      isOverdue ? 'text-red-600' : isToday ? 'text-amber-600' : isTomorrow ? 'text-amber-500' : 'text-slate-400'
                    }`}>
                      <Clock className="w-3 h-3" />
                      {isToday ? 'Hoy' : isTomorrow ? 'Mañana' : formatFecha(t.fecha_vencimiento)}
                      {isOverdue && ' (vencida)'}
                    </span>
                  )}
                  {!clienteId && t.cliente && (
                    <Link href={`/clientes/${t.client_id}`} className="text-xs text-emerald-600 hover:underline">
                      {t.cliente.nombre}
                    </Link>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                <button onClick={() => { setEditing(t); setShowModal(true) }}
                  className="text-slate-400 hover:text-slate-700 transition-colors p-1">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => deleteTarea(t.id)}
                  className="text-slate-400 hover:text-red-600 transition-colors p-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay tareas en esta categoría</p>
          </div>
        )}
      </div>

      {showModal && (
        <TareaModal tarea={editing} clienteId={clienteId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
