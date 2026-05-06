'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Cobro, EstadoCobro } from '@/types'
import { formatCOP, formatDate, daysUntil } from '@/lib/utils'
import { Plus, Search, Pencil, Trash2, AlertTriangle, DollarSign } from 'lucide-react'
import Link from 'next/link'
import CobrosModal from './CobrosModal'

const ESTADO_COLORS: Record<EstadoCobro, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  pagado:    'bg-emerald-100 text-emerald-700',
  vencido:   'bg-red-100 text-red-700',
  anulado:   'bg-slate-100 text-slate-500',
}
const ESTADO_LABELS: Record<EstadoCobro, string> = {
  pendiente: 'Pendiente', pagado: 'Pagado', vencido: 'Vencido', anulado: 'Anulado',
}

export default function CobrosList() {
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [filterEstado, setFilterEstado] = useState<EstadoCobro | 'all'>('all')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<Cobro | undefined>()

  async function load() {
    const { data } = await supabase
      .from('cobros')
      .select('*, cliente:clientes(id, nombre), poliza:polizas(id, numero_poliza, aseguradora, ramo)')
      .order('fecha_vencimiento', { ascending: true, nullsFirst: false })
    setCobros((data || []) as Cobro[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteCobro(id: string) {
    if (!confirm('¿Eliminar este cobro?')) return
    await supabase.from('cobros').delete().eq('id', id)
    setCobros(prev => prev.filter(c => c.id !== id))
  }

  const filtered = cobros.filter(c => {
    const q = search.toLowerCase()
    const match = !search ||
      c.cliente?.nombre?.toLowerCase().includes(q) ||
      c.concepto.toLowerCase().includes(q) ||
      c.poliza?.aseguradora?.toLowerCase().includes(q)
    return match && (filterEstado === 'all' || c.estado === filterEstado)
  })

  const totalPendiente = cobros.filter(c => c.estado === 'pendiente').reduce((s, c) => s + c.valor, 0)
  const totalVencido   = cobros.filter(c => c.estado === 'vencido').reduce((s, c) => s + c.valor, 0)
  const totalPagado    = cobros.filter(c => c.estado === 'pagado').reduce((s, c) => s + c.valor, 0)

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
          <h1 className="text-2xl font-bold text-slate-900">Cobros</h1>
          <p className="text-slate-500 text-sm mt-1">{cobros.filter(c => c.estado === 'pendiente').length} pendientes · {cobros.filter(c => c.estado === 'vencido').length} vencidos</p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nuevo cobro
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-white border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-600 font-medium mb-1">Por cobrar</p>
          <p className="text-xl font-bold text-amber-700">{formatCOP(totalPendiente)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{cobros.filter(c => c.estado === 'pendiente').length} cobros</p>
        </div>
        <div className="bg-white border border-red-200 rounded-xl p-4">
          <p className="text-xs text-red-600 font-medium mb-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Vencidos</p>
          <p className="text-xl font-bold text-red-700">{formatCOP(totalVencido)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{cobros.filter(c => c.estado === 'vencido').length} cobros</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-emerald-600 font-medium mb-1 flex items-center gap-1"><DollarSign className="w-3 h-3" /> Recaudado</p>
          <p className="text-xl font-bold text-emerald-700">{formatCOP(totalPagado)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{cobros.filter(c => c.estado === 'pagado').length} cobros</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por cliente, concepto..."
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
              <th className="px-4 py-3 font-medium">Cliente</th>
              <th className="px-4 py-3 font-medium">Concepto</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Póliza</th>
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
                  <td className="px-4 py-3">
                    {c.client_id
                      ? <Link href={`/clientes/${c.client_id}`} className="font-medium text-slate-800 hover:text-emerald-600">{c.cliente?.nombre || '—'}</Link>
                      : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-slate-700">{c.concepto}</td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">
                    {c.poliza ? `${c.poliza.aseguradora} · ${c.poliza.ramo}` : '—'}
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
                      <button onClick={() => { setEditing(c); setShowModal(true) }} className="text-slate-400 hover:text-slate-700 transition-colors"><Pencil className="w-4 h-4" /></button>
                      <button onClick={() => deleteCobro(c.id)} className="text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <p className="text-sm">No se encontraron cobros</p>
          </div>
        )}
      </div>

      {showModal && (
        <CobrosModal cobro={editing} onClose={() => setShowModal(false)} onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
