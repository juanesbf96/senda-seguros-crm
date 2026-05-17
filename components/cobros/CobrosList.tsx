'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Cobro, EstadoCobro, TipoCobro } from '@/types'
import { formatCOP, formatDate, daysUntil } from '@/lib/utils'
import {
  Plus, Search, Pencil, Trash2, AlertTriangle, DollarSign,
  ArrowDownToLine, ArrowUpFromLine, TrendingDown, TrendingUp,
} from 'lucide-react'
import Link from 'next/link'
import CobrosModal from './CobrosModal'
import { useWorkspace } from '@/contexts/WorkspaceContext'

const ESTADO_COLORS: Record<EstadoCobro, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  pagado:    'bg-emerald-100 text-emerald-700',
  vencido:   'bg-red-100 text-red-700',
  anulado:   'bg-slate-100 text-slate-500',
}
const ESTADO_LABELS: Record<EstadoCobro, string> = {
  pendiente: 'Pendiente', pagado: 'Pagado', vencido: 'Vencido', anulado: 'Anulado',
}

type Tab = TipoCobro

const TABS: { key: Tab; label: string; icon: React.ElementType; desc: string }[] = [
  { key: 'por_cobrar',         label: 'Por cobrar',            icon: ArrowDownToLine, desc: 'Clientes deben pagar' },
  { key: 'por_pagar',          label: 'Por pagar aseg.',       icon: ArrowUpFromLine, desc: 'Debemos a aseguradoras' },
  { key: 'comision_por_cobrar',label: 'Comisiones por cobrar', icon: TrendingUp,      desc: 'Comisiones pendientes' },
  { key: 'comision_recibida',  label: 'Comisiones recibidas',  icon: TrendingDown,    desc: 'Comisiones cobradas' },
]

