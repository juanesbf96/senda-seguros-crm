'use client'
import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Factura, EstadoFactura, TipoFactura, Cliente, Poliza } from '@/types'
import { X } from 'lucide-react'

interface Props {
  factura?: Factura
  tipoInicial?: TipoFactura
  onClose: () => void
  onSaved: () => void
}

const ESTADO_LABELS: Record<EstadoFactura, string> = {
  pendiente: 'Pendiente', pagada: 'Pagada', vencida: 'Vencida', anulada: 'Anulada',
}
const ESTADO_COLORS: Record<EstadoFactura, string> = {
  pendiente: 'bg-amber-500 border-amber-500 text-white',
  pagada:    'bg-emerald-600 border-emerald-600 text-white',
  vencida:   'bg-red-600 border-red-600 text-white',
  anulada:   'bg-slate-500 border-slate-500 text-white',
}

const ASEGURADORAS = ['Sura','Bolívar','Allianz','Colseguros','Liberty Mutual','AXA Colpatria','La Equidad','Mapfre','Positiva','Previsora','Seguros del Estado','Otro']
const IVA_RATE = 0.19
const RET_RATE = 0.11 // retención en la fuente típica seguros Colombia

export default function FacturasModal({ factura, tipoInicial, onClose, onSaved }: Props) {
  const [clientes, setClientes] = useState<Pick<Cliente,'id'|'nombre'>[]>([])
  const [polizas,  setPolizas]  = useState<Pick<Poliza,'id'|'numero_poliza'|'aseguradora'>[]>([])
  const [form, setForm] = useState({
    tipo:              (factura?.tipo || tipoInicial || 'emitida') as TipoFactura,
    client_id:         factura?.client_id    || '',
    poliza_id:         factura?.poliza_id    || '',
    aseguradora:       factura?.aseguradora  || '',
    concepto:          factura?.concepto     || '',
    valor_base:        factura?.valor_base?.toString()  || '',
    iva:               factura?.iva?.toString()          || '0',
    retencion:         factura?.retencion?.toString()    || '0',
    total:             factura?.total?.toString()        || '0',
    fecha_emision:     factura?.fecha_emision     || new Date().toISOString().slice(0,10),
    fecha_vencimiento: factura?.fecha_vencimiento || '',
    estado:            (factura?.estado || 'pendiente') as EstadoFactura,
    notas:             factura?.notas || '',
  })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(field: string, val: string) { setForm(f => ({ ...f, [field]: val })) }

  useEffect(() => {
    supabase.from('clientes').select('id,nombre').order('nombre').then(({ data }) => setClientes(data || []))
  }, [])

  useEffect(() => {
    const cid = form.client_id
    if (!cid) { setPolizas([]); return }
    supabase.from('polizas').select('id,numero_poliza,aseguradora').eq('client_id', cid).eq('eliminada', false)
      .then(({ data }) => setPolizas(data || []))
  }, [form.client_id])

  // Auto-calcular IVA, retención y total
  useEffect(() => {
    const base = parseFloat(form.valor_base) || 0
    const iva  = Math.round(base * IVA_RATE)
    const ret  = Math.round(base * RET_RATE)
    const total = base + iva - ret
    setForm(f => ({ ...f, iva: String(iva), retencion: String(ret), total: String(total) }))
  }, [form.valor_base])

  async function save() {
    if (!form.concepto.trim()) { setError('El concepto es obligatorio'); return }
    const base = parseFloat(form.valor_base)
    if (isNaN(base)) { setError('Ingresa un valor base válido'); return }
    setSaving(true); setError('')

    const payload = {
      tipo:              form.tipo,
      client_id:         form.client_id    || null,
      poliza_id:         form.poliza_id    || null,
      aseguradora:       form.aseguradora.trim() || null,
      concepto:          form.concepto.trim(),
      valor_base:        base,
      iva:               parseFloat(form.iva)      || 0,
      retencion:         parseFloat(form.retencion) || 0,
      total:             parseFloat(form.total)     || 0,
      fecha_emision:     form.fecha_emision,
      fecha_vencimiento: form.fecha_vencimiento || null,
      estado:            form.estado,
      notas:             form.notas.trim() || null,
    }

    const { error: err } = factura
      ? await supabase.from('facturas').update(payload).eq('id', factura.id)
      : await supabase.from('facturas').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-200">
          <h2 className="font-semibold text-slate-800">
            {factura ? `Factura #${factura.numero_factura}` : 'Nueva factura'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">

          {/* Tipo */}
          <div className="flex gap-2">
            {([['emitida','Emitida (cliente)'],['recibida','Recibida (aseguradora)']] as [TipoFactura,string][]).map(([k,v]) => (
              <button key={k} type="button" onClick={() => set('tipo', k)}
                className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium border transition-colors ${
                  form.tipo === k ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                }`}>{v}</button>
            ))}
          </div>

          {/* Cliente / Aseguradora */}
          {form.tipo === 'emitida' ? (
            <Field label="Cliente">
              <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={cls}>
                <option value="">Sin cliente</option>
                {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
          ) : (
            <Field label="Aseguradora">
              <select value={form.aseguradora} onChange={e => set('aseguradora', e.target.value)} className={cls}>
                <option value="">Seleccionar...</option>
                {ASEGURADORAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </Field>
          )}

          {polizas.length > 0 && (
            <Field label="Póliza asociada">
              <select value={form.poliza_id} onChange={e => set('poliza_id', e.target.value)} className={cls}>
                <option value="">Sin póliza</option>
                {polizas.map(p => <option key={p.id} value={p.id}>{p.aseguradora} · {p.numero_poliza}</option>)}
              </select>
            </Field>
          )}

          <Field label="Concepto *">
            <input value={form.concepto} onChange={e => set('concepto', e.target.value)}
              placeholder="Ej: Prima póliza autos, Comisión enero..." className={cls} />
          </Field>

          {/* Valores — auto-calc */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valores</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Valor base (COP) *">
                <input type="number" min="0" value={form.valor_base} onChange={e => set('valor_base', e.target.value)} placeholder="0" className={cls} />
              </Field>
              <Field label="IVA 19% (auto)">
                <input type="number" value={form.iva} onChange={e => set('iva', e.target.value)} className={cls} />
              </Field>
              <Field label="Retención 11% (auto)">
                <input type="number" value={form.retencion} onChange={e => set('retencion', e.target.value)} className={cls} />
              </Field>
              <Field label="Total">
                <input type="number" value={form.total} onChange={e => set('total', e.target.value)}
                  className={`${cls} font-semibold text-emerald-700`} />
              </Field>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Fecha emisión">
              <input type="date" value={form.fecha_emision} onChange={e => set('fecha_emision', e.target.value)} className={cls} />
            </Field>
            <Field label="Fecha vencimiento">
              <input type="date" value={form.fecha_vencimiento} onChange={e => set('fecha_vencimiento', e.target.value)} className={cls} />
            </Field>
          </div>

          {/* Estado */}
          <Field label="Estado">
            <div className="grid grid-cols-4 gap-2">
              {(Object.entries(ESTADO_LABELS) as [EstadoFactura,string][]).map(([k,v]) => (
                <button key={k} type="button" onClick={() => set('estado', k)}
                  className={`py-2 px-2 rounded-lg text-xs font-medium border transition-colors ${
                    form.estado === k ? ESTADO_COLORS[k] : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}>{v}</button>
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
          <button onClick={onClose} className="flex-1 px-4 py-2 rounded-lg border border-slate-200 text-slate-600 text-sm hover:bg-slate-50">Cancelar</button>
          <button onClick={save} disabled={saving} className="flex-1 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-60">
            {saving ? 'Guardando...' : 'Guardar factura'}
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
