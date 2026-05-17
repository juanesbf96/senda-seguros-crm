'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Siniestro, EstadoSiniestro } from '@/types'
import { formatCOP, formatDate } from '@/lib/utils'
import { Plus, Search, Pencil, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import SiniestroModal from './SiniestroModal'
import { usePermissions } from '@/contexts/PermissionsContext'

const ESTADO_LABELS: Record<EstadoSiniestro, string> = {
  reportado:  'Reportado',
  en_estudio: 'En estudio',
  en_pago:    'En pago',
  cerrado:    'Cerrado',
  rechazado:  'Rechazado',
}
const ESTADO_COLORS: Record<EstadoSiniestro, string> = {
  reportado:  'bg-cream-200 text-ink-500',
  en_estudio: 'bg-warning-soft text-ink-700',
  en_pago:    'bg-info/20 text-info',
  cerrado:    'bg-primary-100 text-primary-700',
  rechazado:  'bg-error-soft text-error',
}

type Tab = EstadoSiniestro | 'todos'

export default function SiniestrosList({ clienteId }: { clienteId?: string }) {
  const { can } = usePermissions()
  const [siniestros, setSiniestros] = useState<Siniestro[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [activeTab,  setActiveTab]  = useState<Tab>('todos')
  const [showModal,  setShowModal]  = useState(false)
  const [editing,    setEditing]    = useState<Siniestro | undefined>()

  async function load() {
    let q = supabase
      .from('siniestros')
      .select('*, cliente:clientes(id,nombre), poliza:polizas(id,numero_poliza,aseguradora,ramo), amparos:siniestro_amparos(*)')
      .order('created_at', { ascending: false })
    if (clienteId) q = q.eq('client_id', clienteId)
    const { data } = await q
    setSiniestros((data || []) as Siniestro[])
    setLoading(false)
  }

  useEffect(() => { load() }, [clienteId])

  async function deleteSiniestro(id: string) {
    if (!confirm('¿Eliminar este siniestro?')) return
    await supabase.from('siniestros').delete().eq('id', id)
    setSiniestros(prev => prev.filter(s => s.id !== id))
  }

  const q = search.toLowerCase()
  const filtered = siniestros.filter(s => {
    const matchSearch = !search ||
      s.descripcion.toLowerCase().includes(q) ||
      s.cliente?.nombre?.toLowerCase().includes(q) ||
      s.aseguradora?.toLowerCase().includes(q) ||
      String(s.numero_siniestro || '').includes(q)
    const matchTab = activeTab === 'todos' || s.estado === activeTab
    return matchSearch && matchTab
  })

  const counts = {
    todos:      siniestros.length,
    reportado:  siniestros.filter(s => s.estado === 'reportado').length,
    en_estudio: siniestros.filter(s => s.estado === 'en_estudio').length,
    en_pago:    siniestros.filter(s => s.estado === 'en_pago').length,
    cerrado:    siniestros.filter(s => s.estado === 'cerrado').length,
    rechazado:  siniestros.filter(s => s.estado === 'rechazado').length,
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
          <h1 className="text-2xl font-bold text-ink-700">Siniestros</h1>
          <p className="text-ink-400 text-sm mt-1">{siniestros.length} registros</p>
        </div>
        {can('siniestros_crear') && (
          <button onClick={() => { setEditing(undefined); setShowModal(true) }}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Nuevo siniestro
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-ink-200 overflow-x-auto">
        {([['todos','Todos'], ...Object.entries(ESTADO_LABELS)] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              activeTab === key ? 'border-primary-500 text-primary-500' : 'border-transparent text-ink-400 hover:text-ink-600'
            }`}>
            {label}
            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activeTab === key ? 'bg-primary-100 text-primary-700' : 'bg-cream-200 text-ink-400'}`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por N°, cliente, aseguradora..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-cream-100 border-b border-ink-200">
            <tr className="text-left text-xs text-ink-400">
              <th className="px-4 py-3 font-medium w-16">N°</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Descripción</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Aseguradora</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Reclamado</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Aprobado</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Fecha</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(s => (
              <tr key={s.id} className="border-b border-cream-200 hover:bg-cream-100 transition-colors">
                <td className="px-4 py-3 text-ink-400 text-xs font-mono">
                  {s.numero_siniestro ? `#${s.numero_siniestro}` : '—'}
                </td>
                <td className="px-4 py-3">
                  {s.client_id
                    ? <Link href={`/clientes/${s.client_id}`} className="font-medium text-ink-700 hover:text-primary-500">{s.cliente?.nombre || '—'}</Link>
                    : <span className="text-ink-400">—</span>}
                </td>
                <td className="px-4 py-3 text-ink-600 max-w-[200px]">
                  <p className="line-clamp-1">{s.descripcion}</p>
                  {s.amparo && <p className="text-xs text-ink-400 truncate">{s.amparo}</p>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs">{s.aseguradora || '—'}</td>
                <td className="px-4 py-3 hidden md:table-cell font-medium text-ink-600">
                  {s.valor_reclamado ? formatCOP(s.valor_reclamado) : '—'}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell font-medium text-primary-700">
                  {s.valor_aprobado ? formatCOP(s.valor_aprobado) : '—'}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs">{formatDate(s.fecha_reporte)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[s.estado]}`}>
                    {ESTADO_LABELS[s.estado]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    {can('siniestros_editar_todos') && (
                      <button onClick={() => { setEditing(s); setShowModal(true) }}
                        className="text-ink-400 hover:text-ink-600 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                    )}
                    {can('siniestros_editar_todos') && (
                      <button onClick={() => deleteSiniestro(s.id)}
                        className="text-ink-400 hover:text-error transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-ink-400">
            <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay siniestros en esta sección</p>
          </div>
        )}
      </div>

      {showModal && (
        <SiniestroModal siniestro={editing}
          clienteId={clienteId}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
