'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Poliza, EstadoPoliza } from '@/types'
import { formatCOP, formatDate, daysUntil } from '@/lib/utils'
import { Search, AlertTriangle, Plus, Pencil, Trash2, FileText, ShieldCheck } from 'lucide-react'
import Link from 'next/link'
import PolizaModal from './PolizaModal'

const ESTADO_COLORS: Record<EstadoPoliza, string> = {
  activa:    'bg-emerald-100 text-emerald-700',
  vencida:   'bg-red-100 text-red-700',
  cancelada: 'bg-slate-100 text-slate-600',
  pendiente: 'bg-amber-100 text-amber-700',
}
const ESTADO_LABELS: Record<EstadoPoliza, string> = {
  activa: 'Activa', vencida: 'Vencida', cancelada: 'Cancelada', pendiente: 'Pendiente'
}

type PolizaConCliente = Poliza & { cliente: { id: string; nombre: string } | null }
type Tab = 'seguros' | 'cumplimiento'

const RAMOS_CUMPLIMIENTO = ['Fianzas', 'Cumplimiento']

export default function PolizasList() {
  const [polizas, setPolizas] = useState<PolizaConCliente[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterEstado, setFilterEstado] = useState<EstadoPoliza | 'all'>('all')
  const [filterRamo, setFilterRamo] = useState('all')
  const [activeTab, setActiveTab] = useState<Tab>('seguros')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<PolizaConCliente | undefined>()

  async function load() {
    const { data } = await supabase
      .from('polizas')
      .select('*, cliente:clientes(id, nombre)')
      .eq('eliminada', false)
      .order('fecha_fin', { ascending: true, nullsFirst: false })
    setPolizas((data as PolizaConCliente[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function softDelete(id: string) {
    if (!confirm('¿Eliminar esta póliza? Podrá recuperarla desde la base de datos.')) return
    await supabase.from('polizas').update({ eliminada: true, fecha_eliminacion: new Date().toISOString() }).eq('id', id)
    setPolizas(prev => prev.filter(p => p.id !== id))
  }

  // Split by tab
  const byCumplimiento = (p: PolizaConCliente) => RAMOS_CUMPLIMIENTO.includes(p.ramo)
  const tabPolizas = polizas.filter(p => activeTab === 'cumplimiento' ? byCumplimiento(p) : !byCumplimiento(p))

  // Unique ramos for the active tab
  const ramosDisponibles = [...new Set(tabPolizas.map(p => p.ramo))].sort()

  const filtered = tabPolizas.filter(p => {
    const nombre = p.cliente?.nombre?.toLowerCase() || ''
    const matchSearch = !search ||
      nombre.includes(search.toLowerCase()) ||
      p.aseguradora.toLowerCase().includes(search.toLowerCase()) ||
      p.ramo.toLowerCase().includes(search.toLowerCase()) ||
      p.numero_poliza?.includes(search) ||
      p.riesgo?.toLowerCase().includes(search.toLowerCase())
    const matchEstado = filterEstado === 'all' || p.estado === filterEstado
    const matchRamo = filterRamo === 'all' || p.ramo === filterRamo
    return matchSearch && matchEstado && matchRamo
  })

  const primaTotal = filtered.filter(p => p.estado === 'activa').reduce((s, p) => s + (p.prima || 0), 0)
  const cntSeguros = polizas.filter(p => !byCumplimiento(p)).length
  const cntCumplimiento = polizas.filter(byCumplimiento).length

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pólizas</h1>
          <p className="text-slate-500 text-sm mt-1">
            {filtered.filter(p => p.estado === 'activa').length} activas · Prima: {formatCOP(primaTotal)}
          </p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nueva póliza
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200">
        {([
          { key: 'seguros', label: 'Seguros', count: cntSeguros, icon: FileText },
          { key: 'cumplimiento', label: 'Cumplimiento', count: cntCumplimiento, icon: ShieldCheck },
        ] as { key: Tab; label: string; count: number; icon: React.ElementType }[]).map(({ key, label, count, icon: Icon }) => (
          <button
            key={key}
            onClick={() => { setActiveTab(key); setFilterRamo('all') }}
            className={[
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors',
              activeTab === key
                ? 'border-emerald-600 text-emerald-600'
                : 'border-transparent text-slate-500 hover:text-slate-700',
            ].join(' ')}
          >
            <Icon className="w-4 h-4" />
            {label}
            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activeTab === key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={activeTab === 'cumplimiento' ? 'Buscar por cliente, aseguradora, riesgo...' : 'Buscar por cliente, aseguradora, ramo...'}
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
          />
        </div>
        <select
          value={filterRamo}
          onChange={e => setFilterRamo(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <option value="all">Todos los ramos</option>
          {ramosDisponibles.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <select
          value={filterEstado}
          onChange={e => setFilterEstado(e.target.value as EstadoPoliza | 'all')}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <option value="all">Todos los estados</option>
          <option value="activa">Activa</option>
          <option value="pendiente">Pendiente</option>
          <option value="vencida">Vencida</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">
                {activeTab === 'cumplimiento' ? 'Aseg. / Tipo' : 'Aseg. / Ramo'}
              </th>
              {activeTab === 'cumplimiento' && (
                <th className="px-4 py-3 font-medium hidden md:table-cell">Riesgo / Objeto</th>
              )}
              <th className="px-4 py-3 font-medium hidden md:table-cell">N° Póliza</th>
              <th className="px-4 py-3 font-medium hidden lg:table-cell">Prima</th>
              <th className="px-4 py-3 font-medium">Vencimiento</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => {
              const days = p.fecha_fin ? daysUntil(p.fecha_fin) : null
              const urgent = days !== null && days >= 0 && days <= 30 && p.estado === 'activa'
              const warn = days !== null && days > 30 && days <= 60 && p.estado === 'activa'
              return (
                <tr key={p.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${urgent ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-4 py-3">
                    {p.client_id ? (
                      <Link href={`/clientes/${p.client_id}`} className="font-medium text-slate-800 hover:text-emerald-600">
                        {p.cliente?.nombre || '—'}
                      </Link>
                    ) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-700">{p.aseguradora}</p>
                    <p className="text-xs text-slate-400">
                      {activeTab === 'cumplimiento' ? (p.tipo_poliza || p.ramo) : p.ramo}
                    </p>
                  </td>
                  {activeTab === 'cumplimiento' && (
                    <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs max-w-[200px]">
                      <span className="line-clamp-2">{p.riesgo || '—'}</span>
                    </td>
                  )}
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell">{p.numero_poliza || '—'}</td>
                  <td className="px-4 py-3 hidden lg:table-cell text-slate-700 font-medium">
                    {p.prima ? formatCOP(p.prima) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className={urgent ? 'text-amber-700 font-medium' : warn ? 'text-amber-600' : 'text-slate-600'}>
                        {formatDate(p.fecha_fin)}
                      </span>
                      {urgent && <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />}
                      {(urgent || warn) && days !== null && (
                        <span className={`text-xs px-1.5 py-0.5 rounded-full ${urgent ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}>
                          {days}d
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[p.estado]}`}>
                      {ESTADO_LABELS[p.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => { setEditing(p); setShowModal(true) }}
                        className="text-slate-400 hover:text-slate-700 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => softDelete(p.id)}
                        className="text-slate-400 hover:text-red-600 transition-colors"
                      >
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
            <p className="text-sm">No se encontraron pólizas</p>
          </div>
        )}
      </div>

      {showModal && (
        <PolizaModal
          poliza={editing}
          clientId={editing?.client_id || ''}
          isCumplimiento={activeTab === 'cumplimiento'}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
