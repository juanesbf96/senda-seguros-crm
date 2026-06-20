'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase }          from '@/lib/supabase/client'
import { useWorkspace }      from '@/contexts/WorkspaceContext'
import { Loader2, TrendingDown, TrendingUp, Minus } from 'lucide-react'

interface FilaEstado {
  vendedor_id: string | null
  vendedor_nombre: string | null
  periodo: string
  aseguradora: string
  comision_esperada: number
  comision_recibida: number
  saldo_pendiente: number
  asesor_pago_estado: string | null
  num_polizas: number
}

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

export default function EstadoCuentaVendedor() {
  const { currentWorkspace } = useWorkspace()

  const [filas, setFilas]       = useState<FilaEstado[]>([])
  const [loading, setLoading]   = useState(true)
  const [filtroPer, setFiltroPer] = useState('')
  const [filtroVen, setFiltroVen] = useState('')

  const cargar = useCallback(async () => {
    if (!currentWorkspace) return
    setLoading(true)
    const { data } = await supabase.rpc('get_estado_cuenta_vendedor', {
      p_workspace_id: currentWorkspace.id,
      p_vendedor_id:  filtroVen || null,
      p_periodo:      filtroPer || null,
    })
    setFilas((data ?? []) as FilaEstado[])
    setLoading(false)
  }, [currentWorkspace?.id, filtroPer, filtroVen])

  useEffect(() => { cargar() }, [cargar])

  // Vendedores únicos para el filtro
  const vendedoresUnicos = [...new Map(
    filas.filter(f => f.vendedor_id).map(f => [f.vendedor_id, f.vendedor_nombre])
  ).entries()].map(([id, nombre]) => ({ id: id!, nombre: nombre ?? '' }))

  const totalEsperado  = filas.reduce((s, f) => s + f.comision_esperada, 0)
  const totalRecibido  = filas.reduce((s, f) => s + f.comision_recibida, 0)
  const totalPendiente = filas.reduce((s, f) => s + f.saldo_pendiente, 0)

  return (
    <div className="space-y-5">
      {/* Resumen global */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 mb-1">Total esperado</p>
          <p className="text-xl font-bold text-slate-700">{formatCOP(totalEsperado)}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <p className="text-xs text-emerald-600 mb-1">Total recibido</p>
          <p className="text-xl font-bold text-emerald-700">{formatCOP(totalRecibido)}</p>
        </div>
        <div className={`border rounded-xl p-4 ${totalPendiente > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <p className={`text-xs mb-1 ${totalPendiente > 0 ? 'text-amber-600' : 'text-slate-500'}`}>Saldo pendiente</p>
          <p className={`text-xl font-bold ${totalPendiente > 0 ? 'text-amber-700' : 'text-slate-400'}`}>{formatCOP(totalPendiente)}</p>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex gap-3 flex-wrap">
        <input
          type="month"
          value={filtroPer}
          onChange={e => setFiltroPer(e.target.value)}
          placeholder="Período"
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        />
        <select
          value={filtroVen}
          onChange={e => setFiltroVen(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
        >
          <option value="">Todos los vendedores</option>
          {vendedoresUnicos.map(v => (
            <option key={v.id} value={v.id}>{v.nombre}</option>
          ))}
        </select>
      </div>

      {/* Tabla */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
      ) : filas.length === 0 ? (
        <div className="text-center py-12 text-slate-400 text-sm">
          Sin datos. Importa y confirma colillas para ver el estado de cuenta.
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Vendedor</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Período</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Aseguradora</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Esperado</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Recibido</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Saldo</th>
                <th className="text-center px-4 py-3 text-slate-500 font-medium">Asesor</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((f, i) => {
                const saldoNeg = f.saldo_pendiente > 0
                const saldoPos = f.saldo_pendiente < 0
                return (
                  <tr key={i} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-medium text-slate-700">{f.vendedor_nombre ?? 'Sin asignar'}</td>
                    <td className="px-4 py-3 text-slate-600">{f.periodo}</td>
                    <td className="px-4 py-3 text-slate-600">{f.aseguradora}</td>
                    <td className="px-4 py-3 text-right text-slate-600">{formatCOP(f.comision_esperada)}</td>
                    <td className="px-4 py-3 text-right text-emerald-700 font-medium">{formatCOP(f.comision_recibida)}</td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold inline-flex items-center gap-1 ${saldoNeg ? 'text-amber-600' : saldoPos ? 'text-emerald-600' : 'text-slate-400'}`}>
                        {saldoNeg && <TrendingDown className="w-3.5 h-3.5" />}
                        {saldoPos && <TrendingUp   className="w-3.5 h-3.5" />}
                        {!saldoNeg && !saldoPos && <Minus className="w-3.5 h-3.5" />}
                        {formatCOP(Math.abs(f.saldo_pendiente))}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {f.asesor_pago_estado === 'pagada' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Liquidado</span>
                      )}
                      {f.asesor_pago_estado === 'pendiente' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 font-medium">Pendiente</span>
                      )}
                      {f.asesor_pago_estado === 'no_aplica' && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">Agencia</span>
                      )}
                      {!f.asesor_pago_estado && <span className="text-slate-300">—</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
