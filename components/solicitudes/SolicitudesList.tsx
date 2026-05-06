'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Solicitud, EstadoSolicitud, TipoSolicitud } from '@/types'
import { Plus, Search, Pencil, Trash2, AlertCircle, Clock, CheckCircle2, XCircle } from 'lucide-react'
import Link from 'next/link'
import SolicitudModal from './SolicitudModal'

const TIPO_LABELS: Record<TipoSolicitud, string> = {
  expedicion: 'Expedición', renovacion: 'Renovación', endoso: 'Endoso',
  cancelacion: 'Cancelación', certificado: 'Certificado', siniestro: 'Siniestro',
  inclusion: 'Inclusión', exclusion: 'Exclusión', otro: 'Otro',
}
const TIPO_COLORS: Record<TipoSolicitud, string> = {
  expedicion: 'bg-blue-100 text-blue-700',
  renovacion: 'bg-indigo-100 text-indigo-700',
  endoso: 'bg-purple-100 text-purple-700',
  cancelacion: 'bg-slate-100 text-slate-600',
  certificado: 'bg-teal-100 text-teal-700',
  siniestro: 'bg-red-100 text-red-700',
  inclusion: 'bg-emerald-100 text-emerald-700',
  exclusion: 'bg-orange-100 text-orange-700',
  otro: 'bg-slate-100 text-slate-600',
}

const ESTADO_TABS: { key: EstadoSolicitud | 'all'; label: string; icon: React.ElementType }[] = [
  { key: 'all',        label: 'Todas',      icon: Clock },
  { key: 'nueva',      label: 'Nuevas',     icon: Clock },
  { key: 'en_proceso', label: 'En proceso', icon: AlertCircle },
  { key: 'resuelta',   label: 'Resueltas',  icon: CheckCircle2 },
  { key: 'cancelada',  label: 'Canceladas', icon: XCircle },
]

function formatFecha(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function daysLeft(dateStr: string | null) {
  if (!dateStr) return null
  const diff = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000)
  return diff
}

export default function SolicitudesList() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<EstadoSolicitud | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Solicitud | undefined>()

  async function load() {
    const { data } = await supabase
      .from('solicitudes')
      .select('*, cliente:clientes(id, nombre), poliza:polizas(id, numero_poliza, aseguradora, ramo)')
      .order('created_at', { ascending: false })
    setSolicitudes((data || []) as Solicitud[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteSolicitud(id: string) {
    if (!confirm('¿Eliminar esta solicitud?')) return
    await supabase.from('solicitudes').delete().eq('id', id)
    setSolicitudes(prev => prev.filter(s => s.id !== id))
  }

  // Count by status for tab badges
  const counts = ESTADO_TABS.reduce((acc, t) => {
    acc[t.key] = t.key === 'all'
      ? solicitudes.length
      : solicitudes.filter(s => s.estado === t.key).length
    return acc
  }, {} as Record<string, number>)

  const filtered = solicitudes.filter(s => {
    const matchTab = activeTab === 'all' || s.estado === activeTab
    const q = search.toLowerCase()
    const matchSearch = !search ||
      s.cliente?.nombre?.toLowerCase().includes(q) ||
      s.descripcion?.toLowerCase().includes(q) ||
      TIPO_LABELS[s.tipo].toLowerCase().includes(q)
    return matchTab && matchSearch
  })

  const urgentes = filtered.filter(s => s.prioridad === 'urgente' && s.estado !== 'resuelta' && s.estado !== 'cancelada').length

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Solicitudes</h1>
          <p className="text-slate-500 text-sm mt-1">
            {filtered.length} solicitudes
            {urgentes > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 text-red-600 font-medium">
                <AlertCircle className="w-3.5 h-3.5" />
                {urgentes} urgente{urgentes > 1 ? 's' : ''}
              </span>
            )}
          </p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva solicitud
        </button>
      </div>

      {/* State tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200 overflow-x-auto">
        {ESTADO_TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={[
              'flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
              activeTab === key
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
            {counts[key] > 0 && (
              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activeTab === key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                {counts[key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, tipo, descripción..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Tipo</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Descripción</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Póliza</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Fecha límite</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => {
              const days = daysLeft(s.fecha_limite)
              const overdue = days !== null && days < 0 && s.estado !== 'resuelta' && s.estado !== 'cancelada'
              const dueToday = days !== null && days === 0
              return (
                <tr key={s.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${overdue ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {s.prioridad === 'urgente' && (
                        <AlertCircle className="w-3.5 h-3.5 text-red-500 flex-shrink-0" />
                      )}
                      {s.client_id ? (
                        <Link href={`/clientes/${s.client_id}`} className="font-medium text-slate-800 hover:text-emerald-600">
                          {s.cliente?.nombre || '—'}
                        </Link>
                      ) : <span className="text-slate-400">—</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIPO_COLORS[s.tipo]}`}>
                      {TIPO_LABELS[s.tipo]}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs max-w-[200px]">
                    <span className="line-clamp-2">{s.descripcion || '—'}</span>
                  </td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs">
                    {s.poliza
                      ? `${s.poliza.aseguradora} · ${s.poliza.ramo}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    {s.fecha_limite ? (
                      <div className={`text-xs ${overdue ? 'text-red-600 font-medium' : dueToday ? 'text-amber-600 font-medium' : 'text-slate-500'}`}>
                        {formatFecha(s.fecha_limite)}
                        {overdue && <span className="ml-1">(vencida)</span>}
                        {dueToday && <span className="ml-1">(hoy)</span>}
                        {days !== null && days > 0 && days <= 3 && (
                          <span className="ml-1 text-amber-600">({days}d)</span>
                        )}
                      </div>
                    ) : <span className="text-slate-300 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <EstadoBadge estado={s.estado} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditing(s); setShowModal(true) }}
                        className="text-slate-400 hover:text-slate-700 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteSolicitud(s.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay solicitudes{activeTab !== 'all' ? ` ${ESTADO_TABS.find(t => t.key === activeTab)?.label.toLowerCase()}` : ''}</p>
          </div>
        )}
      </div>

      {showModal && (
        <SolicitudModal
          solicitud={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}

function EstadoBadge({ estado }: { estado: EstadoSolicitud }) {
  const map: Record<EstadoSolicitud, string> = {
    nueva:      'bg-blue-100 text-blue-700',
    en_proceso: 'bg-amber-100 text-amber-700',
    resuelta:   'bg-emerald-100 text-emerald-700',
    cancelada:  'bg-slate-100 text-slate-500',
  }
  const labels: Record<EstadoSolicitud, string> = {
    nueva: 'Nueva', en_proceso: 'En proceso', resuelta: 'Resuelta', cancelada: 'Cancelada',
  }
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[estado]}`}>
      {labels[estado]}
    </span>
  )
}
