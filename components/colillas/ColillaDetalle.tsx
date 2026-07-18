'use client'

import { useState, useEffect, useCallback } from 'react'
import { supabase }          from '@/lib/supabase/client'
import { useWorkspace }      from '@/contexts/WorkspaceContext'
import {
  ArrowLeft, CheckCircle2, AlertTriangle, Edit3, Loader2,
  Search, X, Trash2, Pencil, Plus,
} from 'lucide-react'
import PolizaQuickView from '@/components/polizas/PolizaQuickView'
import PolizaModal     from '@/components/polizas/PolizaModal'
import type { ColillaImportacion, ColillaLinea, Poliza } from '@/types'

function formatCOP(n: number | null) {
  if (n == null) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}
function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

interface Props {
  colillaId: string
  onVolver:  () => void
  onEliminada?: () => void
}

interface PolizaResult {
  id: string
  numero_poliza: string | null
  aseguradora: string
  ramo: string | null
  nombre_tomador: string | null
  fecha_fin: string | null
  cliente: { nombre: string; telefono: string | null; email: string | null } | null
}

// Subraya el fragmento que hizo match
function Hl({ text, q }: { text: string | null; q: string }) {
  if (!text) return <span className="text-slate-400">—</span>
  if (!q)    return <>{text}</>
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return <>{text}</>
  return (
    <>
      {text.slice(0, idx)}
      <span className="underline decoration-emerald-500 font-semibold text-slate-900">
        {text.slice(idx, idx + q.length)}
      </span>
      {text.slice(idx + q.length)}
    </>
  )
}

