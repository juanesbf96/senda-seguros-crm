'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Prospecto, EtapaProspecto, FuenteProspecto } from '@/types'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import { formatCOP } from '@/lib/utils'
import {
  Plus, Search, Pencil, Trash2, LayoutGrid, List,
  Phone, Mail, MapPin, TrendingUp, ChevronRight,
} from 'lucide-react'
import ProspectoModal from './ProspectoModal'
import ProspectoActividades from './ProspectoActividades'

const ETAPAS: EtapaProspecto[] = [
  'nuevo', 'contactado', 'calificado', 'propuesta', 'cerrado_ganado', 'cerrado_perdido',
]

const ETAPA_LABELS: Record<EtapaProspecto, string> = {
  nuevo:           'Nuevo',
  contactado:      'Contactado',
  calificado:      'Calificado',
  propuesta:       'Propuesta',
  cerrado_ganado:  'Ganado ✓',
  cerrado_perdido: 'Perdido',
}

const ETAPA_COLORS: Record<EtapaProspecto, string> = {
  nuevo:           'bg-cream-200 text-ink-600 border-ink-200',
  contactado:      'bg-info/10 text-info border-info/30',
  calificado:      'bg-warning-soft text-ink-700 border-warning/30',
  propuesta:       'bg-indigo-50 text-indigo-700 border-indigo-200',
  cerrado_ganado:  'bg-primary-50 text-primary-700 border-primary-200',
  cerrado_perdido: 'bg-error-soft text-error border-error/30',
}

const ETAPA_HEADER_COLORS: Record<EtapaProspecto, string> = {
  nuevo:           'bg-ink-500',
  contactado:      'bg-info',
  calificado:      'bg-warning',
  propuesta:       'bg-indigo-600',
  cerrado_ganado:  'bg-primary-500',
  cerrado_perdido: 'bg-error',
}

const FUENTE_LABELS: Record<FuenteProspecto, string> = {
  referido:   'Referido',
  web:        'Web',
  llamada:    'Llamada',
  red_social: 'Red social',
  evento:     'Evento',
  otro:       'Otro',
}

type ViewMode = 'kanban' | 'list'

