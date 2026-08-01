'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { PolizaAfiliado, PolizaPlan, Poliza, TipoCliente, AfiliadoCambioPlan } from '@/types'
import { X, User } from 'lucide-react'

/* ── Constantes ── */

const TIPOS_DOCUMENTO = [
  { value: 'CC',   label: 'CC — Cédula de ciudadanía' },
  { value: 'CE',   label: 'CE — Cédula de extranjería' },
  { value: 'TI',   label: 'TI — Tarjeta de identidad' },
  { value: 'NIT',  label: 'NIT' },
  { value: 'PA',   label: 'PA — Pasaporte' },
  { value: 'RC',   label: 'RC — Registro civil' },
  { value: 'PPT',  label: 'PPT — Permiso por Protección Temporal' },
  { value: 'NUIP', label: 'NUIP' },
]

const PARENTESCO_OPTIONS = [
  'Empleado', 'Cónyuge', 'Hijo/a', 'Padre', 'Madre',
  'Hermano/a', 'Socio', 'Otro',
]

/* ── Props ── */

interface Props {
  // Si viene desde detalle de póliza, polizaFija está pre-seleccionada
  polizaFija?: Poliza
  // Si viene desde detalle de cliente, se cargan las pólizas colectivas del cliente
  clienteId?: string
  // Plan pre-seleccionado (cuando se abre desde AfiliadosPorPlan para un plan específico)
  planInicial?: string | null
  clienteTipo: TipoCliente
  workspaceId: string
  afiliado?: PolizaAfiliado | null
  /** Recalcular la prima de la póliza con la suma de afiliados. Solo colectivas (ver recalcularPrimas). */
  recalcularPrima?: boolean
  onClose: () => void
  onSaved: () => void
}

/* ── Helpers ── */

/**
 * Recalcula la prima del plan y la de la póliza a partir de los afiliados.
 *
 * ⚠️ Solo tiene sentido en pólizas COLECTIVAS, donde la prima ES la suma de sus
 * afiliados. En una póliza individual sobrescribiría la prima real con la suma
 * de sus asegurados (que normalmente es 0) — por eso el caller decide con
 * `recalcularPrima`. Ver PolizaDetalle: los asegurados se muestran en cualquier
 * póliza (fase 2.2), pero solo las colectivas recalculan.
 */
async function recalcularPrimas(polizaId: string, planId?: string | null) {
  // 1. Recalcular prima del plan (si aplica)
  if (planId) {
    const { data: afs } = await supabase
      .from('poliza_afiliados')
      .select('prima_individual')
      .eq('plan_id', planId)
      .eq('activo', true)
    const sumaPlan = (afs ?? []).reduce((s, a) => s + (a.prima_individual ?? 0), 0)
    await supabase.from('poliza_planes').update({ prima_plan: sumaPlan }).eq('id', planId)
  }

  // 2. Recalcular prima total de la póliza
  const { data: todosAfs } = await supabase
    .from('poliza_afiliados')
    .select('prima_individual')
    .eq('poliza_id', polizaId)
    .eq('activo', true)
  const sumaPoliza = (todosAfs ?? []).reduce((s, a) => s + (a.prima_individual ?? 0), 0)
  await supabase.from('polizas').update({ prima: sumaPoliza }).eq('id', polizaId)
}

/* ── Componente ── */

