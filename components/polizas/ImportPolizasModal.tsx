'use client'
import { useRef, useState } from 'react'
import * as XLSX from 'xlsx'
import { supabase } from '@/lib/supabase/client'
import { X, Upload, CheckCircle, AlertCircle, FileText, Loader2, Info } from 'lucide-react'
import { useWorkspace } from '@/contexts/WorkspaceContext'

/* ── Tipos ──────────────────────────────────────────────────────── */

interface ExcelRow {
  // Flags
  es_renovacion: boolean
  mes_emision: string
  oneroso: boolean
  endoso_enviado: boolean
  cancelada_anterior: boolean
  aseguradora_anterior: string
  // Cliente
  tipo_poliza: string
  nombre: string
  tipo_documento: string
  cedula: string
  fecha_nacimiento: string
  telefono: string
  email: string
  // Póliza base
  fecha_inicio: string
  fecha_fin: string
  aseguradora: string
  numero_poliza: string
  ramo: string
  periodicidad: string
  // Financiero
  pct_comision_negocio: number | null
  prima_neta: number | null
  prima_periodica: number | null
  comision_agencia: number | null
  comision_periodica: number | null
  retencion_agencia: number | null
  // Intermediario
  intermediario: string
  pct_comision_int: number | null
  comision_intermediario: number | null
  // Asesor
  asesor: string
  pct_comision_asesor: number | null
  retencion_asesor: number | null
  comision_asesor: number | null
  // Referido
  referido: string
  pct_comision_referido: number | null
  retencion_referido: number | null
  comision_referido: number | null
  // ABC / Agencia neta
  comision_abc_periodica: number | null
  pct_comision_abc: number | null
  retencion_abc: number | null
  comision_abc_anual: number | null
  comision_abc_recibida: number | null
  fecha_pago_abc: string
  comision_asesor_pagada: number | null
  fecha_pago_asesor: string
}

interface ImportResult {
  clientesCreados: number
  clientesExistentes: number
  polizasCreadas: number
  errores: string[]
}

type Stage = 'idle' | 'select_sheet' | 'preview' | 'importing' | 'done'

/** Hojas que contienen pólizas (formato año o nombre conocido) */
const YEAR_SHEET_RE = /^(20\d{2}|2\d{3})$/

/* ── Helpers ────────────────────────────────────────────────────── */

