'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Recibo, FormaPago, TipoRecibo, Cliente, Cobro } from '@/types'
import { X } from 'lucide-react'
import { formatCOP } from '@/lib/utils'
import { useWorkspace } from '@/contexts/WorkspaceContext'

const TIPO_LABELS: Record<TipoRecibo, string> = {
  anticipo:    'Anticipo',
  activo:      'Recibo activo',
  pago_directo:'Pago directo',
  anulado:     'Anulado',
  certificado: 'Certificado',
}

interface Props {
  recibo?: Recibo
  clienteId?: string
  activeTab?: TipoRecibo
  onClose: () => void
  onSaved: () => void
}

const FORMA_LABELS: Record<FormaPago, string> = {
  efectivo: 'Efectivo', transferencia: 'Transferencia', cheque: 'Cheque',
  tarjeta: 'Tarjeta', consignacion: 'Consignación',
}
const FORMA_REQUIERE_BANCO: FormaPago[] = ['transferencia', 'cheque', 'consignacion']

export default function ReciboModal({ recibo, clienteId, activeTab, onClose, onSaved }: Props) {
  const { currentWorkspace } = useWorkspace()
  const [clientes, setClientes] = useState<Pick<Cliente, 'id' | 'nombre'>[]>([])
  const [cobros, setCobros] = useState<Pick<Cobro, 'id' | 'numero_cobro' | 'ramo' | 'saldo_pendiente' | 'prima_total'>[]>([])
  const [form, setForm] = useState({
    client_id:          recibo?.client_id || clienteId || '',
    cobro_id:           recibo?.cobro_id || '',
    numero_recibo:      recibo?.numero_recibo || '',
    numero_certificado: recibo?.numero_certificado || '',
    concepto:           recibo?.concepto || '',
    valor:              recibo?.valor?.toString() || '',
    fecha_pago:         recibo?.fecha_pago || new Date().toISOString().split('T')[0],
    forma_pago:         (recibo?.forma_pago || 'efectivo') as FormaPago,
    tipo:               (recibo?.tipo || activeTab || 'activo') as TipoRecibo,
    banco:              recibo?.banco || '',
    referencia:         recibo?.referencia || '',
    notas:              recibo?.notas || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function set(field: string, val: string) { setForm(f => ({ ...f, [field]: val })) }

  useEffect(() => {
    if (!clienteId)
      supabase.from('clientes').select('id, nombre').order('nombre').then(({ data }) => setClientes(data || []))
  }, [clienteId])

  // Cobros pendientes del cliente: cobros no tiene client_id → se une vía poliza_id → polizas.client_id
  useEffect(() => {
    const cid = form.client_id
    if (!cid) { setCobros([]); return }
    supabase.from('cobros')
      .select('id, numero_cobro, ramo, saldo_pendiente, prima_total, poliza:polizas!inner(client_id)')
      .eq('poliza.client_id', cid)
      .then(({ data }) => setCobros(((data || []) as unknown as Pick<Cobro, 'id' | 'numero_cobro' | 'ramo' | 'saldo_pendiente' | 'prima_total'>[])
        .filter(c => (c.saldo_pendiente ?? 0) > 0)))
  }, [form.client_id])

  // Auto-fill concepto y valor cuando se selecciona un cobro (ramo y saldo pendiente)
  useEffect(() => {
    if (!form.cobro_id) return
    const cobro = cobros.find(c => c.id === form.cobro_id)
    if (cobro) set('concepto', cobro.ramo || `Cobro #${cobro.numero_cobro ?? ''}`.trim())
    if (cobro) set('valor', (cobro.saldo_pendiente ?? cobro.prima_total ?? 0).toString())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.cobro_id])

  async function save() {
    if (!form.concepto.trim()) { setError('El concepto es obligatorio'); return }
    if (!form.valor || isNaN(parseFloat(form.valor))) { setError('Ingresa un valor válido'); return }
    setSaving(true); setError('')

    const payload = {
      client_id:          form.client_id || null,
      cobro_id:           form.cobro_id || null,
      numero_recibo:      form.numero_recibo.trim() || null,
      numero_certificado: form.numero_certificado.trim() || null,
      concepto:           form.concepto.trim(),
      valor:              parseFloat(form.valor),
      fecha_pago:         form.fecha_pago,
      forma_pago:         form.forma_pago,
      tipo:               form.tipo,
      banco:              form.banco.trim() || null,
      referencia:         form.referencia.trim() || null,
      notas:              form.notas.trim() || null,
      workspace_id:       currentWorkspace?.id,
    }

    const { error: err } = recibo
      ? await supabase.from('recibos').update(payload).eq('id', recibo.id)
      : await supabase.from('recibos').insert(payload)

    // Si está vinculado a un cobro, saldarlo (estado de pago derivado: saldo 0 + fecha de pago).
    // NOTA: asume liquidación total del cobro; el pago parcial es una regla de negocio a definir.
    if (!err && form.cobro_id && !recibo) {
      await supabase.from('cobros').update({ saldo_pendiente: 0, fecha_pago: form.fecha_pago }).eq('id', form.cobro_id)
    }

    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  const needsBanco = FORMA_REQUIERE_BANCO.includes(form.forma_pago)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-ink-200">
          <h2 className="font-semibold text-ink-700">{recibo ? 'Editar recibo' : 'Nuevo recibo'}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-500"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {!clienteId && (
            <Field label="Cliente">
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={inputCls}>
                <option value="">Sin cliente específico</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
          )}

          {cobros.length > 0 && (
            <Field label="Vincular a cobro pendiente">
              <select value={form.cobro_id} onChange={e => set('cobro_id', e.target.value)} className={inputCls}>
                <option value="">Sin cobro específico</option>
                {cobros.map(c => (
                  <option key={c.id} value={c.id}>{c.ramo || `Cobro #${c.numero_cobro ?? ''}`} — {formatCOP(c.saldo_pendiente ?? 0)}</option>
                ))}
              </select>
            </Field>
          )}

          {/* Tipo de recibo */}
          <Field label="Tipo de recibo">
            <select value={form.tipo} onChange={e => set('tipo', e.target.value as TipoRecibo)} className={inputCls}>
              {(Object.entries(TIPO_LABELS) as [TipoRecibo, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="N° Recibo">
              <input value={form.numero_recibo} onChange={e => set('numero_recibo', e.target.value)}
                placeholder="Ej: REC-001" className={inputCls} />
            </Field>
            <Field label="Fecha de pago *">
              <input type="date" value={form.fecha_pago} onChange={e => set('fecha_pago', e.target.value)} className={inputCls} />
            </Field>
          </div>

          {form.tipo === 'certificado' && (
            <Field label="N° Certificado">
              <input value={form.numero_certificado} onChange={e => set('numero_certificado', e.target.value)}
                placeholder="Ej: CERT-2024-001" className={inputCls} />
            </Field>
          )}

          <Field label="Concepto *">
            <input value={form.concepto} onChange={e => set('concepto', e.target.value)}
              placeholder="Ej: Prima póliza todo riesgo" className={inputCls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Valor (COP) *">
              <input type="number" min="0" value={form.valor} onChange={e => set('valor', e.target.value)}
                placeholder="0" className={inputCls} />
            </Field>
            <Field label="Forma de pago *">
              <select value={form.forma_pago} onChange={e => set('forma_pago', e.target.value as FormaPago)} className={inputCls}>
                {(Object.entries(FORMA_LABELS) as [FormaPago, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </Field>
          </div>

          {needsBanco && (
            <div className="grid grid-cols-2 gap-4">
              <Field label="Banco">
                <input value={form.banco} onChange={e => set('banco', e.target.value)}
                  placeholder="Bancolombia, Davivienda..." className={inputCls} />
              </Field>
              <Field label="Referencia / N° transacción">
                <input value={form.referencia} onChange={e => set('referencia', e.target.value)}
                  placeholder="123456789" className={inputCls} />
              </Field>
            </div>
          )}

          <Field label="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones adicionales..." rows={2} className={inputCls} />
          </Field>

          {error && <p className="text-sm text-error bg-error-soft rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 border-t border-ink-200">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-ink-200 text-ink-500 text-sm hover:bg-cream-100 transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors">
            {saving ? 'Guardando...' : 'Guardar recibo'}
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-ink-500 mb-1">{label}</label>{children}</div>
}
const inputCls = "w-full px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white"
