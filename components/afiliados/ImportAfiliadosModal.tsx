'use client'
import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Poliza, TipoCliente } from '@/types'
import { X, Upload, CheckCircle, AlertTriangle, FileSpreadsheet } from 'lucide-react'
import * as XLSX from 'xlsx'

interface Props {
  poliza: Poliza
  clienteTipo: TipoCliente
  workspaceId: string
  onClose: () => void
  onSaved: () => void
}

interface RowResult {
  fila: number
  nombre: string
  ok: boolean
  error?: string
}

// Fuzzy column matcher
function col(headers: string[], aliases: string[]): number {
  const norm = (s: string) => s.toLowerCase().trim().replace(/[^a-záéíóúñ0-9]/gi, '')
  for (const alias of aliases) {
    const idx = headers.findIndex(h => norm(h).includes(norm(alias)) || norm(alias).includes(norm(h)))
    if (idx !== -1) return idx
  }
  return -1
}

function parseDate(val: unknown): string | null {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val)
    if (d) return `${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`
  }
  if (typeof val === 'string') {
    const parts = val.includes('/') ? val.split('/') : val.split('-')
    if (parts.length === 3) {
      const [a, b, c] = parts
      if (a.length === 4) return `${a}-${b.padStart(2,'0')}-${c.padStart(2,'0')}`
      return `${c}-${b.padStart(2,'0')}-${a.padStart(2,'0')}`
    }
  }
  return null
}

async function recalcularPrima(polizaId: string) {
  const { count } = await supabase
    .from('poliza_afiliados')
    .select('*', { count: 'exact', head: true })
    .eq('poliza_id', polizaId)
    .eq('activo', true)

  const { data: pol } = await supabase
    .from('polizas')
    .select('prima_por_afiliado')
    .eq('id', polizaId)
    .single()

  if (pol?.prima_por_afiliado != null && count != null) {
    await supabase
      .from('polizas')
      .update({ prima: pol.prima_por_afiliado * count })
      .eq('id', polizaId)
  }
}

