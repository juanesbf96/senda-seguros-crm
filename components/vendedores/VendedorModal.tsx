'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Vendedor, ComisionAnio } from '@/types'
import { X, Plus, Trash2 } from 'lucide-react'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface Props {
  vendedor?: Vendedor
  onClose: () => void
  onSaved: () => void
}

const BANCOS = [
  'Bancolombia','Banco de Bogotá','Davivienda','BBVA','Banco de Occidente',
  'Banco Popular','Colpatria','Banco Agrario','Nequi','Daviplata','Otro',
]

export default function VendedorModal({ vendedor, onClose, onSaved }: Props) {
  const { currentWorkspace } = useWorkspace()
  const [form, setForm] = useState({
    nombre:       vendedor?.nombre       || '',
    email:        vendedor?.email        || '',
    telefono:     vendedor?.telefono     || '',
    cedula:       vendedor?.cedula       || '',
    activo:       vendedor?.activo       ?? true,
    notas:        vendedor?.notas        || '',
    // banco
    banco:         vendedor?.banco         || '',
    numero_cuenta: vendedor?.numero_cuenta || '',
    tipo_cuenta:   vendedor?.tipo_cuenta   || '',
  })
  const [comisiones, setComisiones] = useState<ComisionAnio[]>(
    vendedor?.comisiones_por_anio?.length
      ? vendedor.comisiones_por_anio
      : [{ anio: 1, porcentaje: 0 }]
  )
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(field: string, val: string | boolean) {
    setForm(f => ({ ...f, [field]: val }))
  }

  function updateComision(idx: number, field: 'anio' | 'porcentaje', val: string) {
    setComisiones(prev => prev.map((c, i) =>
      i === idx ? { ...c, [field]: parseFloat(val) || 0 } : c
    ))
  }

  function addComision() {
    const nextAnio = comisiones.length > 0
      ? Math.max(...comisiones.map(c => c.anio)) + 1
      : 1
    setComisiones(prev => [...prev, { anio: nextAnio, porcentaje: 0 }])
  }

  function removeComision(idx: number) {
    setComisiones(prev => prev.filter((_, i) => i !== idx))
  }

  async function save() {
    if (!form.nombre.trim()) { setError('El nombre es obligatorio'); return }
    // validate comisiones
    for (const c of comisiones) {
      if (isNaN(c.porcentaje) || c.porcentaje < 0 || c.porcentaje > 100) {
        setError('Los porcentajes de comisión deben ser entre 0 y 100'); return
      }
    }
    setSaving(true); setError('')

    // porcentaje_comision = year 1 percentage (backwards compat)
    const pct1 = comisiones.find(c => c.anio === 1)?.porcentaje ?? comisiones[0]?.porcentaje ?? 0

    const payload = {
      nombre:              form.nombre.trim(),
      email:               form.email.trim()    || null,
      telefono:            form.telefono.trim() || null,
      cedula:              form.cedula.trim()   || null,
      porcentaje_comision: pct1,
      activo:              form.activo,
      notas:               form.notas.trim()   || null,
      banco:               form.banco           || null,
      numero_cuenta:       form.numero_cuenta.trim() || null,
      tipo_cuenta:         form.tipo_cuenta     || null,
      comisiones_por_anio: comisiones,
      workspace_id:        currentWorkspace?.id,
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

        <div className="p-5 space-y-5">

          {/* ── Datos personales ── */}
          <Section title="Datos personales">
            <Field label="Nombre *">
              <input value={form.nombre} onChange={e => set('nombre', e.target.value)}
                placeholder="Nombre completo" className={cls} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Cédula">
                <input value={form.cedula} onChange={e => set('cedula', e.target.value)}
                  placeholder="N° documento" className={cls} />
              </Field>
              <Field label="Teléfono">
                <input value={form.telefono} onChange={e => set('telefono', e.target.value)}
                  placeholder="300 000 0000" className={cls} />
              </Field>
            </div>
            <Field label="Email">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                placeholder="correo@ejemplo.com" className={cls} />
            </Field>
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
          </Section>

          {/* ── Comisiones por año ── */}
          <Section title="Comisiones por año (sobre comisión agencia)">
            <div className="space-y-2">
              {comisiones.map((c, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <div className="flex-1 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">Año</label>
                      <input
                        type="number" min="1" max="30"
                        value={c.anio}
                        onChange={e => updateComision(idx, 'anio', e.target.value)}
                        className={cls}
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-slate-400 mb-1">% Comisión</label>
                      <div className="relative">
                        <input
                          type="number" min="0" max="100" step="0.01"
                          value={c.porcentaje}
                          onChange={e => updateComision(idx, 'porcentaje', e.target.value)}
                          className={cls + ' pr-7'}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">%</span>
                      </div>
                    </div>
                  </div>
                  {comisiones.length > 1 && (
                    <button type="button" onClick={() => removeComision(idx)}
                      className="mt-4 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={addComision}
              className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium mt-1">
              <Plus className="w-3.5 h-3.5" /> Agregar año
            </button>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              El % se aplica sobre la <strong>comisión de agencia</strong>, no sobre la prima neta.
            </p>
          </Section>

          {/* ── Cuenta bancaria ── */}
          <Section title="Cuenta bancaria">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Banco">
                <select value={form.banco} onChange={e => set('banco', e.target.value)} className={cls}>
                  <option value="">Seleccionar...</option>
                  {BANCOS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
              <Field label="Tipo de cuenta">
                <select value={form.tipo_cuenta} onChange={e => set('tipo_cuenta', e.target.value)} className={cls}>
                  <option value="">Seleccionar...</option>
                  <option value="ahorros">Ahorros</option>
                  <option value="corriente">Corriente</option>
                </select>
              </Field>
            </div>
            <Field label="Número de cuenta">
              <input value={form.numero_cuenta} onChange={e => set('numero_cuenta', e.target.value)}
                placeholder="Ej: 000 1234 5678" className={cls} />
            </Field>
          </Section>

          {/* ── Notas ── */}
          <Section title="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones..." rows={2} className={cls} />
          </Section>

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>{children}</div>
}

const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:border-transparent bg-white"
