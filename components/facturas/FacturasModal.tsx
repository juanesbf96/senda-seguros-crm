'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Factura, EstadoFactura, TipoFactura } from '@/types'
import { formatCOP } from '@/lib/utils'
import { X, Eye, FileText, Save } from 'lucide-react'

interface Props {
  factura?: Factura
  tipoInicial?: TipoFactura
  onClose: () => void
  onSaved: () => void
}

const ASEGURADORAS = [
  'Allianz Seguros','Sura','Bolívar','Colseguros','Liberty Seguros',
  'AXA Colpatria','La Equidad','Mapfre','Positiva','Previsora',
  'Seguros del Estado','Aseguradora Solidaria','Cardif','Otro',
]

const TIPO_LABELS: Record<TipoFactura, string> = {
  emitida:     'Emitida (a cliente)',
  recibida:    'Recibida (de aseguradora)',
  nota_credito:'Nota Crédito',
  nota_debito: 'Nota Débito',
}

const ESTADO_LABELS: Record<EstadoFactura, string> = {
  pendiente: 'Pendiente', pagada: 'Pagada', vencida: 'Vencida',
  anulada: 'Anulada', borrador: 'Borrador',
}

interface Form {
  tipo: TipoFactura
  aseguradora: string
  concepto: string
  fecha_emision: string
  fecha_corte: string
  comision_gravada: string
  comision_no_gravada: string
  pct_iva: string
  pct_ret_iva: string
  pct_ret_ica: string
  pct_ret_fuente: string
  otros: string
  estado: EstadoFactura
  sede: string
  notas: string
}

const defaultForm = (tipo: TipoFactura, f?: Factura): Form => ({
  tipo:                f?.tipo              ?? tipo,
  aseguradora:         f?.aseguradora       ?? '',
  concepto:            f?.concepto          ?? 'Comisión',
  fecha_emision:       f?.fecha_emision     ?? new Date().toISOString().slice(0,10),
  fecha_corte:         f?.fecha_corte       ?? '',
  comision_gravada:    String(f?.comision_gravada    ?? 0),
  comision_no_gravada: String(f?.comision_no_gravada ?? 0),
  pct_iva:             String(f?.pct_iva             ?? 19),
  pct_ret_iva:         String(f?.pct_ret_iva         ?? 15),
  pct_ret_ica:         String(f?.pct_ret_ica         ?? 0),
  pct_ret_fuente:      String(f?.pct_ret_fuente      ?? 11),
  otros:               String(f?.otros               ?? 0),
  estado:              f?.estado ?? 'pendiente',
  sede:                f?.sede   ?? '',
  notas:               f?.notas  ?? '',
})

