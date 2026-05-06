'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Vendedor } from '@/types'
import { X } from 'lucide-react'

interface Props {
  vendedor?: Vendedor
  onClose: () => void
  onSaved: () => void
}

export default function VendedorModal({ vendedor, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    nombre:              vendedor?.nombre              || '',
    email:               vendedor?.email               || '',
    telefono:            vendedor?.telefono            || '',
    cedula:              vendedor?.cedula              || '',
    porcentaje_comision: vendedor?.porcentaje_comision?.toString() || '0',
    activo:              vendedor?.activo              ?? true,
    notas:               vendedor?.notas               || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(field: string, val: string | boolean) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function save() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    const pct = parseFloat(form.porcentaje_comision)
    if (isNaN(pct) || pct < 0 || pct > 100) { setError('Porcentaje debe ser 0–100'); return }
    setSaving(true); setError('')

    const payload = {
      nombre:              form.nombre.trim(),
      email:               form.email.trim()    || null,
      telefono:            form.telefono.trim() || null,
      cedula:              form.cedula.trim()   || null,
      porcentaje_comision: pct,
      activo:              form.activo,
      notas:               form.notas.trim()   || null,
    }

    const { error: err } = vendedor
      ? await supabase.from('vendedores').update(payload).eq('id', vendedor.id)
      : await supabase.from('vendedores').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{vendedor ? 'Editar vendedor' : 'Nuevo vendedor'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <Field label="Nombre *">
            <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
              placeholder="Nombre completo" className={cls} />
          </Field>

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
            <Field label="Cédula">
              <input value={form.cedula} onChange={e => set('cedula', e.target.value)}
                placeholder="N° documento" className={cls} />
            </Field>
            <Field label="% Comisión">
              <input type="number" min="0" max="100" step="0.01"
                value={form.porcentaje_comision} onChange={e => set('porcentaje_comision', e.target.value)}
                placeholder="Ej: 15.5" className={cls} />
            </Field>
          </div>

          <Field label="Estado">
            <div className="flex gap-3">
              {[{ val: true, label: 'Activo' }, { val: false, label: 'Inactivo' }].map(opt => (
                <button key={String(opt.val)} type="button" onClick={() => set('activo', opt.val)}
                  className={[
                    'flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors',
                    form.activo === opt.val
                      ? opt.val ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-slate-500 border-slate-500 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400',
                  ].join(' ')}>
                  {opt.label}
                </button>
              ))}
            </div>
          </Field>

          <Field label="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones..." rows={2} className={cls} />
          </Field>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-200">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors">
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>{children}</div>
}
const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white"
