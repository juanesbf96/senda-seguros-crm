'use client'
import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { X, Upload, CheckCircle, AlertCircle, FileText } from 'lucide-react'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface ParsedRow {
  nombre: string
  cedula: string
  telefono: string
  email: string
  notas: string
  etapa: 'nuevo'
}

interface Props {
  onClose: () => void
  onImported: () => void
}

function normalizeHeader(h: string): string {
  return h
    .replace(/^﻿/, '')   // quitar BOM UTF-8
    .replace(/[""]/g, '')     // quitar comillas tipográficas
    .replace(/"/g, '')        // quitar comillas rectas
    .trim()
    .toLowerCase()
    .normalize('NFC')         // normalizar tildes (é, ú, etc.)
}

function splitLine(line: string, sep: string): string[] {
  // Maneja campos entre comillas que pueden contener el separador
  const result: string[] = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if ((ch === '"' || ch === '“' || ch === '”') && !inQuotes) {
      inQuotes = true
    } else if ((ch === '"' || ch === '”') && inQuotes) {
      inQuotes = false
    } else if (ch === sep && !inQuotes) {
      result.push(cur.trim())
      cur = ''
    } else {
      cur += ch
    }
  }
  result.push(cur.trim())
  return result
}

function detectSeparator(headerLine: string): string {
  const commas = (headerLine.match(/,/g) || []).length
  const semicolons = (headerLine.match(/;/g) || []).length
  return semicolons > commas ? ';' : ','
}

function parseCSV(text: string): { rows: ParsedRow[]; errors: string[]; sep: string } {
  const lines = text
    .split(/\r?\n/)
    .map(l => l.replace(/^﻿/, '').trimEnd())
    .filter(l => l.trim().length > 0)

  if (lines.length < 2) return { rows: [], errors: ['El archivo está vacío o solo tiene encabezado.'], sep: ',' }

  const sep = detectSeparator(lines[0])
  const header = splitLine(lines[0], sep).map(normalizeHeader)

  const idx = {
    nombre:   header.findIndex(h => h === 'nombre cliente'),
    tipoId:   header.findIndex(h => h === 'tipo id'),
    numero:   header.findIndex(h => h === 'número' || h === 'numero'),
    fechaNac: header.findIndex(h => h === 'fecha de nacimiento'),
    celular:  header.findIndex(h => h === 'celular'),
    correo:   header.findIndex(h => h === 'correo'),
  }

  const errors: string[] = []
  if (idx.nombre === -1) {
    errors.push(
      `No se encontró "Nombre cliente". Encabezados detectados: ${header.map(h => `"${h}"`).join(', ')}`
    )
  }
  if (errors.length > 0) return { rows: [], errors, sep }

  const rows: ParsedRow[] = []

  for (let i = 1; i < lines.length; i++) {
    const cols = splitLine(lines[i], sep)

    // Ignorar filas vacías (todas las columnas vacías)
    if (cols.every(c => c === '' || c === undefined)) continue

    const nombre = idx.nombre >= 0 ? cols[idx.nombre] || '' : ''
    if (!nombre) continue // ignorar filas sin nombre

    const tipoId = idx.tipoId >= 0 ? cols[idx.tipoId] || '' : ''
    const numero = idx.numero >= 0 ? cols[idx.numero] || '' : ''
    const fechaNac = idx.fechaNac >= 0 ? cols[idx.fechaNac] || '' : ''
    const celular = idx.celular >= 0 ? cols[idx.celular] || '' : ''
    const correo = idx.correo >= 0 ? cols[idx.correo] || '' : ''

    // Guardar solo el número en cédula
    const cedulaStr = numero || ''

    // Fecha de nacimiento en notas (ignorar "NA" y valores vacíos)
    const fechaValida = fechaNac && fechaNac.toUpperCase() !== 'NA' && fechaNac !== ''
    const notasStr = fechaValida ? `Nacimiento: ${fechaNac}` : ''

    rows.push({
      nombre,
      cedula: cedulaStr,
      telefono: celular,
      email: correo,
      notas: notasStr,
      etapa: 'nuevo',
    })
  }

  return { rows, errors, sep }
}

type Stage = 'idle' | 'preview' | 'importing' | 'done'