export default function AfiliadoModal({
  polizaFija, clienteId, planInicial, clienteTipo, workspaceId,
  afiliado, recalcularPrima = true, onClose, onSaved,
}: Props) {
  const esGrupoFamiliar = clienteTipo === 'grupo_familiar'

  // Pólizas colectivas del cliente (solo cuando viene desde el cliente)
  const [polizasCliente, setPolizasCliente] = useState<Poliza[]>([])
  const [polizaSeleccionada, setPolizaSeleccionada] = useState<Poliza | null>(polizaFija ?? null)

  // Planes de la póliza seleccionada
  const [planes, setPlanes] = useState<PolizaPlan[]>([])

  const [form, setForm] = useState({
    tipo_documento:           afiliado?.tipo_documento          ?? 'CC',
    nombre_completo:          afiliado?.nombre_completo         ?? '',
    numero_documento:         afiliado?.numero_documento        ?? '',
    fecha_nacimiento:         afiliado?.fecha_nacimiento        ?? '',
    fecha_inicio:             afiliado?.fecha_inicio            ?? '',
    numero_poliza_individual: afiliado?.numero_poliza_individual ?? '',
    parentesco:               afiliado?.parentesco              ?? '',
    plan_id:                  afiliado?.plan_id                 ?? planInicial ?? '',
    prima_individual:         afiliado?.prima_individual?.toString() ?? '',
    notas:                    afiliado?.notas                   ?? '',
  })

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  // Cargar pólizas colectivas del cliente si viene desde cliente
  useEffect(() => {
    if (polizaFija || !clienteId) return
    supabase
      .from('polizas')
      .select('*')
      .eq('client_id', clienteId)
      .eq('es_colectiva', true)
      .eq('workspace_id', workspaceId)
      .then(({ data }) => setPolizasCliente(data ?? []))
  }, [clienteId, polizaFija, workspaceId])

  // Preseleccionar póliza del afiliado en modo edición
  useEffect(() => {
    if (afiliado?.poliza_id && !polizaFija && polizasCliente.length > 0) {
      const p = polizasCliente.find(p => p.id === afiliado.poliza_id)
      if (p) setPolizaSeleccionada(p)
    }
  }, [polizasCliente, afiliado, polizaFija])

  // Cargar planes cuando cambia la póliza seleccionada
  useEffect(() => {
    if (!polizaSeleccionada) { setPlanes([]); return }
    supabase
      .from('poliza_planes')
      .select('*')
      .eq('poliza_id', polizaSeleccionada.id)
      .order('nombre')
      .then(({ data }) => setPlanes(data ?? []))
  }, [polizaSeleccionada])

  // Limpiar plan si la póliza cambia y no tiene planes
  useEffect(() => {
    if (planes.length === 0) setForm(f => ({ ...f, plan_id: '' }))
  }, [planes])

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function save() {
    setError(null)

    if (!polizaSeleccionada) return setError('Debes seleccionar una póliza.')
    if (!form.nombre_completo.trim()) return setError('El nombre es obligatorio.')
    if (!form.numero_documento.trim()) return setError('El documento es obligatorio.')
    if (!form.fecha_inicio) return setError('La fecha de inicio es obligatoria.')
    if (esGrupoFamiliar && !form.parentesco) return setError('El parentesco es obligatorio para grupos familiares.')

    setSaving(true)

    const planAnterior = afiliado?.plan_id ?? null
    const planNuevo   = form.plan_id || null
    const primaAnterior = afiliado?.prima_individual ?? null
    const primaNueva    = form.prima_individual ? parseFloat(form.prima_individual) : null

    const payload = {
      workspace_id:             workspaceId,
      poliza_id:                polizaSeleccionada.id,
      plan_id:                  planNuevo,
      tipo_documento:           form.tipo_documento,
      nombre_completo:          form.nombre_completo.trim(),
      numero_documento:         form.numero_documento.trim(),
      fecha_nacimiento:         form.fecha_nacimiento || null,
      fecha_inicio:             form.fecha_inicio,
      numero_poliza_individual: form.numero_poliza_individual.trim() || null,
      parentesco:               form.parentesco || null,
      prima_individual:         primaNueva,
      notas:                    form.notas.trim() || null,
    }

    const { data: saved, error: err } = afiliado
      ? await supabase.from('poliza_afiliados').update(payload).eq('id', afiliado.id).select('id').single()
      : await supabase.from('poliza_afiliados').insert(payload).select('id').single()

    if (err) { setError(err.message); setSaving(false); return }

    // Registrar historial si cambió el plan
    const afiliadoId = saved?.id ?? afiliado?.id
    if (afiliado && afiliadoId && (planAnterior !== planNuevo || primaAnterior !== primaNueva)) {
      await supabase.from('afiliado_cambios_plan').insert({
        afiliado_id:      afiliadoId,
        plan_anterior_id: planAnterior,
        plan_nuevo_id:    planNuevo,
        prima_anterior:   primaAnterior,
        prima_nueva:      primaNueva,
      } as AfiliadoCambioPlan)
    }

    // Recalcular primas en cascada
    if (recalcularPrima) await recalcularPrimas(polizaSeleccionada.id, planNuevo ?? planAnterior)

    setSaving(false)
    onSaved()
  }

  const tienePlanes = planes.length > 0

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 flex-shrink-0">
          <div className="flex items-center gap-2">
            <User className="w-5 h-5 text-primary-500" />
            <h2 className="font-semibold text-ink-800">
              {afiliado ? 'Editar afiliado' : 'Agregar afiliado'}
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {error && (
            <div className="bg-error-soft text-error text-sm px-4 py-2.5 rounded-lg">{error}</div>
          )}

          {/* Selector de póliza (solo desde cliente) */}
          {!polizaFija && (
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">
                Póliza colectiva <span className="text-error">*</span>
              </label>
              {polizasCliente.length === 0 ? (
                <p className="text-xs text-ink-400 bg-cream-100 rounded-lg px-3 py-2.5">
                  Este cliente no tiene pólizas colectivas registradas. Créala primero en el tab de Pólizas.
                </p>
              ) : (
                <select
                  value={polizaSeleccionada?.id ?? ''}
                  onChange={e => {
                    const p = polizasCliente.find(p => p.id === e.target.value) ?? null
                    setPolizaSeleccionada(p)
                    setForm(f => ({ ...f, plan_id: '' }))
                  }}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                >
                  <option value="">Seleccionar póliza…</option>
                  {polizasCliente.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.numero_poliza ? `N° ${p.numero_poliza} — ` : ''}{p.aseguradora} · {p.ramo}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          {/* Info de póliza fija */}
          {polizaFija && (
            <div className="bg-cream-100 rounded-lg px-3 py-2 text-xs text-ink-500">
              Póliza: <span className="font-medium text-ink-700">
                {polizaFija.numero_poliza ? `N° ${polizaFija.numero_poliza} — ` : ''}{polizaFija.aseguradora} · {polizaFija.ramo}
              </span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Tipo documento */}
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">
                Tipo documento <span className="text-error">*</span>
              </label>
              <select
                value={form.tipo_documento}
                onChange={e => set('tipo_documento', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              >
                {TIPOS_DOCUMENTO.map(t => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {/* Número documento */}
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">
                N° documento <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={form.numero_documento}
                onChange={e => set('numero_documento', e.target.value)}
                placeholder="Ej: 1234567890"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* Nombre completo */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-ink-500 mb-1.5">
                Nombre completo <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={form.nombre_completo}
                onChange={e => set('nombre_completo', e.target.value)}
                placeholder="Ej: Juan Pérez García"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* Plan (si la póliza tiene planes) */}
            {tienePlanes && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-ink-500 mb-1.5">
                  Plan <span className="text-xs text-ink-400">(opcional)</span>
                </label>
                <select
                  value={form.plan_id}
                  onChange={e => set('plan_id', e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
                >
                  <option value="">Sin plan específico</option>
                  {planes.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}{p.valor_cobertura ? ` — $${p.valor_cobertura.toLocaleString('es-CO')}` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Prima individual */}
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">
                Prima individual (COP) <span className="text-xs text-ink-400">(opcional)</span>
              </label>
              <input
                type="number"
                value={form.prima_individual}
                onChange={e => set('prima_individual', e.target.value)}
                placeholder="0"
                min="0"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* Parentesco */}
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">
                Parentesco / cargo {esGrupoFamiliar && <span className="text-error">*</span>}
              </label>
              <select
                value={form.parentesco}
                onChange={e => set('parentesco', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
              >
                <option value="">Seleccionar…</option>
                {PARENTESCO_OPTIONS.map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>

            {/* Fecha inicio */}
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">
                Fecha inicio <span className="text-error">*</span>
              </label>
              <input
                type="date"
                value={form.fecha_inicio}
                onChange={e => set('fecha_inicio', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* Fecha nacimiento */}
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">
                Fecha nacimiento <span className="text-xs text-ink-400">(opcional)</span>
              </label>
              <input
                type="date"
                value={form.fecha_nacimiento}
                onChange={e => set('fecha_nacimiento', e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* N° póliza individual */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-ink-500 mb-1.5">
                N° póliza individual <span className="text-xs text-ink-400">(opcional — si difiere del número global)</span>
              </label>
              <input
                type="text"
                value={form.numero_poliza_individual}
                onChange={e => set('numero_poliza_individual', e.target.value)}
                placeholder={polizaSeleccionada?.numero_poliza ? `Global: ${polizaSeleccionada.numero_poliza}` : 'Número propio del afiliado'}
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* Notas */}
            <div className="col-span-2">
              <label className="block text-xs font-medium text-ink-500 mb-1.5">Notas</label>
              <textarea
                value={form.notas}
                onChange={e => set('notas', e.target.value)}
                rows={2}
                placeholder="Observaciones adicionales…"
                className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200 flex-shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-ink-600 border border-slate-200 rounded-lg hover:bg-cream-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={save}
            disabled={saving}
            className="px-5 py-2 text-sm font-medium bg-primary-500 text-white rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
          >
            {saving ? 'Guardando…' : afiliado ? 'Guardar cambios' : 'Agregar afiliado'}
          </button>
        </div>
      </div>
    </div>
  )
}