export default function FacturasModal({ factura, tipoInicial, onClose, onSaved }: Props) {
  const [form,   setForm]   = useState<Form>(() => defaultForm(tipoInicial || 'emitida', factura))
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  function set(field: keyof Form, val: string) {
    setForm(f => ({ ...f, [field]: val }))
  }

  // ── Auto-calc derived tax values ──────────────────────────────
  const gravada   = parseFloat(form.comision_gravada)    || 0
  const noGravada = parseFloat(form.comision_no_gravada) || 0
  const pctIva    = parseFloat(form.pct_iva)             || 0
  const pctRetIva = parseFloat(form.pct_ret_iva)         || 0
  const pctRetIca = parseFloat(form.pct_ret_ica)         || 0
  const pctRetFte = parseFloat(form.pct_ret_fuente)      || 0
  const otrosVal  = parseFloat(form.otros)               || 0

  const iva       = Math.round(gravada * pctIva    / 100)
  const ret_iva   = Math.round(iva     * pctRetIva / 100)
  const ret_ica   = Math.round((gravada + noGravada) * pctRetIca / 100)
  const ret_fuente= Math.round((gravada + noGravada) * pctRetFte / 100)
  const gran_total= gravada + noGravada + iva - ret_iva - ret_ica - ret_fuente + otrosVal

  async function saveFn(esBorrador: boolean) {
    if (!form.concepto.trim()) { setError('El concepto es obligatorio'); return }
    setSaving(true); setError('')

    // Get next numero_factura if new
    let numero_factura = factura?.numero_factura
    if (!factura && !esBorrador) {
      const { data } = await supabase.from('facturas').select('numero_factura').order('numero_factura', { ascending: false }).limit(1)
      numero_factura = ((data?.[0]?.numero_factura || 0) as number) + 1
    }

    const payload = {
      tipo:                form.tipo,
      aseguradora:         form.aseguradora || null,
      concepto:            form.concepto.trim(),
      fecha_emision:       form.fecha_emision,
      fecha_corte:         form.fecha_corte || null,
      comision_gravada:    gravada,
      comision_no_gravada: noGravada,
      pct_iva:             pctIva,
      iva,
      pct_ret_iva:         pctRetIva,
      ret_iva,
      pct_ret_ica:         pctRetIca,
      ret_ica,
      pct_ret_fuente:      pctRetFte,
      ret_fuente,
      otros:               otrosVal,
      gran_total,
      // legacy fields
      valor_base:          gravada + noGravada,
      retencion:           ret_fuente,
      total:               gran_total,
      es_borrador:         esBorrador,
      estado:              esBorrador ? 'borrador' as EstadoFactura : form.estado,
      sede:                form.sede || null,
      notas:               form.notas.trim() || null,
      numero_factura,
    }

    const { error: err } = factura
      ? await supabase.from('facturas').update(payload).eq('id', factura.id)
      : await supabase.from('facturas').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-xl max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-200 sticky top-0 bg-white z-10">
          <h2 className="font-semibold text-slate-800">
            {factura ? `Factura #${factura.numero_factura}` : 'Nueva factura'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Tipo de factura</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(TIPO_LABELS) as [TipoFactura, string][]).map(([k, v]) => (
                <button key={k} type="button" onClick={() => set('tipo', k)}
                  className={`py-2 px-3 rounded-lg text-xs font-medium border transition-colors ${
                    form.tipo === k ? 'bg-emerald-600 border-emerald-600 text-white' : 'bg-white border-slate-200 text-slate-600 hover:border-slate-400'
                  }`}>{v}</button>
              ))}
            </div>
          </div>

          {/* Aseguradora + Concepto */}
          <div className="grid grid-cols-2 gap-4">
            <F label="Aseguradora">
              <select value={form.aseguradora} onChange={e => set('aseguradora', e.target.value)} className={cls}>
                <option value="">Seleccionar...</option>
                {ASEGURADORAS.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </F>
            <F label="Concepto">
              <input value={form.concepto} onChange={e => set('concepto', e.target.value)} className={cls} placeholder="Comisión" />
            </F>
          </div>

          {/* Fechas */}
          <div className="grid grid-cols-2 gap-4">
            <F label="Fecha de Expedición *">
              <input type="date" value={form.fecha_emision} onChange={e => set('fecha_emision', e.target.value)} className={cls} />
            </F>
            <F label="Fecha de Corte *">
              <input type="date" value={form.fecha_corte} onChange={e => set('fecha_corte', e.target.value)} className={cls} />
            </F>
          </div>

          {/* Tributario */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Valores tributarios</p>

            <div className="grid grid-cols-2 gap-4">
              <F label="Comisión Gravada">
                <input type="number" min="0" value={form.comision_gravada}
                  onChange={e => set('comision_gravada', e.target.value)}
                  placeholder="0" className={cls} />
              </F>
              <F label="Comisión No Gravada">
                <input type="number" min="0" value={form.comision_no_gravada}
                  onChange={e => set('comision_no_gravada', e.target.value)}
                  placeholder="0" className={cls} />
              </F>
            </div>

            {/* IVA row */}
            <div className="grid grid-cols-3 gap-3 items-end">
              <F label="% IVA">
                <input type="number" min="0" max="100" step="0.0001" value={form.pct_iva}
                  onChange={e => set('pct_iva', e.target.value)} className={cls} />
              </F>
              <F label="IVA (calculado)">
                <input readOnly value={formatCOP(iva)} className={`${cls} bg-slate-100 text-slate-500 cursor-default`} />
              </F>
              <div className="pb-0.5 text-xs text-slate-400 self-end">Base: gravada</div>
            </div>

            {/* Ret IVA */}
            <div className="grid grid-cols-3 gap-3 items-end">
              <F label="% Retención de IVA">
                <input type="number" min="0" max="100" step="0.0001" value={form.pct_ret_iva}
                  onChange={e => set('pct_ret_iva', e.target.value)} className={cls} />
              </F>
              <F label="Ret. IVA (calculado)">
                <input readOnly value={formatCOP(ret_iva)} className={`${cls} bg-slate-100 text-red-500 cursor-default`} />
              </F>
              <div className="pb-0.5 text-xs text-slate-400 self-end">Base: IVA</div>
            </div>

            {/* Ret ICA */}
            <div className="grid grid-cols-3 gap-3 items-end">
              <F label="% Retención de ICA">
                <input type="number" min="0" max="100" step="0.0001" value={form.pct_ret_ica}
                  onChange={e => set('pct_ret_ica', e.target.value)} className={cls} />
              </F>
              <F label="Ret. ICA (calculado)">
                <input readOnly value={formatCOP(ret_ica)} className={`${cls} bg-slate-100 text-red-500 cursor-default`} />
              </F>
              <div className="pb-0.5 text-xs text-slate-400 self-end">Base: gravada+no grav.</div>
            </div>

            {/* Ret Fuente */}
            <div className="grid grid-cols-3 gap-3 items-end">
              <F label="% Retención de Fuente">
                <input type="number" min="0" max="100" step="0.0001" value={form.pct_ret_fuente}
                  onChange={e => set('pct_ret_fuente', e.target.value)} className={cls} />
              </F>
              <F label="Ret. Fuente (calculado)">
                <input readOnly value={formatCOP(ret_fuente)} className={`${cls} bg-slate-100 text-red-500 cursor-default`} />
              </F>
              <div className="pb-0.5 text-xs text-slate-400 self-end">Base: gravada+no grav.</div>
            </div>

            <F label="Otros">
              <input type="number" min="0" value={form.otros} onChange={e => set('otros', e.target.value)} placeholder="0" className={cls} />
            </F>

            {/* Gran Total */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3 flex items-center justify-between">
              <span className="text-sm font-semibold text-emerald-800">Gran Total</span>
              <span className="text-xl font-bold text-emerald-700">{formatCOP(gran_total)}</span>
            </div>
          </div>

          {/* Estado + Sede */}
          <div className="grid grid-cols-2 gap-4">
            <F label="Estado">
              <select value={form.estado} onChange={e => set('estado', e.target.value as EstadoFactura)} className={cls}>
                {(Object.entries(ESTADO_LABELS) as [EstadoFactura, string][]).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </F>
            <F label="Sede (opcional)">
              <input value={form.sede} onChange={e => set('sede', e.target.value)} placeholder="Ej: Principal" className={cls} />
            </F>
          </div>

          <F label="Observaciones">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              rows={2} placeholder="Observaciones opcionales..." className={cls} />
          </F>

          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        </div>

        {/* Footer — Cancelar / Crear borrador / Vista previa / Crear y salir */}
        <div className="flex gap-2 p-5 border-t border-slate-200 flex-wrap">
          <button onClick={onClose}
            className="px-4 py-2 text-sm text-red-600 hover:text-red-700 font-medium">
            Cancelar
          </button>
          <button onClick={() => saveFn(true)} disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-blue-300 text-blue-700 text-sm hover:bg-blue-50 disabled:opacity-50 transition-colors">
            <FileText className="w-4 h-4" /> Crear borrador
          </button>
          <button disabled
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-200 text-slate-400 text-sm cursor-not-allowed">
            <Eye className="w-4 h-4" /> Visualización Previa
          </button>
          <button onClick={() => saveFn(false)} disabled={saving}
            className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-60 transition-colors">
            <Save className="w-4 h-4" />
            {saving ? 'Guardando...' : 'Crear y salir'}
          </button>
        </div>
      </div>
    </div>
  )
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>{children}</div>
}
const cls = "w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 bg-white"
