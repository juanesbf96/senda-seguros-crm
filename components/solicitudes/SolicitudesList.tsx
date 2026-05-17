'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Solicitud, EstadoSolicitud, TipoSolicitud } from '@/types'
import {
  Plus, Search, Pencil, Trash2,
  ClipboardList, FileCheck, Archive, RefreshCw,
  FilePen, XCircle, FileText, UserPlus, UserMinus,
  AlertTriangle, LayoutGrid,
} from 'lucide-react'
import Link from 'next/link'
import SolicitudModal from './SolicitudModal'
import { useWorkspace } from '@/contexts/WorkspaceContext'

const ESTADO_COLORS: Record<EstadoSolicitud, string> = {
  nueva:      'bg-info/20 text-info',
  en_proceso: 'bg-warning-soft text-ink-700',
  resuelta:   'bg-primary-100 text-primary-700',
  cancelada:  'bg-cream-200 text-ink-400',
  inactiva:   'bg-cream-200 text-ink-400',
}
const ESTADO_LABELS: Record<EstadoSolicitud, string> = {
  nueva: 'Nueva', en_proceso: 'En proceso', resuelta: 'Resuelta',
  cancelada: 'Cancelada', inactiva: 'Inactiva',
}

type Tab = 'todas' | TipoSolicitud | 'inactivas'

const TIPO_LABELS: Record<TipoSolicitud, string> = {
  cotizacion:  'Cotizaciones',
  expedicion:  'Expediciones',
  renovacion:  'Renovaciones',
  endoso:      'Endosos',
  cancelacion: 'Cancelaciones',
  certificado: 'Certificados',
  siniestro:   'Siniestros',
  inclusion:   'Inclusiones',
  exclusion:   'Exclusiones',
  otro:        'Otros',
}


