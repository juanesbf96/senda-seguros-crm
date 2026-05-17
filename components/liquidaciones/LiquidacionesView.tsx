'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Liquidacion, Vendedor, EstadoLiquidacion } from '@/types'
import { formatCOP, formatDate } from '@/lib/utils'
import { Plus, Pencil, Trash2, DollarSign, Search } from 'lucide-react'
import LiquidacionModal from './LiquidacionModal'
import { useWorkspace } from '@/contexts/WorkspaceContext'

const ESTADO_COLORS: Record<EstadoLiquidacion, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  pagado:    'bg-emerald-100 text-emerald-700',
  anulado:   'bg-slate-100 text-slate-500',
}
const ESTADO_LABELS: Record<EstadoLiquidacion, string> = {
  pendiente: 'Pendiente',
  pagado:    'Pagado',
  anulado:   'Anulado',
}

export default function LiquidacionesView() {
  const { currentWorkspace } = useWorkspace()
  const [liquidaciones, setLiquidaciones] = useState<Liquidacion[]>([])
  const [vendedores, setVendedores]       = useState<Pick<Vendedor, 'id' | 'nombre'>[]>([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')
  const [filterVendedor, setFilterVendedor] = useState('')
  const [filterEstado, setFilterEstado]   = useState<EstadoLiquidacion | 'all'>('all')
  const [showModal, setShowModal]         = useState(false)
  const [editing, setEditing]             = useState<Liquidacion | undefined>()

  async function load() {
    if (!currentWorkspace) return
    const wid = currentWorkspace.id
    const [liqRes, vendRes] = await Promise.all([
      supabase.from('liquidaciones')
        .select('*, vendedor:vendedores(id, nombre, porcentaje_comision)')
        .eq('workspace_id', wid)
        .order('periodo', { ascending: false }),
      supabase.from('vendedores').select('id, nombre').eq('workspace_id', wid).eq('activo', true).order('nombre'),
    ])
    setLiquidaciones((liqRes.data || []) as Liquidacion[])
    setVendedores(vendRes.data || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [currentWorkspace])

  async function deleteLiquidacion(id: string) {
    if (!confirm('¿Eliminar esta liquidación?')) return
    await supabase.from('liquidaciones').delete().eq('id', id)
    setLiquidaciones(prev => prev.filter(l => l.id !== id))
  }

  const q = search.toLowerCase()
  const filtered = liquidaciones.filter(l => {
    const matchSearch = !search ||
      l.vendedor?.nombre?.toLowerCase().includes(q) ||
      l.periodo.includes(q)
    const matchVendedor = !filterVendedor || l.vendedor_id === filterVendedor
    const matchEstado   = filterEstado === 'all' || l.estado === filterEstado
    return matchSearch && matchVendedor && matchEstado
  })

  const totalPendiente = filtered.filter(l => l.estado === 'pendiente').reduce((s, l) => s + l.total_comision, 0)
  const totalPagado    = filtered.filter(l => l.estado === 'pagado').reduce((s, l) => s + l.total_comision, 0)

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
          <h1 className="text-2xl font-bold text-slate-900">Liquidaciones</h1>
          <p className="text-slate-500 text-sm mt-1">Comisiones por vendedor y período</p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nueva liquidación
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-5">
        <div className="bg-white border border-amber-200 rounded-xl p-4">
          <p className="text-xs text-amber-600 font-medium mb-1">Por pagar</p>
          <p className="text-xl font-bold text-amber-700">{formatCOP(totalPendiente)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.filter(l => l.estado === 'pendiente').length} liquidaciones</p>
        </div>
        <div className="bg-white border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-emerald-600 font-medium mb-1 flex items-center gap-1">
            <DollarSign className="w-3 h-3" /> Pagado
          </p>
          <p className="text-xl font-bold text-emerald-700">{formatCOP(totalPagado)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{filtered.filter(l => l.estado === 'pagado').length} liquidaciones</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar por vendedor o período..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
        </div>
        <select value={filterVendedor} onChange={e => setFilterVendedor(e.target.value)}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="">Todos los vendedores</option>
          {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
        </select>
        <select value={filterEstado} onChange={e => setFilterEstado(e.target.value as EstadoLiquidacion | 'all')}
          className="px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400">
          <option value="all">Todos los estados</option>
          {(Object.entries(ESTADO_LABELS) as [EstadoLiquidacion, string][]).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-4 py-3 font-medium">Vendedor</th>
              <th className="px-4 py-3 font-medium">Período</th>
              <th className="px-4 py-3 font-medium text-right">Total primas</th>
              <th className="px-4 py-3 font-medium text-right">Comisión</th>
              <th className="px-4 py-3 font-medium hidden md:table-cell">Fecha pago</th>
              <th className="px-4 py-3 font-medium">Estado</th>
              <th className="px-4 py-3 font-medium text-right">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(l => (
              <tr key={l.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-800">{l.vendedor?.nombre || '—'}</td>
                <td className="px-4 py-3 text-slate-600 font-mono text-xs">{l.periodo}</td>
                <td className="px-4 py-3 text-right text-slate-600">{formatCOP(l.total_primas)}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCOP(l.total_comision)}</td>
                <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">{formatDate(l.fecha_pago)}</td>
                <td className="px-4 py-3">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[l.estado]}`}>
                    {ESTADO_LABELS[l.estado]}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => { setEditing(l); setShowModal(true) }}
                      className="text-slate-400 hover:text-slate-700 transition-colors">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => deleteLiquidacion(l.id)}
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
            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay liquidaciones registradas</p>
          </div>
        )}
      </div>

      {showModal && (
        <LiquidacionModal
          liquidacion={editing}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }}
        />
      )}
    </div>
  )
}