export default function ImportModal({ onClose, onImported }: Props) {
  const { currentWorkspace } = useWorkspace()
  const inputRef = useRef<HTMLInputElement>(null)
  const [stage, setStage] = useState<Stage>('idle')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<ParsedRow[]>([])
  const [parseErrors, setParseErrors] = useState<string[]>([])
  const [imported, setImported] = useState(0)
  const [failed, setFailed] = useState(0)

  function handleFile(file: File) {
    setFileName(file.name)
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const { rows: parsed, errors } = parseCSV(text)
      setParseErrors(errors)
      setRows(parsed)
      setStage('preview')
    }
    reader.readAsText(file, 'UTF-8')
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

  async function importar() {
    setStage('importing')
    let ok = 0
    let err = 0

    // Insert en lotes de 50
    const BATCH = 50
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH).map(r => ({
        nombre: r.nombre,
        cedula: r.cedula || null,
        telefono: r.telefono || null,
        email: r.email || null,
        notas: r.notas || null,
        etapa: r.etapa,
        workspace_id: currentWorkspace?.id,
      }))
      const { error } = await supabase.from('clientes').insert(batch)
      if (error) {
        err += batch.length
      } else {
        ok += batch.length
      }
    }

    setImported(ok)
    setFailed(err)
    setStage('done')
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 flex-shrink-0">
          <h2 className="font-semibold text-slate-800 flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-600" />
            Importar clientes desde CSV
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">

          {/* IDLE - zona de carga */}
          {stage === 'idle' && (
            <div>
              <p className="text-sm text-slate-500 mb-4">
                Acepta archivos <strong>.csv</strong> — el separador se detecta automáticamente (<code className="bg-slate-100 px-1 rounded">,</code> o <code className="bg-slate-100 px-1 rounded">;</code>).
                Columnas esperadas: <span className="text-slate-700">Nombre cliente · Tipo ID · Número · Fecha de nacimiento · Celular · Correo</span>
              </p>
              <div
                onDrop={onDrop}
                onDragOver={e => e.preventDefault()}
                onClick={() => inputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-emerald-400 rounded-xl p-10 text-center cursor-pointer transition-colors"
              >
                <Upload className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 text-sm font-medium">Arrastra tu archivo aquí o haz clic para seleccionar</p>
                <p className="text-xs text-slate-400 mt-1">Solo archivos .csv</p>
                <input ref={inputRef} type="file" accept=".csv,text/csv" onChange={onFileChange} className="hidden" />
              </div>
            </div>
          )}

          {/* PREVIEW */}
          {stage === 'preview' && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <FileText className="w-4 h-4 text-slate-400" />
                <span className="text-sm text-slate-600 font-medium">{fileName}</span>
                <span className="text-xs text-slate-400">· {rows.length} registros encontrados</span>
              </div>

              {parseErrors.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 space-y-1">
                  {parseErrors.map((e, i) => <p key={i}>⚠ {e}</p>)}
                </div>
              )}

              {rows.length > 0 && (
                <>
                  <p className="text-xs text-slate-500 mb-2 font-medium uppercase tracking-wide">
                    Previsualización — primeros {Math.min(5, rows.length)} registros
                  </p>
                  <div className="overflow-x-auto rounded-lg border border-slate-200 mb-4">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50 text-slate-500">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium">Nombre</th>
                          <th className="px-3 py-2 text-left font-medium">Cédula / NIT</th>
                          <th className="px-3 py-2 text-left font-medium">Teléfono</th>
                          <th className="px-3 py-2 text-left font-medium">Email</th>
                          <th className="px-3 py-2 text-left font-medium">Notas</th>
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(0, 5).map((r, i) => (
                          <tr key={i} className="border-t border-slate-100">
                            <td className="px-3 py-2 text-slate-800 font-medium">{r.nombre}</td>
                            <td className="px-3 py-2 text-slate-600">{r.cedula || '—'}</td>
                            <td className="px-3 py-2 text-slate-600">{r.telefono || '—'}</td>
                            <td className="px-3 py-2 text-slate-600 truncate max-w-[140px]">{r.email || '—'}</td>
                            <td className="px-3 py-2 text-slate-400">{r.notas || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {rows.length > 5 && (
                    <p className="text-xs text-slate-400 mb-4">
                      ... y {rows.length - 5} registros más que también se importarán.
                    </p>
                  )}
                  <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-700">
                    <strong>Mapeo automático:</strong> Nombre cliente → nombre · Tipo ID + Número → cédula · Celular → teléfono · Correo → email · Fechas NA ignoradas · Etapa: Nuevo
                  </div>
                </>
              )}
            </div>
          )}

          {/* IMPORTING */}
          {stage === 'importing' && (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600 mb-4" />
              <p className="text-slate-600 font-medium">Importando {rows.length} registros...</p>
              <p className="text-xs text-slate-400 mt-1">Esto puede tardar unos segundos</p>
            </div>
          )}

          {/* DONE */}
          {stage === 'done' && (
            <div className="flex flex-col items-center justify-center py-10">
              <CheckCircle className="w-14 h-14 text-emerald-500 mb-4" />
              <p className="text-xl font-bold text-slate-800 mb-1">
                {imported} cliente{imported !== 1 ? 's' : ''} importado{imported !== 1 ? 's' : ''}
              </p>
              {failed > 0 && (
                <div className="flex items-center gap-2 mt-2 text-sm text-red-600">
                  <AlertCircle className="w-4 h-4" />
                  {failed} fila{failed !== 1 ? 's' : ''} no se pudo importar
                </div>
              )}
              <p className="text-sm text-slate-400 mt-3">Ya puedes ver tus clientes en la lista</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 border-t border-slate-200 flex-shrink-0">
          {stage === 'done' ? (
            <button
              onClick={() => { onImported(); onClose() }}
              className="w-full px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
            >
              Ver clientes importados
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors"
              >
                Cancelar
              </button>
              {stage === 'preview' && rows.length > 0 && parseErrors.length === 0 && (
                <button
                  onClick={importar}
                  className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors"
                >
                  Importar {rows.length} cliente{rows.length !== 1 ? 's' : ''}
                </button>
              )}
              {stage === 'preview' && (rows.length === 0 || parseErrors.length > 0) && (
                <button
                  onClick={() => { setStage('idle'); setRows([]); setParseErrors([]) }}
                  className="flex-1 px-4 py-2 rounded-lg bg-slate-700 text-white text-sm font-medium hover:bg-slate-800 transition-colors"
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
