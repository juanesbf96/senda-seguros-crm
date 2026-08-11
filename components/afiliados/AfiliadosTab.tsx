'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { PolizaAfiliado, Poliza, TipoCliente } from '@/types'
import { formatCOP, formatDate } from '@/lib/utils'
import {
  Users, Plus, Upload, Download, Pencil, UserX,
  UserCheck, ChevronDown, ChevronUp,
} from 'lucide-react'
import AfiliadoModal from './AfiliadoModal'
import ImportAfiliadosModal from './ImportAfiliadosModal'
import { usePermissions } from '@/contexts/PermissionsContext'
import { derivarPrimaColectiva } from '@/lib/polizas/primaColectiva'

interface Props {
  /** Modo póliza: muestra afiliados de esta póliza fija */
  poliza?: Poliza
  /** Modo cliente: muestra afiliados de todas las pólizas colectivas del cliente */
  clienteId?: string
  clienteTipo: TipoCliente
  workspaceId: string
  /** Recalcular la prima de la póliza como suma de afiliados. Solo colectivas: en
   *  una póliza individual sobrescribiría la prima real (ver recalcularPrimaPoliza). */
  recalcularPrima?: boolean
}

type AfiliadoConPoliza = PolizaAfiliado & {
  poliza_info?: { id: string; numero_poliza: string | null; aseguradora: string; ramo: string | null }
}

async function recalcularPrimaPoliza(polizaId: string) {
  const { data: afs } = await supabase
    .from('poliza_afiliados')
    .select('prima_individual')
    .eq('poliza_id', polizaId)
    .eq('activo', true)

  const suma = (afs ?? []).reduce((s, a) => s + (a.prima_individual ?? 0), 0)

  if (suma > 0) {
    // Primas individuales → suma directa
    await supabase.from('polizas').update(derivarPrimaColectiva(suma)).eq('id', polizaId)
  } else {
    // Fallback: prima_por_afiliado × count (si la póliza usa ese modelo)
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
      await supabase.from('polizas').update(derivarPrimaColectiva(pol.prima_por_afiliado * count)).eq('id', polizaId)
    }
  }
}

