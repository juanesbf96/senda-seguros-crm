'use client'
import { useRef, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import type { Poliza, ResultadoExtraccionCaratula } from '@/types'
import {
  borradorAPoliza, camposBorrador, mapearRamo, ETIQUETAS_BORRADOR,
} from '@/lib/polizas/borradorCaratula'
import {
  X, Upload, FileText, AlertTriangle, Sparkles, Check, UserPlus, Loader2, ScanLine,
} from 'lucide-react'

/** Lo que el modal entrega al padre para abrir PolizaModal pre-llenado. */
export interface PrefillCaratula {
  poliza: Partial<Poliza>
  /** Texto del aviso a mostrar dentro del formulario; null si no hace falta. */
  aviso: string | null
}

interface Props {
  onClose: () => void
  onContinuar: (prefill: PrefillCaratula) => void
}

type Paso = 'subir' | 'preview'

interface TomadorResuelto {
  estado: 'buscando' | 'encontrado' | 'sin_match' | 'sin_documento'
  clienteId?: string
  clienteNombre?: string
}

const cls = 'w-full border border-ink-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400'

/** Documentos vienen con puntos y guiones ('900.123.456-7'); se compara también en crudo. */
function variantesDocumento(doc: string): string[] {
  const limpio = doc.trim()
  const digitos = limpio.replace(/\D/g, '')
  // El NIT suele venir con dígito de verificación: se prueba también sin él.
  const sinDv = digitos.length > 9 ? digitos.slice(0, -1) : null
  return [...new Set([limpio, digitos, sinDv].filter(Boolean) as string[])]
}

export default function ExtraerCaratulaModal({ onClose, onContinuar }: Props) {
  const { currentWorkspace } = useWorkspace()
  const inputRef = useRef<HTMLInputElement>(null)

  const [paso,      setPaso]      = useState<Paso>('subir')
  const [archivo,   setArchivo]   = useState<File | null>(null)
  const [cargando,  setCargando]  = useState(false)
  const [error,     setError]     = useState('')
  const [resultado, setResultado] = useState<ResultadoExtraccionCaratula | null>(null)
  const [tomador,   setTomador]   = useState<TomadorResuelto>({ estado: 'sin_documento' })

  // Alta explícita del tomador (nunca automática: los datos pueden venir de una IA)
  const [creando,     setCreando]     = useState(false)
  const [nuevoNombre, setNuevoNombre] = useState('')
  const [nuevoDoc,    setNuevoDoc]    = useState('')
  const [nuevoEsEmpresa, setNuevoEsEmpresa] = useState(false)

  async function extraer() {
    if (!archivo || !currentWorkspace) return
    setCargando(true); setError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setError('Sesión expirada, vuelve a iniciar sesión.'); setCargando(false); return }

    const fd = new FormData()
    fd.append('file', archivo)
    fd.append('workspaceId', currentWorkspace.id)

    let res: Response
    try {
      res = await fetch('/api/polizas/extraer-caratula', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: fd,
      })
    } catch {
      setError('No se pudo contactar el servidor. Revisa tu conexión.')
      setCargando(false); return
    }

    const json = await res.json().catch(() => null)
    setCargando(false)
    if (!res.ok) {
      setError(json?.error || 'No se pudo procesar el PDF.')
      return
    }

    const data = json as ResultadoExtraccionCaratula
    setResultado(data)
    setPaso('preview')
    setNuevoNombre(data.borrador.tomador_nombre ?? '')
    setNuevoDoc(data.borrador.tomador_documento ?? '')
    void resolverTomador(data)
  }

  /** Busca el tomador por documento (cédula o NIT). Nunca crea nada por su cuenta. */
  async function resolverTomador(data: ResultadoExtraccionCaratula) {
    const doc = data.borrador.tomador_documento
    if (!doc || !currentWorkspace) { setTomador({ estado: 'sin_documento' }); return }
    setTomador({ estado: 'buscando' })

    const variantes = variantesDocumento(doc)
    const filtro = variantes.flatMap(v => [`cedula.eq.${v}`, `nit.eq.${v}`]).join(',')
    const { data: encontrados } = await supabase
      .from('clientes')
      .select('id, nombre')
      .eq('workspace_id', currentWorkspace.id)
      .or(filtro)
      .limit(1)

    const cli = encontrados?.[0]
    setTomador(cli
      ? { estado: 'encontrado', clienteId: cli.id, clienteNombre: cli.nombre }
      : { estado: 'sin_match' })
  }

  async function crearTomador() {
    if (!currentWorkspace || !nuevoNombre.trim()) return
    setCreando(true); setError('')
    const { data: { user } } = await supabase.auth.getUser()
    const doc = nuevoDoc.trim() || null

    const { data: creado, error: err } = await supabase
      .from('clientes')
      .insert({
        nombre:       nuevoNombre.trim(),
        tipo_cliente: nuevoEsEmpresa ? 'empresa' : 'persona_natural',
        razon_social: nuevoEsEmpresa ? nuevoNombre.trim() : null,
        cedula:       nuevoEsEmpresa ? null : doc,
        nit:          nuevoEsEmpresa ? doc  : null,
        etapa:        'cerrado',   // llegó con una póliza en mano
        workspace_id: currentWorkspace.id,
        assigned_to:  user?.id ?? null,
      })
      .select('id, nombre')
      .single()

    setCreando(false)
    if (err) { setError(`No se pudo crear el cliente: ${err.message}`); return }
    setTomador({ estado: 'encontrado', clienteId: creado.id, clienteNombre: creado.nombre })
  }

  function continuar() {
    if (!resultado) return
    const revision = resultado.confianza === 'requiere_revision'
    const ramo = mapearRamo(resultado.borrador.ramo)

    const notas: string[] = []
    if (revision) {
      notas.push(resultado.origen === 'ia'
        ? 'Los datos los extrajo la IA desde el PDF: revísalos campo por campo antes de guardar.'
        : 'La extracción quedó incompleta: revisa los datos antes de guardar.')
    }
    if (resultado.campos_faltantes.length) {
      const faltan = resultado.campos_faltantes
        .map(c => ETIQUETAS_BORRADOR[c as keyof typeof ETIQUETAS_BORRADOR] ?? c)
        .join(', ')
      notas.push(`No se pudo leer del PDF: ${faltan}.`)
    }
    if (ramo.inferido) notas.push(`El ramo "${ramo.valor}" es una sugerencia: confírmalo.`)
    if (resultado.borrador.prima != null) {
      notas.push('La prima se cargó como prima neta (antes de IVA); verifica si la carátula traía la prima total.')
    }

    onContinuar({
      poliza: borradorAPoliza(resultado.borrador, tomador.clienteId),
      aviso:  notas.length ? notas.join(' ') : null,
    })
  }

  const filas = resultado ? camposBorrador(resultado.borrador, resultado.campos_faltantes) : []
  const requiereRevision = resultado?.confianza === 'requiere_revision'

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-ink-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-ink-700 flex items-center gap-2">
            <ScanLine className="w-5 h-5 text-primary-500" />
            Cargar póliza desde PDF
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {paso === 'subir' && (
            <>
              <p className="text-sm text-ink-500">
                Sube la carátula de la póliza en PDF. Se extraen los datos y luego
                puedes revisarlos y corregirlos antes de crearla.
              </p>
              <div
                onClick={() => inputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setArchivo(f) }}
                className="border-2 border-dashed border-ink-200 rounded-xl p-8 text-center cursor-pointer hover:border-primary-400 hover:bg-primary-50 transition-colors">
                {archivo ? (
                  <div className="flex items-center justify-center gap-2 text-sm text-ink-700">
                    <FileText className="w-5 h-5 text-primary-500" />
                    <span className="font-medium">{archivo.name}</span>
                    <span className="text-ink-400">({(archivo.size / 1024).toFixed(0)} KB)</span>
                  </div>
                ) : (
                  <div className="text-ink-400">
                    <Upload className="w-8 h-8 mx-auto mb-2" />
                    <p className="text-sm">Arrastra el PDF aquí o haz clic para seleccionar</p>
                    <p className="text-xs mt-1">Solo PDF con texto (no sirve un escaneo en imagen)</p>
                  </div>
                )}
              </div>
              <input ref={inputRef} type="file" accept=".pdf,application/pdf" className="hidden"
                onChange={e => setArchivo(e.target.files?.[0] ?? null)} />
            </>
          )}

          {paso === 'preview' && resultado && (
            <>
              {/* Aviso de confianza: lo más importante de la pantalla */}
              {requiereRevision ? (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                  <Sparkles className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <p className="font-medium">Revisa los datos antes de crear la póliza</p>
                    <p className="text-xs mt-0.5">
                      {resultado.origen === 'ia'
                        ? 'Los completó la IA a partir del PDF, así que pueden tener errores.'
                        : 'La lectura del PDF quedó incompleta.'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2 bg-primary-50 border border-primary-200 rounded-lg px-4 py-3 text-sm text-primary-700">
                  <Check className="w-4 h-4 mt-0.5 shrink-0" />
                  <p>Datos leídos directamente del PDF. Aun así puedes corregirlos en el formulario.</p>
                </div>
              )}

              <div className="flex items-center gap-2 text-xs text-ink-400">
                <span className="px-2 py-0.5 rounded-full bg-cream-100 border border-ink-200">
                  Origen: {resultado.origen === 'ia' ? 'IA' : 'lectura directa'}
                </span>
                {resultado.aseguradora_detectada && (
                  <span className="px-2 py-0.5 rounded-full bg-cream-100 border border-ink-200">
                    Aseguradora detectada: {resultado.aseguradora_detectada}
                  </span>
                )}
              </div>

              {/* Campos extraídos */}
              <div className="border border-ink-200 rounded-lg divide-y divide-ink-100">
                {filas.map(f => (
                  <div key={f.campo} className="flex items-center justify-between px-3 py-2 text-sm">
                    <span className="text-ink-400">{f.label}</span>
                    {f.valor ? (
                      <span className="text-ink-700 font-medium text-right">{f.valor}</span>
                    ) : (
                      <span className="text-amber-600 text-xs">no se encontró</span>
                    )}
                  </div>
                ))}
              </div>

              {/* Tomador */}
              <div className="border border-ink-200 rounded-lg p-3 space-y-2">
                <p className="text-xs font-semibold text-ink-500 uppercase tracking-wide">Cliente tomador</p>

                {tomador.estado === 'buscando' && (
                  <p className="text-sm text-ink-400 flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin" /> Buscando por documento…
                  </p>
                )}

                {tomador.estado === 'encontrado' && (
                  <p className="text-sm text-primary-700 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    Se vinculará a <strong>{tomador.clienteNombre}</strong>
                  </p>
                )}

                {tomador.estado === 'sin_documento' && (
                  <p className="text-sm text-ink-400">
                    El PDF no traía documento del tomador. Elige el cliente en el formulario.
                  </p>
                )}

                {tomador.estado === 'sin_match' && (
                  <>
                    <p className="text-sm text-ink-500">
                      Ningún cliente tiene el documento <strong>{resultado.borrador.tomador_documento}</strong>.
                      Créalo ahora o elígelo tú en el formulario.
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      <input value={nuevoNombre} onChange={e => setNuevoNombre(e.target.value)}
                        placeholder="Nombre / razón social" className={cls} />
                      <input value={nuevoDoc} onChange={e => setNuevoDoc(e.target.value)}
                        placeholder="Documento" className={cls} />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-ink-500">
                      <input type="checkbox" checked={nuevoEsEmpresa}
                        onChange={e => setNuevoEsEmpresa(e.target.checked)} />
                      Es una empresa (el documento se guarda como NIT)
                    </label>
                    <button onClick={crearTomador} disabled={creando || !nuevoNombre.trim()}
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-300 bg-primary-50 text-primary-700 text-sm font-medium hover:bg-primary-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                      <UserPlus className="w-4 h-4" />
                      {creando ? 'Creando…' : 'Crear cliente'}
                    </button>
                  </>
                )}
              </div>
            </>
          )}

          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-ink-200 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 text-sm text-ink-500 hover:text-ink-700">
            Cancelar
          </button>
          {paso === 'subir' ? (
            <button onClick={extraer} disabled={!archivo || cargando}
              className="inline-flex items-center gap-2 bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
              {cargando ? <><Loader2 className="w-4 h-4 animate-spin" /> Leyendo PDF…</> : 'Extraer datos'}
            </button>
          ) : (
            <>
              <button onClick={() => { setPaso('subir'); setResultado(null); setArchivo(null); setError('') }}
                className="px-4 py-2 text-sm text-ink-500 hover:text-ink-700">
                Subir otro
              </button>
              <button onClick={continuar} disabled={tomador.estado === 'buscando'}
                className="bg-primary-500 hover:bg-primary-700 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-40 transition-colors">
                Continuar al formulario
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