export default function CobrosList() {
  const { currentWorkspace } = useWorkspace()
  const [cobros, setCobros]         = useState<Cobro[]>([])
  const [loading, setLoading]       = useState(true)
  const [search, setSearch]         = useState('')
  const [filterEstado, setFilterEstado] = useState<EstadoCobro | 'all'>('all')
  const [activeTab, setActiveTab]   = useState<Tab>('por_cobrar')
  const [showModal, setShowModal]   = useState(false)
  const [editing, setEditing]       = useState<Cobro | undefined>()

  async function load() {
    if (!currentWorkspace) return
    const { data } = await supabase
      .from('cobros')
      .select('*, cliente:clientes(id, nombre), poliza:polizas(id, numero_poliza, aseguradora, ramo)')
      .eq('workspace_id', currentWorkspace.id)
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    setCobros((data || []) as Cobro[])
    setLoading(false)
  }

  useEffect(() => { load() }, [currentWorkspace])

  async function deleteCobro(id: string) {
    if (!confirm('¿Eliminar este cobro?')) return
    await supabase.from('cobros').delete().eq('id', id)
    setCobros(prev => prev.filter(c => c.id !== id))
  }

  const tabCobros = cobros.filter(c => c.tipo === activeTab)

  const q = search.toLowerCase()
  const filtered = tabCobros.filter(c => {
    const match = !search ||
      c.cliente?.nombre?.toLowerCase().includes(q) ||
      c.concepto.toLowerCase().includes(q) ||
      c.aseguradora?.toLowerCase().includes(q) ||
      c.numero_poliza?.includes(q) ||
      String(c.numero_cobro || '').includes(q)
    return match && (filterEstado === 'all' || c.estado === filterEstado)
  })

  // Summary totals per tab
  const counts: Record<Tab, { pending: number; total: number }> = {
    por_cobrar:          { pending: cobros.filter(c => c.tipo === 'por_cobrar'          && c.estado === 'pendiente').length, total: cobros.filter(c => c.tipo === 'por_cobrar').length },
    por_pagar:           { pending: cobros.filter(c => c.tipo === 'por_pagar'           && c.estado === 'pendiente').length, total: cobros.filter(c => c.tipo === 'por_pagar').length },
    comision_por_cobrar: { pending: cobros.filter(c => c.tipo === 'comision_por_cobrar' && c.estado === 'pendiente').length, total: cobros.filter(c => c.tipo === 'comision_por_cobrar').length },
    comision_recibida:   { pending: cobros.filter(c => c.tipo === 'comision_recibida'   && c.estado === 'pendiente').length, total: cobros.filter(c => c.tipo === 'comision_recibida').length },
  }

  const totalPendiente = filtered.filter(c => c.estado === 'pendiente').reduce((s, c) => s + c.valor, 0)

  const isComisionTab = activeTab === 'comision_por_cobrar' || activeTab === 'comision_recibida'
  const isAseguradoraTab = activeTab === 'por_pagar' || isComisionTab

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
          <h1 className="text-2xl font-bold text-slate-900">Cobros</h1>
          <p className="text-slate-500 text-sm mt-1">
            {filtered.filter(c => c.estado === 'pendiente').length} pendientes · {formatCOP(totalPendiente)}
          </p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nuevo cobro
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon, desc }) => {
          const cnt = counts[key]
          return (
            <button key={key} onClick={() => { setActiveTab(key); setFilterEstado('all') }}
              className={[
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                activeTab === key ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700',
              ].join(' ')}>
              <Icon className="w-4 h-4" />
              {label}
              <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${
                activeTab === key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'
              }`}>
                {cnt.total}
              </span>
            </button>
          )
        })}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <div className="bg-white border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-600 font-medium mb-1">Pendiente</p>
          <p className="text-xl font-bold text-amber-700">{formatCOP(filtered.filter(c => c.estado === 'pendiente').reduce((s, c) => s + c.valor, 0))}</p>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.filter(c => c.estado === 'pendiente').length} cobros</p>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-600 font-medium mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Vencidos</p>
          <p className="text-xl font-bold text-red-700">{formatCOP(filtered.filter(c => c.estado === 'vencido').reduce((s, c) => s + c.valor, 0))}</p>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.filter(c => c.estado === 'vencido').length} cobros</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-emerald-600 font-medium mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Pagado</p>
          <p className="text-xl font-bold text-emerald-700">{formatCOP(filtered.filter(c => c.estado === 'pagado').reduce((s, c) => s + c.valor, 0))}</p>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.filter(c => c.estado === 'pagado').length} cobros</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, concepto, N° póliza..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value as EstadoCobro | 'all')}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="all">Todos los estados</option>
          {(Object.entries(ESTADO_LABELS) as [EstadoCobro, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium w-16">N°</th>
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Concepto</th>
              {isAseguradoraTab && <th className="px-4 py-3 font-medium hidden md:table-cell">Aseguradora</th>}
              {isComisionTab && <th className="px-4 py-3 font-medium hidden md:table-cell">% Comisión</th>}
              <th className="px-4 py-3 font-medium hidden md:table-cell">N° Póliza</th>
              <th className="px-4 py-3 font-medium">Valor</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Vencimiento</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const days = c.fecha_vencimiento ? daysUntil(c.fecha_vencimiento) : null
              const overdue = days !== null && days < 0 && c.estado === 'pendiente'
              return (
                <tr key={c.id} className={`border-b border-slate-100 hover:bg-slate-50 transition-colors ${overdue ? 'bg-red-50/30' : ''}`}>
                  <td className="px-4 py-3 text-slate-400 text-xs font-mono">
                    {c.numero_cobro ? `#${c.numero_cobro}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    {c.client_id
                      ? <Link href={`/clientes/${c.client_id}`} className="font-medium text-slate-800 hover:text-emerald-600">{c.cliente?.nombre || '—'}</Link>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-700 max-w-[180px]">
                    <span className="line-clamp-1">{c.concepto}</span>
                  </td>
                  {isAseguradoraTab && (
                    <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">
                      {c.aseguradora || c.poliza?.aseguradora || '—'}
                    </td>
                  )}
                  {isComisionTab && (
                    <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">
                      {c.porcentaje_comision ? `${c.porcentaje_comision}%` : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs font-mono">
                    {c.numero_poliza || c.poliza?.numero_poliza || '—'}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{formatCOP(c.valor)}</td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className={`text-xs ${overdue ? 'text-red-600 font-medium' : 'text-slate-500'}`}>
                      {formatDate(c.fecha_vencimiento)}
                      {overdue && <span className="ml-1">(vencido)</span>}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[c.estado]}`}>
                      {ESTADO_LABELS[c.estado]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => { setEditing(c); setShowModal(true) }}
                        className="text-slate-400 hover:text-slate-700 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteCobro(c.id)}
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
            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay cobros en esta sección</p>
          </div>
        )}
      </div>

      {showModal && (
        <CobrosModal cobro={editing} activeTab={activeTab}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
