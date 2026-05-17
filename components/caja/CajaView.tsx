'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Recibo, FormaPago, TipoRecibo } from '@/types'
import { formatCOP, formatDate } from '@/lib/utils'
import {
  Plus, Search, Pencil, Trash2, Receipt, BarChart3,
  Banknote, CreditCard, ArrowRightLeft, FileText, Building2,
  Wallet, CheckCircle2, Ban, Award, CreditCard as PayDirect,
} from 'lucide-react'
import Link from 'next/link'
import ReciboModal from './ReciboModal'
import { useWorkspace } from '@/contexts/WorkspaceContext'

const FORMA_LABELS: Record<FormaPago, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', cheque: 'Cheque',
  tarjeta: 'Tarjeta', consignacion: 'Consignación',
}
const FORMA_ICONS: Record<FormaPago, React.ElementType> = {
  efectivo: Banknote, transferencia: ArrowRightLeft, cheque: FileText,
  tarjeta: CreditCard, consignacion: Building2,
}
const FORMA_COLORS: Record<FormaPago, string> = {
  efectivo:      'bg-primary-100 text-primary-700',
  transferencia: 'bg-info/20 text-info',
  cheque:        'bg-purple-100 text-purple-700',
  tarjeta:       'bg-indigo-100 text-indigo-700',
  consignacion:  'bg-warning-soft text-ink-700',
}

type RecibosTab = TipoRecibo | 'cuadre'

const RECIBO_TABS: { key: RecibosTab; label: string; icon: React.ElementType }[] = [
  { key: 'anticipo',    label: 'Anticipo',     icon: Wallet       },
  { key: 'activo',      label: 'Activos',      icon: CheckCircle2 },
  { key: 'pago_directo',label: 'Pago Directo', icon: PayDirect    },
  { key: 'anulado',     label: 'Anulados',     icon: Ban          },
  { key: 'certificado', label: 'Certificados', icon: Award        },
  { key: 'cuadre',      label: 'Cuadre de caja', icon: BarChart3  },
]

function groupByDate(recibos: Recibo[]) {
  const map = new Map<string, Recibo[]>()
  for (const r of recibos) {
    const d = r.fecha_pago
    if (!map.has(d)) map.set(d, [])
    map.get(d)!.push(r)
  }
  return [...map.entries()].sort((a, b) => b[0].localeCompare(a[0]))
}

