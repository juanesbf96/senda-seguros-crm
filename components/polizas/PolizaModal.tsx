'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Poliza, EstadoPoliza } from '@/types'
import { X } from 'lucide-react'

const RAMOS = [
  'Vida Individual','Vida Grupo','SOAT','Todo Riesgo Vehículo','Responsabilidad Civil',
  'Hogar','Incendio','Empresarial','Salud','ARL','Transportes','Agrícola','Fianzas','Otros'
]

const ASEGURADORAS = [
  'Sura','Bolívar','Allianz','Colseguros','Liberty Mutual','AXA Colpatria',
  'La Equidad','Mapfre','Positiva','Previsora','BBVA Seguros','Seguros del Estado','Otro'
]

interface Props {
  poliza?: Poliza
  clientId: string
  onClose: () => void
  onSaved: () => void
}

export default function PolizaModal({ poliza, clientId, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    aseguradora: poliza?.aseguradora || '',
    ramo: poliza?.ramo || '',
    numero_poliza: poliza?.numero_poliza || '',
    prima: poliza?.prima?.toString() || '',
    fecha_inicio: poliza?.fecha_inicio || '',
    fecha_fin: poliza?.fecha_fin || '',
    estado: poliza?.estado || 'activa' as EstadoPoliza,
    notas: poliza?.notas || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function save() {
    if (!form.aseguradora || !form.ramo) {
      setError('Aseguradora y ramo son obligatorios')
      return
    }
    setSaving(true)
    setError('')
    const payload = {
      client_id: clientId,
      aseguradora: form.aseguradora,
      ramo: form.ramo,
      numero_poliza: form.numero_poliza || null,
      prima: form.prima ? parseFloat(form.prima.replace(/\./g, '').replace(',', '.')) : null,
      fecha_inicio: form.fecha_inicio || null,
      fecha_fin: form.fecha_fin || null,
      estado: form.estado,
      notas: form.notas || null,
    }
    const { error: err } = poliza
      ? await supabase.from('polizas').update(payload).eq('id', poliza.id)
      : await supabase.from('polizas').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{poliza ? 'Editar póliza' : 'Nueva póliza'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Aseguradora *">
              <select value={form.aseguradora} onChange={e => set('aseguradora', e.target.value)} className={cls}>
                <option value="">Seleccionar...</option>
                {ASEGURADORAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
            <Field label="Ramo *">
              <select value={form.ramo} onChange={e => set('ramo', e.target.value)} className={cls}>
                <option value="">Seleccionar...</option>
                {RAMOS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Número de póliza">
              <input value={form.numero_poliza} onChange={e => set('numero_poliza', e.target.value)}
                placeholder="Ej: 123456789" className={cls} />
            </Field>
            <Field label="Prima anual (COP)">
              <input value={form.prima} onChange={e => set('prima', e.target.value)}
                placeholder="Ej: 1200000" type="number" className={cls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha inicio">
              <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} className={cls} />
            </Field>
            <Field label="Fecha vencimiento">
              <input type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)} className={cls} />
            </Field>
          </div>

          <Field label="Estado">
            <select value={form.estado} onChange={e => set('estado', e.target.value as EstadoPoliza)} className={cls}>
              <option value="activa">Activa</option>
              <option value="pendiente">Pendiente</option>
              <option value="vencida">Vencida</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </Field>

          <Field label="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Coberturas adicionales, observaciones..." rows={2} className={cls} />
          </Field>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 border-t border-slate-200">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
      {children}
    </div>
  )
}

const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white"
