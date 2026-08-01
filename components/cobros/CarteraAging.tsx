'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { CarteraAgingRow, CarteraBucket } from '@/types'
import { formatCOP } from '@/lib/utils'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import { AlertTriangle, TrendingDown, Clock, Wallet } from 'lucide-react'

// Orden, etiqueta y color por bucket (severidad creciente).
const BUCKETS: { key: CarteraBucket; label: string; bar: string; chip: string }[] = [
  { key: 'por_vencer', label: 'Por vencer',   bar: 'bg-primary-400', chip: 'bg-primary-100 text-primary-700' },
  { key: 'd1_30',      label: '1–30 días',    bar: 'bg-warning',     chip: 'bg-warning-soft text-ink-700' },
  { key: 'd31_60',     label: '31–60 días',   bar: 'bg-orange-400',  chip: 'bg-orange-100 text-orange-700' },
  { key: 'd61_90',     label: '61–90 días',   bar: 'bg-red-400',     chip: 'bg-error-soft text-error' },
  { key: 'd90_mas',    label: '+90 días',     bar: 'bg-red-600',     chip: 'bg-error-soft text-error' },
  { key: 'sin_fecha',  label: 'Sin fecha',    bar: 'bg-ink-300',     chip: 'bg-cream-200 text-ink-500' },
]
// Buckets que cuentan como cartera VENCIDA (mora real).
const VENCIDOS: CarteraBucket[] = ['d1_30', 'd31_60', 'd61_90', 'd90_mas']

