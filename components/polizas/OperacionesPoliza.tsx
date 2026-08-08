'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { usePermissions } from '@/contexts/PermissionsContext'
import { formatCOP, formatDate } from '@/lib/utils'
import type { Operacion, TipoOperacion, EstadoCartera } from '@/types'
import { Loader2, RefreshCw, Ban, FileText, Pencil, Receipt } from 'lucide-react'

/**
 * Timeline de Operaciones de Producción de una póliza (fase 3, ítem 1).
 *
 * Lee de `operaciones` — el modelo unificado de movimientos (cuota de cobro /
 * renovación / cancelación / modificación / expedición) que creó el backbone
 * (PR #28). Es solo lectura: las operaciones las crean el generador de cuotas,
 * el cron de renovaciones y el flujo de cancelación, no esta vista.
 *
 * RLS: `operaciones_select` exige `finanzas_cobros_ver`, así que si el usuario
 * no tiene ese permiso la query devuelve vacío. Se distingue "sin permiso" de
 * "sin operaciones" para no mostrar un vacío engañoso.
 */

const TIPO_META: Record<TipoOperacion, { label: string; icon: React.ElementType; color: string }> = {
  cobro:        { label: 'Cuota de cobro', icon: Receipt,  color: 'text-primary-600' },
  renovacion:   { label: 'Renovación',     icon: RefreshCw, color: 'text-info' },
  cancelacion:  { label: 'Cancelación',    icon: Ban,       color: 'text-error' },
  modificacion: { label: 'Modificación',   icon: Pencil,    color: 'text-ink-500' },
  expedicion:   { label: 'Expedición',     icon: FileText,  color: 'text-ink-500' },
}

const ESTADO_BADGE: Record<EstadoCartera, string> = {
  pendiente: 'bg-warning-soft text-ink-700',
  pagada:    'bg-primary-100 text-primary-700',
  anulada:   'bg-cream-200 text-ink-500',
}

export default function OperacionesPoliza({ polizaId, workspaceId }: {
  polizaId: string
  workspaceId: string
}) {
  const { can } = usePermissions()
  const puedeVer = can('finanzas_cobros_ver')

  const [ops, setOps]         = useState<Operacion[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!puedeVer) { setLoading(false); return }
    const { data } = await supabase
      .from('operaciones')
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('poliza_id', polizaId)
      // Las cuotas se leen en orden de vencimiento; el resto por fecha del movimiento.
      .order('fecha_programada', { ascending: true, nullsFirst: false })
      .order('numero_cuota',     { ascending: true, nullsFirst: true })
    setOps((data ?? []) as Operacion[])
    setLoading(false)
  }, [polizaId, workspaceId, puedeVer])

  useEffect(() => { load() }, [load])

  // Sin permiso no se muestra la sección: es información financiera.
  if (!puedeVer) return null

  if (loading) return (
    <div className="bg-white rounded-xl border border-ink-200 p-5 flex items-center gap-2 text-ink-400 text-sm">
      <Loader2 className="w-4 h-4 animate-spin" /> Cargando operaciones…
    </div>
  )

  const cuotas     = ops.filter(o => o.tipo === 'cobro')
  const pendiente  = cuotas.filter(o => o.estado_cartera === 'pendiente')
    .reduce((s, o) => s + (o.valor ?? 0), 0)

  return (
    <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-ink-100">
        <h3 className="font-semibold text-ink-700 text-sm">
          Operaciones
          {ops.length > 0 && <span className="ml-2 text-xs font-normal text-ink-400">{ops.length}</span>}
        </h3>
        {pendiente > 0 && (
          <span className="text-xs text-ink-400">
            Por cobrar: <strong className="text-ink-700">{formatCOP(pendiente)}</strong>
          </span>
        )}
      </div>

      {ops.length === 0 ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-ink-400">Esta póliza aún no tiene operaciones registradas.</p>
          <p className="text-xs text-ink-400 mt-1">
            Las cuotas, renovaciones y cancelaciones aparecerán aquí automáticamente.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-cream-200">
          {ops.map(op => {
            const meta = TIPO_META[op.tipo] ?? TIPO_META.modificacion
            const Icon = meta.icon
            return (
              <li key={op.id} className="flex items-center gap-3 px-5 py-3">
                <span className={`flex-shrink-0 ${meta.color}`}><Icon className="w-4 h-4" /></span>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-ink-700">
                    {meta.label}
                    {op.numero_cuota != null && (
                      <span className="ml-1.5 text-ink-400 font-normal">#{op.numero_cuota}</span>
                    )}
                  </p>
                  <p className="text-xs text-ink-400 truncate">
                    {op.fecha_programada ? `Programada ${formatDate(op.fecha_programada)}` : 'Sin fecha programada'}
                    {op.fecha_pago && ` · Pagada ${formatDate(op.fecha_pago)}`}
                    {op.notas && ` · ${op.notas}`}
                  </p>
                </div>

                {op.valor != null && op.valor > 0 && (
                  <span className="text-sm font-medium text-ink-700 tabular-nums flex-shrink-0">
                    {formatCOP(op.valor)}
                  </span>
                )}
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${ESTADO_BADGE[op.estado_cartera]}`}>
                  {op.estado_cartera}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
