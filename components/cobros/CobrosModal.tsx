'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Cobro, EstadoCobro, Cliente, Poliza } from '@/types'
import { X } from 'lucide-react'

interface Props {
  cobro?: Cobro
  clienteId?: string
  onClose: () => void
  onSaved: () => void
}

const ESTADO_LABELS: Record<EstadoCobro, string> = {
  pendiente: 'Pendiente', pagado: 'Pagado', vencido: 'Vencido', anulado: 'Anulado',
}

export default function CobrosModal({ cobro, clienteId, onClose, onSaved }: Props) {
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nombre'>[]>([])
  const [polizas, setPolizas] = useState<Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>[]>([])
  const [form, setForm] = useState({
    client_id:         cobro?.client_id || clienteId || '',
    poliza_id:         cobro?.poliza_id || '',
    concepto:          cobro?.concepto || '',
    valor:             cobro?.valor?.toString() || '',
    fecha_vencimiento: cobro?.fecha_vencimiento || '',
    estado:            (cobro?.estado || 'pendiente') as EstadoCobro,
    notas:             cobro?.notas || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, val: string) { setForm(f => ({ ...f, [field]: val })) }

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
    if (!form.client_id) { setError('Selecciona un cliente'); return }
    setSaving(true); setError('')
    const payload = {
      client_id: form.client_id,
      poliza_id: form.poliza_id || null,
      concepto: form.concepto.trim(),
      valor: parseFloat(form.valor),
      fecha_vencimiento: form.fecha_vencimiento || null,
      estado: form.estado,
      notas: form.notas.trim() || null,
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
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">{cobro ? 'Editar cobro' : 'Nuevo cobro'}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {!clienteId && (
            <Field label="Cliente *">
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={cls}>
                <option value="">Seleccionar cliente...</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
          )}

          <Field label="Concepto *">
            <input value={form.concepto} onChange={e => set('concepto', e.target.value)}
              placeholder="Ej: Prima póliza vida · Endoso · Cuota soat" className={cls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor (COP) *">
              <input type="number" min="0" value={form.valor} onChange={e => set('valor', e.target.value)}
                placeholder="Ej: 450000" className={cls} />
            </Field>
            <Field label="Fecha vencimiento">
              <input type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} className={cls} />
            </Field>
          </div>

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

          <Field label="Estado">
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(ESTADO_LABELS) as [EstadoCobro, string][]).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set('estado', k)}
                  className={[
                    'py-2 px-2 rounded-lg text-xs font-medium border transition-colors',
                    form.estado === k
                      ? k === 'pagado' ? 'bg-emerald-600 border-emerald-600 text-white'
                        : k === 'vencido' ? 'bg-red-600 border-red-600 text-white'
                        : k === 'anulado' ? 'bg-slate-500 border-slate-500 text-white'
                        : 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400',
                  ].join(' ')}>{v}</button>
              ))}
            </div>
          </Field>

          <Field label="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones, número de factura..." rows={2} className={cls} />
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