// ── Celda editable para líneas sin match ─────────────────────────────────────
function CeldaVincular({
  linea, workspaceId, aseguradora, onActualizada,
}: {
  linea: ColillaLinea
  workspaceId: string
  aseguradora: string
  onActualizada: (lineaId: string, polizaId: string | null, estado: string) => void
}) {
  const [abierto,     setAbierto]     = useState(false)
  const [busqueda,    setBusqueda]    = useState('')
  const [resultados,  setResultados]  = useState<PolizaResult[]>([])
  const [guardando,   setGuardando]   = useState(false)
  const [crearModal,  setCrearModal]  = useState(false)

  const polizaVinculada = (linea as unknown as { poliza: PolizaResult | null }).poliza

  // ── Búsqueda multi-campo ──────────────────────────────────────────
  const buscar = useCallback(async (query: string) => {
    setBusqueda(query)
    if (query.length < 2) { setResultados([]); return }
    const q = query.trim()

    const [{ data: byPol }, { data: byTom }] = await Promise.all([
      supabase.from('polizas')
        .select('id, numero_poliza, aseguradora, ramo, nombre_tomador, fecha_fin, cliente:clientes(nombre, telefono, email)')
        .eq('workspace_id', workspaceId)
        .ilike('numero_poliza', `%${q}%`)
        .limit(5),
      supabase.from('polizas')
        .select('id, numero_poliza, aseguradora, ramo, nombre_tomador, fecha_fin, cliente:clientes(nombre, telefono, email)')
        .eq('workspace_id', workspaceId)
        .ilike('nombre_tomador', `%${q}%`)
        .limit(5),
    ])

    const { data: clientes } = await supabase.from('clientes')
      .select('id')
      .eq('workspace_id', workspaceId)
      .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,email.ilike.%${q}%`)
      .limit(6)

    let byCliente: PolizaResult[] = []
    if (clientes?.length) {
      const ids = clientes.map((c: { id: string }) => c.id)
      const { data } = await supabase.from('polizas')
        .select('id, numero_poliza, aseguradora, ramo, nombre_tomador, fecha_fin, cliente:clientes(nombre, telefono, email)')
        .eq('workspace_id', workspaceId)
        .in('client_id', ids)
        .limit(5)
      byCliente = (data ?? []) as unknown as PolizaResult[]
    }

    const all  = [...(byPol ?? []), ...(byTom ?? []), ...byCliente] as PolizaResult[]
    const seen = new Set<string>()
    setResultados(all.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true }).slice(0, 8))
  }, [workspaceId])

  // ── Vincular a póliza existente ───────────────────────────────────
  const vincular = async (poliza: PolizaResult) => {
    setGuardando(true)
    const res = await fetch(`/api/colillas/${linea.colilla_id}/linea/${linea.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poliza_id: poliza.id }),
    })
    if (res.ok) onActualizada(linea.id, poliza.id, 'corregida_manual')
    setGuardando(false)
    setAbierto(false)
    setResultados([])
    setBusqueda('')
  }

  // ── Tras crear póliza nueva: buscar la más reciente y vincularla ──
  const handlePolizaCreada = async () => {
    setCrearModal(false)
    setGuardando(true)
    const { data } = await supabase
      .from('polizas')
      .select('id')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
    if (data?.id) {
      const res = await fetch(`/api/colillas/${linea.colilla_id}/linea/${linea.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ poliza_id: data.id }),
      })
      if (res.ok) onActualizada(linea.id, data.id, 'corregida_manual')
    }
    setGuardando(false)
    setAbierto(false)
  }

  const desvincular = async () => {
    setGuardando(true)
    const res = await fetch(`/api/colillas/${linea.colilla_id}/linea/${linea.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ poliza_id: null }),
    })
    if (res.ok) onActualizada(linea.id, null, 'no_encontrada')
    setGuardando(false)
  }

  if (guardando) return <Loader2 className="w-3.5 h-3.5 animate-spin text-slate-400" />

  // Ya vinculada manualmente
  if (polizaVinculada) {
    return (
      <div className="flex items-center gap-1">
        <span className="font-mono text-blue-700 text-xs">{polizaVinculada.numero_poliza}</span>
        <button onClick={desvincular} title="Quitar vínculo" className="text-slate-300 hover:text-red-400">
          <X className="w-3 h-3" />
        </button>
      </div>
    )
  }

  // Modo búsqueda abierto
  if (abierto) {
    // Prefill para PolizaModal en modo crear (sin id → insert)
    const preRelleno = {
      numero_poliza:  linea.numero_poliza_raw,
      nombre_tomador: linea.nombre_tomador ?? '',
      aseguradora:    aseguradora,
    } as unknown as Poliza

    return (
      <>
        <div className="relative">
          <div className="flex items-center gap-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
              <input
                autoFocus
                type="text"
                value={busqueda}
                onChange={e => buscar(e.target.value)}
                placeholder="N° póliza, nombre, teléfono..."
                className="pl-6 pr-2 py-1 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-400 w-44"
              />
            </div>
            <button onClick={() => { setAbierto(false); setResultados([]) }} className="text-slate-400 hover:text-slate-600">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Dropdown resultados */}
          <div className="absolute z-20 left-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-xl w-64 max-h-56 overflow-y-auto">
            {resultados.map(p => {
              const c      = p.cliente
              const tomador = p.nombre_tomador || c?.nombre
              const q       = busqueda
              const vigencia = p.fecha_fin
                ? new Date(p.fecha_fin).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })
                : null
              return (
                <button
                  key={p.id}
                  onClick={() => vincular(p)}
                  className="w-full text-left px-3 py-2 hover:bg-emerald-50 border-b border-slate-100 last:border-0 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[11px] font-semibold text-slate-800">
                      <Hl text={p.numero_poliza} q={q} />
                    </span>
                    <span className="text-[10px] text-slate-400 shrink-0">{p.aseguradora}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-0.5">
                    <span className="text-[11px] text-slate-600 truncate">
                      <Hl text={tomador ?? null} q={q} />
                    </span>
                    {p.ramo && <span className="text-[10px] text-slate-400 shrink-0">{p.ramo}</span>}
                  </div>
                  {(c?.telefono || c?.email) && (
                    <p className="text-[10px] text-slate-400 mt-0.5 truncate">
                      <Hl text={c?.telefono ?? c?.email ?? null} q={q} />
                    </p>
                  )}
                  {vigencia && <p className="text-[10px] text-slate-400">Vence: {vigencia}</p>}
                </button>
              )
            })}

            {/* Opción crear póliza — siempre visible al final */}
            <button
              onClick={() => setCrearModal(true)}
              className="w-full flex items-center gap-2 px-3 py-2 text-[11px] text-emerald-700 font-medium hover:bg-emerald-50 border-t border-slate-100 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Crear póliza nueva
            </button>
          </div>
        </div>

        {/* Modal de creación */}
        {crearModal && (
          <PolizaModal
            poliza={preRelleno}
            onClose={() => setCrearModal(false)}
            onSaved={handlePolizaCreada}
          />
        )}
      </>
    )
  }

  // Número raw en amarillo + lápiz para abrir búsqueda
  return (
    <button
      onClick={() => setAbierto(true)}
      title="Vincular a póliza CRM"
      className="group flex items-center gap-1.5 text-xs font-mono text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2 py-0.5 rounded-md transition-colors"
    >
      <span>{linea.numero_poliza_raw}</span>
      <Pencil className="w-3 h-3 text-amber-400 group-hover:text-amber-600 shrink-0" />
    </button>
  )
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function ColillaDetalle({ colillaId, onVolver, onEliminada }: Props) {
  const { currentWorkspace, isAdmin, isSupervisor } = useWorkspace()
  const [colilla, setColilla]     = useState<ColillaImportacion | null>(null)
  const [lineas, setLineas]       = useState<ColillaLinea[]>([])
  const [loading, setLoading]     = useState(true)
  const [eliminando, setEliminando] = useState(false)
  const [filtro, setFiltro]       = useState<'todas' | 'conciliada' | 'no_encontrada' | 'corregida_manual'>('todas')
  const [quickViewId, setQuickViewId] = useState<string | null>(null)

  const puedeEditar = isAdmin || isSupervisor

  const cargar = useCallback(async () => {
    setLoading(true)
    const [{ data: col }, { data: lin }] = await Promise.all([
      supabase.from('colillas_importacion').select('*').eq('id', colillaId).single(),
      supabase.from('colilla_lineas')
        .select('*, poliza:polizas(id, numero_poliza, aseguradora, ramo)')
        .eq('colilla_id', colillaId)
        .order('estado_conciliacion')   // sin-match primero
        .order('created_at'),
    ])
    setColilla(col as ColillaImportacion)
    setLineas((lin ?? []) as unknown as ColillaLinea[])
    setLoading(false)
  }, [colillaId])

  useEffect(() => { cargar() }, [cargar])

  const handleActualizada = (lineaId: string, polizaId: string | null, estado: string) => {
    setLineas(prev => prev.map(l =>
      l.id === lineaId
        ? { ...l, poliza_id: polizaId, estado_conciliacion: estado as ColillaLinea['estado_conciliacion'] }
        : l
    ))
    // Refrescar contadores
    cargar()
  }

  const handleEliminar = async () => {
    if (!confirm(`¿Eliminar esta importación (${colilla?.aseguradora} · ${colilla?.periodo})?\nSe restaurarán los valores de comisión anteriores en las pólizas vinculadas.`)) return
    if (!currentWorkspace) return
    setEliminando(true)
    try {
      const res = await fetch(`/api/colillas/${colillaId}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspace_id: currentWorkspace.id }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[eliminar colilla detalle]', err)
        alert('Error al eliminar la importación')
        return
      }
      onEliminada?.()
      onVolver()
    } finally {
      setEliminando(false)
    }
  }

  const lineasFiltradas = filtro === 'todas'
    ? lineas
    : lineas.filter(l => l.estado_conciliacion === filtro)

  const totalComision = lineas
    .filter(l => l.estado_conciliacion !== 'no_encontrada')
    .reduce((s, l) => s + (l.valor_comision ?? 0), 0)

  const sinMatchCount = lineas.filter(l => l.estado_conciliacion === 'no_encontrada').length

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    )
  }

  if (!colilla) return null

  return (
    <div className="p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={onVolver} className="text-slate-400 hover:text-slate-600">
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-slate-800">
              {colilla.aseguradora} · {colilla.periodo}
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              {colilla.estado === 'confirmada'
                ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-700"><CheckCircle2 className="w-3 h-3" /> Confirmada</span>
                : <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">Borrador</span>
              }
              <span className="text-xs text-slate-400">{colilla.archivo_nombre}</span>
            </div>
          </div>
        </div>

        {/* Botón eliminar */}
        {puedeEditar && (
          <button
            onClick={handleEliminar}
            disabled={eliminando}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-500 border border-slate-200 hover:border-red-200 px-3 py-1.5 rounded-lg transition-colors"
          >
            {eliminando ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
            Eliminar importación
          </button>
        )}
      </div>

      {/* Aviso de líneas sin match editables */}
      {sinMatchCount > 0 && puedeEditar && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
          <span>
            <strong>{sinMatchCount} línea{sinMatchCount > 1 ? 's' : ''} sin póliza vinculada.</strong>{' '}
            Haz clic en <em>"Vincular"</em> para asignarlas manualmente.
          </span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total',       value: colilla.total_lineas,      color: 'slate' },
          { label: 'Conciliadas', value: colilla.conciliadas,       color: 'emerald' },
          { label: 'Corregidas',  value: colilla.corregidas_manual, color: 'blue' },
          { label: 'Sin match',   value: colilla.no_encontradas,    color: colilla.no_encontradas > 0 ? 'amber' : 'slate' },
        ].map(s => (
          <div key={s.label} className={`bg-${s.color}-50 border border-${s.color}-200 rounded-xl p-3 text-center`}>
            <p className={`text-xl font-bold text-${s.color}-600`}>{s.value}</p>
            <p className={`text-xs text-${s.color}-600 mt-0.5`}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-600">
          Total comisiones: <span className="font-semibold text-slate-800">{formatCOP(totalComision)}</span>
        </p>
        <div className="flex gap-1 bg-slate-100 rounded-lg p-1 text-xs">
          {(['todas', 'no_encontrada', 'conciliada', 'corregida_manual'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`px-3 py-1.5 rounded-md font-medium transition-colors ${filtro === f ? 'bg-white text-slate-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              {f === 'todas' ? 'Todas' : f === 'no_encontrada' ? `Sin match${sinMatchCount > 0 ? ` (${sinMatchCount})` : ''}` : f === 'conciliada' ? 'Conciliadas' : 'Corregidas'}
            </button>
          ))}
        </div>
      </div>

      {/* Tabla de líneas */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-y-auto max-h-[500px]">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">N° póliza (colilla)</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Tomador</th>
                <th className="text-right px-4 py-3 text-slate-500 font-medium">Comisión</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Fecha pago</th>
                <th className="text-left px-4 py-3 text-slate-500 font-medium">Póliza CRM</th>
                <th className="text-center px-4 py-3 text-slate-500 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lineasFiltradas.map(l => (
                <tr key={l.id} className={`hover:bg-slate-50 ${l.estado_conciliacion === 'no_encontrada' ? 'bg-amber-50/40' : ''}`}>
                  <td className="px-4 py-3 font-mono text-xs text-slate-700">{l.numero_poliza_raw}</td>
                  <td className="px-4 py-3 text-slate-600 max-w-[160px] truncate">{l.nombre_tomador ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700">{formatCOP(l.valor_comision)}</td>
                  <td className="px-4 py-3 text-xs text-slate-500">{formatDate(l.fecha_pago)}</td>
                  <td className="px-4 py-3 text-xs">
                    {l.estado_conciliacion === 'no_encontrada' && puedeEditar && currentWorkspace ? (
                      /* Sin match — número raw en amarillo + lápiz para vincular */
                      <CeldaVincular linea={l} workspaceId={currentWorkspace.id} aseguradora={colilla.aseguradora} onActualizada={handleActualizada} />
                    ) : l.poliza_id && l.poliza ? (
                      /* Vinculada — clickeable para abrir QuickView */
                      <button
                        onClick={() => setQuickViewId(l.poliza_id)}
                        className={`font-mono hover:underline underline-offset-2 transition-colors ${
                          l.estado_conciliacion === 'corregida_manual'
                            ? 'text-blue-600 hover:text-blue-800'
                            : 'text-emerald-600 hover:text-emerald-800'
                        }`}
                      >
                        {(l.poliza as { numero_poliza: string | null }).numero_poliza}
                      </button>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {l.estado_conciliacion === 'conciliada'      && <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />}
                    {l.estado_conciliacion === 'no_encontrada'   && <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />}
                    {l.estado_conciliacion === 'corregida_manual' && <Edit3 className="w-4 h-4 text-blue-400 mx-auto" />}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {lineasFiltradas.length === 0 && (
            <div className="text-center py-8 text-slate-400 text-sm">Sin líneas para este filtro</div>
          )}
        </div>
      </div>

      {quickViewId && (
        <PolizaQuickView
          polizaId={quickViewId}
          onClose={() => setQuickViewId(null)}
        />
      )}
    </div>
  )
}
