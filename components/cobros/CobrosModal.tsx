'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Cobro, EstadoCobro, TipoCobro, Cliente, Poliza } from '@/types'
import { X } from 'lucide-react'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface Props {
  cobro?: Cobro
  clienteId?: string
  activeTab?: TipoCobro
  onClose: () => void
  onSaved: () => void
}

const ESTADO_LABELS: Record<EstadoCobro, string> = {
  pendiente: 'Pendiente', pagado: 'Pagado', vencido: 'Vencido', anulado: 'Anulado',
}

const TIPO_LABELS: Record<TipoCobro, string> = {
  por_cobrar:          'Por cobrar (cliente)',
  por_pagar:           'Por pagar (aseguradora)',
  comision_por_cobrar: 'Comisión por cobrar',
  comision_recibida:   'Comisión recibida',
}

const ASEGURADORAS = [
  'Sura','Bolívar','Allianz','Colseguros','Liberty Mutual','AXA Colpatria',
  'La Equidad','Mapfre','Positiva','Previsora','BBVA Seguros','Seguros del Estado','Otro',
]

export default function CobrosModal({ cobro, clienteId, activeTab, onClose, onSaved }: Props) {
  const { currentWorkspace } = useWorkspace()
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nombre'>[]>([])
  const [polizas, setPolizas]   = useState<Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>[]>([])

  const [form, setForm] = useState({
    client_id:           cobro?.client_id          || clienteId || '',
    poliza_id:           cobro?.poliza_id           || '',
    tipo:                (cobro?.tipo               || activeTab || 'por_cobrar') as TipoCobro,
    concepto:            cobro?.concepto            || '',
    valor:               cobro?.valor?.toString()   || '',
    fecha_vencimiento:   cobro?.fecha_vencimiento   || '',
    fecha_emision:       cobro?.fecha_emision       || '',
    estado:              (cobro?.estado             || 'pendiente') as EstadoCobro,
    notas:               cobro?.notas               || '',
    aseguradora:         cobro?.aseguradora         || '',
    ramo:                cobro?.ramo                || '',
    numero_poliza:       cobro?.numero_poliza       || '',
    porcentaje_comision: cobro?.porcentaje_comision?.toString() || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  function set(field: string, val: string) { setForm(f => ({ ...f, [field]: val })) }

  const isAseguradoraTab = form.tipo === 'por_pagar' || form.tipo === 'comision_por_cobrar' || form.tipo === 'comision_recibida'

  useEffect(() => {
    if (!clienteId)
      supabase.from('clientes').select('id, nombre').order('nombre').then(({ data }) => setClientes(data || []))
  }, [clienteId])

  useEffect(() => {
    const cid = form.client_id
    if (!cid) { setPolizas([]); return }
    supabase.from('polizas').select('id, numero_poliza, aseguradora, ramo')
      .eq('client_id', cid).eq('eliminada', false)
      .then(({ data }) => setPolizas(data || []))
  }, [form.client_id])

  async function save() {
    if (!form.concepto.trim()) { setError('El concepto es obligatorio'); return }
    if (!form.valor || isNaN(parseFloat(form.valor))) { setError('Ingresa un valor válido'); return }
    setSaving(true); setError('')
    const payload = {
      client_id:           form.client_id    || null,
      poliza_id:           form.poliza_id    || null,
      tipo:                form.tipo,
      concepto:            form.concepto.trim(),
      valor:               parseFloat(form.valor),
      fecha_vencimiento:   form.fecha_vencimiento || null,
      fecha_emision:       form.fecha_emision     || null,
      estado:              form.estado,
      notas:               form.notas.trim()      || null,
      aseguradora:         form.aseguradora.trim()       || null,
      ramo:                form.ramo.trim()               || null,
      numero_poliza:       form.numero_poliza.trim()      || null,
      porcentaje_comision: form.porcentaje_comision ? parseFloat(form.porcentaje_comision) : null,
      workspace_id:        currentWorkspace?.id,
    }
    const { error: err } = cobro
      ? await supabase.from('cobros').update(payload).eq('id', cobro.id)
      : await supabase.from('cobros').insert(payload)
    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-ink-200">
          <h2 className="font-semibold text-ink-700">{cobro ? 'Editar cobro' : 'Nuevo cobro'}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {/* Tipo */}
          <Field label="Tipo de cobro *">
            <select value={form.tipo} onChange={e => set('tipo', e.target.value)} className={cls}>
              {(Object.entries(TIPO_LABELS) as [TipoCobro, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          {/* Cliente (no requerido para tipo aseguradora) */}
          {!clienteId && (
            <Field label={isAseguradoraTab ? 'Cliente (opcional)' : 'Cliente *'}>
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={cls}>
                <option value="">Sin cliente específico</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
          )}

          {/* Aseguradora (para cobros de aseguradoras) */}
          {isAseguradoraTab && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Aseguradora">
                <select value={form.aseguradora} onChange={e => set('aseguradora', e.target.value)} className={cls}>
                  <option value="">Seleccionar...</option>
                  {ASEGURADORAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Ramo">
                <input value={form.ramo} onChange={e => set('ramo', e.target.value)}
                  placeholder="Ej: Vida, SOAT..." className={cls} />
              </Field>
            </div>
          )}

          {isAseguradoraTab && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="N° Póliza">
                <input value={form.numero_poliza} onChange={e => set('numero_poliza', e.target.value)}
                  placeholder="Ej: 123456" className={cls} />
              </Field>
              {(form.tipo === 'comision_por_cobrar' || form.tipo === 'comision_recibida') && (
                <Field label="% Comisión">
                  <input type="number" min="0" max="100" step="0.01"
                    value={form.porcentaje_comision} onChange={e => set('porcentaje_comision', e.target.value)}
                    placeholder="Ej: 15.5" className={cls} />
                </Field>
              )}
            </div>
          )}

          <Field label="Concepto *">
            <input value={form.concepto} onChange={e => set('concepto', e.target.value)}
              placeholder="Ej: Prima póliza vida · Comisión enero..." className={cls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor (COP) *">
              <input type="number" min="0" value={form.valor} onChange={e => set('valor', e.target.value)}
                placeholder="0" className={cls} />
            </Field>
            <Field label="Fecha vencimiento">
              <input type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} className={cls} />
            </Field>
          </div>

          {/* Póliza vinculada */}
          {polizas.length > 0 && (
            <Field label="Póliza asociada">
              <select value={form.poliza_id} onChange={e => set('poliza_id', e.target.value)} className={cls}>
                <option value="">Sin póliza específica</option>
                {polizas.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.aseguradora} · {p.ramo}{p.numero_poliza ? ` · ${p.numero_poliza}` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}

          {/* Estado */}
          <Field label="Estado">
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(ESTADO_LABELS) as [EstadoCobro, string][]).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set('estado', k)}
                  className={[
                    'py-2 px-2 rounded-lg text-xs font-medium border transition-colors',
                    form.estado === k
                      ? k === 'pagado' ? 'bg-primary-500 border-primary-500 text-white'
                        : k === 'vencido' ? 'bg-error border-error text-white'
                        : k === 'anulado' ? 'bg-ink-400 border-ink-400 text-white'
                        : 'bg-warning border-warning text-white'
                      : 'bg-white border-ink-200 text-ink-500 hover:border-ink-400',
                  ].join(' ')}>{v}</button>
              ))}
            </div>
          </Field>

          <Field label="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones..." rows={2} className={cls} />
          </Field>

          {error && <p className="text-sm text-error bg-error-soft rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 border-t border-ink-200">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-ink-200 text-ink-500 text-sm hover:bg-cream-100 transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors">
            {saving ? 'Guardando...' : 'Guardar cobro'}
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
