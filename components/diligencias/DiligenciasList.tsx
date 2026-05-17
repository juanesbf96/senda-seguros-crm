'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Diligencia, EstadoDiligencia, TipoDiligencia } from '@/types'
import { formatDate, daysUntil } from '@/lib/utils'
import { Plus, Search, Pencil, Trash2, ClipboardCheck, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import DiligenciasModal from './DiligenciasModal'

const ESTADO_COLORS: Record<EstadoDiligencia, string> = {
  pendiente:  'bg-warning-soft text-ink-700',
  en_proceso: 'bg-info/20 text-info',
  completada: 'bg-primary-100 text-primary-700',
  cancelada:  'bg-cream-200 text-ink-400',
}
const ESTADO_LABELS: Record<EstadoDiligencia, string> = {
  pendiente:  'Pendiente',
  en_proceso: 'En proceso',
  completada: 'Completada',
  cancelada:  'Cancelada',
}
const TIPO_LABELS: Record<TipoDiligencia, string> = {
  tramite:     'Trámite',
  certificado: 'Certificado',
  paz_y_salvo: 'Paz y salvo',
  inclusion:   'Inclusión',
  exclusion:   'Exclusión',
  endoso:      'Endoso',
  otro:        'Otro',
}

type Tab = EstadoDiligencia | 'todas'

export default function DiligenciasList() {
  const [diligencias, setDiligencias] = useState<Diligencia[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [activeTab,   setActiveTab]   = useState<Tab>('todas')
  const [showModal,   setShowModal]   = useState(false)
  const [editing,     setEditing]     = useState<Diligencia | undefined>()

  async function load() {
    const { data } = await supabase
      .from('diligencias')
      .select('*, cliente:clientes(id,nombre), poliza:polizas(id,numero_poliza,aseguradora)')
      .order('created_at', { ascending: false })
    setDiligencias((data || []) as Diligencia[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteDiligencia(id: string) {
    if (!confirm('¿Eliminar esta diligencia?')) return
    await supabase.from('diligencias').delete().eq('id', id)
    setDiligencias(prev => prev.filter(d => d.id !== id))
  }

  const q = search.toLowerCase()
  const filtered = diligencias.filter(d => {
    const matchSearch = !search ||
      d.descripcion.toLowerCase().includes(q) ||
      d.cliente?.nombre?.toLowerCase().includes(q) ||
      d.asignado_a?.toLowerCase().includes(q) ||
      String(d.numero_diligencia || '').includes(q)
    const matchTab = activeTab === 'todas' || d.estado === activeTab
    return matchSearch && matchTab
  })

  const counts = {
    todas:      diligencias.length,
    pendiente:  diligencias.filter(d => d.estado === 'pendiente').length,
    en_proceso: diligencias.filter(d => d.estado === 'en_proceso').length,
    completada: diligencias.filter(d => d.estado === 'completada').length,
    cancelada:  diligencias.filter(d => d.estado === 'cancelada').length,
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-700">Diligencias</h1>
          <p className="text-ink-400 text-sm mt-1">
            {counts.pendiente + counts.en_proceso} activas · {counts.completada} completadas
          </p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nueva diligencia
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-ink-200 overflow-x-auto">
        {([['todas','Todas'], ['pendiente','Pendientes'], ['en_proceso','En proceso'], ['completada','Completadas'], ['cancelada','Canceladas']] as [Tab,string][]).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              activeTab === key ? 'border-primary-500 text-primary-500' : 'border-transparent text-ink-400 hover:text-ink-600'
            }`}>
            {label}
            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activeTab === key ? 'bg-primary-100 text-primary-700' : 'bg-cream-200 text-ink-400'}`}>
              {counts[key as Tab] ?? 0}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por N°, cliente, descripción..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 border-b border-ink-200">
            <tr className="text-left text-xs text-ink-400">
              <th className="px-4 py-3 font-medium w-16">N°</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Asignado a</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Límite</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(d => {
              const days    = d.fecha_limite ? daysUntil(d.fecha_limite) : null
              const overdue = days !== null && days < 0 && d.estado !== 'completada' && d.estado !== 'cancelada'
              const urgent  = days !== null && days >= 0 && days <= 3 && d.estado !== 'completada' && d.estado !== 'cancelada'
              return (
                <tr key={d.id} className={`border-b border-cream-200 hover:bg-cream-100 transition-colors ${overdue ? 'bg-error-soft/30' : ''}`}>
                  <td className="px-4 py-3 text-ink-400 text-xs font-mono">#{d.numero_diligencia}</td>
                  <td className="px-4 py-3 text-ink-500 text-xs">{TIPO_LABELS[d.tipo]}</td>
                  <td className="px-4 py-3">
                    {d.client_id
                      ? <Link href={`/clientes/${d.client_id}`} className="font-medium text-ink-700 hover:text-primary-500">{d.cliente?.nombre || '—'}</Link>
                      : <span className="text-ink-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-ink-600 max-w-[200px]"><p className="line-clamp-1">{d.descripcion}</p></td>
                  <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs">{d.asignado_a || '—'}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`text-xs flex items-center gap-1 ${overdue ? 'text-error font-medium' : urgent ? 'text-ink-700 font-medium' : 'text-ink-400'}`}>
                      {(overdue || urgent) && <AlertTriangle className="w-3 h-3" />}
                      {formatDate(d.fecha_limite)}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[d.estado]}`}>
                      {ESTADO_LABELS[d.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditing(d); setShowModal(true) }} className="text-ink-400 hover:text-ink-600"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => deleteDiligencia(d.id)} className="text-ink-400 hover:text-error"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-ink-400">
            <ClipboardCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay diligencias en esta sección</p>
          </div>
        )}
      </div>

      {showModal && (
        <DiligenciasModal diligencia={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
