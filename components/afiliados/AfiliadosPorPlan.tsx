'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { PolizaPlan, PolizaAfiliado, Poliza, TipoCliente } from '@/types'
import { formatCOP, formatDate } from '@/lib/utils'
import { Plus, Pencil, UserX, UserCheck, Layers } from 'lucide-react'
import PlanModal from './PlanModal'
import AfiliadoModal from './AfiliadoModal'
import { usePermissions } from '@/contexts/PermissionsContext'

interface Props {
  poliza: Poliza
  clienteTipo: TipoCliente
  workspaceId: string
}

export default function AfiliadosPorPlan({ poliza, clienteTipo, workspaceId }: Props) {
  const { can } = usePermissions()
  const [planes,         setPlanes]         = useState<PolizaPlan[]>([])
  const [afiliados,      setAfiliados]      = useState<PolizaAfiliado[]>([])
  const [planActivo,     setPlanActivo]     = useState<string | null>(null)
  const [loading,        setLoading]        = useState(true)
  const [planModal,      setPlanModal]      = useState(false)
  const [editandoPlan,   setEditandoPlan]   = useState<PolizaPlan | null>(null)
  const [afiliadoModal,  setAfiliadoModal]  = useState(false)
  const [editandoAfil,   setEditandoAfil]   = useState<PolizaAfiliado | null>(null)
  const [verInactivos,   setVerInactivos]   = useState(false)

  async function load() {
    setLoading(true)
    const [{ data: pls }, { data: afs }] = await Promise.all([
      supabase.from('poliza_planes').select('*').eq('poliza_id', poliza.id).order('nombre'),
      supabase.from('poliza_afiliados').select('*').eq('poliza_id', poliza.id).order('nombre_completo'),
    ])
    setPlanes(pls ?? [])
    setAfiliados(afs ?? [])
    if (!planActivo && pls && pls.length > 0) setPlanActivo(pls[0].id)
    setLoading(false)
  }

  useEffect(() => { load() }, [poliza.id])

  async function inactivarAfiliado(afil: PolizaAfiliado) {
    const hoy = new Date().toISOString().split('T')[0]
    await supabase.from('poliza_afiliados')
      .update({ activo: false, fecha_retiro: hoy })
      .eq('id', afil.id)
    await recalcularPrimas(afil.plan_id)
    load()
  }

  async function reactivarAfiliado(afil: PolizaAfiliado) {
    await supabase.from('poliza_afiliados')
      .update({ activo: true, fecha_retiro: null })
      .eq('id', afil.id)
    await recalcularPrimas(afil.plan_id)
    load()
  }

  async function recalcularPrimas(planId: string | null | undefined) {
    if (planId) {
      const { data: afs } = await supabase
        .from('poliza_afiliados').select('prima_individual').eq('plan_id', planId).eq('activo', true)
      const suma = (afs ?? []).reduce((s, a) => s + (a.prima_individual ?? 0), 0)
      await supabase.from('poliza_planes').update({ prima_plan: suma }).eq('id', planId)
    }
    const { data: todos } = await supabase
      .from('poliza_afiliados').select('prima_individual').eq('poliza_id', poliza.id).eq('activo', true)
    const sumaTotal = (todos ?? []).reduce((s, a) => s + (a.prima_individual ?? 0), 0)
    await supabase.from('polizas').update({ prima: sumaTotal }).eq('id', poliza.id)
  }

  const puedoGestionar = can('afiliados_gestionar') || can('afiliados_gestionar_propios')
  const planSeleccionado = planes.find(p => p.id === planActivo)
  const afiliadosDelPlan = afiliados.filter(a =>
    a.plan_id === planActivo && (verInactivos ? !a.activo : a.activo)
  )
  const sinPlan = afiliados.filter(a => !a.plan_id && (verInactivos ? !a.activo : a.activo))

  if (loading) return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="p-6 space-y-4">

      {/* Header con prima total */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <p className="text-xs text-ink-400">Prima total póliza</p>
          <p className="text-lg font-bold text-primary-700">{formatCOP(poliza.prima ?? 0)}</p>
        </div>
        {puedoGestionar && (
          <button
            onClick={() => { setEditandoPlan(null); setPlanModal(true) }}
            className="flex items-center gap-1.5 text-xs border border-slate-200 text-ink-600 px-3 py-1.5 rounded-lg hover:bg-cream-100 transition-colors"
          >
            <Layers className="w-3.5 h-3.5" /> Nuevo plan
          </button>
        )}
      </div>

      {/* Tabs de planes */}
      {planes.length === 0 ? (
        <div className="bg-cream-100 rounded-xl p-6 text-center text-ink-400 text-sm">
          <Layers className="w-6 h-6 mx-auto mb-2 opacity-30" />
          <p>No hay planes definidos.</p>
          {puedoGestionar && (
            <button
              onClick={() => { setEditandoPlan(null); setPlanModal(true) }}
              className="mt-2 text-primary-500 hover:underline text-xs"
            >
              + Crear el primer plan
            </button>
          )}
        </div>
      ) : (
        <>
          {/* Tab bar */}
          <div className="flex gap-1 border-b border-ink-200 overflow-x-auto">
            {planes.map(p => {
              const activos = afiliados.filter(a => a.plan_id === p.id && a.activo).length
              return (
                <button
                  key={p.id}
                  onClick={() => setPlanActivo(p.id)}
                  className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                    planActivo === p.id
                      ? 'border-primary-500 text-primary-700'
                      : 'border-transparent text-ink-500 hover:text-ink-700'
                  }`}
                >
                  {p.nombre}
                  <span className="ml-1.5 px-1.5 py-0.5 bg-cream-200 text-ink-500 rounded-full text-xs">
                    {activos}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Contenido del plan activo */}
          {planSeleccionado && (
            <div className="space-y-3">
              {/* Info del plan */}
              <div className="flex items-center justify-between bg-primary-50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-4 text-sm">
                  {planSeleccionado.valor_cobertura && (
                    <span className="text-ink-500">
                      Cobertura: <span className="font-semibold text-ink-700">{formatCOP(planSeleccionado.valor_cobertura)}</span>
                    </span>
                  )}
                  <span className="text-ink-500">
                    Prima del plan: <span className="font-semibold text-primary-700">{formatCOP(planSeleccionado.prima_plan ?? 0)}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setVerInactivos(v => !v)}
                    className="text-xs text-ink-400 hover:text-ink-600 transition-colors"
                  >
                    {verInactivos ? 'Ver activos' : 'Ver inactivos'}
                  </button>
                  {puedoGestionar && (
                    <>
                      <button
                        onClick={() => { setEditandoPlan(planSeleccionado); setPlanModal(true) }}
                        className="p-1.5 text-ink-400 hover:text-primary-500 rounded-lg transition-colors"
                        title="Editar plan"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => { setEditandoAfil(null); setAfiliadoModal(true) }}
                        className="flex items-center gap-1 text-xs bg-primary-500 text-white px-3 py-1.5 rounded-lg hover:bg-primary-600 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Agregar
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Tabla de afiliados del plan */}
              {afiliadosDelPlan.length === 0 ? (
                <div className="text-center py-8 text-ink-400 text-sm">
                  {verInactivos ? 'Sin afiliados inactivos en este plan.' : 'Sin afiliados en este plan.'}
                </div>
              ) : (
                <table className="w-full text-sm bg-white rounded-xl border border-ink-200 overflow-hidden">
                  <thead className="bg-cream-100 border-b border-ink-200">
                    <tr className="text-left text-xs text-ink-400">
                      <th className="px-4 py-3 font-medium">Nombre</th>
                      <th className="px-4 py-3 font-medium">Documento</th>
                      <th className="px-4 py-3 font-medium hidden sm:table-cell">Parentesco</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">Prima ind.</th>
                      <th className="px-4 py-3 font-medium hidden md:table-cell">Inicio</th>
                      {verInactivos && <th className="px-4 py-3 font-medium hidden md:table-cell">Retiro</th>}
                      <th className="px-4 py-3 font-medium text-right">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {afiliadosDelPlan.map(a => (
                      <tr key={a.id} className="border-b border-cream-200 hover:bg-cream-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-ink-700">{a.nombre_completo}</td>
                        <td className="px-4 py-3 text-xs text-ink-500 font-mono">
                          {a.tipo_documento} {a.numero_documento}
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-400 hidden sm:table-cell">{a.parentesco ?? '—'}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-primary-700 hidden md:table-cell">
                          {a.prima_individual ? formatCOP(a.prima_individual) : '—'}
                        </td>
                        <td className="px-4 py-3 text-xs text-ink-400 hidden md:table-cell">{formatDate(a.fecha_inicio)}</td>
                        {verInactivos && (
                          <td className="px-4 py-3 text-xs text-ink-400 hidden md:table-cell">
                            {a.fecha_retiro ? formatDate(a.fecha_retiro) : '—'}
                          </td>
                        )}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1.5">
                            {puedoGestionar && !verInactivos && (
                              <>
                                <button
                                  onClick={() => { setEditandoAfil(a); setAfiliadoModal(true) }}
                                  className="p-1.5 text-ink-400 hover:text-primary-500 rounded-lg transition-colors"
                                  title="Editar"
                                >
                                  <Pencil className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => inactivarAfiliado(a)}
                                  className="p-1.5 text-ink-400 hover:text-error rounded-lg transition-colors"
                                  title="Inactivar"
                                >
                                  <UserX className="w-3.5 h-3.5" />
                                </button>
                              </>
                            )}
                            {puedoGestionar && verInactivos && (
                              <button
                                onClick={() => reactivarAfiliado(a)}
                                className="flex items-center gap-1 text-xs text-primary-600 hover:underline"
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
              )}
            </div>
          )}

          {/* Afiliados sin plan asignado */}
          {sinPlan.length > 0 && (
            <div className="mt-4">
              <p className="text-xs text-ink-400 mb-2">Sin plan asignado ({sinPlan.length})</p>
              <div className="space-y-1">
                {sinPlan.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-cream-100 rounded-lg px-4 py-2 text-sm">
                    <span className="text-ink-600">{a.nombre_completo}</span>
                    <span className="text-xs text-ink-400 font-mono">{a.tipo_documento} {a.numero_documento}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Modales */}
      {planModal && (
        <PlanModal
          polizaId={poliza.id}
          workspaceId={workspaceId}
          plan={editandoPlan}
          onClose={() => { setPlanModal(false); setEditandoPlan(null) }}
          onSaved={() => { setPlanModal(false); setEditandoPlan(null); load() }}
        />
      )}

      {afiliadoModal && (
        <AfiliadoModal
          polizaFija={poliza}
          planInicial={editandoAfil ? undefined : planActivo}
          clienteTipo={clienteTipo}
          workspaceId={workspaceId}
          afiliado={editandoAfil}
          onClose={() => { setAfiliadoModal(false); setEditandoAfil(null) }}
          onSaved={() => { setAfiliadoModal(false); setEditandoAfil(null); load() }}
        />
      )}
    </div>
  )
}