export default function SolicitudesList({ clienteId }: { clienteId?: string }) {
  const { currentWorkspace } = useWorkspace()
  const [solicitudes, setSolicitudes] = useState<Solicitud[]>([])
  const [loading, setLoading]         = useState(true)
  const [search, setSearch]           = useState('')
  const [activeTab, setActiveTab]     = useState<Tab>('todas')
  const [showModal, setShowModal]     = useState(false)
  const [editing, setEditing]         = useState<Solicitud | undefined>()

  async function load() {
    if (!currentWorkspace) return
    let q = supabase
      .from('solicitudes')
      .select('*, cliente:clientes(id, nombre), poliza:polizas(id, numero_poliza, aseguradora, ramo)')
      .eq('workspace_id', currentWorkspace.id)
      .order('numero_solicitud', { ascending: false })
    if (clienteId) q = q.eq('client_id', clienteId)
    const { data } = await q
    setSolicitudes((data || []) as Solicitud[])
    setLoading(false)
  }

  useEffect(() => { load() }, [clienteId, currentWorkspace])

  async function deleteSolicitud(id: string) {
    if (!confirm('¿Eliminar esta solicitud?')) return
    await supabase.from('solicitudes').delete().eq('id', id)
    setSolicitudes(prev => prev.filter(s => s.id !== id))
  }

  // Tab filtering
  const activas   = solicitudes.filter(s => s.estado !== 'inactiva')
  const inactivas = solicitudes.filter(s => s.estado === 'inactiva')

  function getTabData(tab: Tab): Solicitud[] {
    if (tab === 'todas')    return activas
    if (tab === 'inactivas') return inactivas
    return activas.filter(s => s.tipo === tab)
  }

  const q = search.toLowerCase()
  const filtered = getTabData(activeTab).filter(s =>
    !search ||
    s.cliente?.nombre?.toLowerCase().includes(q) ||
    s.descripcion?.toLowerCase().includes(q) ||
    s.notas?.toLowerCase().includes(q) ||
    s.asignado_a?.toLowerCase().includes(q) ||
    String(s.numero_solicitud || '').includes(q)
  )

  const TABS: { key: Tab; label: string; icon: React.ElementType; count: number }[] = [
    { key: 'todas',        label: 'Todas',         icon: LayoutGrid,   count: activas.length },
    { key: 'cotizacion',   label: 'Cotizaciones',  icon: ClipboardList, count: activas.filter(s => s.tipo === 'cotizacion').length },
    { key: 'expedicion',   label: 'Expediciones',  icon: FileCheck,     count: activas.filter(s => s.tipo === 'expedicion').length },
    { key: 'renovacion',   label: 'Renovaciones',  icon: RefreshCw,     count: activas.filter(s => s.tipo === 'renovacion').length },
    { key: 'endoso',       label: 'Endosos',       icon: FilePen,       count: activas.filter(s => s.tipo === 'endoso').length },
    { key: 'cancelacion',  label: 'Cancelaciones', icon: XCircle,       count: activas.filter(s => s.tipo === 'cancelacion').length },
    { key: 'certificado',  label: 'Certificados',  icon: FileText,      count: activas.filter(s => s.tipo === 'certificado').length },
    { key: 'siniestro',    label: 'Siniestros',    icon: AlertTriangle, count: activas.filter(s => s.tipo === 'siniestro').length },
    { key: 'inclusion',    label: 'Inclusiones',   icon: UserPlus,      count: activas.filter(s => s.tipo === 'inclusion').length },
    { key: 'exclusion',    label: 'Exclusiones',   icon: UserMinus,     count: activas.filter(s => s.tipo === 'exclusion').length },
    { key: 'otro',         label: 'Otros',         icon: ClipboardList, count: activas.filter(s => s.tipo === 'otro').length },
    { key: 'inactivas',    label: 'Inactivas',     icon: Archive,       count: inactivas.length },
  ]

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-700">Solicitudes</h1>
          <p className="text-ink-400 text-sm mt-1">
            {cotizaciones.length} cotizaciones · {expediciones.length} expediciones · {inactivas.length} inactivas
          </p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva solicitud
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-ink-200">
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={[
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key
                ? 'border-primary-500 text-primary-500'
                : 'border-transparent text-ink-400 hover:text-ink-600',
            ].join(' ')}>
            <Icon className="w-4 h-4" />
            {label}
            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activeTab === key ? 'bg-primary-100 text-primary-700' : 'bg-cream-200 text-ink-400'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="flex gap-3 mb-5">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, asignado, N° solicitud..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 border-b border-ink-200">
            <tr className="text-left text-xs text-ink-400">
              <th className="px-4 py-3 font-medium w-20">N°</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              {(activeTab === 'todas' || activeTab === 'inactivas') && (
                <th className="px-4 py-3 font-medium hidden md:table-cell">Tipo</th>
              )}
              <th className="px-4 py-3 font-medium hidden md:table-cell">Ramo</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Riesgo</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Observaciones</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Asignado a</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b border-cream-200 hover:bg-cream-100 transition-colors">
                <td className="px-4 py-3 text-ink-400 text-xs font-mono">
                  {s.numero_solicitud ? `#${s.numero_solicitud}` : '—'}
                </td>
                <td className="px-4 py-3">
                  {s.client_id
                    ? <Link href={`/clientes/${s.client_id}`} className="font-medium text-ink-700 hover:text-primary-500">{s.cliente?.nombre || '—'}</Link>
                    : <span className="text-ink-400">—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[s.estado]}`}>
                    {ESTADO_LABELS[s.estado]}
                  </span>
                </td>
                {activeTab === 'inactivas' && (
                  <>
                    <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs capitalize">{s.tipo}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs">{s.ramo || '—'}</td>
                    <td className="px-4 py-3 hidden lg:table-cell text-ink-400 text-xs max-w-[150px]">
                      <span className="line-clamp-2">{s.riesgo || '—'}</span>
                    </td>
                  </>
                )}
                <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs max-w-[200px]">
                  <span className="line-clamp-2">{s.descripcion || s.notas || '—'}</span>
                </td>
                <td className="px-4 py-3 hidden lg:table-cell text-ink-400 text-xs">{s.asignado_a || '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => { setEditing(s); setShowModal(true) }}
                      className="text-ink-400 hover:text-ink-600 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteSolicitud(s.id)}
                      className="text-ink-400 hover:text-error transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-ink-400">
            <ClipboardList className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay solicitudes en esta sección</p>
          </div>
        )}
      </div>

      {showModal && (
        <SolicitudModal
          solicitud={editing}
          clienteId={clienteId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