export default function CarteraAging() {
  const { currentWorkspace } = useWorkspace()
  const [rows, setRows]       = useState<CarteraAgingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState('')

  useEffect(() => {
    if (!currentWorkspace) return
    setLoading(true)
    supabase.rpc('get_cartera_aging', { p_workspace_id: currentWorkspace.id })
      .then(({ data, error }) => {
        if (error) setError(error.message)
        else setRows((data || []) as CarteraAgingRow[])
        setLoading(false)
      })
  }, [currentWorkspace])

  // Totales por bucket (# y $), sumando todas las aseguradoras.
  const porBucket = useMemo(() => {
    const m = new Map<CarteraBucket, { cantidad: number; total: number }>()
    for (const b of BUCKETS) m.set(b.key, { cantidad: 0, total: 0 })
    for (const r of rows) {
      const acc = m.get(r.bucket) ?? { cantidad: 0, total: 0 }
      acc.cantidad += Number(r.cantidad); acc.total += Number(r.total)
      m.set(r.bucket, acc)
    }
    return m
  }, [rows])

  // Pivot por aseguradora: fila = aseguradora, columna = bucket → $.
  const porAseguradora = useMemo(() => {
    const m = new Map<string, { buckets: Record<string, number>; total: number }>()
    for (const r of rows) {
      const cur = m.get(r.aseguradora) ?? { buckets: {}, total: 0 }
      cur.buckets[r.bucket] = (cur.buckets[r.bucket] ?? 0) + Number(r.total)
      cur.total += Number(r.total)
      m.set(r.aseguradora, cur)
    }
    return [...m.entries()].sort((a, b) => b[1].total - a[1].total)
  }, [rows])

  const totalPendiente = useMemo(() => rows.reduce((s, r) => s + Number(r.total), 0), [rows])
  const countPendiente = useMemo(() => rows.reduce((s, r) => s + Number(r.cantidad), 0), [rows])
  const totalVencido = useMemo(
    () => rows.filter(r => VENCIDOS.includes(r.bucket)).reduce((s, r) => s + Number(r.total), 0), [rows])
  const countVencido = useMemo(
    () => rows.filter(r => VENCIDOS.includes(r.bucket)).reduce((s, r) => s + Number(r.cantidad), 0), [rows])
  const pctVencido = totalPendiente > 0 ? Math.round((totalVencido / totalPendiente) * 100) : 0
  const maxBucket = useMemo(() => Math.max(1, ...[...porBucket.values()].map(v => v.total)), [porBucket])

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-700">Cartera — Aging de mora</h1>
        <p className="text-ink-400 text-sm mt-1">
          Saldos por cobrar pendientes, agrupados por días vencidos (calculado sobre el compromiso de pago).
        </p>
      </div>

      {error && <p className="text-sm text-error bg-error-soft rounded-lg px-3 py-2 mb-4">{error}</p>}

      {countPendiente === 0 && !error ? (
        <div className="bg-white rounded-xl border border-dashed border-ink-300 p-12 text-center text-ink-400">
          <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No hay cartera por cobrar pendiente. 🎉</p>
        </div>
      ) : (
        <>
          {/* Resumen */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
            <Card icon={Wallet} tone="ink" label="Total pendiente"
              value={formatCOP(totalPendiente)} sub={`${countPendiente} cobro${countPendiente !== 1 ? 's' : ''}`} />
            <Card icon={AlertTriangle} tone="error" label="Cartera vencida"
              value={formatCOP(totalVencido)} sub={`${countVencido} en mora`} />
            <Card icon={TrendingDown} tone={pctVencido >= 40 ? 'error' : 'warning'} label="% vencido"
              value={`${pctVencido}%`} sub="del total pendiente" />
          </div>

          {/* Barras por bucket */}
          <div className="bg-white rounded-xl border border-ink-200 p-5 mb-6">
            <h2 className="text-sm font-semibold text-ink-600 mb-4 flex items-center gap-2">
              <Clock className="w-4 h-4 text-ink-400" /> Distribución por antigüedad
            </h2>
            <div className="space-y-3">
              {BUCKETS.map(b => {
                const d = porBucket.get(b.key)!
                const pct = Math.round((d.total / maxBucket) * 100)
                return (
                  <div key={b.key} className="flex items-center gap-3">
                    <div className="w-24 text-xs text-ink-500 shrink-0">{b.label}</div>
                    <div className="flex-1 bg-cream-100 rounded-full h-6 overflow-hidden relative">
                      <div className={`${b.bar} h-full rounded-full transition-all`} style={{ width: `${d.total > 0 ? Math.max(pct, 2) : 0}%` }} />
                    </div>
                    <div className="w-32 text-right shrink-0">
                      <span className="text-sm font-semibold text-ink-700">{formatCOP(d.total)}</span>
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${b.chip}`}>{d.cantidad}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Pivot por aseguradora */}
          <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
            <h2 className="text-sm font-semibold text-ink-600 px-5 py-3 border-b border-ink-200">
              Desglose por aseguradora
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-cream-100 border-b border-ink-200">
                  <tr className="text-left text-xs text-ink-400">
                    <th className="px-4 py-3 font-medium">Aseguradora</th>
                    {BUCKETS.map(b => <th key={b.key} className="px-4 py-3 font-medium text-right whitespace-nowrap">{b.label}</th>)}
                    <th className="px-4 py-3 font-medium text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {porAseguradora.map(([nombre, d]) => (
                    <tr key={nombre} className="border-b border-cream-200 hover:bg-cream-100 transition-colors">
                      <td className="px-4 py-3 font-medium text-ink-700 whitespace-nowrap">{nombre}</td>
                      {BUCKETS.map(b => (
                        <td key={b.key} className="px-4 py-3 text-right text-ink-500">
                          {d.buckets[b.key] ? formatCOP(d.buckets[b.key]) : <span className="text-ink-300">—</span>}
                        </td>
                      ))}
                      <td className="px-4 py-3 text-right font-semibold text-ink-700 whitespace-nowrap">{formatCOP(d.total)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-cream-100 border-t border-ink-200">
                  <tr className="text-sm">
                    <td className="px-4 py-3 font-semibold text-ink-600">Total</td>
                    {BUCKETS.map(b => (
                      <td key={b.key} className="px-4 py-3 text-right font-medium text-ink-600 whitespace-nowrap">
                        {formatCOP(porBucket.get(b.key)!.total)}
                      </td>
                    ))}
                    <td className="px-4 py-3 text-right font-bold text-ink-800 whitespace-nowrap">{formatCOP(totalPendiente)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function Card({ icon: Icon, tone, label, value, sub }: {
  icon: React.ElementType; tone: 'ink' | 'warning' | 'error'; label: string; value: string; sub: string
}) {
  const toneCls = tone === 'error' ? 'text-error' : tone === 'warning' ? 'text-warning' : 'text-ink-500'
  return (
    <div className="bg-white rounded-xl border border-ink-200 p-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${toneCls}`} />
        <span className="text-xs text-ink-400">{label}</span>
      </div>
      <p className="text-xl font-bold text-ink-700">{value}</p>
      <p className="text-xs text-ink-400 mt-0.5">{sub}</p>
    </div>
  )
}
