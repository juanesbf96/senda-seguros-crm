'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { usePermissions } from '@/contexts/PermissionsContext'
import { formatCOP } from '@/lib/utils'
import { Plus, Pencil, Trash2, Check, X, Loader2 } from 'lucide-react'

/**
 * Tabla editable para sub-registros de una póliza (coberturas, certificados).
 *
 * Coberturas y certificados son el mismo widget con distintas columnas, así que
 * se comparte en vez de duplicar el CRUD. Sigue el patrón visual de AfiliadosTab.
 *
 * Las escrituras están atadas al permiso `polizas_editar` — igual que las
 * políticas RLS de estas tablas (ver migration_modelo_polizas_v2.sql), así que
 * la UI no ofrece acciones que la base vaya a rechazar.
 */

export type TipoCampo = 'texto' | 'numero' | 'moneda' | 'fecha' | 'select'

export interface CampoSubTabla {
  key: string
  label: string
  tipo: TipoCampo
  requerido?: boolean
  opciones?: { valor: string; label: string }[]
  /** Clases para ocultar la columna en pantallas pequeñas */
  claseCelda?: string
  /** Mostrar la suma de la columna en el pie */
  sumar?: boolean
}

interface Props {
  tabla: 'coberturas' | 'certificados'
  polizaId: string
  workspaceId: string
  titulo: string
  /** Texto del estado vacío */
  vacio: string
  campos: CampoSubTabla[]
  /** Valores por defecto al crear una fila */
  defaults?: Record<string, unknown>
}

type Fila = Record<string, unknown> & { id: string }

function celdaVisible(campo: CampoSubTabla, valor: unknown): string {
  if (valor === null || valor === undefined || valor === '') return '—'
  if (campo.tipo === 'moneda') return formatCOP(Number(valor))
  if (campo.tipo === 'numero') return Number(valor).toLocaleString('es-CO')
  if (campo.tipo === 'select') {
    return campo.opciones?.find(o => o.valor === valor)?.label ?? String(valor)
  }
  return String(valor)
}

const inputCls =
  'w-full border border-ink-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-400'

