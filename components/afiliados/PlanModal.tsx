'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { PolizaPlan } from '@/types'
import { X, Layers } from 'lucide-react'

interface Props {
  polizaId: string
  workspaceId: string
  plan?: PolizaPlan | null
  onClose: () => void
  onSaved: () => void
}

export default function PlanModal({ polizaId, workspaceId, plan, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    nombre:          plan?.nombre ?? '',
    valor_cobertura: plan?.valor_cobertura?.toString() ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  function set(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function save() {
    setError(null)
    if (!form.nombre.trim()) return setError('El nombre del plan es obligatorio.')

    setSaving(true)

    const payload = {
      workspace_id:    workspaceId,
      poliza_id:       polizaId,
      nombre:          form.nombre.trim(),
      valor_cobertura: form.valor_cobertura ? parseFloat(form.valor_cobertura) : null,
    }

    const { error: err } = plan
      ? await supabase.from('poliza_planes').update(payload).eq('id', plan.id)
      : await supabase.from('poliza_planes').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }

    setSaving(false)
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">

        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-primary-500" />
            <h2 className="font-semibold text-ink-800">
              {plan ? 'Editar plan' : 'Nuevo plan'}
            </h2>
          </div>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-600 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-error-soft text-error text-sm px-4 py-2.5 rounded-lg">{error}</div>
          )}

          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1.5">
              Nombre del plan <span className="text-error">*</span>
            </label>
            <input
              type="text"
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              placeholder="Ej: Plan Plus 100M, Plan Básico 20M…"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-ink-500 mb-1.5">
              Valor de cobertura (COP) <span className="text-xs text-ink-400">(opcional)</span>
            </label>
            <input
              type="number"
              value={form.valor_cobertura}
              onChange={e => set('valor_cobertura', e.target.value)}
              placeholder="Ej: 100000000"
              min="0"
              className="w-full border border-slate-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
            <p className="text-xs text-ink-400 mt-1">
              La prima del plan se calcula automáticamente sumando las primas individuales de sus afiliados.
            </p>
          </div>
        </div>

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
            {saving ? 'Guardando…' : plan ? 'Guardar cambios' : 'Crear plan'}
          </button>
        </div>
      </div>
    </div>
  )
}
