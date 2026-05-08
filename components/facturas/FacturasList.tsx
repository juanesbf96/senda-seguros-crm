'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Factura, TipoFactura } from '@/types'
import { formatCOP, formatDate } from '@/lib/utils'
import {
  Plus, Search, Pencil, Trash2, Receipt,
  FileText, FileMinus, FilePlus, Ban, Inbox, Download,
} from 'lucide-react'
import FacturasModal from './FacturasModal'

type TabKey = 'por_cobrar' | 'recibidas' | 'anuladas' | 'borradores' | 'nota_credito' | 'nota_debito'
interface TabCfg { key: TabKey; label: string; icon: React.ElementType }
const TABS: TabCfg[] = [
  { key: 'por_cobrar',   label: 'Por cobrar',    icon: Receipt   },
  { key: 'recibidas',    label: 'Recibidas',     icon: Inbox     },
  { key: 'anuladas',     label: 'Anuladas',      icon: Ban       },
  { key: 'borradores',   label: 'Borradores',    icon: FileText  },
  { key: 'nota_credito', label: 'Notas Crédito', icon: FileMinus },
  { key: 'nota_debito',  label: 'Notas Débito',  icon: FilePlus  },
]

function tabMatch(f: Factura, tab: TabKey): boolean {
  if (tab === 'por_cobrar')   return f.tipo === 'emitida' && f.estado !== 'anulada' && !f.es_borrador
  if (tab === 'recibidas')    return f.tipo === 'recibida'
  if (tab === 'anuladas')     return f.estado === 'anulada'
  if (tab === 'borradores')   return !!f.es_borrador
  if (tab === 'nota_credito') return f.tipo === 'nota_credito'
  if (tab === 'nota_debito')  return f.tipo === 'nota_debito'
  return true
}

const n = (v: number | null | undefined) => v ?? 0
const dash = <span className="text-slate-300">—</span>