/** Convierte cualquier valor de celda de Excel a string "YYYY-MM-DD" o '' */
function excelDateToISO(val: unknown): string {
  if (val === null || val === undefined || val === '' || val === 'NA' || val === '-') return ''

  // Date object (cuando cellDates:true o JS Date)
  if (val instanceof Date) {
    if (isNaN(val.getTime())) return ''
    const y = val.getFullYear()
    const m = String(val.getMonth() + 1).padStart(2, '0')
    const d = String(val.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  // Número serial de Excel (cellDates:false)
  if (typeof val === 'number') {
    if (val < 1 || val > 2958465) return '' // fuera de rango razonable
    try {
      const date = XLSX.SSF.parse_date_code(val)
      if (!date) return ''
      return `${date.y}-${String(date.m).padStart(2,'0')}-${String(date.d).padStart(2,'0')}`
    } catch { return '' }
  }

  if (typeof val === 'string') {
    const s = val.trim()
    if (!s || s === '0' || s === 'NA' || s === '-') return ''

    // Ya viene en formato ISO "2023-11-22"
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)

    // Formato "22/11/2023" o "22-11-2023" (dd/mm/yyyy o dd-mm-yyyy)
    const parts = s.split(/[\/\-\.]/)
    if (parts.length === 3) {
      const nums = parts.map(p => parseInt(p.trim(), 10))
      const [a, b, c] = nums
      if (isNaN(a) || isNaN(b) || isNaN(c)) return ''

      // Si el tercer elemento tiene 4 dígitos → a/b son día y mes
      if (String(parts[2].trim()).length === 4) {
        // Si a > 12 es dd/mm/yyyy
        if (a > 12) return `${c}-${String(b).padStart(2,'0')}-${String(a).padStart(2,'0')}`
        // sino puede ser mm/dd/yyyy — en Colombia usamos dd/mm/yyyy
        return `${c}-${String(a).padStart(2,'0')}-${String(b).padStart(2,'0')}`
      }
      // Si el primer elemento tiene 4 dígitos → yyyy/mm/dd
      if (String(parts[0].trim()).length === 4) {
        return `${a}-${String(b).padStart(2,'0')}-${String(c).padStart(2,'0')}`
      }
    }
    return ''
  }
  return ''
}

/** Convierte valor de celda a número, null si vacío/no numérico */
function toNum(val: unknown): number | null {
  if (val === null || val === undefined || val === '' || val === '-' || val === 'NA') return null
  const n = typeof val === 'number' ? val : parseFloat(String(val).replace(/[$,\s]/g, ''))
  return isNaN(n) ? null : n
}

/** Normaliza flag booleano (Sí, SI, sí, YES, X, mes-año → true) */
function toBool(val: unknown): boolean {
  if (!val || val === '-' || val === 'NA' || val === '') return false
  const s = String(val).toLowerCase().trim()
  return ['si', 'sí', 'yes', 'x', '1', 'true'].includes(s) || /^[a-z]{3}-\d{2}$/.test(s)
}

/** Normaliza texto, convierte NA/- a '' */
function toText(val: unknown): string {
  if (!val || val === 'NA' || val === '-') return ''
  return String(val).trim()
}

/** Normaliza header para comparación */
function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

/** Devuelve los nombres de hojas disponibles en el workbook */
function getSheetNames(buffer: ArrayBuffer): { all: string[]; yearSheets: string[] } {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const all = wb.SheetNames
  const yearSheets = all.filter(n => YEAR_SHEET_RE.test(n.trim()))
  return { all, yearSheets }
}

/** Parsea UNA hoja específica y devuelve sus filas */
function parseSheet(buffer: ArrayBuffer, sheetName: string): { rows: ExcelRow[]; errors: string[] } {
  const wb = XLSX.read(buffer, { type: 'array', cellDates: true })
  const ws = wb.Sheets[sheetName]
  if (!ws) return { rows: [], errors: [`Hoja "${sheetName}" no encontrada.`] }

  // Convertir a array de arrays
  const raw: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
  if (raw.length < 2) return { rows: [], errors: [`La hoja "${sheetName}" está vacía.`] }

  // Primera fila = headers
  const headers = (raw[0] as string[]).map(h => norm(String(h)))

  // Helper adicional: busca columna por función de matching personalizada
  const colFn = (fn: (h: string) => boolean) => headers.findIndex(fn)

  // Mapa de índices: busca por inclusión parcial, con aliases
  const col = (...names: string[]) => {
    for (const name of names) {
      const idx = headers.findIndex(h => h.includes(norm(name)))
      if (idx !== -1) return idx
    }
    return -1
  }

  // Debug: mostrar columnas detectadas en consola
  const idxFechaFin = col('fecha fin de vigencia', 'fin de vigencia', 'fecha fin', 'fin vigencia', 'vencimiento') !== -1
    ? col('fecha fin de vigencia', 'fin de vigencia', 'fecha fin', 'fin vigencia', 'vencimiento')
    : colFn(h => h.includes('fin') && h.includes('vigencia'))
  console.log('[Import] Headers detectados:', headers)
  console.log('[Import] Índice columna fecha_fin:', idxFechaFin, '→', headers[idxFechaFin])
  console.log('[Import] Valor fecha_fin fila 2:', (raw[1] as unknown[])?.[idxFechaFin])

  const rows: ExcelRow[] = []
  const errors: string[] = []

  for (let i = 1; i < raw.length; i++) {
    const r = raw[i] as unknown[]

    // Ignorar filas vacías
    const nombre = toText(r[col('cliente')])
    if (!nombre) continue

    // Ignorar filas de totales o separadores
    if (nombre.toLowerCase().startsWith('total') || nombre === '—') continue

    const cedula = toText(r[col('nit')] || r[col('cc')]) ||
                   toText(r[headers.findIndex(h => h.includes('nit') || h.includes('c.c'))])

    rows.push({
      // Flags
      es_renovacion:      toBool(r[col('renovacion')]),
      mes_emision:        toText(r[col('mes emision', 'mes')]),
      oneroso:            toBool(r[col('oneroso')]),
      endoso_enviado:     toBool(r[col('endoso enviado', 'endoso')]),
      cancelada_anterior: toBool(r[col('cancelada anterior')]),
      aseguradora_anterior: toText(r[col('aseguradora anterior', 'aseguradora nueva')]),
      // Cliente
      tipo_poliza:    toText(r[col('tipo')]),
      nombre,
      tipo_documento: toText(r[col('tipo id', 'tipo doc', 'tipo documento')]),
      cedula:         cedula || String(toNum(r[col('nit', 'cc', 'nit/cc', 'cedula')]) ?? ''),
      fecha_nacimiento: excelDateToISO(r[col('nacimiento', 'fecha nacimiento', 'fecha de nacimiento')]),
      telefono:       toText(r[col('celular', 'telefono', 'tel')]),
      email:          toText(r[col('correo', 'email', 'correo electronico')]),
      // Póliza
      fecha_inicio:   excelDateToISO(
        r[col('fecha inicio de vigencia', 'inicio de vigencia', 'fecha inicio', 'inicio vigencia', 'inicio')] ??
        r[colFn(h => h.includes('inicio') && h.includes('vigencia'))]
      ),
      fecha_fin:      excelDateToISO(
        r[col('fecha fin de vigencia', 'fin de vigencia', 'fecha fin', 'fin vigencia', 'vencimiento')] ??
        r[colFn(h => h.includes('fin') && h.includes('vigencia'))] ??
        r[colFn(h => h.includes('vencimiento'))]
      ),
      aseguradora:    toText(r[col('aseguradora')]),
      numero_poliza:  toText(r[col('numero de poliza', 'numero poliza', 'no poliza', 'n° poliza', 'nro poliza')]),
      ramo:           toText(r[col('ramo')]),
      periodicidad:   toText(r[col('periodicidad')]),
      // Financiero — columnas exactas del formato Senda
      pct_comision_negocio:  toNum(r[col('porcentaje comision del negocio', 'comision del negocio', '% comision negocio')]),
      prima_neta:            toNum(r[col('prima anual antes de iva', 'prima anual', 'prima neta')]),
      prima_periodica:       toNum(r[col('prima periodica pagada', 'prima periodica')]),
      comision_agencia:      toNum(r[col('comision anual negocio', 'comision anual')]),
      comision_periodica:    toNum(r[col('comision periodica abc', 'comision periodica')]),
      retencion_agencia:     toNum(r[col('retencion 10', 'retencion')]),
      // Intermediario
      intermediario:         toText(r[col('intermediario inicial', 'intermediario')]),
      pct_comision_int:      toNum(r[col('porcentaje comision intermediario', '% comision intermediario')]),
      comision_intermediario: toNum(r[col('comision intermediario inicial', 'comision intermediario')]),
      // Asesor
      asesor:               toText(r[col('asesor', 'concesionario', 'vendedor')]),
      pct_comision_asesor:  toNum(r[col('% comision asesor', 'porcentaje comision asesor')]),
      retencion_asesor:     toNum(r[col('retencion asesor')]),
      comision_asesor:      toNum(r[col('comision asesor')]),
      // Referido
      referido:              toText(r[col('referido')]),
      pct_comision_referido: toNum(r[col('porcentaje comision referido', '% comision referido')]),
      retencion_referido:    toNum(r[col('retencion referido')]),
      comision_referido:     toNum(r[col('comision referido')]),
      // ABC / Agencia
      comision_abc_periodica: toNum(r[col('comision abc periodica')]),
      pct_comision_abc:       toNum(r[col('% comision abc seguros', '% comision abc', 'porcentaje comision abc')]),
      retencion_abc:          toNum(r[col('retencion asumida por abc', 'retencion asumida', 'retencion abc')]),
      comision_abc_anual:     toNum(r[col('comision abc anual')]),
      comision_abc_recibida:  toNum(r[col('comision abc recibida', 'abc recibida')]),
      fecha_pago_abc:         excelDateToISO(r[col('fecha pago abc')]),
      comision_asesor_pagada: toNum(r[col('pago comision asesor')]),
      fecha_pago_asesor:      excelDateToISO(r[col('fecha pago asesor')]),
    })
  }

  if (rows.length === 0) {
    errors.push(`No se encontraron filas válidas en la hoja "${sheetName}". Verifica que la hoja tenga datos con columna CLIENTE.`)
  }

  return { rows, errors }
}

/* ── Importar a Supabase ────────────────────────────────────────── */

async function importarFilas(rows: ExcelRow[], wsId: string): Promise<ImportResult> {
  const result: ImportResult = { clientesCreados: 0, clientesExistentes: 0, polizasCreadas: 0, errores: [] }

  // Cache de cedula → cliente_id para no re-buscar
  const clienteCache = new Map<string, string>()

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]

    try {
      // 1. Buscar o crear cliente
      const cedulaKey = r.cedula || r.nombre.toLowerCase()
      let clienteId: string | null = clienteCache.get(cedulaKey) ?? null

      if (!clienteId && r.cedula) {
        // Buscar por cédula en el workspace
        const { data: existing } = await supabase
          .from('clientes')
          .select('id')
          .eq('workspace_id', wsId)
          .eq('cedula', r.cedula)
          .maybeSingle()

        if (existing) {
          clienteId = existing.id
          result.clientesExistentes++
        }
      }

      if (!clienteId) {
        // Crear cliente nuevo
        const clienteData: Record<string, unknown> = {
          workspace_id:    wsId,
          nombre:          r.nombre,
          tipo_documento:  r.tipo_documento || null,
          cedula:          r.cedula || null,
          telefono:        r.telefono || null,
          email:           r.email || null,
          etapa:           'cerrado',  // Ya tiene póliza → cliente activo
        }
        if (r.fecha_nacimiento) clienteData.fecha_nacimiento = r.fecha_nacimiento
        // Tipo cliente según tipo_documento
        if (r.tipo_documento?.toUpperCase() === 'NIT') {
          clienteData.tipo_cliente = 'empresa'
          clienteData.nit = r.cedula || null
        }

        const { data: nuevo, error: errCliente } = await supabase
          .from('clientes')
          .insert(clienteData)
          .select('id')
          .single()

        if (errCliente || !nuevo) {
          result.errores.push(`Fila ${i + 2}: No se pudo crear cliente "${r.nombre}" — ${errCliente?.message}`)
          continue
        }

        clienteId = nuevo.id
        result.clientesCreados++
      }

      if (!clienteId) continue
      clienteCache.set(cedulaKey, clienteId)

      // 2. Crear póliza
      // Auto-detectar estado según fecha_fin
      const hoy = new Date().toISOString().split('T')[0]
      let estadoPoliza: string = 'activa'
      if (r.fecha_fin && r.fecha_fin < hoy) estadoPoliza = 'vencida'
      else if (!r.fecha_inicio && !r.fecha_fin) estadoPoliza = 'pendiente'

      const polizaData: Record<string, unknown> = {
        workspace_id:               wsId,
        client_id:                  clienteId,
        aseguradora:                r.aseguradora || 'Sin asignar',
        ramo:                       r.ramo || 'Sin ramo',
        numero_poliza:              r.numero_poliza || null,
        tipo_poliza:                r.tipo_poliza || null,
        fecha_inicio:               r.fecha_inicio || null,
        fecha_fin:                  r.fecha_fin || null,
        periodicidad_pago:          r.periodicidad || null,
        estado:                     estadoPoliza,
        eliminada:                  false,
        // Flags
        es_renovacion:              r.es_renovacion,
        mes_emision:                r.mes_emision || null,
        beneficiario_oneroso:       r.oneroso,
        endoso_enviado:             r.endoso_enviado,
        cancelada_anterior:         r.cancelada_anterior,
        aseguradora_anterior:       r.aseguradora_anterior || null,
        // Financiero
        prima_neta:                 r.prima_neta,
        prima_periodica:            r.prima_periodica,
        porcentaje_comision_agencia: r.pct_comision_negocio,
        comision_agencia:           r.comision_agencia,
        comision_periodica:         r.comision_periodica,
        retencion_agencia:          r.retencion_agencia,
        // Intermediario
        intermediario:              r.intermediario || null,
        pct_comision_int:           r.pct_comision_int,
        comision_intermediario:     r.comision_intermediario,
        // Asesor
        porcentaje_comision_vendedor: r.pct_comision_asesor,
        retencion_vendedor:         r.retencion_asesor,
        comision_vendedor:          r.comision_asesor,
        // Referido
        referido:                   r.referido || null,
        pct_comision_referido:      r.pct_comision_referido,
        retencion_referido:         r.retencion_referido,
        comision_referido:          r.comision_referido,
        // ABC
        comision_abc_periodica:     r.comision_abc_periodica,
        pct_comision_abc:           r.pct_comision_abc,
        retencion_abc:              r.retencion_abc,
        comision_abc_anual:         r.comision_abc_anual,
        comision_abc_recibida:      r.comision_abc_recibida,
        fecha_pago_abc:             r.fecha_pago_abc || null,
        comision_asesor_pagada:     r.comision_asesor_pagada,
        fecha_pago_asesor:          r.fecha_pago_asesor || null,
      }

      // Buscar si ya existe la póliza por numero_poliza + workspace → actualizar, sino insertar
      let errPoliza = null
      if (r.numero_poliza) {
        const { data: existente } = await supabase
          .from('polizas')
          .select('id')
          .eq('workspace_id', wsId)
          .eq('numero_poliza', r.numero_poliza)
          .maybeSingle()

        if (existente) {
          const { error } = await supabase.from('polizas').update(polizaData).eq('id', existente.id)
          errPoliza = error
        } else {
          const { error } = await supabase.from('polizas').insert(polizaData)
          errPoliza = error
        }
      } else {
        const { error } = await supabase.from('polizas').insert(polizaData)
        errPoliza = error
      }

      if (errPoliza) {
        result.errores.push(`Fila ${i + 2}: No se pudo guardar póliza para "${r.nombre}" — ${errPoliza.message}`)
      } else {
        result.polizasCreadas++
      }
    } catch (e) {
      result.errores.push(`Fila ${i + 2}: Error inesperado — ${String(e)}`)
    }
  }

  return result
}

