'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Factura, EstadoFactura, TipoFactura } from '@/types'
import { formatCOP, formatDate } from '@/lib/utils'
import { Plus, Search, Pencil, Trash2, Receipt, TrendingDown, TrendingUp } from 'lucide-react'
import Link from 'next/link'
import FacturasModal from './FacturasModal'

const ESTADO_COLORS: Record<EstadoFactura, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  pagada:    'bg-emerald-100 text-emerald-700',
  vencida:   'bg-red-100 text-red-700',
  anulada:   'bg-slate-100 text-slate-500',
}
const ESTADO_LABELS: Record<EstadoFactura, string> = {
  pendiente: 'Pendiente', pagada: 'Pagada', vencida: 'Vencida', anulada: 'Anulada',
}

type Tab = 'emitidas' | 'recibidas' | 'pendientes' | 'pagadas' | 'vencidas' | 'tributario'

const TABS: { key: Tab; label: string }[] = [
  { key: 'emitidas',   label: 'Emitidas' },
  { key: 'recibidas',  label: 'Recibidas' },
  { key: 'pendientes', label: 'Pendientes' },
  { key: 'pagadas',    label: 'Pagadas' },
  { key: 'vencidas',   label: 'Vencidas' },
  { key: 'tributario', label: 'Tributario' },
]

