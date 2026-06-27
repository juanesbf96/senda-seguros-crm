'use client'

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase }        from '@/lib/supabase/client'
import { useWorkspace }    from '@/contexts/WorkspaceContext'
import {
  X, Upload, CheckCircle2, AlertTriangle, Loader2,
  ChevronRight, ChevronLeft, Search, FileText, HelpCircle, Plus, Clock,
} from 'lucide-react'
import PolizaModal from '@/components/polizas/PolizaModal'
import type { LineaReconciliada } from '@/lib/colillas/reconciliar'
import type { Poliza } from '@/types'
import { ASEGURADORAS_DISPONIBLES, type AseguradoraKey } from '@/lib/colillas/parsers'

type Paso = 1 | 2 | 3 | 4

interface Stats {
  total: number
  conciliadas: number
  probables: number
  noEncontradas: number
  totalComision: number
}

interface ActualizarNumero {
  poliza_id:    string
  nuevo_numero: string
}

// ── Highlight: subraya la parte que hizo match ────────────────────────────────
function Hl({ text, q }: { text: string | null; q: string }) {
  if (!text) return <span className="text-slate-400">—</span>
  if (!q) return <>{text}</>
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
  lineas, setLineas, aseguradora, workspaceId, onConfirmar, onVolver, guardando,
}: {
  lineas:      LineaReconciliada[]
  setLineas:   (l: LineaReconciliada[]) => void
  aseguradora: string
  workspaceId: string
  onConfirmar: (actualizarNumeros: ActualizarNumero[]) => void
  onVolver:    () => void
  guardando:   boolean
}) {
  type PolizaResultado = {
    id: string; numero_poliza: string | null; aseguradora: string
    ramo: string | null; nombre_tomador: string | null
    fecha_fin: string | null; cliente: { nombre: string; telefono: string | null; email: string | null } | null
  }

  const [busquedas,       setBusquedas]      = useState<Record<number, string>>({})
  const [resultados,      setResultados]     = useState<Record<number, PolizaResultado[]>>({})
  const [buscando,        setBuscando]       = useState<Record<number, boolean>>({})
  const [actualizarNum,   setActualizarNum]  = useState<Record<number, boolean>>({})
  const [probableChecked, setProbableChecked] = useState<Record<number, boolean>>(() => {
    const init: Record<number, boolean> = {}
    lineas.forEach((l, i) => { if (l.estado_conciliacion === 'probable') init[i] = true })
    return init
  })
  // Candidato seleccionado pero aún no confirmado (estado "por completar")
  const [pendiente,      setPendiente]      = useState<Record<number, PolizaResultado>>({})
  // Índice de línea para el que se quiere crear póliza nueva
  const [crearPolizaIdx, setCrearPolizaIdx] = useState<number | null>(null)
  // Refs para calcular posición del dropdown via portal
  const inputContainerRefs = useRef<Record<number, HTMLDivElement | null>>({})

  // Grupos por estado (índice global)
  const grupos = {
    sinMatch:    lineas.map((l, i) => ({ l, i })).filter(({ l, i }) =>
      l.estado_conciliacion === 'no_encontrada' && !pendiente[i]),
    porCompletar: lineas.map((l, i) => ({ l, i })).filter(({ l, i }) =>
      l.estado_conciliacion === 'no_encontrada' && !!pendiente[i]),
    corregidas:  lineas.map((l, i) => ({ l, i })).filter(({ l }) => l.estado_conciliacion === 'corregida_manual'),
    probables:   lineas.map((l, i) => ({ l, i })).filter(({ l }) => l.estado_conciliacion === 'probable'),
    conciliadas: lineas.map((l, i) => ({ l, i })).filter(({ l }) => l.estado_conciliacion === 'conciliada'),
  }

  // ── Búsqueda multi-campo ───────────────────────────────────────────
  const buscar = useCallback(async (idx: number, query: string) => {
    setBusquedas(prev => ({ ...prev, [idx]: query }))
    if (query.length < 2) {
      setResultados(prev => ({ ...prev, [idx]: [] }))
      setBuscando(prev => ({ ...prev, [idx]: false }))
      return
    }
    setBuscando(prev => ({ ...prev, [idx]: true }))
    try {
      const q = query.trim()

      // Buscar pólizas por número y por nombre_tomador (sin join)
      const [{ data: byPol, error: e1 }, { data: byTom, error: e2 }] = await Promise.all([
        supabase.from('polizas')
          .select('id, numero_poliza, aseguradora, ramo, nombre_tomador, fecha_fin, client_id')
          .eq('workspace_id', workspaceId).ilike('numero_poliza', `%${q}%`).limit(5),
        supabase.from('polizas')
          .select('id, numero_poliza, aseguradora, ramo, nombre_tomador, fecha_fin, client_id')
          .eq('workspace_id', workspaceId).ilike('nombre_tomador', `%${q}%`).limit(5),
      ])
      if (e1) console.error('[buscar byPol]', e1)
      if (e2) console.error('[buscar byTom]', e2)

      // Buscar clientes por nombre/teléfono/email → luego sus pólizas
      const { data: clientesData, error: e3 } = await supabase.from('clientes')
        .select('id, nombre, telefono, email')
        .eq('workspace_id', workspaceId)
        .or(`nombre.ilike.%${q}%,telefono.ilike.%${q}%,email.ilike.%${q}%`)
        .limit(6)
      if (e3) console.error('[buscar clientes]', e3)

      type ClienteRow = { id: string; nombre: string; telefono: string | null; email: string | null }
      const clienteMap = new Map<string, ClienteRow>(
        (clientesData ?? []).map((c: ClienteRow) => [c.id, c])
      )

      let byCliente: (PolizaResultado & { client_id: string | null })[] = []
      if (clientesData?.length) {
        const ids = (clientesData as ClienteRow[]).map(c => c.id)
        const { data, error: e4 } = await supabase.from('polizas')
          .select('id, numero_poliza, aseguradora, ramo, nombre_tomador, fecha_fin, client_id')
          .eq('workspace_id', workspaceId).in('client_id', ids).limit(5)
        if (e4) console.error('[buscar byCliente]', e4)
        byCliente = (data ?? []) as unknown as typeof byCliente
      }

      // Combinar y adjuntar datos del cliente si existen
      type RawRow = { id: string; numero_poliza: string | null; aseguradora: string; ramo: string | null; nombre_tomador: string | null; fecha_fin: string | null; client_id: string | null }
      const toResultado = (r: RawRow): PolizaResultado => {
        const c = r.client_id ? clienteMap.get(r.client_id) ?? null : null
        return { id: r.id, numero_poliza: r.numero_poliza, aseguradora: r.aseguradora, ramo: r.ramo, nombre_tomador: r.nombre_tomador, fecha_fin: r.fecha_fin, cliente: c ? { nombre: c.nombre, telefono: c.telefono, email: c.email } : null }
      }

      const all: PolizaResultado[] = [
        ...(byPol ?? []).map(r => toResultado(r as RawRow)),
        ...(byTom ?? []).map(r => toResultado(r as RawRow)),
        ...byCliente.map(r => toResultado(r as RawRow)),
      ]
      const seen = new Set<string>()
      setResultados(prev => ({
        ...prev,
        [idx]: all.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true }).slice(0, 8),
      }))
    } catch (err) {
      console.error('[buscar] error inesperado', err)
    } finally {
      setBuscando(prev => ({ ...prev, [idx]: false }))
    }
  }, [workspaceId])

  // ── Seleccionar candidato (sin confirmar aún) ──────────────────────
  const seleccionar = (idx: number, pol: PolizaResultado) => {
    setPendiente(prev => ({ ...prev, [idx]: pol }))
    setResultados(prev => ({ ...prev, [idx]: [] }))
    setBusquedas(prev => ({ ...prev, [idx]: '' }))
  }

  // ── Confirmar el candidato pendiente → corregida_manual ───────────
  const confirmarVinculo = (idx: number) => {
    const pol = pendiente[idx]
    if (!pol) return
    const updated = [...lineas]
    updated[idx] = { ...updated[idx], poliza_id: pol.id, estado_conciliacion: 'corregida_manual' }
    setLineas(updated)
    setPendiente(prev => { const n = { ...prev }; delete n[idx]; return n })
    setActualizarNum(prev => ({ ...prev, [idx]: true }))
  }

  // ── Cancelar candidato pendiente → vuelve a buscar ────────────────
  const cancelarPendiente = (idx: number) => {
    setPendiente(prev => { const n = { ...prev }; delete n[idx]; return n })
  }

  // ── Tras crear póliza nueva → vincular directamente ───────────────
  const handlePolizaCreada = async (idx: number) => {
    setCrearPolizaIdx(null)
    const { data } = await supabase.from('polizas')
      .select('id')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(1).single()
    if (data?.id) {
      const updated = [...lineas]
      updated[idx] = { ...updated[idx], poliza_id: data.id, estado_conciliacion: 'corregida_manual' }
      setLineas(updated)
      setActualizarNum(prev => ({ ...prev, [idx]: true }))
      setPendiente(prev => { const n = { ...prev }; delete n[idx]; return n })
    }
  }

  const desvincular = (idx: number) => {
    const updated = [...lineas]
    updated[idx] = { ...updated[idx], poliza_id: null, estado_conciliacion: 'no_encontrada' }
    setLineas(updated)
    setActualizarNum(prev => ({ ...prev, [idx]: false }))
  }

  const toggleProbable = (idx: number, checked: boolean) =>
    setProbableChecked(prev => ({ ...prev, [idx]: checked }))

  // ── Submit ────────────────────────────────────────────────────────
  const handleSubmit = () => {
    const updated = [...lineas]
    grupos.probables.forEach(({ i }) => {
      updated[i] = {
        ...updated[i],
        estado_conciliacion: probableChecked[i] !== false ? 'corregida_manual' : 'no_encontrada',
        poliza_id: probableChecked[i] !== false ? updated[i].poliza_id : null,
      }
    })
    setLineas(updated)
    const actualizarNumeros: ActualizarNumero[] = []
    lineas.forEach((l, i) => {
      if (l.estado_conciliacion === 'corregida_manual' && actualizarNum[i] && l.poliza_id && l.numero_poliza_raw)
        actualizarNumeros.push({ poliza_id: l.poliza_id, nuevo_numero: l.numero_poliza_raw })
    })
    onConfirmar(actualizarNumeros)
  }

  const pendientesCount = Object.keys(pendiente).length
  const es48Horas = aseguradora === '48 HORAS'

  // ── Helper: dropdown de resultados de búsqueda (portal para evitar overflow clip) ──
  function DropdownResultados({ idx }: { idx: number }) {
    const q = busquedas[idx] ?? ''
    const hayResultados = (resultados[idx]?.length ?? 0) > 0
    const estaBuscando  = buscando[idx] ?? false
    // Mostrar si el usuario escribió >= 2 chars (con carga, resultados o vacío)
    if (q.length < 2 && !hayResultados && !estaBuscando) return null
    if (q.length < 2) return null
    const anchor = inputContainerRefs.current[idx]
    if (!anchor) return null
    const rect = anchor.getBoundingClientRect()
    return createPortal(
      <div style={{ position: 'fixed', top: rect.bottom + 4, left: rect.left, width: rect.width, zIndex: 9999 }}
        className="bg-white border border-slate-200 rounded-xl shadow-xl max-h-52 overflow-y-auto">
        {estaBuscando && (
          <div className="flex items-center gap-2 px-3 py-3 text-xs text-slate-400">
            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Buscando...
          </div>
        )}
        {!estaBuscando && !hayResultados && (
          <div className="px-3 py-3 text-xs text-slate-400">Sin resultados para &ldquo;{q}&rdquo;</div>
        )}
        {!estaBuscando && resultados[idx]?.map(p => {
          const c = p.cliente as { nombre: string; telefono: string | null; email: string | null } | null
          const tomador = p.nombre_tomador || c?.nombre
          const vigencia = p.fecha_fin
            ? new Date(p.fecha_fin).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })
            : null
          return (
            <button key={p.id} onClick={() => seleccionar(idx, p)}
              className="w-full text-left px-3 py-2 hover:bg-slate-50 border-b border-slate-100 last:border-0 transition-colors">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[11px] font-semibold text-slate-800"><Hl text={p.numero_poliza} q={q} /></span>
                <span className="text-[10px] text-slate-400 shrink-0">{p.aseguradora}</span>
              </div>
              <div className="flex items-center justify-between gap-2 mt-0.5">
                <span className="text-[11px] text-slate-600 truncate"><Hl text={tomador ?? null} q={q} /></span>
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
      </div>,
      document.body
    )
  }

  return (
    <div className="space-y-5">
      {es48Horas && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
          <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0 text-amber-500" />
          <span>48 Horas usa <strong>VOUCHER</strong>. Vincula manualmente cada línea.</span>
        </div>
      )}

      {/* ── Sección 1: Por completar (candidato seleccionado, sin confirmar) ── */}
      {grupos.porCompletar.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" />
            Por completar ({grupos.porCompletar.length}) — confirma o cancela cada vinculación
          </p>
          <div className="space-y-2.5 pr-0.5">
            {grupos.porCompletar.map(({ l, i }) => {
              const pol = pendiente[i]
              const tomadorPol = pol.nombre_tomador || (pol.cliente as { nombre: string } | null)?.nombre
              const vigencia = pol.fecha_fin
                ? new Date(pol.fecha_fin).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: '2-digit' })
                : null
              const preRelleno = {
                numero_poliza: l.numero_poliza_raw,
                nombre_tomador: l.nombre_tomador ?? '',
                aseguradora,
              } as unknown as Poliza
              return (
                <div key={i} className="border border-blue-200 bg-blue-50 rounded-xl p-3 text-xs">
                  {/* Datos de la colilla */}
                  <div className="flex justify-between mb-2">
                    <div>
                      <p className="text-[10px] text-slate-400 uppercase tracking-wide">Colilla</p>
                      <p className="font-mono font-semibold text-slate-700">{l.numero_poliza_raw}</p>
                      {l.nombre_tomador && <p className="text-slate-500">{l.nombre_tomador}</p>}
                    </div>
                    <p className="font-semibold text-slate-700 shrink-0">{l.valor_comision != null ? formatCOP(l.valor_comision) : '—'}</p>
                  </div>

                  {/* Póliza CRM seleccionada */}
                  <div className="bg-white rounded-lg px-3 py-2 border border-blue-100">
                    <p className="text-[10px] text-blue-500 uppercase tracking-wide mb-1">Póliza CRM seleccionada</p>
                    <p className="font-mono font-semibold text-blue-800">{pol.numero_poliza ?? '—'}</p>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      {tomadorPol && <span className="text-slate-600 text-[11px]">{tomadorPol}</span>}
                      <span className="text-slate-400 text-[10px]">{pol.aseguradora}</span>
                      {pol.ramo && <span className="text-slate-400 text-[10px]">· {pol.ramo}</span>}
                    </div>
                    {vigencia && <p className="text-[10px] text-slate-400 mt-0.5">Vence: {vigencia}</p>}
                  </div>

                  {/* Checkbox actualizar número */}
                  <label className="flex items-center gap-2 mt-2 cursor-pointer select-none">
                    <input type="checkbox"
                      checked={actualizarNum[i] ?? true}
                      onChange={e => setActualizarNum(prev => ({ ...prev, [i]: e.target.checked }))}
                      className="accent-blue-500" />
                    <span className="text-slate-600 text-[11px]">
                      Actualizar N° póliza en CRM
                      <span className="text-slate-400 ml-1 font-mono">{l.numero_poliza_raw}</span>
                    </span>
                  </label>

                  {/* Acciones */}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => cancelarPendiente(i)}
                      className="flex-1 text-center text-slate-500 border border-slate-200 rounded-lg py-1.5 hover:bg-white text-[11px] transition-colors">
                      Cancelar
                    </button>
                    <button onClick={() => setCrearPolizaIdx(i)}
                      className="flex items-center justify-center gap-1 flex-1 text-emerald-700 border border-emerald-200 rounded-lg py-1.5 hover:bg-emerald-50 text-[11px] transition-colors">
                      <Plus className="w-3 h-3" /> Crear nueva
                    </button>
                    <button onClick={() => confirmarVinculo(i)}
                      className="flex-1 text-center bg-blue-500 hover:bg-blue-600 text-white rounded-lg py-1.5 text-[11px] font-medium transition-colors">
                      ✓ Confirmar
                    </button>
                  </div>

                  {crearPolizaIdx === i && (
                    <PolizaModal poliza={preRelleno} onClose={() => setCrearPolizaIdx(null)} onSaved={() => handlePolizaCreada(i)} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Sección 2: Sin match (buscando) ── */}
      {grupos.sinMatch.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5" />
            Sin match ({grupos.sinMatch.length}) — busca la póliza o crea una nueva
          </p>
          <div className="space-y-2.5 pr-0.5">
            {grupos.sinMatch.map(({ l, i }) => {
              const preRelleno = {
                numero_poliza: l.numero_poliza_raw,
                nombre_tomador: l.nombre_tomador ?? '',
                aseguradora,
              } as unknown as Poliza
              return (
                <div key={i} className="border border-amber-200 bg-amber-50 rounded-xl p-3 text-xs">
                  <div className="flex justify-between mb-2">
                    <div>
                      <p className="font-mono font-semibold text-slate-700">{l.numero_poliza_raw}</p>
                      {l.nombre_tomador && <p className="text-slate-500 mt-0.5">{l.nombre_tomador}</p>}
                    </div>
                    <p className="font-semibold text-slate-700 shrink-0">{l.valor_comision != null ? formatCOP(l.valor_comision) : '—'}</p>
                  </div>
                  {/* Buscador + opción crear */}
                  <div className="relative" ref={el => { inputContainerRefs.current[i] = el }}>
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
                    <input type="text"
                      value={busquedas[i] ?? ''}
                      onChange={e => buscar(i, e.target.value)}
                      placeholder="Buscar por N° póliza, nombre, teléfono o email..."
                      className="w-full border border-slate-200 rounded-lg pl-6 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                    />
                    {/* Dropdown via portal (se muestra desde 2 chars) */}
                    {(busquedas[i]?.length ?? 0) >= 2 && <DropdownResultados idx={i} />}
                  </div>
                  {/* Botón crear póliza nueva */}
                  <button onClick={() => setCrearPolizaIdx(i)}
                    className="mt-1.5 flex items-center gap-1 text-[11px] text-emerald-700 hover:text-emerald-800 font-medium">
                    <Plus className="w-3 h-3" /> Crear póliza nueva
                  </button>
                  {crearPolizaIdx === i && (
                    <PolizaModal poliza={preRelleno} onClose={() => setCrearPolizaIdx(null)} onSaved={() => handlePolizaCreada(i)} />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Sección 3: Ya vinculadas manualmente ── */}
      {grupos.corregidas.length > 0 && (
        <details className="group" open>
          <summary className="text-xs font-semibold text-emerald-700 uppercase tracking-wider cursor-pointer flex items-center gap-1.5 list-none select-none mb-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Vinculadas manualmente ({grupos.corregidas.length})
            <span className="text-slate-400 normal-case font-normal ml-1">▸ ver detalle</span>
          </summary>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {grupos.corregidas.map(({ l, i }) => (
              <div key={i} className="flex items-center justify-between text-xs text-slate-600 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="font-mono">{l.numero_poliza_raw}</span>
                  {l.nombre_tomador && <span className="text-slate-400 truncate text-[11px]">{l.nombre_tomador}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="font-medium">{l.valor_comision != null ? formatCOP(l.valor_comision) : '—'}</span>
                  <button onClick={() => desvincular(i)} title="Quitar vínculo"
                    className="text-slate-300 hover:text-red-400 transition-colors">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* ── Sección 4: Sugerencias por nombre (probable) ── */}
      {grupos.probables.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-blue-700 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5" />
            Posibles coincidencias por nombre ({grupos.probables.length})
          </p>
          <p className="text-[11px] text-slate-400 mb-2">Desmarca las que no estés seguro — se importarán como "Sin match".</p>
          <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
            {grupos.probables.map(({ l, i }) => {
              const sugerida = l.poliza_sugerida
              const checked  = probableChecked[i] !== false
              return (
                <label key={i}
                  className={`flex items-start gap-3 border rounded-xl p-3 cursor-pointer transition-colors ${
                    checked ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'
                  }`}>
                  <input type="checkbox" checked={checked}
                    onChange={e => toggleProbable(i, e.target.checked)}
                    className="mt-0.5 accent-blue-500 shrink-0" />
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="flex justify-between items-start gap-2 mb-1">
                      <div>
                        <p className="font-mono font-semibold text-slate-700">{l.numero_poliza_raw}</p>
                        <p className="text-slate-500">{l.nombre_tomador}</p>
                      </div>
                      <p className="font-semibold text-slate-700 shrink-0">{l.valor_comision != null ? formatCOP(l.valor_comision) : '—'}</p>
                    </div>
                    {sugerida && (
                      <div className="bg-white rounded-lg px-2.5 py-2 border border-blue-100 mt-1">
                        <p className="text-[10px] text-blue-500 uppercase tracking-wide mb-0.5">Póliza CRM sugerida</p>
                        <p className="font-mono font-semibold text-blue-800">{sugerida.numero_poliza ?? '—'}</p>
                        <p className="text-slate-500 text-[11px]">{sugerida.nombre_tomador ?? '—'} · {sugerida.aseguradora}</p>
                      </div>
                    )}
                  </div>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Sección 5: Conciliadas automáticamente ── */}
      {grupos.conciliadas.length > 0 && (
        <details className="group">
          <summary className="text-xs font-semibold text-emerald-700 uppercase tracking-wider cursor-pointer flex items-center gap-1.5 list-none select-none">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Conciliadas automáticamente ({grupos.conciliadas.length})
            <span className="text-slate-400 normal-case font-normal ml-1">▸ ver detalle</span>
          </summary>
          <div className="mt-2 space-y-1 max-h-40 overflow-y-auto">
            {grupos.conciliadas.map(({ l, i }) => (
              <div key={i} className="flex items-center justify-between text-xs text-slate-600 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="font-mono">{l.numero_poliza_raw}</span>
                  {l.nombre_tomador && <span className="text-slate-400 truncate text-[11px]">{l.nombre_tomador}</span>}
                </div>
                <span className="shrink-0 font-medium">{l.valor_comision != null ? formatCOP(l.valor_comision) : '—'}</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {grupos.sinMatch.length === 0 && grupos.probables.length === 0 && grupos.porCompletar.length === 0 && (
        <div className="text-center py-6 text-slate-400 text-sm">
          <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
          Todas las líneas están conciliadas
        </div>
      )}

      {/* Aviso si hay pendientes de confirmar */}
      {pendientesCount > 0 && (
        <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800">
          <Clock className="w-3.5 h-3.5 mt-0.5 shrink-0 text-blue-500" />
          <span>
            <strong>{pendientesCount} selección{pendientesCount > 1 ? 'es' : ''} pendiente{pendientesCount > 1 ? 's' : ''} de confirmar.</strong>{' '}
            Confírmalas antes de continuar o se importarán como "Sin match".
          </span>
        </div>
      )}

      <div className="flex gap-3 pt-1">
        <button onClick={onVolver} className="flex-1 flex items-center justify-center gap-1.5 border border-slate-200 rounded-lg py-2.5 text-sm text-slate-600 hover:bg-slate-50">
          <ChevronLeft className="w-4 h-4" /> Volver
        </button>
        <button onClick={handleSubmit} disabled={guardando} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-sm font-medium py-2.5 rounded-lg transition-colors">
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
  const [stats, setStats]         = useState<Stats>({ total: 0, conciliadas: 0, probables: 0, noEncontradas: 0, totalComision: 0 })
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

  const handleConfirmar = async (actualizarNumeros: ActualizarNumero[] = []) => {
    if (!currentWorkspace) return
    setGuardando(true)
    try {
      // 1. Crear colilla en borrador
      const resCrear = await fetch('/api/colillas/crear', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspace_id:      currentWorkspace.id,
          aseguradora,
          periodo,
          archivo_nombre:    archivo?.name ?? 'desconocido',
          lineas,
          actualizar_numeros: actualizarNumeros,
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
      setStats({ total: lineas.length, conciliadas: conciliadas + corregidas, probables: 0, noEncontradas, totalComision: stats.totalComision })
      setColillaId(nuevoColillaId)
      setPaso(4)
      onConfirmada()
    } finally {
      setGuardando(false)
    }
  }

  const resetear = () => {
    setPaso(1); setArchivo(null); setLineas([]); setError('')
    setStats({ total: 0, conciliadas: 0, probables: 0, noEncontradas: 0, totalComision: 0 })
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
              onSiguiente={() => lineas.some(l => l.estado_conciliacion === 'no_encontrada' || l.estado_conciliacion === 'probable') ? setPaso(3) : handleConfirmar()}
              onVolver={() => setPaso(1)}
            />
          )}
          {paso === 3 && currentWorkspace && (
            <PasoRevisar
              lineas={lineas} setLineas={setLineas}
              aseguradora={aseguradora}
              workspaceId={currentWorkspace.id}
              onConfirmar={handleConfirmar}
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