export default function ImportAfiliadosModal({ poliza, clienteTipo, workspaceId, onClose, onSaved }: Props) {
  const fileRef  = useRef<HTMLInputElement>(null)
  const [file, setFile]       = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<RowResult[] | null>(null)
  const [stats, setStats]     = useState({ ok: 0, err: 0 })

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setFile(e.target.files?.[0] ?? null)
    setResults(null)
  }

  async function importar() {
    if (!file) return
    setLoading(true)

    const buffer  = await file.arrayBuffer()
    const wb      = XLSX.read(buffer, { cellDates: true })
    const ws      = wb.Sheets[wb.SheetNames[0]]
    const rows    = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { header: 1, defval: '' })

    if (rows.length < 2) { setLoading(false); return }

    const headers = (rows[0] as unknown as string[]).map(String)
    const iNombre      = col(headers, ['nombre', 'nombre completo', 'afiliado', 'empleado'])
    const iDocumento   = col(headers, ['documento', 'cedula', 'cedula', 'id', 'cc'])
    const iNacimiento  = col(headers, ['nacimiento', 'fecha nacimiento', 'fecha_nacimiento', 'fnac'])
    const iInicio      = col(headers, ['inicio', 'fecha inicio', 'fecha_inicio', 'vinculacion', 'vinculación'])
    const iPolizaInd   = col(headers, ['poliza individual', 'poliza_individual', 'n poliza', 'numero poliza'])
    const iParentesco  = col(headers, ['parentesco', 'relacion', 'relación', 'cargo'])

    const rowResults: RowResult[] = []
    let okCount = 0, errCount = 0

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i] as unknown as unknown[]
      const nombre    = String(r[iNombre] ?? '').trim()
      const documento = String(r[iDocumento] ?? '').trim()

      if (!nombre && !documento) continue // fila vacía

      if (!nombre || !documento) {
        rowResults.push({ fila: i + 1, nombre: nombre || '(sin nombre)', ok: false, error: 'Nombre y documento son obligatorios' })
        errCount++
        continue
      }

      const fechaInicio = parseDate(r[iInicio])
      if (!fechaInicio) {
        rowResults.push({ fila: i + 1, nombre, ok: false, error: 'Fecha de inicio inválida o vacía' })
        errCount++
        continue
      }

      const payload = {
        workspace_id:             workspaceId,
        poliza_id:                poliza.id,
        nombre_completo:          nombre,
        numero_documento:         documento,
        fecha_nacimiento:         iNacimiento !== -1 ? parseDate(r[iNacimiento]) : null,
        fecha_inicio:             fechaInicio,
        numero_poliza_individual: iPolizaInd !== -1 ? String(r[iPolizaInd] ?? '').trim() || null : null,
        parentesco:               iParentesco !== -1 ? String(r[iParentesco] ?? '').trim() || null : null,
        activo:                   true,
      }

      // Upsert por (poliza_id, numero_documento)
      const { data: existing } = await supabase
        .from('poliza_afiliados')
        .select('id')
        .eq('poliza_id', poliza.id)
        .eq('numero_documento', documento)
        .maybeSingle()

      const { error } = existing
        ? await supabase.from('poliza_afiliados').update(payload).eq('id', existing.id)
        : await supabase.from('poliza_afiliados').insert(payload)

      if (error) {
        rowResults.push({ fila: i + 1, nombre, ok: false, error: error.message })
        errCount++
      } else {
        rowResults.push({ fila: i + 1, nombre, ok: true })
        okCount++
      }
    }

    await recalcularPrima(poliza.id)
    setResults(rowResults)
    setStats({ ok: okCount, err: errCount })
    setLoading(false)
  }

  const done = results !== null

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary-500" />
            <h2 className="font-semibold text-ink-800">Importar afiliados desde Excel</h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {!done ? (
            <>
              {/* Instrucciones */}
              <div className="bg-cream-100 rounded-xl p-4 text-xs text-ink-500 space-y-1">
                <p className="font-medium text-ink-700 mb-2">Columnas que debe tener el archivo:</p>
                <p>• <strong>Nombre completo</strong> (obligatorio)</p>
                <p>• <strong>Documento / Cédula</strong> (obligatorio)</p>
                <p>• <strong>Fecha inicio</strong> (obligatorio) — formato dd/mm/aaaa</p>
                <p>• Fecha nacimiento (opcional)</p>
                <p>• N° póliza individual (opcional)</p>
                <p>• Parentesco / Cargo (opcional{clienteTipo === 'grupo_familiar' ? ', se recomienda' : ''})</p>
                <p className="mt-2 text-ink-400">Los afiliados existentes (mismo documento) se actualizarán.</p>
              </div>

              {/* Selector de archivo */}
              <div
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  file ? 'border-primary-400 bg-primary-50' : 'border-slate-300 hover:border-primary-300 hover:bg-cream-50'
                }`}
              >
                <Upload className="w-8 h-8 mx-auto mb-2 text-ink-400" />
                {file ? (
                  <p className="text-sm font-medium text-primary-700">{file.name}</p>
                ) : (
                  <>
                    <p className="text-sm text-ink-500">Haz clic para seleccionar un archivo</p>
                    <p className="text-xs text-ink-400 mt-1">.xlsx · .xls · .csv</p>
                  </>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={onFileChange}
                  className="hidden"
                />
              </div>
            </>
          ) : (
            <>
              {/* Resultados */}
              <div className="flex gap-3">
                <div className="flex-1 bg-primary-50 rounded-xl p-4 text-center">
                  <p className="text-2xl font-bold text-primary-700">{stats.ok}</p>
                  <p className="text-xs text-primary-600 mt-0.5">importados correctamente</p>
                </div>
                {stats.err > 0 && (
                  <div className="flex-1 bg-error-soft rounded-xl p-4 text-center">
                    <p className="text-2xl font-bold text-error">{stats.err}</p>
                    <p className="text-xs text-error mt-0.5">con errores</p>
                  </div>
                )}
              </div>

              {stats.err > 0 && (
                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                  <p className="text-xs font-medium text-ink-500">Filas con errores:</p>
                  {results.filter(r => !r.ok).map(r => (
                    <div key={r.fila} className="flex items-start gap-2 text-xs bg-error-soft/50 rounded-lg px-3 py-2">
                      <AlertTriangle className="w-3.5 h-3.5 text-error flex-shrink-0 mt-0.5" />
                      <span className="text-ink-600">
                        <span className="font-medium">Fila {r.fila}</span> — {r.nombre}: {r.error}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {stats.ok > 0 && (
                <div className="flex items-center gap-2 text-sm text-primary-700 bg-primary-50 rounded-xl px-4 py-3">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" />
                  <span>Prima de la póliza recalculada automáticamente.</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-ink-600 border border-slate-200 rounded-lg hover:bg-cream-100 transition-colors"
          >
            {done ? 'Cerrar' : 'Cancelar'}
          </button>
          {!done && (
            <button
              onClick={importar}
              disabled={!file || loading}
              className="flex items-center gap-2 px-5 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
            >
              <Upload className="w-4 h-4" />
              {loading ? 'Importando…' : 'Importar'}
            </button>
          )}
          {done && stats.ok > 0 && (
            <button
              onClick={onSaved}
              className="px-5 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
            >
              Listo
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
