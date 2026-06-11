'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { PolizaAfiliado, Poliza, TipoCliente } from '@/types'
import { X, User } from 'lucide-react'

const PARENTESCO_OPTIONS = [
  'Empleado', 'Cónyuge', 'Hijo/a', 'Padre', 'Madre',
  'Hermano/a', 'Socio', 'Otro',
]

interface Props {
  poliza: Poliza
  clienteTipo: TipoCliente
  workspaceId: string
  afiliado?: PolizaAfiliado | null
  onClose: () => void
  onSaved: () => void
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

export default function AfiliadoModal({ poliza, clienteTipo, workspaceId, afiliado, onClose, onSaved }: Props) {
  const esGrupoFamiliar = clienteTipo === 'grupo_familiar'

  const [form, setForm] = useState({
    nombre_completo:          afiliado?.nombre_completo          ?? '',
    numero_documento:         afiliado?.numero_documento         ?? '',
    fecha_nacimiento:         afiliado?.fecha_nacimiento         ?? '',
    fecha_inicio:             afiliado?.fecha_inicio             ?? '',
    numero_poliza_individual: afiliado?.numero_poliza_individual ?? '',
    parentesco:               afiliado?.parentesco               ?? '',
    notas:                    afiliado?.notas                    ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function save() {
    setError(null)

    if (!form.nombre_completo.trim()) return setError('El nombre es obligatorio.')
    if (!form.numero_documento.trim()) return setError('El documento es obligatorio.')
    if (!form.fecha_inicio) return setError('La fecha de inicio es obligatoria.')
    if (esGrupoFamiliar && !form.parentesco) return setError('El parentesco es obligatorio para grupos familiares.')

    setSaving(true)

    const payload = {
      workspace_id:             workspaceId,
      poliza_id:                poliza.id,
      nombre_completo:          form.nombre_completo.trim(),
      numero_documento:         form.numero_documento.trim(),
      fecha_nacimiento:         form.fecha_nacimiento || null,
      fecha_inicio:             form.fecha_inicio,
      numero_poliza_individual: form.numero_poliza_individual.trim() || null,
      parentesco:               form.parentesco || null,
      notas:                    form.notas.trim() || null,
    }

    const { error: err } = afiliado
      ? await supabase.from('poliza_afiliados').update(payload).eq('id', afiliado.id)
      : await supabase.from('poliza_afiliados').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }

    await recalcularPrima(poliza.id)
    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
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
        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-error-soft text-error text-sm px-4 py-2.5 rounded-lg">{error}</div>
          )}

          <div className="grid grid-cols-2 gap-4">
            {/* Nombre */}
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

            {/* Documento */}
            <div>
              <label className="block text-xs font-medium text-ink-500 mb-1.5">
                N° documento <span className="text-error">*</span>
              </label>
              <input
                type="text"
                value={form.numero_documento}
                onChange={e => set('numero_documento', e.target.value)}
                placeholder="CC / NIT / CE"
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
                placeholder={`Global: ${poliza.numero_poliza ?? '—'}`}
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
        <div className="flex justify-end gap-3 p-5 border-t border-slate-200">
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
