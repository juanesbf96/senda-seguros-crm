'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Siniestro, EstadoSiniestro } from '@/types'
import { formatCOP, formatDate } from '@/lib/utils'
import { Plus, Search, Pencil, Trash2, AlertTriangle, ShieldAlert } from 'lucide-react'
import Link from 'next/link'
import SiniestroModal from './SiniestroModal'

const ESTADO_LABELS: Record<EstadoSiniestro, string> = {
  reportado:  'Reportado',
  en_estudio: 'En estudio',
  en_pago:    'En pago',
  cerrado:    'Cerrado',
  rechazado:  'Rechazado',
}
const ESTADO_COLORS: Record<EstadoSiniestro, string> = {
  reportado:  'bg-slate-100 text-slate-600',
  en_estudio: 'bg-amber-100 text-amber-700',
  en_pago:    'bg-blue-100 text-blue-700',
  cerrado:    'bg-emerald-100 text-emerald-700',
  rechazado:  'bg-red-100 text-red-700',
}

type Tab = EstadoSiniestro | 'todos'

export default function SiniestrosList() {
  const [siniestros, setSiniestros] = useState<Siniestro[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [activeTab,  setActiveTab]  = useState<Tab>('todos')
  const [showModal,  setShowModal]  = useState(false)
  const [editing,    setEditing]    = useState<Siniestro | undefined>()

  async function load() {
    const { data } = await supabase
      .from('siniestros')
      .select('*, cliente:clientes(id,nombre), poliza:polizas(id,numero_poliza,aseguradora,ramo), amparos:siniestro_amparos(*)')
      .order('created_at', { ascending: false })
    setSiniestros((data || []) as Siniestro[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

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
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Siniestros</h1>
          <p className="text-slate-500 text-sm mt-1">{siniestros.length} registros</p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nuevo siniestro
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200 overflow-x-auto">
        {([['todos','Todos'], ...Object.entries(ESTADO_LABELS)] as [Tab, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              activeTab === key ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {label}
            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activeTab === key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-5 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por N°, cliente, aseguradora..."
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
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
              <tr key={s.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                  {s.numero_siniestro ? `#${s.numero_siniestro}` : '—'}
                </td>
                <td className="px-4 py-3">
                  {s.client_id
                    ? <Link href={`/clientes/${s.client_id}`} className="font-medium text-slate-800 hover:text-emerald-600">{s.cliente?.nombre || '—'}</Link>
                    : <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3 text-slate-700 max-w-[200px]">
                  <p className="line-clamp-1">{s.descripcion}</p>
                  {s.amparo && <p className="text-xs text-slate-400 truncate">{s.amparo}</p>}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">{s.aseguradora || '—'}</td>
                <td className="px-4 py-3 hidden md:table-cell font-medium text-slate-700">
                  {s.valor_reclamado ? formatCOP(s.valor_reclamado) : '—'}
                </td>
                <td className="px-4 py-3 hidden lg:table-cell font-medium text-emerald-700">
                  {s.valor_aprobado ? formatCOP(s.valor_aprobado) : '—'}
                </td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">{formatDate(s.fecha_reporte)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[s.estado]}`}>
                    {ESTADO_LABELS[s.estado]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => { setEditing(s); setShowModal(true) }}
                      className="text-slate-400 hover:text-slate-700 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteSiniestro(s.id)}
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
            <ShieldAlert className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay siniestros en esta sección</p>
          </div>
        )}
      </div>

      {showModal && (
        <SiniestroModal siniestro={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
