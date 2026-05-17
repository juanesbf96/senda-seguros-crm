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
const dash = <span className="text-ink-300">—</span>

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
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-ink-700">Facturas</h1>
          <p className="text-ink-400 text-sm mt-1">{facturas.length} registros</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm border border-ink-200 text-ink-500 rounded-lg hover:bg-cream-100 transition-colors">
            <Download className="w-4 h-4" /> Exportar excel
          </button>
          <button onClick={() => { setEditing(undefined); setShowModal(true) }}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Crear Factura
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-0.5 mb-5 border-b border-ink-200 overflow-x-auto">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setActiveTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors ${
              activeTab === key ? 'border-primary-500 text-primary-500' : 'border-transparent text-ink-400 hover:text-ink-600'
            }`}>
            <Icon className="w-3.5 h-3.5" />
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
          placeholder="Buscar ej (No factura, aseguradora...)"
          className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400" />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-ink-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[920px]">
          <thead className="bg-cream-100 border-b border-ink-200">
            <tr className="text-left text-xs text-ink-400">
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
              <tr key={f.id} className="border-b border-cream-200 hover:bg-cream-100 transition-colors">
                <td className="px-3 py-3 text-xs font-mono text-ink-400">
                  {f.es_borrador ? <span className="text-warning">Bor.</span> : `#${f.numero_factura || '—'}`}
                </td>
                <td className="px-3 py-3 text-ink-500 text-xs">{formatDate(f.fecha_emision)}</td>
                <td className="px-3 py-3 font-medium text-ink-700">{f.aseguradora || f.cliente?.nombre || '—'}</td>
                <td className="px-3 py-3 text-ink-500 max-w-[140px]"><p className="line-clamp-1">{f.concepto || '—'}</p></td>
                <td className="px-3 py-3 text-right text-ink-700">{n(f.comision_gravada) > 0 ? formatCOP(n(f.comision_gravada)) : dash}</td>
                <td className="px-3 py-3 text-right text-ink-500">{n(f.comision_no_gravada) > 0 ? formatCOP(n(f.comision_no_gravada)) : dash}</td>
                <td className="px-3 py-3 text-right text-info">{n(f.iva) > 0 ? formatCOP(n(f.iva)) : dash}</td>
                <td className="px-3 py-3 text-right text-error text-xs">{n(f.ret_iva) > 0 ? `(${formatCOP(n(f.ret_iva))})` : dash}</td>
                <td className="px-3 py-3 text-right text-error text-xs">{n(f.ret_ica) > 0 ? `(${formatCOP(n(f.ret_ica))})` : dash}</td>
                <td className="px-3 py-3 text-right text-error text-xs">{n(f.ret_fuente) > 0 ? `(${formatCOP(n(f.ret_fuente))})` : dash}</td>
                {isRecibidas && <>
                  <td className="px-3 py-3 text-right text-ink-400">{n(f.otros) > 0 ? formatCOP(n(f.otros)) : dash}</td>
                  <td className="px-3 py-3 text-right font-semibold text-primary-700">{formatCOP(n(f.gran_total))}</td>
                  <td className="px-3 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      f.estado === 'pagada' ? 'bg-primary-100 text-primary-700' :
                      f.estado === 'anulada' ? 'bg-cream-200 text-ink-400' :
                      f.estado === 'vencida' ? 'bg-error-soft text-error' :
                      'bg-warning-soft text-ink-700'
                    }`}>{f.estado}</span>
                  </td>
                  <td className="px-3 py-3 text-ink-400 text-xs">{f.sede || '—'}</td>
                </>}
                <td className="px-3 py-3">
                  <div className="flex items-center justify-end gap-1.5">
                    <button onClick={() => { setEditing(f); setShowModal(true) }} className="text-ink-400 hover:text-ink-600 p-1 transition-colors"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteFactura(f.id)} className="text-ink-400 hover:text-error p-1 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-12 text-ink-400">
            <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No hay facturas en esta sección</p>
          </div>
        )}
      </div>

      {/* Ver totales link */}
      <div className="mt-3">
        <button onClick={() => setShowTotales(t => !t)}
          className="text-sm text-primary-500 hover:text-primary-700 font-medium hover:underline underline-offset-2">
          {showTotales ? 'Ocultar totales' : 'Ver totales'}
        </button>
        {showTotales && (
          <div className="mt-3 bg-white border border-ink-200 rounded-xl overflow-hidden max-w-sm">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 border-b border-cream-200">
                <tr className="text-xs text-ink-400">
                  <th className="px-4 py-2.5 text-left font-medium">Concepto</th>
                  <th className="px-4 py-2.5 text-right font-medium">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-100">
                {[
                  { label: 'Comisión gravada',   v: tot.gravada,    cls: 'font-medium text-ink-700' },
                  { label: 'Comisión no gravada', v: tot.no_gravada, cls: 'text-ink-600' },
                  { label: 'IVA (generado)',       v: tot.iva,        cls: 'text-info' },
                  { label: '(-) Ret. de IVA',     v: tot.ret_iva,   cls: 'text-error'  },
                  { label: '(-) Ret. de ICA',     v: tot.ret_ica,   cls: 'text-error'  },
                  { label: '(-) Ret. de Fuente',  v: tot.ret_fuente, cls: 'text-error'  },
                  { label: 'Otros',               v: tot.otros,      cls: 'text-ink-500' },
                ].map(row => (
                  <tr key={row.label}>
                    <td className="px-4 py-2.5 text-ink-500">{row.label}</td>
                    <td className={`px-4 py-2.5 text-right ${row.cls}`}>{formatCOP(row.v)}</td>
                  </tr>
                ))}
                <tr className="bg-primary-50 font-semibold">
                  <td className="px-4 py-3 text-ink-700">Gran Total</td>
                  <td className="px-4 py-3 text-right text-primary-700">{formatCOP(tot.gran_total)}</td>
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
