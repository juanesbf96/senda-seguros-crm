'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { PolizaAfiliado, Poliza, TipoCliente } from '@/types'
import { formatDate } from '@/lib/utils'
import {
  Users, Plus, Upload, Download, Pencil, UserX,
  UserCheck, ChevronDown, ChevronUp,
} from 'lucide-react'
import AfiliadoModal from './AfiliadoModal'
import ImportAfiliadosModal from './ImportAfiliadosModal'
import { usePermissions } from '@/contexts/PermissionsContext'

interface Props {
  poliza: Poliza
  clienteTipo: TipoCliente
  workspaceId: string
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

export default function AfiliadosTab({ poliza, clienteTipo, workspaceId }: Props) {
  const { can } = usePermissions()
  const [afiliados, setAfiliados]           = useState<PolizaAfiliado[]>([])
  const [loading, setLoading]               = useState(true)
  const [verInactivos, setVerInactivos]     = useState(false)
  const [selected, setSelected]             = useState<Set<string>>(new Set())
  const [modalOpen, setModalOpen]           = useState(false)
  const [importOpen, setImportOpen]         = useState(false)
  const [editando, setEditando]             = useState<PolizaAfiliado | null>(null)
  const [inactivando, setInactivando]       = useState(false)

  async function load() {
    setLoading(true)
    const { data } = await supabase
      .from('poliza_afiliados')
      .select('*')
      .eq('poliza_id', poliza.id)
      .order('nombre_completo', { ascending: true })
    setAfiliados(data ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [poliza.id])

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
      .in('id', Array.from(selected))
    await recalcularPrima(poliza.id)
    setSelected(new Set())
    setInactivando(false)
    load()
  }

  async function reactivar(id: string) {
    await supabase
      .from('poliza_afiliados')
      .update({ activo: true, fecha_retiro: null })
      .eq('id', id)
    await recalcularPrima(poliza.id)
    load()
  }

  function exportarCSV() {
    const cols = ['Nombre', 'Documento', 'Parentesco', 'Fecha inicio', 'Fecha nacimiento', 'N° Póliza individual', 'Fecha retiro', 'Estado']
    const rows = visibles.map(a => [
      a.nombre_completo,
      a.numero_documento,
      a.parentesco ?? '',
      a.fecha_inicio,
      a.fecha_nacimiento ?? '',
      a.numero_poliza_individual ?? '',
      a.fecha_retiro ?? '',
      a.activo ? 'Activo' : 'Inactivo',
    ])
    const csv = [cols, ...rows].map(r => r.map(v => `"${v}"`).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `afiliados_${poliza.numero_poliza ?? poliza.id}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const puedoGestionar = can('afiliados_gestionar') || can('afiliados_gestionar_propios')

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
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
            <button
              onClick={() => setImportOpen(true)}
              className="flex items-center gap-1.5 text-xs border border-slate-200 text-ink-600 px-3 py-1.5 rounded-lg hover:bg-cream-100 transition-colors"
            >
              <Upload className="w-3.5 h-3.5" /> Importar Excel
            </button>
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
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Parentesco</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">N° Póliza ind.</th>
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
                  <td className="px-4 py-3 text-ink-500 font-mono text-xs">{a.numero_documento}</td>
                  <td className="px-4 py-3 text-ink-400 hidden sm:table-cell text-xs">{a.parentesco ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-400 hidden md:table-cell text-xs font-mono">
                    {a.numero_poliza_individual ?? <span className="italic">global</span>}
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
                        <button
                          onClick={() => { setEditando(a); setModalOpen(true) }}
                          className="p-1.5 text-ink-400 hover:text-primary-500 hover:bg-primary-50 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {puedoGestionar && verInactivos && (
                        <button
                          onClick={() => reactivar(a.id)}
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
          poliza={poliza}
          clienteTipo={clienteTipo}
          workspaceId={workspaceId}
          afiliado={editando}
          onClose={() => { setModalOpen(false); setEditando(null) }}
          onSaved={() => { setModalOpen(false); setEditando(null); load() }}
        />
      )}

      {importOpen && (
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
