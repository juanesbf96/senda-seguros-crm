'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Solicitud, EstadoSolicitud } from '@/types'
import { Plus, Search, Pencil, Trash2, ClipboardList, FileCheck, Archive } from 'lucide-react'
import Link from 'next/link'
import SolicitudModal from './SolicitudModal'

const ESTADO_COLORS: Record<EstadoSolicitud, string> = {
  nueva:      'bg-blue-100 text-blue-700',
  en_proceso: 'bg-amber-100 text-amber-700',
  resuelta:   'bg-emerald-100 text-emerald-700',
  cancelada:  'bg-slate-100 text-slate-500',
  inactiva:   'bg-slate-100 text-slate-400',
}
const ESTADO_LABELS: Record<EstadoSolicitud, string> = {
  nueva: 'Nueva', en_proceso: 'En proceso', resuelta: 'Resuelta',
  cancelada: 'Cancelada', inactiva: 'Inactiva',
}

type Tab = 'cotizaciones' | 'expediciones' | 'inactivas'

function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function SolicitudesList() {
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [activeTab, setActiveTab]     = useState<Tab>('cotizaciones')
  const [showModal, setShowModal]     = useState(false)
  const [editing, setEditing]         = useState<Solicitud | undefined>()

  async function load() {
    const { data } = await supabase
      .from('solicitudes')
      .select('*, cliente:clientes(id, nombre), poliza:polizas(id, numero_poliza, aseguradora, ramo)')
      .order('numero_solicitud', { ascending: false })
    setSolicitudes((data || []) as Solicitud[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteSolicitud(id: string) {
    if (!confirm('¿Eliminar esta solicitud?')) return
    await supabase.from('solicitudes').delete().eq('id', id)
    setSolicitudes(prev => prev.filter(s => s.id !== id))
  }

  // Tab filtering
  const cotizaciones  = solicitudes.filter(s => s.tipo === 'cotizacion'  && s.estado !== 'inactiva')
  const expediciones  = solicitudes.filter(s => s.tipo === 'expedicion'  && s.estado !== 'inactiva')
  const inactivas     = solicitudes.filter(s => s.estado === 'inactiva')

  const tabData: Record<Tab, Solicitud[]> = { cotizaciones, expediciones, inactivas }

  const q = search.toLowerCase()
  const filtered = tabData[activeTab].filter(s =>
    !search ||
    s.cliente?.nombre?.toLowerCase().includes(q) ||
    s.descripcion?.toLowerCase().includes(q) ||
    s.notas?.toLowerCase().includes(q) ||
    s.asignado_a?.toLowerCase().includes(q) ||
    String(s.numero_solicitud || '').includes(q)
  )

  const TABS: { key: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { key: 'cotizaciones', label: 'Cotizaciones', icon: ClipboardList, count: cotizaciones.length },
    { key: 'expediciones', label: 'Expediciones', icon: FileCheck,     count: expediciones.length },
    { key: 'inactivas',    label: 'Inactivas',    icon: Archive,       count: inactivas.length    },
  ]

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
            {cotizaciones.length} cotizaciones · {expediciones.length} expediciones · {inactivas.length} inactivas
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

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={[
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}>
            <Icon className="w-4 h-4" />
            {label}
            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activeTab === key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, asignado, N° solicitud..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium w-20">N°</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              {activeTab === 'inactivas' && (
                <>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Tipo</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Ramo</th>
                  <th className="px-4 py-3 font-medium hidden lg:table-cell">Riesgo</th>
                </>
              )}
              <th className="px-4 py-3 font-medium hidden md:table-cell">Observaciones</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Asignado a</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                  {s.numero_solicitud ? `#${s.numero_solicitud}` : '—'}
                </td>
                <td className="px-4 py-3">
                  {s.client_id
                    ? <Link href={`/clientes/${s.client_id}`} className="font-medium text-slate-800 hover:text-emerald-600">{s.cliente?.nombre || '—'}</Link>
                    : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[s.estado]}`}>
                    {ESTADO_LABELS[s.estado]}
                  </span>
                </td>
                {activeTab === 'inactivas' && (
                  <>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs capitalize">{s.tipo}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">{s.ramo || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs max-w-[150px]">
                      <span className="line-clamp-2">{s.riesgo || '—'}</span>
                    </td>
                  </>
                )}
                <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs max-w-[200px]">
                  <span className="line-clamp-2">{s.descripcion || s.notas || '—'}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-slate-500 text-xs">{s.asignado_a || '—'}</td>
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
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay solicitudes en esta sección</p>
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
