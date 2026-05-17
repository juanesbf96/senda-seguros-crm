'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Prospecto, EtapaProspecto, FuenteProspecto } from '@/types'
import { X } from 'lucide-react'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface Props {
  prospecto?: Prospecto
  etapaInicial?: EtapaProspecto
  onClose: () => void
  onSaved: () => void
}

const ETAPA_LABELS: Record<EtapaProspecto, string> = {
  nuevo:           'Nuevo',
  contactado:      'Contactado',
  calificado:      'Calificado',
  propuesta:       'Propuesta',
  cerrado_ganado:  'Cerrado ganado',
  cerrado_perdido: 'Cerrado perdido',
}

const FUENTE_LABELS: Record<FuenteProspecto, string> = {
  referido:   'Referido',
  web:        'Web',
  llamada:    'Llamada',
  red_social: 'Red social',
  evento:     'Evento',
  otro:       'Otro',
}

const RAMOS = [
  'Vida', 'Salud', 'Autos', 'SOAT', 'Hogar', 'Empresarial',
  'Responsabilidad Civil', 'Transporte', 'Fianzas', 'Cumplimiento', 'Otro',
]

export default function ProspectoModal({ prospecto, etapaInicial, onClose, onSaved }: Props) {
  const { currentWorkspace } = useWorkspace()
  const [form, setForm] = useState({
    nombre:          prospecto?.nombre          || '',
    empresa:         prospecto?.empresa         || '',
    email:           prospecto?.email           || '',
    telefono:        prospecto?.telefono        || '',
    ciudad:          prospecto?.ciudad          || '',
    fuente:          (prospecto?.fuente         || '') as FuenteProspecto | '',
    etapa:           (prospecto?.etapa          || etapaInicial || 'nuevo') as EtapaProspecto,
    ramo_interes:    prospecto?.ramo_interes    || '',
    valor_estimado:  prospecto?.valor_estimado?.toString() || '',
    asignado_a:      prospecto?.asignado_a      || '',
    notas:           prospecto?.notas           || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(field: string, val: string) { setForm(f => ({ ...f, [field]: val })) }

  async function save() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true); setError('')

    const payload = {
      nombre:         form.nombre.trim(),
      empresa:        form.empresa.trim()       || null,
      email:          form.email.trim()         || null,
      telefono:       form.telefono.trim()      || null,
      ciudad:         form.ciudad.trim()        || null,
      fuente:         form.fuente               || null,
      etapa:          form.etapa,
      ramo_interes:   form.ramo_interes         || null,
      valor_estimado: form.valor_estimado ? parseFloat(form.valor_estimado) : null,
      asignado_a:     form.asignado_a.trim()    || null,
      notas:          form.notas.trim()         || null,
      workspace_id:   currentWorkspace?.id,
    }

    const { error: err } = prospecto
      ? await supabase.from('prospectos').update(payload).eq('id', prospecto.id)
      : await supabase.from('prospectos').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-ink-200">
          <h2 className="font-semibold text-ink-700">
            {prospecto ? 'Editar prospecto' : 'Nuevo prospecto'}
          </h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">

          <Field label="Nombre *">
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
              placeholder="Nombre completo o empresa" className={cls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Empresa">
              <input value={form.empresa} onChange={e => set('empresa', e.target.value)}
                placeholder="Nombre empresa" className={cls} />
            </Field>
            <Field label="Ciudad">
              <input value={form.ciudad} onChange={e => set('ciudad', e.target.value)}
                placeholder="Bogotá, Medellín..." className={cls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Email">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="correo@ejemplo.com" className={cls} />
            </Field>
            <Field label="Teléfono">
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
                placeholder="300 000 0000" className={cls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fuente">
              <select value={form.fuente} onChange={e => set('fuente', e.target.value)} className={cls}>
                <option value="">Sin especificar</option>
                {(Object.entries(FUENTE_LABELS) as [FuenteProspecto, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="Ramo de interés">
              <select value={form.ramo_interes} onChange={e => set('ramo_interes', e.target.value)} className={cls}>
                <option value="">Sin especificar</option>
                {RAMOS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Etapa">
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(ETAPA_LABELS) as [EtapaProspecto, string][]).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set('etapa', k)}
                  className={[
                    'py-1.5 px-2 rounded-lg text-xs font-medium border transition-colors',
                    form.etapa === k
                      ? k === 'cerrado_ganado'  ? 'bg-primary-500 border-primary-500 text-white'
                        : k === 'cerrado_perdido' ? 'bg-error border-error text-white'
                        : 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white border-ink-200 text-ink-500 hover:border-ink-400',
                  ].join(' ')}>
                  {v}
                </button>
              ))}
            </div>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor estimado (COP)">
              <input type="number" min="0" value={form.valor_estimado}
                onChange={e => set('valor_estimado', e.target.value)}
                placeholder="Prima estimada" className={cls} />
            </Field>
            <Field label="Asignado a">
              <input value={form.asignado_a} onChange={e => set('asignado_a', e.target.value)}
                placeholder="Nombre asesor" className={cls} />
            </Field>
          </div>

          <Field label="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones, necesidades detectadas..." rows={2} className={cls} />
          </Field>

          {error && <p className="text-sm text-error bg-error-soft rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 border-t border-ink-200">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-ink-200 text-ink-500 text-sm hover:bg-cream-100 transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors">
            {saving ? 'Guardando...' : 'Guardar prospecto'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-ink-500 mb-1">{label}</label>{children}</div>
}
const cls = "w-full px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white"