export default function SubTablaPoliza({
  tabla, polizaId, workspaceId, titulo, vacio, campos, defaults = {},
}: Props) {
  const { can } = usePermissions()
  const puedeEditar = can('polizas_editar')

  const [filas, setFilas]       = useState<Fila[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')
  const [guardando, setGuardando] = useState(false)
  /** id de la fila en edición, o '__nueva__' para el alta */
  const [editandoId, setEditandoId] = useState<string | null>(null)
  const [borrador, setBorrador]     = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    const { data, error: err } = await supabase
      .from(tabla)
      .select('*')
      .eq('workspace_id', workspaceId)
      .eq('poliza_id', polizaId)
      .order('created_at', { ascending: true })
    if (err) setError(err.message)
    else setFilas((data ?? []) as Fila[])
    setLoading(false)
  }, [tabla, polizaId, workspaceId])

  useEffect(() => { load() }, [load])

  function abrirNueva() {
    setError('')
    setBorrador(Object.fromEntries(campos.map(c => [c.key, ''])))
    setEditandoId('__nueva__')
  }

  function abrirEdicion(f: Fila) {
    setError('')
    setBorrador(Object.fromEntries(
      campos.map(c => [c.key, f[c.key] === null || f[c.key] === undefined ? '' : String(f[c.key])])
    ))
    setEditandoId(f.id)
  }

  function cancelar() { setEditandoId(null); setBorrador({}); setError('') }

  /** Convierte el borrador (todo string) a los tipos que espera la BD. */
  function aPayload(): Record<string, unknown> | null {
    const payload: Record<string, unknown> = {}
    for (const c of campos) {
      const bruto = (borrador[c.key] ?? '').trim()
      if (c.requerido && !bruto) {
        setError(`"${c.label}" es obligatorio`)
        return null
      }
      if (!bruto) { payload[c.key] = null; continue }
      if (c.tipo === 'numero' || c.tipo === 'moneda') {
        const n = parseFloat(bruto.replace(/[^0-9.-]/g, ''))
        if (isNaN(n)) { setError(`"${c.label}" debe ser un número`); return null }
        payload[c.key] = n
      } else {
        payload[c.key] = bruto
      }
    }
    return payload
  }

  async function guardar() {
    const payload = aPayload()
    if (!payload) return
    setGuardando(true); setError('')

    const esNueva = editandoId === '__nueva__'
    const { error: err } = esNueva
      ? await supabase.from(tabla).insert({
          ...defaults, ...payload, poliza_id: polizaId, workspace_id: workspaceId,
        })
      : await supabase.from(tabla).update(payload).eq('id', editandoId!)

    setGuardando(false)
    if (err) { setError(err.message); return }   // no se traga el error: RLS o validación se ven
    cancelar()
    await load()
  }

  async function borrar(id: string) {
    if (!confirm(`¿Eliminar este registro de ${titulo.toLowerCase()}?`)) return
    const { error: err } = await supabase.from(tabla).delete().eq('id', id)
    if (err) { setError(err.message); return }
    await load()
  }

  const totales = campos.filter(c => c.sumar)
  const hayTotales = totales.length > 0 && filas.length > 0

  if (loading) return (
    <div className="bg-white rounded-xl border border-ink-200 p-5 flex items-center gap-2 text-ink-400 text-sm">
      <Loader2 className="w-4 h-4 animate-spin" /> Cargando {titulo.toLowerCase()}…
    </div>
  )

  const editandoNueva = editandoId === '__nueva__'

  return (
    <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
      <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-ink-100">
        <h3 className="font-semibold text-ink-700 text-sm">
          {titulo}
          {filas.length > 0 && (
            <span className="ml-2 text-xs font-normal text-ink-400">{filas.length}</span>
          )}
        </h3>
        {puedeEditar && !editandoNueva && (
          <button onClick={abrirNueva}
            className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-700 transition-colors">
            <Plus className="w-3.5 h-3.5" /> Agregar
          </button>
        )}
      </div>

      {error && (
        <p className="mx-5 mt-3 text-sm text-error bg-error-soft rounded-lg px-3 py-2">{error}</p>
      )}

      {filas.length === 0 && !editandoNueva ? (
        <div className="px-5 py-8 text-center">
          <p className="text-sm text-ink-400">{vacio}</p>
          {puedeEditar && (
            <button onClick={abrirNueva} className="mt-2 text-sm text-primary-500 hover:underline">
              + Agregar el primero
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 border-b border-ink-200">
              <tr className="text-left text-xs text-ink-400">
                {campos.map(c => (
                  <th key={c.key} className={`px-4 py-3 font-medium ${c.claseCelda ?? ''}`}>{c.label}</th>
                ))}
                {puedeEditar && <th className="px-4 py-3 font-medium text-right">Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {filas.map(f => {
                const enEdicion = editandoId === f.id
                return (
                  <tr key={f.id} className={`border-b border-cream-200 ${enEdicion ? 'bg-primary-50' : 'hover:bg-cream-50'} transition-colors`}>
                    {campos.map(c => (
                      <td key={c.key} className={`px-4 py-2.5 ${c.claseCelda ?? ''} ${c.tipo === 'texto' ? 'text-ink-700' : 'text-ink-500'}`}>
                        {enEdicion
                          ? <CampoInput campo={c} valor={borrador[c.key] ?? ''}
                              onChange={v => setBorrador(b => ({ ...b, [c.key]: v }))} />
                          : celdaVisible(c, f[c.key])}
                      </td>
                    ))}
                    {puedeEditar && (
                      <td className="px-4 py-2.5">
                        <div className="flex items-center justify-end gap-2">
                          {enEdicion ? (
                            <>
                              <button onClick={guardar} disabled={guardando}
                                className="text-primary-600 hover:text-primary-700 disabled:opacity-40" title="Guardar">
                                {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </button>
                              <button onClick={cancelar} className="text-ink-400 hover:text-ink-600" title="Cancelar">
                                <X className="w-4 h-4" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button onClick={() => abrirEdicion(f)} className="text-ink-400 hover:text-ink-600" title="Editar">
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button onClick={() => borrar(f.id)} className="text-ink-400 hover:text-error" title="Eliminar">
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                )
              })}

              {editandoNueva && (
                <tr className="border-b border-cream-200 bg-primary-50">
                  {campos.map(c => (
                    <td key={c.key} className={`px-4 py-2.5 ${c.claseCelda ?? ''}`}>
                      <CampoInput campo={c} valor={borrador[c.key] ?? ''}
                        onChange={v => setBorrador(b => ({ ...b, [c.key]: v }))} />
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={guardar} disabled={guardando}
                        className="text-primary-600 hover:text-primary-700 disabled:opacity-40" title="Guardar">
                        {guardando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      </button>
                      <button onClick={cancelar} className="text-ink-400 hover:text-ink-600" title="Cancelar">
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>

            {hayTotales && (
              <tfoot className="bg-cream-100 border-t border-ink-200">
                <tr className="text-xs">
                  {campos.map((c, i) => (
                    <td key={c.key} className={`px-4 py-2.5 font-semibold text-ink-700 ${c.claseCelda ?? ''}`}>
                      {i === 0 ? 'Total' : c.sumar
                        ? celdaVisible(c, filas.reduce((s, f) => s + (Number(f[c.key]) || 0), 0))
                        : ''}
                    </td>
                  ))}
                  {puedeEditar && <td />}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </div>
  )
}

function CampoInput({ campo, valor, onChange }: {
  campo: CampoSubTabla; valor: string; onChange: (v: string) => void
}) {
  if (campo.tipo === 'select') {
    return (
      <select value={valor} onChange={e => onChange(e.target.value)} className={inputCls}>
        <option value="">—</option>
        {campo.opciones?.map(o => <option key={o.valor} value={o.valor}>{o.label}</option>)}
      </select>
    )
  }
  return (
    <input
      type={campo.tipo === 'fecha' ? 'date' : campo.tipo === 'numero' || campo.tipo === 'moneda' ? 'number' : 'text'}
      value={valor}
      onChange={e => onChange(e.target.value)}
      placeholder={campo.requerido ? `${campo.label} *` : campo.label}
      className={inputCls}
    />
  )
}
