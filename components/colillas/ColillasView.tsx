'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase }             from '@/lib/supabase/client'
import { useWorkspace }         from '@/contexts/WorkspaceContext'
import { usePermissions }       from '@/contexts/PermissionsContext'
import {
  Upload, CheckCircle2, AlertTriangle, Clock,
  ChevronDown, ChevronRight, Loader2, Filter,
} from 'lucide-react'
import ImportColillasModal     from './ImportColillasModal'
import ColillaDetalle          from './ColillaDetalle'
import EstadoCuentaVendedor    from './EstadoCuentaVendedor'
import type { ColillaImportacion } from '@/types'

type TabKey = 'historial' | 'estado_cuenta'

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}
function formatDate(d: string) {
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function ColillasView() {
  const { currentWorkspace }      = useWorkspace()
  const { can }                   = usePermissions()

  const [tab, setTab]             = useState<TabKey>('historial')
  const [colillas, setColillas]   = useState<ColillaImportacion[]>([])
  const [loading, setLoading]     = useState(true)
  const [importModal, setImport]  = useState(false)
  const [detalleId, setDetalle]   = useState<string | null>(null)

  // Filtros
  const [filtroAse, setFiltroAse]      = useState('')
  const [filtroPer, setFiltroPer]      = useState('')
  const [filtroEst, setFiltroEst]      = useState<'todos' | 'borrador' | 'confirmada'>('todos')

  const puedeImportar = can('configuracion_editar_agencia')

  const cargar = useCallback(async () => {
    if (!currentWorkspace) return
    setLoading(true)
    let q = supabase
      .from('colillas_importacion')
      .select('*')
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false })

    if (filtroAse) q = q.ilike('aseguradora', `%${filtroAse}%`)
    if (filtroPer) q = q.eq('periodo', filtroPer)
    if (filtroEst !== 'todos') q = q.eq('estado', filtroEst)

    const { data } = await q
    setColillas((data ?? []) as ColillaImportacion[])
    setLoading(false)
  }, [currentWorkspace?.id, filtroAse, filtroPer, filtroEst])

  useEffect(() => { cargar() }, [cargar])

  if (detalleId) {
    return <ColillaDetalle colillaId={detalleId} onVolver={() => setDetalleId(null)} />
  }

  const setDetalleId = (id: string | null) => setDetalle(id)

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-800">Colillas de comisiones</h1>
          <p className="text-sm text-slate-500 mt-0.5">Importa y reconcilia pagos de aseguradoras</p>
        </div>
        {puedeImportar && (
          <button
            onClick={() => setImport(true)}
            className="flex items-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors"
          >
            <Upload className="w-4 h-4" />
            Importar colilla
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {([['historial', 'Historial'], ['estado_cuenta', 'Estado de cuenta']] as [TabKey, string][]).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === key ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'historial' && (
        <>
          {/* Filtros */}
          <div className="flex gap-3 flex-wrap">
            <input
              type="text"
              value={filtroAse}
              onChange={e => setFiltroAse(e.target.value)}
              placeholder="Aseguradora..."
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 w-40"
            />
            <input
              type="month"
              value={filtroPer}
              onChange={e => setFiltroPer(e.target.value)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <select
              value={filtroEst}
              onChange={e => setFiltroEst(e.target.value as typeof filtroEst)}
              className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            >
              <option value="todos">Todos los estados</option>
              <option value="confirmada">Confirmadas</option>
              <option value="borrador">Borrador</option>
            </select>
          </div>

          {/* Lista */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
            </div>
          ) : colillas.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Upload className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">Sin importaciones todavía</p>
              {puedeImportar && (
                <p className="text-xs mt-1">Haz clic en "Importar colilla" para comenzar</p>
              )}
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Aseguradora</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Período</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-medium">Conciliadas</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-medium">Sin match</th>
                    <th className="text-left px-4 py-3 text-slate-500 font-medium">Fecha</th>
                    <th className="text-center px-4 py-3 text-slate-500 font-medium">Estado</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {colillas.map(c => (
                    <tr key={c.id} className="hover:bg-slate-50 cursor-pointer" onClick={() => setDetalleId(c.id)}>
                      <td className="px-4 py-3 font-medium text-slate-700">{c.aseguradora}</td>
                      <td className="px-4 py-3 text-slate-600">{c.periodo}</td>
                      <td className="px-4 py-3 text-center text-emerald-600 font-medium">{c.conciliadas}</td>
                      <td className="px-4 py-3 text-center">
                        {c.no_encontradas > 0
                          ? <span className="text-amber-500 font-medium">{c.no_encontradas}</span>
                          : <span className="text-slate-300">—</span>
                        }
                      </td>
                      <td className="px-4 py-3 text-slate-500 text-xs">{formatDate(c.created_at)}</td>
                      <td className="px-4 py-3 text-center">
                        {c.estado === 'confirmada'
                          ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="w-3 h-3" /> Confirmada
                            </span>
                          : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                              <Clock className="w-3 h-3" /> Borrador
                            </span>
                        }
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        <ChevronRight className="w-4 h-4" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'estado_cuenta' && <EstadoCuentaVendedor />}

      {importModal && (
        <ImportColillasModal
          onClose={() => setImport(false)}
          onConfirmada={() => { cargar(); setImport(false) }}
        />
      )}
    </div>
  )
}
