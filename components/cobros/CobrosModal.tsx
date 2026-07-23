'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Cobro, TipoCobro, Cliente, Poliza } from '@/types'
import { X } from 'lucide-react'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface Props {
  cobro?: Cobro
  clienteId?: string
  activeTab?: TipoCobro
  onClose: () => void
  onSaved: () => void
}

const TIPO_LABELS: Record<TipoCobro, string> = {
  por_cobrar:          'Por cobrar (cliente)',
  por_pagar:           'Por pagar (aseguradora)',
  comision_por_cobrar: 'Comisión por cobrar',
  comision_recibida:   'Comisión recibida',
}

const ASEGURADORAS_DEFAULT = [
  'Sura','Bolívar','Allianz','Colseguros','Liberty Mutual','AXA Colpatria',
  'La Equidad','Mapfre','Positiva','Previsora','BBVA Seguros','Seguros del Estado','Otro',
]

export default function CobrosModal({ cobro, clienteId, activeTab, onClose, onSaved }: Props) {
  const { currentWorkspace } = useWorkspace()
  const [clientes, setClientes]         = useState<Pick<Cliente, 'id' | 'nombre'>[]>([])
  const [polizas, setPolizas]           = useState<Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>[]>([])
  const [aseguradoras, setAseguradoras] = useState<string[]>([])

  // `client_id` es solo ayuda de UI para filtrar pólizas; cobros se vincula por poliza_id.
  const [clienteSel, setClienteSel] = useState<string>(clienteId || '')
  const [form, setForm] = useState({
    poliza_id:           cobro?.poliza_id           || '',
    tipo:                (cobro?.tipo               || activeTab || 'por_cobrar') as TipoCobro,
    prima_total:         cobro?.prima_total?.toString()   || '',
    compromiso_pago:     cobro?.compromiso_pago     || '',
    fecha_emision:       cobro?.fecha_emision       || '',
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
    if (!currentWorkspace) return
    supabase.from('configuracion')
      .select('valor')
      .eq('workspace_id', currentWorkspace.id)
      .eq('clave', 'aseguradoras_lista')
      .single()
      .then(({ data }) => {
        if (data?.valor) setAseguradoras(data.valor.split(',').map((s: string) => s.trim()).filter(Boolean))
      })
  }, [currentWorkspace?.id])

  useEffect(() => {
    if (!clienteId && currentWorkspace)
      supabase.from('clientes').select('id, nombre').eq('workspace_id', currentWorkspace.id).order('nombre').then(({ data }) => setClientes(data || []))
  }, [clienteId, currentWorkspace])

  useEffect(() => {
    const cid = clienteSel
    if (!cid) { setPolizas([]); return }
    supabase.from('polizas').select('id, numero_poliza, aseguradora, ramo')
      .eq('client_id', cid).eq('eliminada', false)
      .then(({ data }) => setPolizas(data || []))
  }, [clienteSel])

  async function save() {
    if (!form.prima_total || isNaN(parseFloat(form.prima_total))) { setError('Ingresa una prima total válida'); return }
    setSaving(true); setError('')
    const prima = parseFloat(form.prima_total)
    // El estado de pago es derivado: en un cobro nuevo el saldo pendiente parte igual a la prima.
    const payload: Record<string, unknown> = {
      poliza_id:           form.poliza_id    || null,
      tipo:                form.tipo,
      estado:              form.tipo,              // columna `estado` guarda el mismo enum de categoría
      prima_total:         prima,
      compromiso_pago:     form.compromiso_pago || null,
      fecha_emision:       form.fecha_emision     || null,
      aseguradora:         form.aseguradora.trim()       || null,
      ramo:                form.ramo.trim()               || null,
      numero_poliza:       form.numero_poliza.trim()      || null,
      porcentaje_comision: form.porcentaje_comision ? parseFloat(form.porcentaje_comision) : null,
      workspace_id:        currentWorkspace?.id,
    }
    if (!cobro) payload.saldo_pendiente = prima  // solo al crear; no re-escribir saldo al editar
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
            <Field label="Cliente (para elegir póliza)">
              <select value={clienteSel} onChange={e => { setClienteSel(e.target.value); set('poliza_id', '') }} className={cls}>
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
                  {(aseguradoras.length > 0 ? aseguradoras : ASEGURADORAS_DEFAULT).map(a => <option key={a} value={a}>{a}</option>)}
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

          <div className="grid grid-cols-2 gap-4">
            <Field label="Prima total (COP) *">
              <input type="number" min="0" value={form.prima_total} onChange={e => set('prima_total', e.target.value)}
                placeholder="0" className={cls} />
            </Field>
            <Field label="Compromiso de pago">
              <input type="date" value={form.compromiso_pago} onChange={e => set('compromiso_pago', e.target.value)} className={cls} />
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

          <p className="text-xs text-ink-400">
            El estado de pago (pendiente / vencido / pagado) se calcula automáticamente a partir del
            saldo pendiente y el compromiso de pago. Los pagos se registran desde Caja (recibos).
          </p>

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
