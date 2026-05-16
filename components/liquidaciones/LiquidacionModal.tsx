'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Liquidacion, EstadoLiquidacion, Vendedor } from '@/types'
import { X } from 'lucide-react'
import { formatCOP } from '@/lib/utils'
import { useWorkspace } from '@/contexts/WorkspaceContext'

interface Props {
  liquidacion?: Liquidacion
  vendedorId?: string
  onClose: () => void
  onSaved: () => void
}

const ESTADO_LABELS: Record<EstadoLiquidacion, string> = {
  pendiente: 'Pendiente',
  pagado:    'Pagado',
  anulado:   'Anulado',
}

export default function LiquidacionModal({ liquidacion, vendedorId, onClose, onSaved }: Props) {
  const { currentWorkspace } = useWorkspace()
  const [vendedores, setVendedores] = useState<Pick<Vendedor, 'id' | 'nombre' | 'porcentaje_comision'>[]>([])
  const [form, setForm] = useState({
    vendedor_id:    liquidacion?.vendedor_id || vendedorId || '',
    periodo:        liquidacion?.periodo        || new Date().toISOString().slice(0, 7), // YYYY-MM
    total_primas:   liquidacion?.total_primas?.toString()   || '',
    total_comision: liquidacion?.total_comision?.toString() || '',
    estado:         (liquidacion?.estado || 'pendiente') as EstadoLiquidacion,
    fecha_pago:     liquidacion?.fecha_pago || '',
    notas:          liquidacion?.notas      || '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    supabase.from('vendedores').select('id, nombre, porcentaje_comision')
      .eq('activo', true).order('nombre')
      .then(({ data }) => setVendedores(data || []))
  }, [])

  // Auto-calculate comision when primas or vendedor changes
  useEffect(() => {
    if (!form.vendedor_id || !form.total_primas) return
    const v = vendedores.find(x => x.id === form.vendedor_id)
    if (!v) return
    const primas = parseFloat(form.total_primas)
    if (!isNaN(primas)) {
      const comision = (primas * v.porcentaje_comision) / 100
      setForm(f => ({ ...f, total_comision: comision.toFixed(2) }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.vendedor_id, form.total_primas, vendedores])

  function set(field: string, val: string) { setForm(f => ({ ...f, [field]: val })) }

  async function save() {
    if (!form.vendedor_id) { setError('Selecciona un vendedor'); return }
    if (!form.periodo)     { setError('El periodo es obligatorio'); return }
    const primas   = parseFloat(form.total_primas)
    const comision = parseFloat(form.total_comision)
    if (isNaN(primas))   { setError('Total primas inválido'); return }
    if (isNaN(comision)) { setError('Total comisión inválido'); return }
    setSaving(true); setError('')

    const payload = {
      vendedor_id:    form.vendedor_id,
      periodo:        form.periodo,
      total_primas:   primas,
      total_comision: comision,
      estado:         form.estado,
      fecha_pago:     form.fecha_pago || null,
      notas:          form.notas.trim() || null,
      workspace_id:   currentWorkspace?.id,
    }

    const { error: err } = liquidacion
      ? await supabase.from('liquidaciones').update(payload).eq('id', liquidacion.id)
      : await supabase.from('liquidaciones').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  const selectedVendedor = vendedores.find(v => v.id === form.vendedor_id)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">
            {liquidacion ? 'Editar liquidación' : 'Nueva liquidación'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">

          {!vendedorId && (
            <Field label="Vendedor *">
              <select value={form.vendedor_id} onChange={e => set('vendedor_id', e.target.value)} className={cls}>
                <option value="">Seleccionar vendedor...</option>
                {vendedores.map(v => (
                  <option key={v.id} value={v.id}>{v.nombre} ({v.porcentaje_comision}%)</option>
                ))}
              </select>
            </Field>
          )}

          {selectedVendedor && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-sm text-emerald-700">
              Comisión: <strong>{selectedVendedor.porcentaje_comision}%</strong>
            </div>
          )}

          <Field label="Periodo *">
            <input type="month" value={form.periodo} onChange={e => set('periodo', e.target.value)} className={cls} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Total primas (COP) *">
              <input type="number" min="0" value={form.total_primas}
                onChange={e => set('total_primas', e.target.value)}
                placeholder="0" className={cls} />
            </Field>
            <Field label="Total comisión (COP) *">
              <input type="number" min="0" value={form.total_comision}
                onChange={e => set('total_comision', e.target.value)}
                placeholder="Auto-calculado" className={cls} />
            </Field>
          </div>

          {form.total_comision && !isNaN(parseFloat(form.total_comision)) && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-600">
              Comisión a pagar: <strong className="text-slate-900">{formatCOP(parseFloat(form.total_comision))}</strong>
            </div>
          )}

          <Field label="Estado">
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(ESTADO_LABELS) as [EstadoLiquidacion, string][]).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set('estado', k)}
                  className={[
                    'py-2 px-2 rounded-lg text-xs font-medium border transition-colors',
                    form.estado === k
                      ? k === 'pagado'  ? 'bg-emerald-600 border-emerald-600 text-white'
                        : k === 'anulado' ? 'bg-slate-500 border-slate-500 text-white'
                        : 'bg-amber-500 border-amber-500 text-white'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400',
                  ].join(' ')}>
                  {v}
                </button>
              ))}
            </div>
          </Field>

          {form.estado === 'pagado' && (
            <Field label="Fecha de pago">
              <input type="date" value={form.fecha_pago} onChange={e => set('fecha_pago', e.target.value)} className={cls} />
            </Field>
          )}

          <Field label="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Observaciones..." rows={2} className={cls} />
          </Field>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>
        <div className="flex gap-3 p-5 border-t border-slate-200">
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50 transition-colors">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60 transition-colors">
            {saving ? 'Guardando...' : 'Guardar liquidación'}
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
