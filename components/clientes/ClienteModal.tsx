'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Cliente, Etapa, TipoCliente } from '@/types'
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
  'Valle del Cauca','Vaupés','Vichada',
]

const TIPO_LABELS: Record<TipoCliente, string> = {
  persona_natural: 'Persona Natural',
  empresa: 'Empresa',
  consorcio: 'Consorcio',
}

export default function ClienteModal({ cliente, onClose, onSaved }: Props) {
  const [tipo, setTipo] = useState<TipoCliente>(cliente?.tipo_cliente || 'persona_natural')
  const [form, setForm] = useState({
    nombre: cliente?.nombre || '',
    email: cliente?.email || '',
    telefono: cliente?.telefono || '',
    cedula: cliente?.cedula || '',
    nit: cliente?.nit || '',
    razon_social: cliente?.razon_social || '',
    sobrenombre: cliente?.sobrenombre || '',
    fecha_nacimiento: cliente?.fecha_nacimiento || '',
    fecha_constitucion: cliente?.fecha_constitucion || '',
    ciudad: cliente?.ciudad || '',
    departamento: cliente?.departamento || '',
    etapa: cliente?.etapa || ('nuevo' as Etapa),
    notas: cliente?.notas || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, val: string) {
    setForm(f => ({ ...f, [field]: val }))
  }

  async function save() {
    const nombreReq = tipo === 'persona_natural' ? form.nombre : form.razon_social
    if (!nombreReq.trim()) {
      setError(tipo === 'persona_natural' ? 'El nombre es obligatorio' : 'La razón social es obligatoria')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      tipo_cliente: tipo,
      nombre: tipo === 'persona_natural' ? form.nombre.trim() : form.razon_social.trim(),
      razon_social: tipo !== 'persona_natural' ? form.razon_social.trim() || null : null,
      sobrenombre: form.sobrenombre.trim() || null,
      email: form.email.trim() || null,
      telefono: form.telefono.trim() || null,
      cedula: tipo === 'persona_natural' ? form.cedula.trim() || null : null,
      nit: tipo !== 'persona_natural' ? form.nit.trim() || null : null,
      fecha_nacimiento: tipo === 'persona_natural' && form.fecha_nacimiento ? form.fecha_nacimiento : null,
      fecha_constitucion: tipo !== 'persona_natural' && form.fecha_constitucion ? form.fecha_constitucion : null,
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
            {cliente ? 'Editar cliente' : 'Nuevo cliente'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Tipo de cliente */}
          <Field label="Tipo de cliente *">
            <div className="grid grid-cols-3 gap-2">
              {(['persona_natural','empresa','consorcio'] as TipoCliente[]).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={[
                    'py-2 px-3 rounded-lg text-xs font-medium border transition-colors',
                    tipo === t
                      ? 'bg-emerald-600 border-emerald-600 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-emerald-400',
                  ].join(' ')}
                >
                  {TIPO_LABELS[t]}
                </button>
              ))}
            </div>
          </Field>

          {/* Campos según tipo */}
          {tipo === 'persona_natural' ? (
            <>
              <Field label="Nombre completo *">
                <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                  placeholder="Ej: Carlos Mendoza" className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Cédula">
                  <input value={form.cedula} onChange={e => set('cedula', e.target.value)}
                    placeholder="12345678" className={inputCls} />
                </Field>
                <Field label="Fecha de nacimiento">
                  <input type="date" value={form.fecha_nacimiento} onChange={e => set('fecha_nacimiento', e.target.value)}
                    className={inputCls} />
                </Field>
              </div>
            </>
          ) : (
            <>
              <Field label="Razón social *">
                <input value={form.razon_social} onChange={e => set('razon_social', e.target.value)}
                  placeholder={tipo === 'empresa' ? 'Ej: Comercializadora ABC S.A.S' : 'Ej: Consorcio Norte'} className={inputCls} />
              </Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="NIT">
                  <input value={form.nit} onChange={e => set('nit', e.target.value)}
                    placeholder="900123456-7" className={inputCls} />
                </Field>
                <Field label="Fecha de constitución">
                  <input type="date" value={form.fecha_constitucion} onChange={e => set('fecha_constitucion', e.target.value)}
                    className={inputCls} />
                </Field>
              </div>
            </>
          )}

          <Field label="Sobrenombre / Alias">
            <input value={form.sobrenombre} onChange={e => set('sobrenombre', e.target.value)}
              placeholder="Apodo o nombre comercial" className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Teléfono">
              <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
                placeholder="3001234567" className={inputCls} />
            </Field>
            <Field label="Email">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="correo@ejemplo.com" className={inputCls} />
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Ciudad">
              <input value={form.ciudad} onChange={e => set('ciudad', e.target.value)}
                placeholder="Bogotá" className={inputCls} />
            </Field>
            <Field label="Departamento">
              <select value={form.departamento} onChange={e => set('departamento', e.target.value)} className={inputCls}>
                <option value="">Seleccionar...</option>
                {DEPARTAMENTOS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Etapa">
            <select value={form.etapa} onChange={e => set('etapa', e.target.value as Etapa)} className={inputCls}>
              <option value="nuevo">Nuevo</option>
              <option value="contactado">Contactado</option>
              <option value="cotizacion">Cotización</option>
              <option value="cerrado">Cerrado</option>
            </select>
          </Field>

          <Field label="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones, intereses, referencias..." rows={3} className={inputCls} />
          </Field>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
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
