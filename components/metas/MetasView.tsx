'use client'
import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Meta, TipoMeta } from '@/types'
import { Plus, Pencil, Trash2, Target, TrendingUp, RefreshCw, CheckCircle2 } from 'lucide-react'
import MetasModal from './MetasModal'
import { usePermissions } from '@/contexts/PermissionsContext'

const TIPO_LABELS: Record<TipoMeta, string> = {
  prima_total:     'Prima total',
  clientes_nuevos: 'Clientes nuevos',
  renovaciones:    'Renovaciones',
  polizas_activas: 'Pólizas activas',
  comisiones:      'Comisiones',
  cobros:          'Cobros',
  personalizada:   'Personalizada',
}

function formatVal(tipo: TipoMeta, val: number): string {
  const money: TipoMeta[] = ['prima_total', 'comisiones', 'cobros']
  if (money.includes(tipo)) {
    return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(val)
  }
  return val.toLocaleString('es-CO')
}

async function calcActual(tipo: TipoMeta, fechaInicio: string, fechaFin: string): Promise<number> {
  switch (tipo) {
    case 'prima_total': {
      const { data } = await supabase.from('polizas').select('prima')
        .gte('fecha_inicio', fechaInicio).lte('fecha_inicio', fechaFin).eq('estado', 'activa').eq('eliminada', false)
      return (data || []).reduce((s, p) => s + (p.prima || 0), 0)
    }
    case 'clientes_nuevos': {
      const { count } = await supabase.from('clientes').select('id', { count: 'exact', head: true })
        .gte('created_at', fechaInicio).lte('created_at', fechaFin + 'T23:59:59')
      return count || 0
    }
    case 'renovaciones': {
      const { count } = await supabase.from('polizas').select('id', { count: 'exact', head: true })
        .gte('fecha_inicio', fechaInicio).lte('fecha_inicio', fechaFin).eq('estado', 'activa').eq('eliminada', false)
      return count || 0
    }
    case 'polizas_activas': {
      const { count } = await supabase.from('polizas').select('id', { count: 'exact', head: true })
        .eq('estado', 'activa').eq('eliminada', false)
      return count || 0
    }
    case 'comisiones': {
      const { data } = await supabase.from('polizas').select('comision')
        .gte('fecha_inicio', fechaInicio).lte('fecha_inicio', fechaFin).eq('eliminada', false)
      return (data || []).reduce((s, p) => s + (p.comision || 0), 0)
    }
    case 'cobros': {
      const { data } = await supabase.from('cobros').select('valor')
        .eq('estado', 'pagado').gte('created_at', fechaInicio).lte('created_at', fechaFin + 'T23:59:59')
      return (data || []).reduce((s, c) => s + (c.valor || 0), 0)
    }
    default:
      return 0
  }
}

function ProgressRing({ pct, color, size = 80 }: { pct: number; color: string; size?: number }) {
  const r = (size - 10) / 2
  const circ = 2 * Math.PI * r
  const dash = Math.min(pct / 100, 1) * circ
  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={8} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={8}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.6s ease' }} />
    </svg>
  )
}