export default function FacturasList() {
  const [facturas,    setFacturas]    = useState<Factura[]>([])
  const [loading,     setLoading]     = useState(true)
  const [search,      setSearch]      = useState('')
  const [activeTab,   setActiveTab]   = useState<TabKey>('por_cobrar')
  const [showModal,   setShowModal]   = useState(false)
  const [editing,     setEditing]     = useState<Factura | undefined>()
  const [showTotales, setShowTotales] = useState(false)

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

  const q = search.toLowerCase()
  const filtered = facturas
    .filter(f => tabMatch(f, activeTab))
    .filter(f => !search ||
      f.concepto?.toLowerCase().includes(q) ||
      f.cliente?.nombre?.toLowerCase().includes(q) ||
      f.aseguradora?.toLowerCase().includes(q) ||
      String(f.numero_factura || '').includes(q)
    )

  const counts = Object.fromEntries(TABS.map(t => [t.key, facturas.filter(f => tabMatch(f, t.key)).length])) as Record<TabKey, number>

  const valid = facturas.filter(f => f.estado !== 'anulada' && !f.es_borrador)
  const tot = {
    gravada:    valid.reduce((s, f) => s + n(f.comision_gravada),    0),
    no_gravada: valid.reduce((s, f) => s + n(f.comision_no_gravada), 0),
    iva:        valid.reduce((s, f) => s + n(f.iva),                  0),
    ret_iva:    valid.reduce((s, f) => s + n(f.ret_iva),             0),
    ret_ica:    valid.reduce((s, f) => s + n(f.ret_ica),             0),
    ret_fuente: valid.reduce((s, f) => s + n(f.ret_fuente),          0),
    otros:      valid.reduce((s, f) => s + n(f.otros),               0),
    gran_total: valid.reduce((s, f) => s + n(f.gran_total),          0),
  }

  const isRecibidas = activeTab === 'recibidas'
  const tipoParaModal: TipoFactura =
    activeTab === 'nota_credito' ? 'nota_credito' :
    activeTab === 'nota_debito'  ? 'nota_debito'  :
    activeTab === 'recibidas'    ? 'recibida'      : 'emitida'

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Facturas</h1>
          <p className="text-slate-500 text-sm mt-1">{facturas.length} registros</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm border border-slate-200 text-slate-600 rounded-lg hover:bg-slate-50 transition-colors">
            <Download className="w-4 h-4" /> Exportar excel
          </button>
          <button onClick={() => { setEditing(undefined); setShowModal(true) }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Crear Factura
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 mb-5 border-b border-slate-200 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              activeTab === key ? 'border-emerald-600 text-emerald-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            <Icon className="w-3.5 h-3.5" />
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
          placeholder="Buscar ej (No factura, aseguradora...)"
          className="w-full pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[920px]">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr className="text-left text-xs text-slate-500">
              <th className="px-3 py-3 font-medium w-12">N°</th>
              <th className="px-3 py-3 font-medium">Fecha Exp.</th>
              <th className="px-3 py-3 font-medium">Aseguradora</th>
              <th className="px-3 py-3 font-medium">Concepto</th>
              <th className="px-3 py-3 font-medium text-right">Gravada</th>
              <th className="px-3 py-3 font-medium text-right">NO Gravada</th>
              <th className="px-3 py-3 font-medium text-right">IVA</th>
              <th className="px-3 py-3 font-medium text-right">Ret. IVA</th>
              <th className="px-3 py-3 font-medium text-right">Ret. ICA</th>
              <th className="px-3 py-3 font-medium text-right">Ret. Fuente</th>
              {isRecibidas && <>
                <th className="px-3 py-3 font-medium text-right">Otros</th>
                <th className="px-3 py-3 font-medium text-right">Gran Total</th>
                <th className="px-3 py-3 font-medium">Estado</th>
                <th className="px-3 py-3 font-medium">Sede</th>
              </>}
              <th className="px-3 py-3 font-medium text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(f => (
              <tr key={f.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                <td className="px-3 py-3 text-xs font-mono text-slate-400">
                  {f.es_borrador ? <span className="text-amber-500">Bor.</span> : `#${f.numero_factura || '—'}`}
                </td>
                <td className="px-3 py-3 text-slate-600 text-xs">{formatDate(f.fecha_emision)}</td>
                <td className="px-3 py-3 font-medium text-slate-800">{f.aseguradora || f.cliente?.nombre || '—'}</td>
                <td className="px-3 py-3 text-slate-600 max-w-[140px]"><p className="line-clamp-1">{f.concepto || '—'}</p></td>
                <td className="px-3 py-3 text-right text-slate-800">{n(f.comision_gravada) > 0 ? formatCOP(n(f.comision_gravada)) : dash}</td>
                <td className="px-3 py-3 text-right text-slate-600">{n(f.comision_no_gravada) > 0 ? formatCOP(n(f.comision_no_gravada)) : dash}</td>
                <td className="px-3 py-3 text-right text-blue-600">{n(f.iva) > 0 ? formatCOP(n(f.iva)) : dash}</td>
                <td className="px-3 py-3 text-right text-red-500 text-xs">{n(f.ret_iva) > 0 ? `(${formatCOP(n(f.ret_iva))})` : dash}</td>
                <td className="px-3 py-3 text-right text-red-500 text-xs">{n(f.ret_ica) > 0 ? `(${formatCOP(n(f.ret_ica))})` : dash}</td>
                <td className="px-3 py-3 text-right text-red-500 text-xs">{n(f.ret_fuente) > 0 ? `(${formatCOP(n(f.ret_fuente))})` : dash}</td>
                {isRecibidas && <>
                  <td className="px-3 py-3 text-right text-slate-500">{n(f.otros) > 0 ? formatCOP(n(f.otros)) : dash}</td>
                  <td className="px-3 py-3 text-right font-semibold text-emerald-700">{formatCOP(n(f.gran_total))}</td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      f.estado === 'pagada' ? 'bg-emerald-100 text-emerald-700' :
                      f.estado === 'anulada' ? 'bg-slate-100 text-slate-500' :
                      f.estado === 'vencida' ? 'bg-red-100 text-red-700' :
                      'bg-amber-100 text-amber-700'
                    }`}>{f.estado}</span>
                  </td>
                  <td className="px-3 py-3 text-slate-500 text-xs">{f.sede || '—'}</td>
                </>}
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => { setEditing(f); setShowModal(true) }} className="text-slate-400 hover:text-slate-700 p-1 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteFactura(f.id)} className="text-slate-400 hover:text-red-600 p-1 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
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

      {/* Ver totales link */}
      <div className="mt-3">
        <button onClick={() => setShowTotales(t => !t)}
          className="text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:underline underline-offset-2">
          {showTotales ? 'Ocultar totales' : 'Ver totales'}
        </button>
        {showTotales && (
          <div className="mt-3 bg-white border border-slate-200 rounded-xl overflow-hidden max-w-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr className="text-xs text-slate-500">
                  <th className="px-4 py-2.5 text-left font-medium">Concepto</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {[
                  { label: 'Comisión gravada',   v: tot.gravada,    cls: 'font-medium text-slate-800' },
                  { label: 'Comisión no gravada', v: tot.no_gravada, cls: 'text-slate-700' },
                  { label: 'IVA (generado)',       v: tot.iva,        cls: 'text-blue-600' },
                  { label: '(-) Ret. de IVA',     v: tot.ret_iva,   cls: 'text-red-600'  },
                  { label: '(-) Ret. de ICA',     v: tot.ret_ica,   cls: 'text-red-600'  },
                  { label: '(-) Ret. de Fuente',  v: tot.ret_fuente, cls: 'text-red-600'  },
                  { label: 'Otros',               v: tot.otros,      cls: 'text-slate-600' },
                ].map(row => (
                  <tr key={row.label}>
                    <td className="px-4 py-2.5 text-slate-600">{row.label}</td>
                    <td className={`px-4 py-2.5 text-right ${row.cls}`}>{formatCOP(row.v)}</td>
                  </tr>
                ))}
                <tr className="bg-emerald-50 font-semibold">
                  <td className="px-4 py-3 text-slate-900">Gran Total</td>
                  <td className="px-4 py-3 text-right text-emerald-700">{formatCOP(tot.gran_total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <FacturasModal factura={editing} tipoInicial={tipoParaModal}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