export default function AfiliadosTab({ poliza, clienteId, clienteTipo, workspaceId, recalcularPrima = true }: Props) {
  const { can } = usePermissions()
  const [afiliados, setAfiliados]       = useState<AfiliadoConPoliza[]>([])
  const [loading, setLoading]           = useState(true)
  const [verInactivos, setVerInactivos] = useState(false)
  const [selected, setSelected]         = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen]       = useState(false)
  const [importOpen, setImportOpen]     = useState(false)
  const [editando, setEditando]         = useState<PolizaAfiliado | null>(null)
  const [inactivando, setInactivando]   = useState(false)

  // Modo cliente: guardamos las pólizas colectivas del cliente
  const [polizasCliente, setPolizasCliente] = useState<Poliza[]>([])

  const modoCliente = Boolean(clienteId && !poliza)

  async function load() {
    setLoading(true)

    if (poliza) {
      // Modo póliza fija
      const { data } = await supabase
        .from('poliza_afiliados')
        .select('*')
        .eq('poliza_id', poliza.id)
        .order('nombre_completo')
      setAfiliados((data ?? []) as AfiliadoConPoliza[])
    } else if (clienteId) {
      // Modo cliente: todas las pólizas colectivas
      const { data: pols } = await supabase
        .from('polizas')
        .select('id, numero_poliza, aseguradora, ramo, tipo_poliza, es_colectiva, prima_por_afiliado, prima, prima_neta, workspace_id, client_id, estado, fecha_fin')
        .eq('client_id', clienteId)
        .eq('es_colectiva', true)
        .eq('workspace_id', workspaceId)

      setPolizasCliente((pols ?? []) as unknown as Poliza[])

      if (!pols || pols.length === 0) {
        setAfiliados([])
        setLoading(false)
        return
      }

      const polIds = pols.map(p => p.id)
      const { data: afs } = await supabase
        .from('poliza_afiliados')
        .select('*')
        .eq('workspace_id', workspaceId)
        .in('poliza_id', polIds)
        .order('nombre_completo')

      // Adjuntar info de póliza a cada afiliado
      const enriched: AfiliadoConPoliza[] = (afs ?? []).map(a => ({
        ...a,
        poliza_info: pols.find(p => p.id === a.poliza_id)
          ? { id: pols.find(p => p.id === a.poliza_id)!.id, numero_poliza: pols.find(p => p.id === a.poliza_id)!.numero_poliza ?? null, aseguradora: pols.find(p => p.id === a.poliza_id)!.aseguradora, ramo: pols.find(p => p.id === a.poliza_id)!.ramo ?? null }
          : undefined,
      }))
      setAfiliados(enriched)
    }

    setLoading(false)
  }

  useEffect(() => { load() }, [poliza?.id, clienteId])

  const visibles  = afiliados.filter(a => verInactivos ? !a.activo : a.activo)
  const activos   = afiliados.filter(a => a.activo).length
  const inactivos = afiliados.filter(a => !a.activo).length

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (selected.size === visibles.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(visibles.map(a => a.id)))
    }
  }

  async function inactivarSeleccionados() {
    if (selected.size === 0) return
    setInactivando(true)
    const hoy = new Date().toISOString().split('T')[0]
    await supabase
      .from('poliza_afiliados')
      .update({ activo: false, fecha_retiro: hoy })
      .eq('workspace_id', workspaceId)
      .in('id', Array.from(selected))

    // Recalcular primas de cada póliza afectada
    const polizaIds = [...new Set(visibles.filter(a => selected.has(a.id)).map(a => a.poliza_id))]
    if (recalcularPrima) await Promise.all(polizaIds.map(pid => recalcularPrimaPoliza(pid)))

    setSelected(new Set())
    setInactivando(false)
    load()
  }

  async function reactivar(afil: AfiliadoConPoliza) {
    await supabase
      .from('poliza_afiliados')
      .update({ activo: true, fecha_retiro: null })
      .eq('id', afil.id)
    if (recalcularPrima) await recalcularPrimaPoliza(afil.poliza_id)
    load()
  }

  async function inactivarUno(afil: AfiliadoConPoliza) {
    const hoy = new Date().toISOString().split('T')[0]
    await supabase
      .from('poliza_afiliados')
      .update({ activo: false, fecha_retiro: hoy })
      .eq('id', afil.id)
    if (recalcularPrima) await recalcularPrimaPoliza(afil.poliza_id)
    load()
  }

  function exportarCSV() {
    const cols = modoCliente
      ? ['Póliza', 'Nombre', 'Tipo doc.', 'Documento', 'Parentesco', 'Prima ind.', 'Fecha inicio', 'Fecha nacimiento', 'N° Póliza individual', 'Fecha retiro', 'Estado']
      : ['Nombre', 'Tipo doc.', 'Documento', 'Parentesco', 'Prima ind.', 'Fecha inicio', 'Fecha nacimiento', 'N° Póliza individual', 'Fecha retiro', 'Estado']

    const rows = visibles.map(a => {
      const row = [
        a.nombre_completo,
        a.tipo_documento,
        a.numero_documento,
        a.parentesco ?? '',
        a.prima_individual != null ? String(a.prima_individual) : '',
        a.fecha_inicio,
        a.fecha_nacimiento ?? '',
        a.numero_poliza_individual ?? '',
        a.fecha_retiro ?? '',
        a.activo ? 'Activo' : 'Inactivo',
      ]
      if (modoCliente) {
        const polLabel = a.poliza_info
          ? `${a.poliza_info.numero_poliza ? `N°${a.poliza_info.numero_poliza} ` : ''}${a.poliza_info.aseguradora}`
          : a.poliza_id
        row.unshift(polLabel)
      }
      return row
    })

    const csv = [cols, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `afiliados_${poliza?.numero_poliza ?? clienteId ?? 'export'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const puedoGestionar = can('afiliados_gestionar') || can('afiliados_gestionar_propios')

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
    </div>
  )

  // En modo cliente sin pólizas colectivas
  if (modoCliente && polizasCliente.length === 0) return (
    <div className="p-6">
      <div className="bg-white rounded-xl border border-dashed border-ink-300 p-12 text-center text-ink-400">
        <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">Este cliente no tiene pólizas colectivas.</p>
        <p className="text-xs mt-1">Crea una póliza con el toggle "Póliza colectiva" activado.</p>
      </div>
    </div>
  )

  return (
    <div className="p-6 space-y-4">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <h2 className="font-semibold text-ink-700 text-sm">
            Afiliados activos
            <span className="ml-2 px-2 py-0.5 bg-primary-100 text-primary-700 rounded-full text-xs font-medium">{activos}</span>
          </h2>
          {inactivos > 0 && (
            <button
              onClick={() => { setVerInactivos(v => !v); setSelected(new Set()) }}
              className="flex items-center gap-1 text-xs text-ink-400 hover:text-ink-600 transition-colors"
            >
              {verInactivos ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {verInactivos ? 'Ver activos' : `Ver inactivos (${inactivos})`}
            </button>
          )}
        </div>

        {puedoGestionar && (
          <div className="flex items-center gap-2">
            {poliza && (
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-1.5 text-xs border border-slate-200 text-ink-600 px-3 py-1.5 rounded-lg hover:bg-cream-100 transition-colors"
              >
                <Upload className="w-3.5 h-3.5" /> Importar Excel
              </button>
            )}
            <button
              onClick={() => { setEditando(null); setModalOpen(true) }}
              className="flex items-center gap-1.5 text-xs bg-primary-500 text-white px-3 py-1.5 rounded-lg hover:bg-primary-600 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" /> Agregar
            </button>
          </div>
        )}
      </div>

      {/* Tabla */}
      {visibles.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-ink-300 p-12 text-center text-ink-400">
          <Users className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">
            {verInactivos ? 'No hay afiliados inactivos' : 'Sin afiliados registrados'}
          </p>
          {!verInactivos && puedoGestionar && (
            <button
              onClick={() => { setEditando(null); setModalOpen(true) }}
              className="mt-3 text-sm text-primary-500 hover:underline"
            >
              + Agregar el primero
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-cream-100 border-b border-ink-200">
              <tr className="text-left text-xs text-ink-400">
                {puedoGestionar && !verInactivos && (
                  <th className="px-4 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selected.size === visibles.length && visibles.length > 0}
                      onChange={toggleAll}
                      className="rounded border-slate-300 text-primary-500 focus:ring-primary-400"
                    />
                  </th>
                )}
                <th className="px-4 py-3 font-medium">Nombre</th>
                <th className="px-4 py-3 font-medium">Documento</th>
                {modoCliente && <th className="px-4 py-3 font-medium hidden lg:table-cell">Póliza</th>}
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Parentesco</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Prima ind.</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Inicio</th>
                {verInactivos && <th className="px-4 py-3 font-medium hidden md:table-cell">Retiro</th>}
                <th className="px-4 py-3 font-medium text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {visibles.map(a => (
                <tr
                  key={a.id}
                  className={`border-b border-cream-200 hover:bg-cream-50 transition-colors ${selected.has(a.id) ? 'bg-primary-50' : ''}`}
                >
                  {puedoGestionar && !verInactivos && (
                    <td className="px-4 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(a.id)}
                        onChange={() => toggleSelect(a.id)}
                        className="rounded border-slate-300 text-primary-500 focus:ring-primary-400"
                      />
                    </td>
                  )}
                  <td className="px-4 py-3 font-medium text-ink-700">{a.nombre_completo}</td>
                  <td className="px-4 py-3 text-ink-500 font-mono text-xs">
                    {a.tipo_documento} {a.numero_documento}
                  </td>
                  {modoCliente && (
                    <td className="px-4 py-3 text-ink-400 hidden lg:table-cell text-xs">
                      {a.poliza_info
                        ? `${a.poliza_info.aseguradora}${a.poliza_info.numero_poliza ? ` · N°${a.poliza_info.numero_poliza}` : ''}`
                        : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3 text-ink-400 hidden sm:table-cell text-xs">{a.parentesco ?? '—'}</td>
                  <td className="px-4 py-3 text-xs font-semibold text-primary-700 hidden md:table-cell">
                    {a.prima_individual != null ? formatCOP(a.prima_individual) : '—'}
                  </td>
                  <td className="px-4 py-3 text-ink-400 hidden md:table-cell text-xs">
                    {formatDate(a.fecha_inicio)}
                  </td>
                  {verInactivos && (
                    <td className="px-4 py-3 text-ink-400 hidden md:table-cell text-xs">
                      {a.fecha_retiro ? formatDate(a.fecha_retiro) : '—'}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      {puedoGestionar && !verInactivos && (
                        <>
                          <button
                            onClick={() => { setEditando(a); setModalOpen(true) }}
                            className="p-1.5 text-ink-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => inactivarUno(a)}
                            className="p-1.5 text-ink-400 hover:text-error rounded-lg transition-colors"
                            title="Inactivar"
                          >
                            <UserX className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                      {puedoGestionar && verInactivos && (
                        <button
                          onClick={() => reactivar(a)}
                          className="flex items-center gap-1 text-xs text-primary-600 hover:underline"
                          title="Reactivar"
                        >
                          <UserCheck className="w-3.5 h-3.5" /> Reactivar
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Barra flotante de selección */}
      {selected.size > 0 && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 flex items-center gap-3 bg-ink-800 text-white px-5 py-3 rounded-2xl shadow-xl">
          <span className="text-sm font-medium">{selected.size} seleccionado(s)</span>
          <div className="w-px h-4 bg-white/20" />
          <button
            onClick={exportarCSV}
            className="flex items-center gap-1.5 text-sm hover:text-primary-300 transition-colors"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
          <button
            onClick={inactivarSeleccionados}
            disabled={inactivando}
            className="flex items-center gap-1.5 text-sm hover:text-error transition-colors disabled:opacity-50"
          >
            <UserX className="w-4 h-4" /> {inactivando ? 'Inactivando…' : 'Inactivar'}
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="ml-1 text-white/50 hover:text-white transition-colors text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Modales */}
      {modalOpen && (
        <AfiliadoModal
          polizaFija={poliza}
          clienteId={modoCliente ? clienteId : undefined}
          clienteTipo={clienteTipo}
          workspaceId={workspaceId}
          afiliado={editando}
          recalcularPrima={recalcularPrima}
          onClose={() => { setModalOpen(false); setEditando(null) }}
          onSaved={() => { setModalOpen(false); setEditando(null); load() }}
        />
      )}

      {importOpen && poliza && (
        <ImportAfiliadosModal
          poliza={poliza}
          clienteTipo={clienteTipo}
          workspaceId={workspaceId}
          onClose={() => setImportOpen(false)}
          onSaved={() => { setImportOpen(false); load() }}
        />
      )}
    </div>
  )
}