export default function MetasView() {
  const { can } = usePermissions()
  const [metas, setMetas]       = useState<Meta[]>([])
  const [loading, setLoading]   = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing]   = useState<Meta | undefined>()
  const [recalcId, setRecalcId] = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('metas').select('*').order('created_at', { ascending: false })
    setMetas((data || []) as Meta[])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  async function recalcular(m: Meta) {
    setRecalcId(m.id)
    const actual = await calcActual(m.tipo, m.fecha_inicio, m.fecha_fin)
    await supabase.from('metas').update({ valor_actual: actual }).eq('id', m.id)
    setMetas(prev => prev.map(x => x.id === m.id ? { ...x, valor_actual: actual } : x))
    setRecalcId(null)
  }

  async function deleteMeta(id: string) {
    if (!confirm('¿Eliminar esta meta?')) return
    await supabase.from('metas').delete().eq('id', id)
    setMetas(prev => prev.filter(m => m.id !== id))
  }

  async function handleSaved() {
    setShowModal(false)
    await load()
    // Auto-recalculate metas with auto_calcular=true
    const { data: fresh } = await supabase.from('metas').select('*').eq('auto_calcular', true)
    for (const m of (fresh || []) as Meta[]) {
      const actual = await calcActual(m.tipo, m.fecha_inicio, m.fecha_fin)
      await supabase.from('metas').update({ valor_actual: actual }).eq('id', m.id)
    }
    load()
  }

  const totalMetas   = metas.length
  const completadas  = metas.filter(m => m.valor_actual >= m.valor_meta).length
  const enProgreso   = metas.filter(m => m.valor_actual > 0 && m.valor_actual < m.valor_meta).length

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink-700">Metas</h1>
          <p className="text-ink-400 text-sm mt-1">
            {completadas} completadas · {enProgreso} en progreso · {totalMetas} total
          </p>
        </div>
        {can('metas_crear_editar') && (
          <button onClick={() => { setEditing(undefined); setShowModal(true) }}
            className="flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
            <Plus className="w-4 h-4" /> Nueva meta
          </button>
        )}
      </div>

      {/* Summary cards */}
      {totalMetas > 0 && (
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total metas', value: totalMetas, icon: Target, color: 'bg-cream-200 text-ink-500' },
            { label: 'Completadas', value: completadas, icon: CheckCircle2, color: 'bg-primary-100 text-primary-500' },
            { label: 'En progreso', value: enProgreso, icon: TrendingUp, color: 'bg-info/20 text-info' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div key={label} className="bg-white rounded-xl border border-ink-200 p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div>
                <p className="text-2xl font-bold text-ink-700">{value}</p>
                <p className="text-xs text-ink-400">{label}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Metas grid */}
      {metas.length === 0 ? (
        <div className="bg-white rounded-xl border border-ink-200 p-16 text-center">
          <Target className="w-10 h-10 mx-auto mb-3 text-ink-300" />
          <p className="text-ink-400 font-medium">No hay metas definidas</p>
          <p className="text-ink-400 text-sm mt-1">Crea tu primera meta para comenzar a trackear el progreso</p>
          {can('metas_crear_editar') && (
            <button onClick={() => { setEditing(undefined); setShowModal(true) }}
              className="mt-4 inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              <Plus className="w-4 h-4" /> Nueva meta
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {metas.map(m => {
            const pct     = m.valor_meta > 0 ? Math.min((m.valor_actual / m.valor_meta) * 100, 100) : 0
            const done    = pct >= 100
            const overPct = m.valor_meta > 0 ? ((m.valor_actual / m.valor_meta) * 100) : 0
            const fi = new Date(m.fecha_inicio).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })
            const ff = new Date(m.fecha_fin).toLocaleDateString('es-CO', { month: 'short', day: 'numeric' })
            return (
              <div key={m.id} className={`bg-white rounded-xl border overflow-hidden transition-shadow hover:shadow-md ${done ? 'border-primary-200' : 'border-ink-200'}`}>
                {/* Top bar */}
                <div className="h-1.5" style={{ background: m.color }} />

                <div className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-2 py-0.5 rounded text-xs font-medium text-white" style={{ background: m.color }}>
                          {TIPO_LABELS[m.tipo]}
                        </span>
                        {done && <span className="px-2 py-0.5 rounded text-xs font-medium bg-primary-100 text-primary-700">✓ Lograda</span>}
                      </div>
                      <h3 className="font-semibold text-ink-700 truncate">{m.nombre}</h3>
                      <p className="text-xs text-ink-400 mt-0.5">{fi} – {ff}</p>
                    </div>
                    <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                      {m.auto_calcular && (
                        <button onClick={() => recalcular(m)} title="Recalcular"
                          className="p-1.5 rounded-lg text-ink-400 hover:text-primary-500 hover:bg-primary-50 transition-colors">
                          <RefreshCw className={`w-3.5 h-3.5 ${recalcId === m.id ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      {can('metas_crear_editar') && (
                        <button onClick={() => { setEditing(m); setShowModal(true) }}
                          className="p-1.5 rounded-lg text-ink-400 hover:text-ink-600 hover:bg-cream-200 transition-colors">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {can('metas_crear_editar') && (
                        <button onClick={() => deleteMeta(m.id)}
                          className="p-1.5 rounded-lg text-ink-400 hover:text-error hover:bg-error-soft transition-colors">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress */}
                  <div className="flex items-center gap-4">
                    <div className="relative flex-shrink-0">
                      <ProgressRing pct={pct} color={done ? '#10b981' : m.color} />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-sm font-bold text-ink-700">{Math.round(overPct)}%</span>
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-ink-400 mb-0.5">Actual</p>
                      <p className="text-lg font-bold text-ink-700 truncate">{formatVal(m.tipo, m.valor_actual)}</p>
                      <p className="text-xs text-ink-400">de {formatVal(m.tipo, m.valor_meta)}</p>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-4">
                    <div className="w-full bg-cream-200 rounded-full h-2">
                      <div className="h-2 rounded-full transition-all duration-700"
                        style={{ width: `${pct}%`, background: done ? '#10b981' : m.color }} />
                    </div>
                    {m.descripcion && (
                      <p className="text-xs text-ink-400 mt-2 line-clamp-1">{m.descripcion}</p>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {showModal && (
        <MetasModal meta={editing} onClose={() => setShowModal(false)} onSaved={handleSaved} />
      )}
    </div>
  )
}
