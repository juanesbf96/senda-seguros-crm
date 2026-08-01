'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Operacion, TipoOperacion, EstadoCartera } from '@/types'
import { formatCOP, formatDate } from '@/lib/utils'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import Link from 'next/link'
import { Activity, RefreshCw, DollarSign, XCircle, FileText, PlusCircle, Layers } from 'lucide-react'

const TIPO_META: Record<TipoOperacion, { label: string; icon: React.ElementType; chip: string }> = {
  renovacion:   { label: 'Renovación',   icon: RefreshCw,  chip: 'bg-info/15 text-info' },
  cobro:        { label: 'Cobro',        icon: DollarSign, chip: 'bg-primary-100 text-primary-700' },
  cancelacion:  { label: 'Cancelación',  icon: XCircle,    chip: 'bg-error-soft text-error' },
  modificacion: { label: 'Modificación', icon: FileText,   chip: 'bg-warning-soft text-ink-700' },
  expedicion:   { label: 'Expedición',   icon: PlusCircle, chip: 'bg-purple-100 text-purple-700' },
}
const ESTADO_META: Record<EstadoCartera, { label: string; chip: string }> = {
  pendiente: { label: 'Pendiente', chip: 'bg-warning-soft text-ink-700' },
  pagada:    { label: 'Pagada',    chip: 'bg-primary-100 text-primary-700' },
  anulada:   { label: 'Anulada',   chip: 'bg-cream-200 text-ink-400' },
}

export default function OperacionesView() {
  const { currentWorkspace } = useWorkspace()
  const [ops, setOps] = useState<Operacion[]>([])
  const [loading, setLoading] = useState(true)
  const [fTipo, setFTipo]     = useState<TipoOperacion | 'all'>('all')
  const [fEstado, setFEstado] = useState<EstadoCartera | 'all'>('all')

  useEffect(() => {
    if (!currentWorkspace) return
    setLoading(true)
    supabase.from('operaciones')
      .select('*, poliza:polizas(id, numero_poliza, aseguradora, ramo, cliente:clientes(id, nombre))')
      .eq('workspace_id', currentWorkspace.id)
      .order('fecha_programada', { ascending: true })
      .then(({ data }) => { setOps((data || []) as unknown as Operacion[]); setLoading(false) })
  }, [currentWorkspace])

  const filtered = useMemo(() => ops.filter(o =>
    (fTipo === 'all' || o.tipo === fTipo) && (fEstado === 'all' || o.estado_cartera === fEstado)
  ), [ops, fTipo, fEstado])

  const totalPendiente = useMemo(
    () => ops.filter(o => o.estado_cartera === 'pendiente').reduce((s, o) => s + (o.valor ?? 0), 0), [ops])
  const totalPagada = useMemo(
    () => ops.filter(o => o.estado_cartera === 'pagada').reduce((s, o) => s + (o.valor ?? 0), 0), [ops])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-700">Operaciones de Producción</h1>
        <p className="text-ink-400 text-sm mt-1">
          Movimientos por póliza (cuotas, renovaciones, cancelaciones) con su estado de cartera.
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
        <Stat icon={Layers} label="Operaciones" value={String(ops.length)} sub="registradas" tone="ink" />
        <Stat icon={DollarSign} label="Cartera pendiente" value={formatCOP(totalPendiente)} sub="por cobrar" tone="warning" />
        <Stat icon={Activity} label="Cartera pagada" value={formatCOP(totalPagada)} sub="recaudada" tone="primary" />
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <select value={fTipo} onChange={e => setFTipo(e.target.value as TipoOperacion | 'all')}
          className="px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400">
          <option value="all">Todos los tipos</option>
          {(Object.entries(TIPO_META) as [TipoOperacion, { label: string }][]).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select value={fEstado} onChange={e => setFEstado(e.target.value as EstadoCartera | 'all')}
          className="px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400">
          <option value="all">Todos los estados</option>
          {(Object.entries(ESTADO_META) as [EstadoCartera, { label: string }][]).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
      </div>

      {ops.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-ink-300 p-12 text-center text-ink-400">
          <Layers className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Aún no hay operaciones registradas.</p>
          <p className="text-xs mt-1">Las cuotas se generan al financiar una póliza; las renovaciones y cancelaciones se irán enganchando.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-cream-100 border-b border-ink-200">
                <tr className="text-left text-xs text-ink-400">
                  <th className="px-4 py-3 font-medium">Tipo</th>
                  <th className="px-4 py-3 font-medium">Cliente / Póliza</th>
                  <th className="px-4 py-3 font-medium">Cuota</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium hidden md:table-cell">Programada</th>
                  <th className="px-4 py-3 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(o => {
                  const T = TIPO_META[o.tipo]; const Icon = T.icon
                  return (
                    <tr key={o.id} className="border-b border-cream-200 hover:bg-cream-100 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${T.chip}`}>
                          <Icon className="w-3 h-3" />{T.label}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {o.poliza?.cliente
                          ? <Link href={`/clientes/${o.poliza.cliente.id}`} className="font-medium text-ink-700 hover:text-primary-500">{o.poliza.cliente.nombre}</Link>
                          : <span className="text-ink-400">—</span>}
                        <span className="text-ink-400 text-xs block">{[o.poliza?.ramo, o.poliza?.numero_poliza].filter(Boolean).join(' · ') || '—'}</span>
                      </td>
                      <td className="px-4 py-3 text-ink-500">{o.numero_cuota ? `#${o.numero_cuota}` : '—'}</td>
                      <td className="px-4 py-3 font-semibold text-ink-700">{formatCOP(o.valor ?? 0)}</td>
                      <td className="px-4 py-3 hidden md:table-cell text-ink-400 text-xs">{o.fecha_programada ? formatDate(o.fecha_programada) : '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_META[o.estado_cartera].chip}`}>
                          {ESTADO_META[o.estado_cartera].label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtered.length === 0 && (
            <div className="text-center py-10 text-ink-400 text-sm">Sin operaciones en el filtro seleccionado.</div>
          )}
        </div>
      )}
    </div>
  )
}

function Stat({ icon: Icon, label, value, sub, tone }: {
  icon: React.ElementType; label: string; value: string; sub: string; tone: 'ink' | 'warning' | 'primary'
}) {
  const t = tone === 'warning' ? 'text-warning' : tone === 'primary' ? 'text-primary-700' : 'text-ink-500'
  return (
    <div className="bg-white rounded-xl border border-ink-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${t}`} />
        <span className="text-xs text-ink-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-ink-700">{value}</p>
      <p className="text-xs text-ink-400 mt-0.5">{sub}</p>
    </div>
  )
}
