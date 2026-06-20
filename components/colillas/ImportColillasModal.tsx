'use client'

import { useState, useRef, useCallback } from 'react'
import { supabase }        from '@/lib/supabase/client'
import { useWorkspace }    from '@/contexts/WorkspaceContext'
import {
  X, Upload, CheckCircle2, AlertTriangle, Loader2,
  ChevronRight, ChevronLeft, Search, FileText,
} from 'lucide-react'
import type { LineaReconciliada } from '@/lib/colillas/reconciliar'
import { ASEGURADORAS_DISPONIBLES, type AseguradoraKey } from '@/lib/colillas/parsers'

type Paso = 1 | 2 | 3 | 4

interface Stats {
  total: number
  conciliadas: number
  noEncontradas: number
  totalComision: number
}

interface Props {
  onClose: () => void
  onConfirmada: () => void
}

const cls = 'border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 w-full'

function formatCOP(n: number) {
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}

// ─── Paso 1: Subir archivo ────────────────────────────────────────────────────
function PasoSubir({
  aseguradora, setAseguradora, periodo, setPeriodo,
  archivo, setArchivo, onParsear, cargando, error,
}: {
  aseguradora: AseguradoraKey | ''; setAseguradora: (v: AseguradoraKey) => void
  periodo: string; setPeriodo: (v: string) => void
  archivo: File | null; setArchivo: (f: File | null) => void
  onParsear: () => void; cargando: boolean; error: string
}) {
  const inputRef = useRef<HTMLInputElement>(null)

  const es48Horas = aseguradora === '48 HORAS'

  return (
    <div className="space-y-5">
      {es48Horas && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
          <span>
            Las colillas de <strong>48 Horas</strong> usan <strong>VOUCHER</strong> en lugar de número de póliza.
            Todas las líneas requerirán vinculación manual en el paso de revisión.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-slate-500 mb-1">Aseguradora *</label>
          <select value={aseguradora} onChange={e => setAseguradora(e.target.value as AseguradoraKey)} className={cls}>
            <option value="">Seleccionar...</option>
            {ASEGURADORAS_DISPONIBLES.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs text-slate-500 mb-1">Período *</label>
          <input
            type="month"
            value={periodo}
            onChange={e => setPeriodo(e.target.value)}
            className={cls}
          />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">Archivo *</label>
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={e => e.preventDefault()}
          onDrop={e => {
            e.preventDefault()
            const f = e.dataTransfer.files[0]
            if (f) setArchivo(f)
          }}
          className="border-2 border-dashed border-slate-200 rounded-xl p-8 text-center cursor-pointer hover:border-emerald-400 hover:bg-emerald-50 transition-colors"
        >
          {archivo ? (
            <div className="flex items-center justify-center gap-2 text-sm text-slate-700">
              <FileText className="w-5 h-5 text-emerald-500" />
              <span className="font-medium">{archivo.name}</span>
              <span className="text-slate-400">({(archivo.size / 1024).toFixed(0)} KB)</span>
            </div>
          ) : (
            <div className="text-slate-400">
              <Upload className="w-8 h-8 mx-auto mb-2" />
              <p className="text-sm">Arrastra el archivo aquí o haz clic para seleccionar</p>
              <p className="text-xs mt-1">CSV, PDF, XLS, XLSX · Máx. 10 MB</p>
            </div>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.pdf,.xls,.xlsx"
          className="hidden"
          onChange={e => setArchivo(e.target.files?.[0] ?? null)}
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <button
        onClick={onParsear}
        disabled={!archivo || !aseguradora || !periodo || cargando}
        className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
      >
        {cargando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
        {cargando ? 'Procesando...' : 'Parsear archivo'}
      </button>
    </div>
  )
}

// ─── Paso 2: Preview ──────────────────────────────────────────────────────────
function PasoPreview({
  lineas, stats, aseguradora, periodo,
  onSiguiente, onVolver,
}: {
  lineas: LineaReconciliada[]
  stats: Stats
  aseguradora: string
  periodo: string
  onSiguiente: () => void
  onVolver: () => void
}) {
  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-emerald-600">{stats.conciliadas}</p>
          <p className="text-xs text-emerald-700 mt-0.5">Conciliadas</p>
        </div>
        <div className={`border rounded-xl p-3 text-center ${stats.noEncontradas > 0 ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-200'}`}>
          <p className={`text-2xl font-bold ${stats.noEncontradas > 0 ? 'text-amber-600' : 'text-slate-400'}`}>{stats.noEncontradas}</p>
          <p className={`text-xs mt-0.5 ${stats.noEncontradas > 0 ? 'text-amber-700' : 'text-slate-400'}`}>Sin match</p>
        </div>
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-center">
          <p className="text-sm font-bold text-slate-700">{formatCOP(stats.totalComision)}</p>
          <p className="text-xs text-slate-500 mt-0.5">Total comisión</p>
        </div>
      </div>

      <p className="text-xs text-slate-500 font-medium">{aseguradora} · {periodo} · {stats.total} líneas</p>

      {/* Tabla de preview */}
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-y-auto max-h-64">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-slate-500 font-medium">Póliza</th>
                <th className="text-left px-3 py-2 text-slate-500 font-medium">Tomador</th>
                <th className="text-right px-3 py-2 text-slate-500 font-medium">Comisión</th>
                <th className="text-center px-3 py-2 text-slate-500 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {lineas.map((l, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2 font-mono text-slate-700">{l.numero_poliza_raw}</td>
                  <td className="px-3 py-2 text-slate-600 max-w-[140px] truncate">{l.nombre_tomador ?? '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{l.valor_comision != null ? formatCOP(l.valor_comision) : '—'}</td>
                  <td className="px-3 py-2 text-center">
                    {l.estado_conciliacion === 'conciliada'
                      ? <CheckCircle2 className="w-4 h-4 text-emerald-500 mx-auto" />
                      : <AlertTriangle className="w-4 h-4 text-amber-400 mx-auto" />
                    }
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex gap-3">
        <button onClick={onVolver} className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600 hover:bg-slate-50">
          <ChevronLeft className="w-4 h-4" /> Cambiar archivo
        </button>
        <button onClick={onSiguiente} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
          {stats.noEncontradas > 0 ? 'Revisar sin match' : 'Confirmar'} <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

// ─── Paso 3: Revisar líneas sin match ────────────────────────────────────────
function PasoRevisar({
  lineas, setLineas, aseguradora, workspaceId, onSiguiente, onVolver, guardando,
}: {
  lineas: LineaReconciliada[]
  setLineas: (l: LineaReconciliada[]) => void
  aseguradora: string
  workspaceId: string
  onSiguiente: () => void
  onVolver: () => void
  guardando: boolean
}) {
  const sinMatch = lineas.filter(l => l.estado_conciliacion !== 'conciliada')
  const [busquedas, setBusquedas] = useState<Record<number, string>>({})
  type PolizaResultado = {
    id: string
    numero_poliza: string | null
    aseguradora: string
    ramo: string | null
    nombre_tomador: string | null
    fecha_inicio: string | null
    fecha_fin: string | null
    cliente: { nombre: string } | null
  }
  const [resultados, setResultados] = useState<Record<number, PolizaResultado[]>>({})
  const [notas, setNotas] = useState<Record<number, string>>({})

  const buscar = useCallback(async (idx: number, query: string) => {
    setBusquedas(prev => ({ ...prev, [idx]: query }))
    if (query.length < 3) { setResultados(prev => ({ ...prev, [idx]: [] })); return }
    const { data } = await supabase
      .from('polizas')
      .select('id, numero_poliza, aseguradora, ramo, nombre_tomador, fecha_inicio, fecha_fin, cliente:clientes(nombre)')
      .eq('workspace_id', workspaceId)
      .ilike('numero_poliza', `%${query}%`)
      .limit(8)
    setResultados(prev => ({ ...prev, [idx]: (data ?? []) as unknown as PolizaResultado[] }))
  }, [supabase, workspaceId])

  const vincular = (lineaIdx: number, polizaId: string, numeroPoliza: string) => {
    const globalIdx = lineas.findIndex(
      (l, i) => l.estado_conciliacion !== 'conciliada' &&
        sinMatch.indexOf(l) === lineaIdx
    )
    // Encontrar índice global correcto
    let count = 0
    for (let i = 0; i < lineas.length; i++) {
      if (lineas[i].estado_conciliacion !== 'conciliada') {
        if (count === lineaIdx) {
          const updated = [...lineas]
          updated[i] = { ...updated[i], poliza_id: polizaId, estado_conciliacion: 'corregida_manual' }
          setLineas(updated)
          break
        }
        count++
      }
    }
    setResultados(prev => ({ ...prev, [lineaIdx]: [] }))
    setBusquedas(prev => ({ ...prev, [lineaIdx]: numeroPoliza }))
  }

  const desvincular = (lineaIdx: number) => {
    let count = 0
    for (let i = 0; i < lineas.length; i++) {
      if (lineas[i].estado_conciliacion !== 'conciliada' || lineas[i].estado_conciliacion === 'corregida_manual') {
        if (count === lineaIdx) {
          const updated = [...lineas]
          updated[i] = { ...updated[i], poliza_id: null, estado_conciliacion: 'no_encontrada' }
          setLineas(updated)
          break
        }
        count++
      }
    }
  }

  const es48Horas = aseguradora === '48 HORAS'

  return (
    <div className="space-y-4">
      {es48Horas && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
          <span>48 Horas usa <strong>VOUCHER</strong>, no número de póliza. Vincula manualmente cada línea.</span>
        </div>
      )}

      {sinMatch.length === 0 ? (
        <div className="text-center py-8 text-slate-400 text-sm">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          Todas las líneas están conciliadas
        </div>
      ) : (
        <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
          {sinMatch.map((linea, idx) => (
            <div key={idx} className={`border rounded-xl p-3 ${linea.estado_conciliacion === 'corregida_manual' ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs font-mono font-semibold text-slate-700">{linea.numero_poliza_raw}</p>
                  {linea.nombre_tomador && <p className="text-xs text-slate-500">{linea.nombre_tomador}</p>}
                </div>
                <div className="text-right">
                  <p className="text-xs font-semibold text-slate-700">{linea.valor_comision != null ? formatCOP(linea.valor_comision) : '—'}</p>
                  {linea.estado_conciliacion === 'corregida_manual'
                    ? <span className="text-xs text-emerald-600 font-medium">✓ Vinculada</span>
                    : <span className="text-xs text-amber-600">Sin match</span>
                  }
                </div>
              </div>

              {/* Buscador de póliza */}
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    type="text"
                    value={busquedas[idx] ?? ''}
                    onChange={e => buscar(idx, e.target.value)}
                    placeholder="Buscar póliza en CRM..."
                    className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                  />
                </div>
                {(resultados[idx]?.length ?? 0) > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-52 overflow-y-auto">
                    {resultados[idx].map(p => {
                      const cliente = (p.cliente as { nombre: string } | null)
                      const tomador = p.nombre_tomador || cliente?.nombre
                      const vigencia = p.fecha_fin
                        ? new Date(p.fecha_fin).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })
                        : null
                      return (
                        <button
                          key={p.id}
                          onClick={() => vincular(idx, p.id, p.numero_poliza ?? '')}
                          className="w-full text-left px-3 py-2.5 hover:bg-emerald-50 border-b border-slate-100 last:border-0 transition-colors"
                        >
                          {/* Fila 1: número + aseguradora */}
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold text-slate-800">{p.numero_poliza}</span>
                            <span className="text-[10px] font-medium text-slate-400 shrink-0">{p.aseguradora}</span>
                          </div>
                          {/* Fila 2: tomador + ramo */}
                          <div className="flex items-center justify-between gap-2 mt-0.5">
                            <span className="text-[11px] text-slate-600 truncate">{tomador ?? '—'}</span>
                            {p.ramo && <span className="text-[10px] text-slate-400 shrink-0 truncate max-w-[80px]">{p.ramo}</span>}
                          </div>
                          {/* Fila 3: vigencia */}
                          {vigencia && (
                            <p className="text-[10px] text-slate-400 mt-0.5">Vence: {vigencia}</p>
                          )}
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {linea.estado_conciliacion === 'corregida_manual' && (
                <button onClick={() => desvincular(idx)} className="mt-1 text-xs text-slate-400 hover:text-red-500">
                  × Quitar vinculación
                </button>
              )}

              <input
                type="text"
                value={notas[idx] ?? ''}
                onChange={e => setNotas(prev => ({ ...prev, [idx]: e.target.value }))}
                placeholder="Nota opcional..."
                className="mt-2 w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-3">
        <button onClick={onVolver} className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600 hover:bg-slate-50">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <button onClick={onSiguiente} disabled={guardando} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
          {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
          {guardando ? 'Guardando...' : 'Confirmar importación'}
        </button>
      </div>
    </div>
  )
}

// ─── Paso 4: Confirmado ───────────────────────────────────────────────────────
function PasoConfirmado({
  stats, aseguradora, periodo, onNueva, onHistorial,
}: {
  stats: Stats; aseguradora: string; periodo: string
  onNueva: () => void; onHistorial: () => void
}) {
  return (
    <div className="text-center space-y-4 py-4">
      <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto">
        <CheckCircle2 className="w-8 h-8 text-emerald-500" />
      </div>
      <div>
        <h3 className="text-lg font-semibold text-slate-800">Colilla confirmada</h3>
        <p className="text-sm text-slate-500 mt-1">{aseguradora} · {periodo}</p>
      </div>
      <div className="bg-slate-50 rounded-xl p-4 text-sm space-y-1">
        <div className="flex justify-between">
          <span className="text-slate-500">Total líneas</span>
          <span className="font-medium">{stats.total}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-slate-500">Conciliadas automático</span>
          <span className="font-medium text-emerald-600">{stats.conciliadas}</span>
        </div>
        {stats.noEncontradas > 0 && (
          <div className="flex justify-between">
            <span className="text-slate-500">Sin póliza vinculada</span>
            <span className="font-medium text-amber-600">{stats.noEncontradas}</span>
          </div>
        )}
        <div className="flex justify-between pt-2 border-t border-slate-200 mt-2">
          <span className="text-slate-500">Total comisiones registradas</span>
          <span className="font-semibold text-slate-700">{formatCOP(stats.totalComision)}</span>
        </div>
      </div>
      <div className="flex gap-3">
        <button onClick={onHistorial} className="flex-1 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600 hover:bg-slate-50">
          Ver historial
        </button>
        <button onClick={onNueva} className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-lg">
          Importar otra
        </button>
      </div>
    </div>
  )
}

// ─── Modal principal ──────────────────────────────────────────────────────────
export default function ImportColillasModal({ onClose, onConfirmada }: Props) {
  const { currentWorkspace } = useWorkspace()

  const [paso, setPaso]           = useState<Paso>(1)
  const [aseguradora, setAse]     = useState<AseguradoraKey | ''>('')
  const [periodo, setPeriodo]     = useState(() => {
    const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const [archivo, setArchivo]     = useState<File | null>(null)
  const [lineas, setLineas]       = useState<LineaReconciliada[]>([])
  const [stats, setStats]         = useState<Stats>({ total: 0, conciliadas: 0, noEncontradas: 0, totalComision: 0 })
  const [colillaId, setColillaId] = useState<string | null>(null)
  const [cargando, setCargando]   = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [error, setError]         = useState('')

  const pasoLabels = ['Subir', 'Preview', 'Revisar', 'Listo']

  const handleParsear = async () => {
    if (!archivo || !aseguradora || !periodo || !currentWorkspace) return
    setCargando(true); setError('')
    try {
      const fd = new FormData()
      fd.append('archivo', archivo)
      fd.append('aseguradora', aseguradora)
      fd.append('workspace_id', currentWorkspace.id)

      const res  = await fetch('/api/colillas/parsear', { method: 'POST', body: fd })
      const json = await res.json()
      if (!res.ok) { setError(json.error ?? 'Error procesando archivo'); return }

      setLineas(json.lineas)
      setStats(json.stats)
      setPaso(2)
    } finally {
      setCargando(false)
    }
  }

  const handleConfirmar = async () => {
    if (!currentWorkspace) return
    setGuardando(true)
    try {
      // 1. Crear colilla en borrador
      const resCrear = await fetch('/api/colillas/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id:   currentWorkspace.id,
          aseguradora,
          periodo,
          archivo_nombre: archivo?.name ?? 'desconocido',
          lineas,
        }),
      })
      const jsonCrear = await resCrear.json()
      if (!resCrear.ok) { setError(jsonCrear.error ?? 'Error guardando colilla'); return }

      const nuevoColillaId = jsonCrear.colilla_id

      // 2. Confirmar (RPC atómico)
      const resConf = await fetch(`/api/colillas/${nuevoColillaId}/confirmar`, { method: 'POST' })
      const jsonConf = await resConf.json()
      if (!resConf.ok) { setError(jsonConf.error ?? 'Error confirmando'); return }

      // Recalcular stats finales
      const conciliadas   = lineas.filter(l => l.estado_conciliacion === 'conciliada').length
      const corregidas    = lineas.filter(l => l.estado_conciliacion === 'corregida_manual').length
      const noEncontradas = lineas.filter(l => l.estado_conciliacion === 'no_encontrada').length
      setStats({ total: lineas.length, conciliadas: conciliadas + corregidas, noEncontradas, totalComision: stats.totalComision })
      setColillaId(nuevoColillaId)
      setPaso(4)
      onConfirmada()
    } finally {
      setGuardando(false)
    }
  }

  const resetear = () => {
    setPaso(1); setArchivo(null); setLineas([]); setError('')
    setStats({ total: 0, conciliadas: 0, noEncontradas: 0, totalComision: 0 })
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-800">Importar colilla de comisiones</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Stepper */}
        {paso < 4 && (
          <div className="flex items-center px-6 pt-4 gap-2">
            {pasoLabels.slice(0, 3).map((label, i) => {
              const num = (i + 1) as Paso
              const active  = paso === num
              const done    = paso > num
              return (
                <div key={i} className="flex items-center gap-2 flex-1">
                  <div className={`flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold shrink-0 ${
                    done   ? 'bg-emerald-500 text-white' :
                    active ? 'bg-emerald-500 text-white' :
                             'bg-slate-100 text-slate-400'
                  }`}>
                    {done ? '✓' : num}
                  </div>
                  <span className={`text-xs ${active ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{label}</span>
                  {i < 2 && <div className="flex-1 h-px bg-slate-200" />}
                </div>
              )
            })}
          </div>
        )}

        {/* Contenido */}
        <div className="p-6 overflow-y-auto flex-1">
          {paso === 1 && (
            <PasoSubir
              aseguradora={aseguradora} setAseguradora={setAse}
              periodo={periodo} setPeriodo={setPeriodo}
              archivo={archivo} setArchivo={setArchivo}
              onParsear={handleParsear} cargando={cargando} error={error}
            />
          )}
          {paso === 2 && (
            <PasoPreview
              lineas={lineas} stats={stats}
              aseguradora={aseguradora} periodo={periodo}
              onSiguiente={() => lineas.some(l => l.estado_conciliacion === 'no_encontrada') ? setPaso(3) : handleConfirmar()}
              onVolver={() => setPaso(1)}
            />
          )}
          {paso === 3 && currentWorkspace && (
            <PasoRevisar
              lineas={lineas} setLineas={setLineas}
              aseguradora={aseguradora}
              workspaceId={currentWorkspace.id}
              onSiguiente={handleConfirmar}
              onVolver={() => setPaso(2)}
              guardando={guardando}
            />
          )}
          {paso === 4 && (
            <PasoConfirmado
              stats={stats} aseguradora={aseguradora} periodo={periodo}
              onNueva={resetear}
              onHistorial={onClose}
            />
          )}
        </div>
      </div>
    </div>
  )
}
