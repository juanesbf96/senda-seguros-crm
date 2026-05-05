'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Cliente, Etapa } from '@/types'
import { X } from 'lucide-react'

interface Props {
  cliente?: Cliente
  onClose: () => void
  onSaved: () => void
}

const DEPARTAMENTOS = [
  'Amazonas','Antioquia','Arauca','Atlántico','Bolívar','Boyacá','Caldas','Caquetá',
  'Casanare','Cauca','Cesar','Chocó','Córdoba','Cundinamarca','Guainía','Guaviare',
  'Huila','La Guajira','Magdalena','Meta','Nariño','Norte de Santander','Putumayo',
  'Quindío','Risaralda','San Andrés y Providencia','Santander','Sucre','Tolima',
  'Valle del Cauca','Vaupés','Vichada'
]

export default function ClienteModal({ cliente, onClose, onSaved }: Props) {
  const [form, setForm] = useState({
    nombre: cliente?.nombre || '',
    email: cliente?.email || '',
    telefono: cliente?.telefono || '',
    cedula: cliente?.cedula || '',
    ciudad: cliente?.ciudad || '',
    departamento: cliente?.departamento || '',
    etapa: cliente?.etapa || 'nuevo' as Etapa,
    notas: cliente?.notas || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function save() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    setSaving(true)
    setError('')
    const payload = {
      nombre: form.nombre.trim(),
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      cedula: form.cedula.trim() || null,
      ciudad: form.ciudad.trim() || null,
      departamento: form.departamento || null,
      etapa: form.etapa,
      notas: form.notas.trim() || null,
    }
    const { error: err } = cliente
      ? await supabase.from('clientes').update(payload).eq('id', cliente.id)
      : await supabase.from('clientes').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">
            {cliente ? 'Editar cliente' : 'Nuevo contacto'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <Field label="Nombre completo *">
            <input
              value={form.nombre}
              onChange={e => set('nombre', e.target.value)}
              placeholder="Ej: Carlos Mendoza"
              className={inputCls}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Teléfono">
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
                placeholder="3001234567" className={inputCls} />
            </Field>
            <Field label="Email">
              <input value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="correo@ejemplo.com" type="email" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Cédula / NIT">
              <input value={form.cedula} onChange={e => set('cedula', e.target.value)}
                placeholder="12345678" className={inputCls} />
            </Field>
            <Field label="Ciudad">
              <input value={form.ciudad} onChange={e => set('ciudad', e.target.value)}
                placeholder="Bogotá" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Departamento">
              <select value={form.departamento} onChange={e => set('departamento', e.target.value)} className={inputCls}>
                <option value="">Seleccionar...</option>
                {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
            <Field label="Etapa">
              <select value={form.etapa} onChange={e => set('etapa', e.target.value as Etapa)} className={inputCls}>
                <option value="nuevo">Nuevo</option>
                <option value="contactado">Contactado</option>
                <option value="cotizacion">Cotización</option>
                <option value="cerrado">Cerrado</option>
              </select>
            </Field>
          </div>

          <Field label="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones, intereses, referencias..." rows={3} className={inputCls} />
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

const inputCls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white"