/* ── Componente ─────────────────────────────────────────────────── */

interface Props {
  onClose: () => void
  onImported: () => void
}

export default function ImportPolizasModal({ onClose, onImported }: Props) {
  const { currentWorkspace } = useWorkspace()
  const inputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage]         = useState<Stage>('idle')
  const [fileName, setFileName]   = useState('')
  // Buffer guardado para re-parsear al cambiar hoja
  const bufferRef = useRef<ArrayBuffer | null>(null)
  // Hojas disponibles
  const [allSheets, setAllSheets]   = useState<string[]>([])
  const [yearSheets, setYearSheets] = useState<string[]>([])
  // Hojas seleccionadas para importar
  const [selectedSheets, setSelectedSheets] = useState<string[]>([])
  // Datos consolidados de todas las hojas seleccionadas
  const [rows, setRows]             = useState<ExcelRow[]>([])
  const [sheetRowCounts, setSheetRowCounts] = useState<Record<string, number>>({})
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [result, setResult]         = useState<ImportResult | null>(null)

  function handleFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const buf = e.target?.result as ArrayBuffer
      bufferRef.current = buf
      const { all, yearSheets: ys } = getSheetNames(buf)
      setAllSheets(all)
      setYearSheets(ys)
      // Pre-seleccionar todas las hojas de año
      setSelectedSheets(ys.length > 0 ? ys : [all[0]])
      setStage('select_sheet')
    }
    reader.readAsArrayBuffer(file)
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) handleFile(file)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (file) handleFile(file)
  }

  function toggleSheet(name: string) {
    setSelectedSheets(prev =>
      prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]
    )
  }

  function previewSheets() {
    if (!bufferRef.current || selectedSheets.length === 0) return
    const allRows: ExcelRow[] = []
    const counts: Record<string, number> = {}
    const errors: string[] = []

    for (const sn of selectedSheets) {
      const { rows: r, errors: e } = parseSheet(bufferRef.current, sn)
      allRows.push(...r)
      counts[sn] = r.length
      errors.push(...e)
    }

    setRows(allRows)
    setSheetRowCounts(counts)
    setParseErrors(errors)
    setStage('preview')
  }

  async function importar() {
    if (!currentWorkspace) return
    setStage('importing')
    const res = await importarFilas(rows, currentWorkspace.id)
    setResult(res)
    setStage('done')
  }

  // Preview — primeras 5 filas
  const preview = rows.slice(0, 5)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-lifted w-full max-w-4xl max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200 flex-shrink-0">
          <h2 className="font-semibold text-ink-700 flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary-500" />
            Importar pólizas desde Excel
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* IDLE */}
          {stage === 'idle' && (
            <div>
              <div className="flex items-start gap-3 p-4 bg-primary-50 rounded-xl border border-primary-100 mb-5 text-sm text-ink-600">
                <Info className="w-4 h-4 text-primary-700 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-ink-700 mb-1">¿Qué importa este proceso?</p>
                  <ul className="space-y-0.5 text-xs text-ink-500">
                    <li>• Lee la hoja <strong>2025</strong> (o la primera disponible)</li>
                    <li>• Crea <strong>clientes</strong> nuevos si no existen por cédula/NIT</li>
                    <li>• Crea <strong>pólizas</strong> con los 44 campos del Excel</li>
                    <li>• Los clientes existentes no se duplican</li>
                  </ul>
                </div>
              </div>

              <div
                onDrop={onDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-ink-200 hover:border-primary-400 rounded-2xl p-12 text-center cursor-pointer transition-colors"
              >
                <Upload className="w-10 h-10 text-ink-300 mx-auto mb-3" />
                <p className="text-ink-500 text-sm font-medium">Arrastra el archivo aquí o haz clic para seleccionar</p>
                <p className="text-xs text-ink-400 mt-1">Acepta <strong>.xlsx</strong> · VENTAS_SENDA_SEGUROS_CONSOLIDADO.xlsx</p>
                <input
                  ref={inputRef}
                  type="file"
                  accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  onChange={onFileChange}
                  className="hidden"
                />
              </div>
            </div>
          )}

          {/* SELECCIÓN DE HOJAS */}
          {stage === 'select_sheet' && (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <FileText className="w-4 h-4 text-ink-400" />
                <span className="text-sm font-medium text-ink-700">{fileName}</span>
                <span className="text-xs text-ink-400">· {allSheets.length} hojas detectadas</span>
              </div>

              {/* Hojas de año (recomendadas) */}
              {yearSheets.length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-ink-400 font-medium mb-3">
                    Hojas de pólizas detectadas
                  </p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {yearSheets.map(sn => {
                      const sel = selectedSheets.includes(sn)
                      return (
                        <button
                          key={sn}
                          onClick={() => toggleSheet(sn)}
                          className={`flex items-center justify-between px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all ${
                            sel
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-cream-200 bg-white text-ink-500 hover:border-ink-300'
                          }`}
                        >
                          <span>{sn}</span>
                          {sel && <span className="text-primary-500">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Otras hojas disponibles */}
              {allSheets.filter(s => !YEAR_SHEET_RE.test(s.trim())).length > 0 && (
                <div>
                  <p className="text-[10px] uppercase tracking-widest text-ink-400 font-medium mb-3">
                    Otras hojas (opcional)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {allSheets.filter(s => !YEAR_SHEET_RE.test(s.trim())).map(sn => {
                      const sel = selectedSheets.includes(sn)
                      return (
                        <button
                          key={sn}
                          onClick={() => toggleSheet(sn)}
                          className={`px-3 py-1.5 rounded-pill border text-xs font-medium transition-all ${
                            sel
                              ? 'border-primary-400 bg-primary-50 text-primary-700'
                              : 'border-cream-200 text-ink-400 hover:border-ink-300'
                          }`}
                        >
                          {sel ? '✓ ' : ''}{sn}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div className="p-4 bg-cream-100 rounded-xl text-xs text-ink-500 space-y-1">
                <p className="font-medium text-ink-700">¿Columnas diferentes entre años?</p>
                <p>No hay problema — las columnas que no existen en hojas antiguas (2023, 2024) quedarán en blanco (<code className="bg-white px-1 rounded">null</code>) en la base de datos. La importación es compatible con todas las versiones del archivo.</p>
              </div>
            </div>
          )}

          {/* PREVIEW */}
          {stage === 'preview' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <FileText className="w-4 h-4 text-ink-400" />
                <span className="text-sm font-medium text-ink-700">{fileName}</span>
                {selectedSheets.map(sn => (
                  <span key={sn} className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-pill font-medium">
                    {sn}: {sheetRowCounts[sn] ?? 0} filas
                  </span>
                ))}
                <span className="text-xs text-ink-400">· {rows.length} total</span>
              </div>

              {parseErrors.length > 0 && (
                <div className="p-4 bg-error-soft border border-error/30 rounded-xl text-sm text-error space-y-1">
                  {parseErrors.map((e, i) => <p key={i}>⚠ {e}</p>)}
                </div>
              )}

              {rows.length > 0 && (
                <>
                  <p className="text-[10px] uppercase tracking-widest text-ink-400 font-medium">
                    Vista previa — primeros {preview.length} registros
                  </p>
                  <div className="overflow-x-auto rounded-xl border border-cream-200">
                    <table className="w-full text-xs">
                      <thead className="bg-cream-100 text-ink-400">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Cliente</th>
                          <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Cédula/NIT</th>
                          <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Aseguradora</th>
                          <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Ramo</th>
                          <th className="px-3 py-2 text-left font-medium whitespace-nowrap">N° Póliza</th>
                          <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Inicio</th>
                          <th className="px-3 py-2 text-left font-medium whitespace-nowrap">Fin</th>
                          <th className="px-3 py-2 text-right font-medium whitespace-nowrap">Prima neta</th>
                          <th className="px-3 py-2 text-center font-medium whitespace-nowrap">Renovación</th>
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((r, i) => (
                          <tr key={i} className="border-t border-cream-100 hover:bg-cream-50">
                            <td className="px-3 py-2 font-medium text-ink-700 whitespace-nowrap">{r.nombre}</td>
                            <td className="px-3 py-2 text-ink-500">{r.cedula || '—'}</td>
                            <td className="px-3 py-2 text-ink-500 whitespace-nowrap">{r.aseguradora || '—'}</td>
                            <td className="px-3 py-2 text-ink-500">{r.ramo || '—'}</td>
                            <td className="px-3 py-2 text-ink-500">{r.numero_poliza || '—'}</td>
                            <td className="px-3 py-2 text-ink-500 whitespace-nowrap">{r.fecha_inicio || '—'}</td>
                            <td className="px-3 py-2 text-ink-500 whitespace-nowrap">{r.fecha_fin || '—'}</td>
                            <td className="px-3 py-2 text-right text-ink-700 tabular-nums">
                              {r.prima_neta != null
                                ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(r.prima_neta)
                                : '—'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {r.es_renovacion
                                ? <span className="bg-primary-100 text-primary-800 text-[10px] px-2 py-0.5 rounded-pill font-medium">Sí</span>
                                : <span className="text-ink-300 text-[10px]">No</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {rows.length > 5 && (
                    <p className="text-xs text-ink-400">... y {rows.length - 5} filas más.</p>
                  )}

                  <div className="p-4 bg-warning-soft border border-warning/30 rounded-xl text-xs text-ink-700 space-y-1">
                    <p className="font-medium">Resumen de importación:</p>
                    <ul className="space-y-0.5 text-ink-500 ml-2">
                      <li>• <strong>{rows.length}</strong> pólizas a importar</li>
                      <li>• <strong>{new Set(rows.map(r => r.cedula || r.nombre)).size}</strong> clientes únicos (se crearán los que no existan)</li>
                      <li>• Clientes existentes por cédula <strong>no se duplicarán</strong></li>
                    </ul>
                  </div>
                </>
              )}
            </div>
          )}

          {/* IMPORTING */}
          {stage === 'importing' && (
            <div className="flex flex-col items-center justify-center py-16">
              <Loader2 className="w-10 h-10 text-primary-500 animate-spin mb-4" />
              <p className="text-ink-600 font-medium">Importando {rows.length} pólizas...</p>
              <p className="text-xs text-ink-400 mt-1">Creando clientes y pólizas · puede tardar unos segundos</p>
            </div>
          )}

          {/* DONE */}
          {stage === 'done' && result && (
            <div className="space-y-4">
              <div className="flex flex-col items-center py-6">
                <CheckCircle className="w-14 h-14 text-primary-500 mb-3" />
                <p className="text-2xl font-semibold text-ink-700">
                  {result.polizasCreadas} póliza{result.polizasCreadas !== 1 ? 's' : ''} importada{result.polizasCreadas !== 1 ? 's' : ''}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-primary-50 rounded-xl p-3">
                  <p className="text-2xl font-semibold text-primary-700 tabular-nums">{result.polizasCreadas}</p>
                  <p className="text-xs text-ink-400 mt-0.5">Pólizas creadas</p>
                </div>
                <div className="bg-cream-100 rounded-xl p-3">
                  <p className="text-2xl font-semibold text-ink-700 tabular-nums">{result.clientesCreados}</p>
                  <p className="text-xs text-ink-400 mt-0.5">Clientes nuevos</p>
                </div>
                <div className="bg-cream-100 rounded-xl p-3">
                  <p className="text-2xl font-semibold text-ink-700 tabular-nums">{result.clientesExistentes}</p>
                  <p className="text-xs text-ink-400 mt-0.5">Clientes existentes</p>
                </div>
              </div>

              {result.errores.length > 0 && (
                <div className="bg-error-soft border border-error/30 rounded-xl p-4 space-y-1 max-h-48 overflow-y-auto">
                  <p className="text-sm font-medium text-error mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {result.errores.length} error{result.errores.length !== 1 ? 'es' : ''}
                  </p>
                  {result.errores.map((e, i) => (
                    <p key={i} className="text-xs text-error/80">{e}</p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-cream-200 flex-shrink-0">
          {stage === 'done' ? (
            <button
              onClick={() => { onImported(); onClose() }}
              className="w-full px-4 py-2 rounded-pill bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
            >
              Ver pólizas importadas
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-pill border border-ink-200 text-ink-500 text-sm hover:bg-cream-100 transition-colors"
              >
                Cancelar
              </button>
              {stage === 'select_sheet' && (
                <button
                  onClick={previewSheets}
                  disabled={selectedSheets.length === 0}
                  className="flex-1 px-4 py-2 rounded-pill bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 disabled:opacity-40 transition-colors"
                >
                  Vista previa {selectedSheets.length > 1 ? `(${selectedSheets.length} hojas)` : selectedSheets[0] ?? ''}
                </button>
              )}
              {stage === 'preview' && rows.length > 0 && parseErrors.length === 0 && (
                <>
                  <button
                    onClick={() => setStage('select_sheet')}
                    className="px-4 py-2 rounded-pill border border-ink-200 text-ink-500 text-sm hover:bg-cream-100 transition-colors"
                  >
                    ← Cambiar hojas
                  </button>
                  <button
                    onClick={importar}
                    className="flex-1 px-4 py-2 rounded-pill bg-primary-500 text-white text-sm font-medium hover:bg-primary-600 transition-colors"
                  >
                    Importar {rows.length} póliza{rows.length !== 1 ? 's' : ''}
                  </button>
                </>
              )}
              {stage === 'preview' && (rows.length === 0 || parseErrors.length > 0) && (
                <button
                  onClick={() => { setStage('idle'); setRows([]); setParseErrors([]) }}
                  className="flex-1 px-4 py-2 rounded-pill bg-ink-600 text-white text-sm font-medium hover:bg-ink-700 transition-colors"
                >
                  Cargar otro archivo
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