export default function CajaView() {
  const { currentWorkspace } = useWorkspace()
  const [recibos, setRecibos] = useState<Recibo[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [filterForma, setFilterForma] = useState<FormaPago | 'all'>('all')
  const [activeTab, setActiveTab] = useState<RecibosTab>('activo')
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]     = useState<Recibo | undefined>()
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')

  async function load() {
    if (!currentWorkspace) return
    const { data } = await supabase
      .from('recibos')
      .select('*, cliente:clientes(id, nombre), cobro:cobros(id, concepto, valor), poliza:polizas(id, numero_poliza, aseguradora, ramo)')
      .eq('workspace_id', currentWorkspace.id)
      .order('fecha_pago', { ascending: false })
    setRecibos((data || []) as Recibo[])
    setLoading(false)
  }

  useEffect(() => { load() }, [currentWorkspace])

  async function deleteRecibo(id: string) {
    if (!confirm('¿Eliminar este recibo?')) return
    await supabase.from('recibos').delete().eq('id', id)
    setRecibos(prev => prev.filter(r => r.id !== id))
  }

  // Tab data
  const isCuadreTab = activeTab === 'cuadre'
  const tabRecibos  = isCuadreTab ? recibos : recibos.filter(r => r.tipo === activeTab)

  const filtered = tabRecibos.filter(r => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      r.cliente?.nombre?.toLowerCase().includes(q) ||
      r.concepto.toLowerCase().includes(q) ||
      r.numero_recibo?.toLowerCase().includes(q) ||
      r.referencia?.toLowerCase().includes(q) ||
      r.numero_certificado?.toLowerCase().includes(q)
    const matchForma = filterForma === 'all' || r.forma_pago === filterForma
    const matchFrom  = !dateFrom || r.fecha_pago >= dateFrom
    const matchTo    = !dateTo   || r.fecha_pago <= dateTo
    return matchSearch && matchForma && matchFrom && matchTo
  })

  const totalFiltrado = filtered.reduce((s, r) => s + r.valor, 0)
  const grouped       = groupByDate(filtered)

  const tabCounts = RECIBO_TABS.reduce((acc, t) => {
    acc[t.key] = t.key === 'cuadre' ? recibos.length : recibos.filter(r => r.tipo === t.key).length
    return acc
  }, {} as Record<RecibosTab, number>)

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
          <h1 className="text-2xl font-bold text-ink-700">Caja</h1>
          <p className="text-ink-400 text-sm mt-1">
            {recibos.length} recibos · Total: {formatCOP(recibos.reduce((s, r) => s + r.valor, 0))}
          </p>
        </div>
        <button onClick={() => { setEditing(undefined); setShowModal(true) }}
          className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          <Plus className="w-4 h-4" /> Nuevo recibo
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-ink-200 overflow-x-auto">
        {RECIBO_TABS.map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => { setActiveTab(key); setSearch('') }}
            className={[
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
              activeTab === key ? 'border-primary-500 text-primary-500' : 'border-transparent text-ink-400 hover:text-ink-600',
            ].join(' ')}>
            <Icon className="w-4 h-4" />
            {label}
            <span className={`px-1.5 py-0.5 rounded text-xs font-semibold ${activeTab === key ? 'bg-primary-100 text-primary-700' : 'bg-cream-200 text-ink-400'}`}>
              {tabCounts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Filters (shared) */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Buscar cliente, concepto, N° recibo..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
        {!isCuadreTab && (
          <select value={filterForma} onChange={e => setFilterForma(e.target.value as FormaPago | 'all')}
            className="px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400">
            <option value="all">Todas las formas</option>
            {(Object.entries(FORMA_LABELS) as [FormaPago, string][]).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        )}
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          className="px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          className="px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400" />
      </div>

      {/* Total filtrado */}
      {(search || filterForma !== 'all' || dateFrom || dateTo) && (
        <div className="mb-4 px-4 py-3 bg-primary-50 border border-primary-200 rounded-xl flex items-center justify-between">
          <span className="text-sm text-primary-700">{filtered.length} recibos en el filtro seleccionado</span>
          <span className="font-bold text-primary-800">{formatCOP(totalFiltrado)}</span>
        </div>
      )}

      {/* ── Tab: Recibos (anticipo / activos / pago_directo / anulados / certificados) ── */}
      {!isCuadreTab && (
        <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 border-b border-ink-200">
              <tr className="text-left text-xs text-ink-400">
                <th className="px-4 py-3 font-medium">Fecha</th>
                <th className="px-4 py-3 font-medium">Cliente</th>
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">N° Recibo</th>
                {activeTab === 'certificado' && (
                  <th className="px-4 py-3 font-medium hidden md:table-cell">N° Certificado</th>
                )}
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Forma</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Referencia</th>
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => {
                const FormaIcon = FORMA_ICONS[r.forma_pago]
                return (
                  <tr key={r.id} className={`border-b border-cream-200 hover:bg-cream-100 transition-colors ${r.tipo === 'anulado' ? 'opacity-60' : ''}`}>
                    <td className="px-4 py-3 text-ink-400 text-xs whitespace-nowrap">{formatDate(r.fecha_pago)}</td>
                    <td className="px-4 py-3">
                      {r.client_id
                        ? <Link href={`/clientes/${r.client_id}`} className="font-medium text-ink-700 hover:text-primary-500">{r.cliente?.nombre || '—'}</Link>
                        : <span className="text-ink-400">—</span>}
                    </td>
                    <td className="px-4 py-3 text-ink-600 max-w-[180px]">
                      <span className="line-clamp-1">{r.concepto}</span>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs">{r.numero_recibo || '—'}</td>
                    {activeTab === 'certificado' && (
                      <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs">{r.numero_certificado || '—'}</td>
                    )}
                    <td className="px-4 py-3 font-semibold text-ink-700">{formatCOP(r.valor)}</td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <span className={`flex items-center gap-1 w-fit px-2 py-0.5 rounded-full text-xs font-medium ${FORMA_COLORS[r.forma_pago]}`}>
                        <FormaIcon className="w-3 h-3" />{FORMA_LABELS[r.forma_pago]}
                      </span>
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell text-ink-400 text-xs">{r.referencia || r.banco || '—'}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button onClick={() => { setEditing(r); setShowModal(true) }} className="text-ink-400 hover:text-ink-600 transition-colors"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => deleteRecibo(r.id)} className="text-ink-400 hover:text-error transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="text-center py-12 text-ink-400">
              <Receipt className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">No hay recibos en esta sección</p>
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Cuadre de caja ── */}
      {isCuadreTab && (
        <div className="space-y-6">
          {/* Resumen por forma de pago */}
          <div>
            <h2 className="text-sm font-semibold text-ink-600 mb-3">Resumen por forma de pago</h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {(Object.keys(FORMA_LABELS) as FormaPago[]).map(f => {
                const total = filtered.filter(r => r.forma_pago === f).reduce((s, r) => s + r.valor, 0)
                const count = filtered.filter(r => r.forma_pago === f).length
                const Icon  = FORMA_ICONS[f]
                return (
                  <div key={f} className="bg-white border border-ink-200 rounded-xl p-4 text-center">
                    <Icon className="w-5 h-5 mx-auto mb-1 text-ink-400" />
                    <p className="text-xs text-ink-400 mb-1">{FORMA_LABELS[f]}</p>
                    <p className="font-bold text-ink-700 text-sm">{formatCOP(total)}</p>
                    <p className="text-xs text-ink-400">{count} recibo{count !== 1 ? 's' : ''}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Total general */}
          <div className="bg-primary-50 border border-primary-200 rounded-xl p-5 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-primary-700">Total recaudado</p>
              <p className="text-xs text-primary-500 mt-0.5">{filtered.length} recibos en el período</p>
            </div>
            <p className="text-2xl font-bold text-primary-800">{formatCOP(totalFiltrado)}</p>
          </div>

          {/* Por día */}
          <div>
            <h2 className="text-sm font-semibold text-ink-600 mb-3">Detalle por día</h2>
            <div className="space-y-3">
              {grouped.length === 0 ? (
                <div className="text-center py-10 text-ink-400 bg-white rounded-xl border border-dashed border-ink-200">
                  <BarChart3 className="w-8 h-8 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Sin movimientos en el período</p>
                </div>
              ) : grouped.map(([date, items]) => {
                const dayTotal = items.reduce((s, r) => s + r.valor, 0)
                return (
                  <div key={date} className="bg-white border border-ink-200 rounded-xl overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-2.5 bg-cream-100 border-b border-cream-200">
                      <span className="text-sm font-semibold text-ink-600">{formatDate(date)}</span>
                      <span className="text-sm font-bold text-ink-700">{formatCOP(dayTotal)}</span>
                    </div>
                    <div className="divide-y divide-cream-100">
                      {items.map(r => {
                        const Icon = FORMA_ICONS[r.forma_pago]
                        return (
                          <div key={r.id} className="flex items-center justify-between px-4 py-2.5 text-sm">
                            <div className="flex items-center gap-2 min-w-0">
                              <Icon className="w-3.5 h-3.5 text-ink-400 flex-shrink-0" />
                              <span className="text-ink-600 truncate">{r.concepto}</span>
                              {r.cliente && (
                                <span className="text-ink-400 text-xs hidden md:inline">· {r.cliente.nombre}</span>
                              )}
                            </div>
                            <span className="font-medium text-ink-700 flex-shrink-0 ml-4">{formatCOP(r.valor)}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {showModal && (
        <ReciboModal recibo={editing} activeTab={activeTab !== 'cuadre' ? activeTab : 'activo'}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load() }} />
      )}
    </div>
  )
}