export default function FacturasList() {
  const [facturas,   setFacturas]   = useState<Factura[]>([])
  const [loading,    setLoading]    = useState(true)
  const [search,     setSearch]     = useState('')
  const [activeTab,  setActiveTab]  = useState<Tab>('emitidas')
  const [showModal,  setShowModal]  = useState(false)
  const [editing,    setEditing]    = useState<Factura | undefined>()

  async function load() {
    const { data } = await supabase
      .from('facturas')
      .select('*, cliente:clientes(id,nombre), poliza:polizas(id,numero_poliza,aseguradora)')
      .order('fecha_emision', { ascending: false })
    setFacturas((data || []) as Factura[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function deleteFactura(id: string) {
    if (!confirm('¿Eliminar esta factura?')) return
    await supabase.from('facturas').delete().eq('id', id)
    setFacturas(prev => prev.filter(f => f.id !== id))
  }

  function tabFilter(f: Factura): boolean {
    if (activeTab === 'emitidas')   return f.tipo === 'emitida'
    if (activeTab === 'recibidas')  return f.tipo === 'recibida'
    if (activeTab === 'pendientes') return f.estado === 'pendiente'
    if (activeTab === 'pagadas')    return f.estado === 'pagada'
    if (activeTab === 'vencidas')   return f.estado === 'vencida'
    if (activeTab === 'tributario') return true
    return true
  }

  const q = search.toLowerCase()
  const filtered = facturas.filter(f => {
    const matchSearch = !search ||
      f.concepto.toLowerCase().includes(q) ||
      f.cliente?.nombre?.toLowerCase().includes(q) ||
      f.aseguradora?.toLowerCase().includes(q) ||
      String(f.numero_factura || '').includes(q)
    return matchSearch && tabFilter(f)
  })

  // Totales para tributario
  const totalIVA       = facturas.filter(f => f.estado !== 'anulada').reduce((s, f) => s + f.iva, 0)
  const totalRetencion = facturas.filter(f => f.estado !== 'anulada').reduce((s, f) => s + f.retencion, 0)
  const totalEmitidas  = facturas.filter(f => f.tipo === 'emitida'  && f.estado !== 'anulada').reduce((s, f) => s + f.total, 0)
  const totalRecibidas = facturas.filter(f => f.tipo === 'recibida' && f.estado !== 'anulada').reduce((s, f) => s + f.total, 0)

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Facturas</h1>
          <p className="text-slate-500 text-sm mt-1">{facturas.length} registros</p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nueva factura
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-slate-200 overflow-x-auto">
        {TABS.map(({ key, label }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              activeTab === key ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* Vista Tributario */}
      {activeTab === 'tributario' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white border border-emerald-200 rounded-xl p-5">
              <p className="text-xs text-emerald-600 font-medium mb-1 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Total facturado</p>
              <p className="text-xl font-bold text-emerald-700">{formatCOP(totalEmitidas)}</p>
            </div>
            <div className="bg-white border border-blue-200 rounded-xl p-5">
              <p className="text-xs text-blue-600 font-medium mb-1 flex items-center gap-1"><TrendingDown className="w-3 h-3" />Total recibido</p>
              <p className="text-xl font-bold text-blue-700">{formatCOP(totalRecibidas)}</p>
            </div>
            <div className="bg-white border border-amber-200 rounded-xl p-5">
              <p className="text-xs text-amber-600 font-medium mb-1">IVA total</p>
              <p className="text-xl font-bold text-amber-700">{formatCOP(totalIVA)}</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <p className="text-xs text-slate-600 font-medium mb-1">Retención total</p>
              <p className="text-xl font-bold text-slate-700">{formatCOP(totalRetencion)}</p>
            </div>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <h3 className="font-semibold text-slate-800 mb-4">Resumen tributario</h3>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 border-b border-slate-100">
                <tr>
                  <th className="text-left py-2 font-medium">Concepto</th>
                  <th className="text-right py-2 font-medium">Emitidas</th>
                  <th className="text-right py-2 font-medium">Recibidas</th>
                  <th className="text-right py-2 font-medium">Neto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  { label: 'Base gravable', e: facturas.filter(f=>f.tipo==='emitida'&&f.estado!=='anulada').reduce((s,f)=>s+f.valor_base,0), r: facturas.filter(f=>f.tipo==='recibida'&&f.estado!=='anulada').reduce((s,f)=>s+f.valor_base,0) },
                  { label: 'IVA (19%)', e: facturas.filter(f=>f.tipo==='emitida'&&f.estado!=='anulada').reduce((s,f)=>s+f.iva,0), r: facturas.filter(f=>f.tipo==='recibida'&&f.estado!=='anulada').reduce((s,f)=>s+f.iva,0) },
                  { label: 'Retención (11%)', e: facturas.filter(f=>f.tipo==='emitida'&&f.estado!=='anulada').reduce((s,f)=>s+f.retencion,0), r: facturas.filter(f=>f.tipo==='recibida'&&f.estado!=='anulada').reduce((s,f)=>s+f.retencion,0) },
                  { label: 'Total', e: totalEmitidas, r: totalRecibidas },
                ].map(row => (
                  <tr key={row.label}>
                    <td className="py-2.5 text-slate-700 font-medium">{row.label}</td>
                    <td className="py-2.5 text-right text-emerald-700">{formatCOP(row.e)}</td>
                    <td className="py-2.5 text-right text-blue-700">{formatCOP(row.r)}</td>
                    <td className="py-2.5 text-right font-semibold text-slate-900">{formatCOP(row.e - row.r)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative mb-5 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Buscar por N°, cliente, concepto..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
          </div>

          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-5">
            {(['pendiente','pagada','vencida'] as EstadoFactura[]).map(estado => (
              <div key={estado} className={`bg-white border rounded-xl p-4 ${
                estado === 'pendiente' ? 'border-amber-200' : estado === 'pagada' ? 'border-emerald-200' : 'border-red-200'
              }`}>
                <p className={`text-xs font-medium mb-1 ${
                  estado === 'pendiente' ? 'text-amber-600' : estado === 'pagada' ? 'text-emerald-600' : 'text-red-600'
                }`}>{ESTADO_LABELS[estado]}</p>
                <p className={`text-xl font-bold ${
                  estado === 'pendiente' ? 'text-amber-700' : estado === 'pagada' ? 'text-emerald-700' : 'text-red-700'
                }`}>{formatCOP(filtered.filter(f => f.estado === estado).reduce((s, f) => s + f.total, 0))}</p>
                <p className="text-xs text-slate-400 mt-0.5">{filtered.filter(f => f.estado === estado).length} facturas</p>
              </div>
            ))}
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr className="text-left text-xs text-slate-500">
                  <th className="px-4 py-3 font-medium w-16">N°</th>
                  <th className="px-4 py-3 font-medium">Cliente / Aseg.</th>
                  <th className="px-4 py-3 font-medium">Concepto</th>
                  <th className="px-4 py-3 font-medium text-right hidden md:table-cell">Base</th>
                  <th className="px-4 py-3 font-medium text-right hidden md:table-cell">IVA</th>
                  <th className="px-4 py-3 font-medium text-right">Total</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Emisión</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                  <th className="px-4 py-3 font-medium text-right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(f => (
                  <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-slate-400 text-xs font-mono">#{f.numero_factura}</td>
                    <td className="px-4 py-3">
                      {f.tipo === 'emitida'
                        ? f.client_id ? <Link href={`/clientes/${f.client_id}`} className="font-medium text-slate-800 hover:text-emerald-600">{f.cliente?.nombre || '—'}</Link> : <span className="text-slate-400">—</span>
                        : <span className="font-medium text-slate-700">{f.aseguradora || '—'}</span>
                      }
                    </td>
                    <td className="px-4 py-3 text-slate-600 max-w-[180px]"><p className="line-clamp-1">{f.concepto}</p></td>
                    <td className="px-4 py-3 text-right hidden md:table-cell text-slate-500">{formatCOP(f.valor_base)}</td>
                    <td className="px-4 py-3 text-right hidden md:table-cell text-slate-500">{formatCOP(f.iva)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-900">{formatCOP(f.total)}</td>
                    <td className="px-4 py-3 hidden md:table-cell text-slate-500 text-xs">{formatDate(f.fecha_emision)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[f.estado]}`}>{ESTADO_LABELS[f.estado]}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setEditing(f); setShowModal(true) }} className="text-slate-400 hover:text-slate-700"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => deleteFactura(f.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">No hay facturas en esta sección</p>
              </div>
            )}
          </div>
        </>
      )}

      {showModal && (
        <FacturasModal factura={editing}
          tipoInicial={activeTab === 'recibidas' ? 'recibida' : 'emitida'}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