export default function ProspectosList() {
  const { currentWorkspace } = useWorkspace()
  const { can } = usePermissions()
  const [prospectos, setProspectos] = useState<Prospecto[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<Prospecto | undefined>()
  const [etapaInicial, setEtapaInicial] = useState<EtapaProspecto>('nuevo')
  const [viewMode, setViewMode]     = useState<ViewMode>('kanban')
  const [expanded, setExpanded]     = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase
      .from('prospectos')
      .select('*')
      .eq('workspace_id', currentWorkspace?.id || '')
      .order('created_at', { ascending: false })
    setProspectos((data || []) as Prospecto[])
    setLoading(false)
  }

  useEffect(() => { load() }, [currentWorkspace?.id])

  async function deleteProspecto(id: string) {
    if (!confirm('¿Eliminar este prospecto?')) return
    await supabase.from('prospectos').delete().eq('id', id)
    setProspectos(prev => prev.filter(p => p.id !== id))
  }

  async function moveToEtapa(prospectoId: string, etapa: EtapaProspecto) {
    await supabase.from('prospectos').update({ etapa }).eq('id', prospectoId)
    setProspectos(prev => prev.map(p => p.id === prospectoId ? { ...p, etapa } : p))
  }

  // Drag handlers
  function onDragStart(id: string) { setDraggingId(id) }
  function onDragOver(e: React.DragEvent) { e.preventDefault() }
  function onDrop(e: React.DragEvent, etapa: EtapaProspecto) {
    e.preventDefault()
    if (draggingId) { moveToEtapa(draggingId, etapa); setDraggingId(null) }
  }

  const q = search.toLowerCase()
  const filtered = prospectos.filter(p =>
    !search ||
    p.nombre.toLowerCase().includes(q) ||
    p.empresa?.toLowerCase().includes(q) ||
    p.email?.toLowerCase().includes(q) ||
    p.ciudad?.toLowerCase().includes(q) ||
    p.ramo_interes?.toLowerCase().includes(q)
  )

  const totalValor = filtered
    .filter(p => p.etapa !== 'cerrado_perdido')
    .reduce((s, p) => s + (p.valor_estimado || 0), 0)

  const byEtapa = (etapa: EtapaProspecto) => filtered.filter(p => p.etapa === etapa)

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="p-6 max-w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-700">CRM Prospectos</h1>
          <p className="text-ink-400 text-sm mt-1">
            {filtered.filter(p => !['cerrado_ganado','cerrado_perdido'].includes(p.etapa)).length} activos
            · Valor pipeline: {formatCOP(totalValor)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* View toggle */}
          <div className="flex border border-ink-200 rounded-lg overflow-hidden">
            <button onClick={() => setViewMode('kanban')}
              className={`px-3 py-2 text-sm transition-colors ${viewMode === 'kanban' ? 'bg-primary-500 text-white' : 'text-ink-400 hover:bg-cream-100'}`}>
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button onClick={() => setViewMode('list')}
              className={`px-3 py-2 text-sm transition-colors ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'text-ink-400 hover:bg-cream-100'}`}>
              <List className="w-4 h-4" />
            </button>
          </div>
          {can('pipeline_ver') && (
            <button onClick={() => { setEditing(undefined); setEtapaInicial('nuevo'); setShowModal(true) }}
              className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Nuevo prospecto
            </button>
          )}
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nombre, ramo, ciudad..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400" />
      </div>

      {/* ── Kanban View ── */}
      {viewMode === 'kanban' && (
        <div className="flex gap-4 overflow-x-auto pb-4">
          {ETAPAS.map(etapa => {
            const cards = byEtapa(etapa)
            return (
              <div key={etapa}
                className="flex-shrink-0 w-64"
                onDragOver={onDragOver}
                onDrop={e => onDrop(e, etapa)}>
                {/* Column header */}
                <div className={`${ETAPA_HEADER_COLORS[etapa]} text-white rounded-t-xl px-3 py-2 flex items-center justify-between`}>
                  <span className="text-xs font-semibold">{ETAPA_LABELS[etapa]}</span>
                  <span className="bg-white/20 text-white text-xs px-1.5 py-0.5 rounded-full">{cards.length}</span>
                </div>
                <div className="bg-cream-200 rounded-b-xl min-h-[120px] p-2 space-y-2">
                  {cards.map(p => (
                    <div key={p.id}
                      draggable
                      onDragStart={() => onDragStart(p.id)}
                      className={`bg-white rounded-lg border shadow-sm p-3 cursor-grab active:cursor-grabbing transition-opacity ${ETAPA_COLORS[etapa]} ${draggingId === p.id ? 'opacity-50' : ''}`}>
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-ink-700 text-sm leading-tight truncate">{p.nombre}</p>
                          {p.empresa && <p className="text-xs text-ink-400 truncate">{p.empresa}</p>}
                        </div>
                        <div className="flex gap-1 flex-shrink-0">
                          <button onClick={() => { setEditing(p); setShowModal(true) }}
                            className="text-ink-300 hover:text-ink-500 transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {(can('pipeline_eliminar_todos') || can('pipeline_eliminar_propios')) && (
                            <button onClick={() => deleteProspecto(p.id)}
                              className="text-ink-300 hover:text-error transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                      {p.ramo_interes && (
                        <span className="inline-block text-xs bg-white/60 px-1.5 py-0.5 rounded border mb-1.5">
                          {p.ramo_interes}
                        </span>
                      )}
                      <div className="flex flex-wrap gap-2 text-xs text-ink-400">
                        {p.telefono && (
                          <span className="flex items-center gap-0.5"><Phone className="w-3 h-3" />{p.telefono}</span>
                        )}
                        {p.ciudad && (
                          <span className="flex items-center gap-0.5"><MapPin className="w-3 h-3" />{p.ciudad}</span>
                        )}
                      </div>
                      {p.valor_estimado && (
                        <p className="text-xs font-semibold text-ink-600 mt-1.5 flex items-center gap-1">
                          <TrendingUp className="w-3 h-3 text-primary-500" />
                          {formatCOP(p.valor_estimado)}
                        </p>
                      )}
                      {/* Quick move buttons */}
                      {can('pipeline_mover_todos') && (
                        <div className="flex gap-1 mt-2 pt-2 border-t border-cream-200">
                          {ETAPAS.filter(e => e !== etapa).slice(0, 2).map(nextEtapa => (
                            <button key={nextEtapa}
                              onClick={() => moveToEtapa(p.id, nextEtapa)}
                              className="flex items-center gap-0.5 text-[10px] text-ink-400 hover:text-ink-500 transition-colors">
                              <ChevronRight className="w-3 h-3" />
                              {ETAPA_LABELS[nextEtapa].replace(' ✓', '')}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {/* Add card in column */}
                  {can('pipeline_ver') && (
                    <button onClick={() => { setEditing(undefined); setEtapaInicial(etapa); setShowModal(true) }}
                      className="w-full py-2 text-xs text-ink-400 hover:text-ink-500 hover:bg-white rounded-lg border border-dashed border-ink-300 transition-colors flex items-center justify-center gap-1">
                      <Plus className="w-3 h-3" /> Agregar
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── List View ── */}
      {viewMode === 'list' && (
        <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 border-b border-ink-200">
              <tr className="text-left text-xs text-ink-400">
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Ramo</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Ciudad</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Fuente</th>
                <th className="px-4 py-3 font-medium text-right hidden sm:table-cell">Valor est.</th>
                <th className="px-4 py-3 font-medium">Etapa</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => (
                <>
                  <tr key={p.id} className="border-b border-cream-200 hover:bg-cream-100 transition-colors">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-ink-700">{p.nombre}</p>
                        {p.empresa && <p className="text-xs text-ink-400">{p.empresa}</p>}
                        <div className="flex gap-2 mt-0.5">
                          {p.telefono && (
                            <span className="text-xs text-ink-400 flex items-center gap-0.5">
                              <Phone className="w-3 h-3" />{p.telefono}
                            </span>
                          )}
                          {p.email && (
                            <span className="text-xs text-ink-400 flex items-center gap-0.5">
                              <Mail className="w-3 h-3" />{p.email}
                            </span>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs">{p.ramo_interes || '—'}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs">{p.ciudad || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-ink-400 text-xs">
                      {p.fuente ? FUENTE_LABELS[p.fuente] : '—'}
                    </td>
                    <td className="px-4 py-3 text-right hidden sm:table-cell font-medium text-ink-600">
                      {p.valor_estimado ? formatCOP(p.valor_estimado) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <select value={p.etapa}
                        onChange={e => moveToEtapa(p.id, e.target.value as EtapaProspecto)}
                        disabled={!can('pipeline_mover_todos')}
                        className={`text-xs border border-ink-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-400 ${!can('pipeline_mover_todos') ? 'opacity-50 cursor-not-allowed' : ''}`}>
                        {ETAPAS.map(e => (
                          <option key={e} value={e}>{ETAPA_LABELS[e]}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                          className="text-ink-400 hover:text-ink-600 text-xs transition-colors">
                          Historial
                        </button>
                        <button onClick={() => { setEditing(p); setShowModal(true) }}
                          className="text-ink-400 hover:text-ink-600 transition-colors">
                          <Pencil className="w-4 h-4" />
                        </button>
                        {(can('pipeline_eliminar_todos') || can('pipeline_eliminar_propios')) && (
                          <button onClick={() => deleteProspecto(p.id)}
                            className="text-ink-400 hover:text-error transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {expanded === p.id && (
                    <tr key={`${p.id}-act`} className="bg-cream-100 border-b border-cream-200">
                      <td colSpan={7} className="px-6 py-4">
                        <ProspectoActividades prospectoId={p.id} />
                      </td>
                    </tr>
                  )}
                </>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-ink-400">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay prospectos registrados</p>
            </div>
          )}
        </div>
      )}

      {showModal && (
        <ProspectoModal
          prospecto={editing}
          etapaInicial={etapaInicial}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
