'use client'
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Poliza, EstadoPoliza, Cliente, Vendedor } from '@/types'
import { X, Calculator } from 'lucide-react'
import { useWorkspace } from '@/contexts/WorkspaceContext'

/* ────────────────────────────────────────────────────────── */
/*  Lists                                                     */
/* ────────────────────────────────────────────────────────── */

const RAMOS_SEGUROS = [
  'Vida Individual','Vida Grupo','SOAT','Todo Riesgo Vehículo','Responsabilidad Civil',
  'Hogar','Incendio','Empresarial','Salud','ARL','Transportes','Agrícola','Otros',
]
const RAMOS_CUMPLIMIENTO = ['Fianzas','Cumplimiento']

const TIPOS_CUMPLIMIENTO = [
  'Licitación','Buena calidad de bienes','Anticipo','Cumplimiento del contrato',
  'Estabilidad de obra','Correcto funcionamiento de equipos','Manejo','Garantía',
  'Seriedad de oferta','Otro',
]

const ASEGURADORAS = [
  'Sura','Bolívar','Allianz','Colseguros','Liberty Mutual','AXA Colpatria',
  'La Equidad','Mapfre','Positiva','Previsora','BBVA Seguros','Seguros del Estado','Otro',
]

const PERIODICIDADES = ['Anual','Semestral','Trimestral','Mensual','Prima única']
const FORMAS_PAGO    = ['Contado','Crédito','Cuotas']
const MEDIOS_PAGO    = ['Efectivo','Transferencia','Cheque','PSE','Débito automático','Tarjeta crédito']
const BANCOS_PAGO    = [
  'Bancolombia','Banco de Bogotá','Davivienda','BBVA','Banco de Occidente',
  'Banco Popular','Colpatria','Banco Agrario','Nequi','Daviplata','Otro',
]

/* ────────────────────────────────────────────────────────── */
/*  Types / helpers                                           */
/* ────────────────────────────────────────────────────────── */

type TipoModalidad = 'individual' | 'colectiva' | 'agrupadora'

function n(v: string) { return v ? parseFloat(v.replace(/[^0-9.-]/g, '')) || 0 : 0 }
function fmt(v: number) { return v ? v.toLocaleString('es-CO', { maximumFractionDigits: 0 }) : '' }

interface Props {
  poliza?: Poliza
  clientId?: string
  isCumplimiento?: boolean
  onClose: () => void
  onSaved: () => void
}

/* ────────────────────────────────────────────────────────── */
/*  Component                                                 */
/* ────────────────────────────────────────────────────────── */

export default function PolizaModal({ poliza, clientId, isCumplimiento, onClose, onSaved }: Props) {
  const { currentWorkspace } = useWorkspace()
  const [clientes,  setClientes]  = useState<Pick<Cliente, 'id' | 'nombre'>[]>([])
  const [vendedores, setVendedores] = useState<Pick<Vendedor, 'id' | 'nombre' | 'comisiones_por_anio'>[]>([])

  const defaultRamo = isCumplimiento ? 'Fianzas' : ''

  const [form, setForm] = useState({
    // identidad
    client_id:     poliza?.client_id    || clientId || '',
    aseguradora:   poliza?.aseguradora  || '',
    ramo:          poliza?.ramo         || defaultRamo,
    tipo_poliza:   poliza?.tipo_poliza  || '',
    tipo_modalidad:(poliza?.tipo_modalidad || 'individual') as TipoModalidad,
    numero_poliza: poliza?.numero_poliza || '',
    estado:        (poliza?.estado      || 'activa') as EstadoPoliza,
    // fechas
    fecha_expedicion: poliza?.fecha_expedicion || '',
    fecha_recepcion:  poliza?.fecha_recepcion  || '',
    fecha_inicio:     poliza?.fecha_inicio     || '',
    fecha_fin:        poliza?.fecha_fin        || '',
    // riesgo
    riesgo:          poliza?.riesgo          || '',
    valor_asegurado: poliza?.valor_asegurado?.toString() || '',
    // roles
    nombre_tomador:        poliza?.nombre_tomador        || '',
    asegurado_nombre:      poliza?.asegurado_nombre      || '',
    asegurado_documento:   poliza?.asegurado_documento   || '',
    beneficiario_nombre:   poliza?.beneficiario_nombre   || '',
    beneficiario_documento:poliza?.beneficiario_documento|| '',
    beneficiario_oneroso:  poliza?.beneficiario_oneroso  ?? false,
    beneficiario_en_remision: poliza?.beneficiario_en_remision ?? false,
    // prima
    prima_neta:                 poliza?.prima_neta?.toString()                  || '',
    porcentaje_iva:             (poliza?.porcentaje_iva ?? 19).toString(),
    gastos:                     (poliza?.gastos ?? 0).toString(),
    porcentaje_comision_agencia:poliza?.porcentaje_comision_agencia?.toString() || '',
    // vendedor
    vendedor_id:                poliza?.vendedor_id                    || '',
    porcentaje_comision_vendedor:poliza?.porcentaje_comision_vendedor?.toString() || '',
    retencion_vendedor:         (poliza?.retencion_vendedor ?? 10).toString(),
    // pagos
    periodicidad_pago: poliza?.periodicidad_pago || '',
    forma_pago:        poliza?.forma_pago        || '',
    medio_pago:        poliza?.medio_pago        || '',
    banco_pago:        poliza?.banco_pago        || '',
    // recaudo (legacy cumplimiento)
    comision:              poliza?.comision?.toString()              || '',
    recaudado_oficina:     poliza?.recaudado_oficina?.toString()     || '',
    recaudado_aseguradora: poliza?.recaudado_aseguradora?.toString() || '',
    // notas
    notas: poliza?.notas || '',
  })

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  /* derived */
  const esCumplimiento = RAMOS_CUMPLIMIENTO.includes(form.ramo)
  const primaNeta      = n(form.prima_neta)
  const pctIva         = n(form.porcentaje_iva)
  const gastos         = n(form.gastos)
  const pctAgencia     = n(form.porcentaje_comision_agencia)
  const iva            = primaNeta * pctIva / 100
  const comisionAgencia = primaNeta * pctAgencia / 100
  const totalPrima     = primaNeta + iva + gastos
  const pctVendedor    = n(form.porcentaje_comision_vendedor)
  const comisionVendedor = comisionAgencia * pctVendedor / 100

  /* load */
  useEffect(() => {
    if (!clientId) {
      supabase.from('clientes').select('id, nombre').order('nombre')
        .then(({ data }) => setClientes(data || []))
    }
    supabase.from('vendedores').select('id, nombre, comisiones_por_anio').eq('activo', true).order('nombre')
      .then(({ data }) => setVendedores((data || []) as Pick<Vendedor, 'id' | 'nombre' | 'comisiones_por_anio'>[]))
  }, [clientId])

  /* auto-fill vendedor % when selected */
  function onVendedorChange(id: string) {
    setForm(f => {
      const v = vendedores.find(x => x.id === id)
      const pct = v?.comisiones_por_anio?.[0]?.porcentaje?.toString() || ''
      return { ...f, vendedor_id: id, porcentaje_comision_vendedor: pct }
    })
  }

  function set(field: string, val: string | boolean) {
    setForm(f => ({ ...f, [field]: val }))
  }

  /* ── save ── */
  async function save() {
    if (!form.aseguradora || !form.ramo) { setError('Aseguradora y ramo son obligatorios'); return }
    if (!form.client_id)                  { setError('Debes seleccionar un cliente'); return }
    setSaving(true); setError('')

    const payload: Record<string, unknown> = {
      client_id:     form.client_id,
      aseguradora:   form.aseguradora,
      ramo:          form.ramo,
      tipo_poliza:   form.tipo_poliza || null,
      tipo_modalidad:form.tipo_modalidad,
      riesgo:        form.riesgo.trim() || null,
      numero_poliza: form.numero_poliza || null,
      estado:        form.estado,
      // fechas
      fecha_expedicion: form.fecha_expedicion || null,
      fecha_recepcion:  form.fecha_recepcion  || null,
      fecha_inicio:     form.fecha_inicio     || null,
      fecha_fin:        form.fecha_fin        || null,
      // riesgo
      valor_asegurado: form.valor_asegurado ? n(form.valor_asegurado) : null,
      // roles
      nombre_tomador:         form.nombre_tomador.trim()        || null,
      asegurado_nombre:       form.asegurado_nombre.trim()      || null,
      asegurado_documento:    form.asegurado_documento.trim()   || null,
      beneficiario_nombre:    form.beneficiario_nombre.trim()   || null,
      beneficiario_documento: form.beneficiario_documento.trim()|| null,
      beneficiario_oneroso:   form.beneficiario_oneroso,
      beneficiario_en_remision: form.beneficiario_en_remision,
      // prima
      prima:                        primaNeta || null,   // legacy compat
      prima_neta:                   primaNeta || null,
      porcentaje_iva:               pctIva,
      iva:                          iva || null,
      gastos:                       gastos,
      porcentaje_comision_agencia:  pctAgencia || null,
      comision_agencia:             comisionAgencia || null,
      total_prima:                  totalPrima || null,
      // vendedor
      vendedor_id:                  form.vendedor_id || null,
      porcentaje_comision_vendedor: pctVendedor || null,
      retencion_vendedor:           n(form.retencion_vendedor),
      comision_vendedor:            comisionVendedor || null,
      // pagos
      periodicidad_pago: form.periodicidad_pago || null,
      forma_pago:        form.forma_pago        || null,
      medio_pago:        form.medio_pago        || null,
      banco_pago:        form.banco_pago        || null,
      // legacy cumplimiento
      comision:              form.comision ? n(form.comision) : null,
      recaudado_oficina:     form.recaudado_oficina ? n(form.recaudado_oficina) : null,
      recaudado_aseguradora: form.recaudado_aseguradora ? n(form.recaudado_aseguradora) : null,
      // notas
      notas: form.notas || null,
      workspace_id: currentWorkspace?.id,
    }

    const { error: err } = poliza
      ? await supabase.from('polizas').update(payload).eq('id', poliza.id)
      : await supabase.from('polizas').insert(payload)

    if (err) { setError(err.message); setSaving(false); return }
    onSaved()
  }

  /* ────────────────────────────────────────────────────── */
  /*  Render                                                */
  /* ────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* header */}
        <div className="flex items-center justify-between p-5 border-b border-ink-200">
          <h2 className="font-semibold text-ink-700">{poliza ? 'Editar póliza' : 'Nueva póliza'}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* ── 1. Info básica ── */}
          <Section title="Información básica">
            {!clientId && (
              <Field label="Cliente *">
                <select value={form.client_id} onChange={e => set('client_id', e.target.value)} className={cls}>
                  <option value="">Seleccionar cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
              </Field>
            )}

            {/* tipo modalidad */}
            <Field label="Tipo de modalidad">
              <div className="grid grid-cols-3 gap-2">
                {(['individual','colectiva','agrupadora'] as TipoModalidad[]).map(t => (
                  <button key={t} type="button" onClick={() => set('tipo_modalidad', t)}
                    className={['py-2 px-3 rounded-lg text-xs font-medium border capitalize transition-colors',
                      form.tipo_modalidad === t
                        ? 'bg-primary-500 border-primary-500 text-white'
                        : 'bg-white border-ink-200 text-ink-500 hover:border-primary-400',
                    ].join(' ')}>
                    {t}
                  </button>
                ))}
              </div>
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Aseguradora *">
                <select value={form.aseguradora} onChange={e => set('aseguradora', e.target.value)} className={cls}>
                  <option value="">Seleccionar...</option>
                  {ASEGURADORAS.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </Field>
              <Field label="Ramo *">
                <select value={form.ramo} onChange={e => set('ramo', e.target.value)} className={cls}>
                  <option value="">Seleccionar...</option>
                  <optgroup label="Seguros">
                    {RAMOS_SEGUROS.map(r => <option key={r} value={r}>{r}</option>)}
                  </optgroup>
                  <optgroup label="Cumplimiento">
                    {RAMOS_CUMPLIMIENTO.map(r => <option key={r} value={r}>{r}</option>)}
                  </optgroup>
                </select>
              </Field>
            </div>

            {esCumplimiento && (
              <Field label="Tipo de amparo">
                <select value={form.tipo_poliza} onChange={e => set('tipo_poliza', e.target.value)} className={cls}>
                  <option value="">Seleccionar tipo...</option>
                  {TIPOS_CUMPLIMIENTO.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            )}

            <div className="grid grid-cols-2 gap-4">
              <Field label="Número de póliza">
                <input value={form.numero_poliza} onChange={e => set('numero_poliza', e.target.value)}
                  placeholder="Ej: 123456789" className={cls} />
              </Field>
              <Field label="Estado">
                <select value={form.estado} onChange={e => set('estado', e.target.value as EstadoPoliza)} className={cls}>
                  <option value="activa">Activa</option>
                  <option value="pendiente">Pendiente</option>
                  <option value="vencida">Vencida</option>
                  <option value="cancelada">Cancelada</option>
                </select>
              </Field>
            </div>
          </Section>

          {/* ── 2. Fechas ── */}
          <Section title="Fechas">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Fecha expedición">
                <input type="date" value={form.fecha_expedicion} onChange={e => set('fecha_expedicion', e.target.value)} className={cls} />
              </Field>
              <Field label="Fecha recepción">
                <input type="date" value={form.fecha_recepcion} onChange={e => set('fecha_recepcion', e.target.value)} className={cls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Vigencia desde">
                <input type="date" value={form.fecha_inicio} onChange={e => set('fecha_inicio', e.target.value)} className={cls} />
              </Field>
              <Field label="Vigencia hasta">
                <input type="date" value={form.fecha_fin} onChange={e => set('fecha_fin', e.target.value)} className={cls} />
              </Field>
            </div>
          </Section>

          {/* ── 3. Riesgo ── */}
          <Section title="Riesgo">
            <Field label="Objeto / Riesgo amparado">
              <textarea value={form.riesgo} onChange={e => set('riesgo', e.target.value)}
                placeholder="Describe el bien, contrato u objeto amparado..." rows={2} className={cls} />
            </Field>
            <Field label="Valor asegurado (COP)">
              <input value={form.valor_asegurado} onChange={e => set('valor_asegurado', e.target.value)}
                type="number" min="0" placeholder="Ej: 50000000" className={cls} />
            </Field>
          </Section>

          {/* ── 4. Roles ── */}
          <Section title="Tomador / Asegurado / Beneficiario">
            <Field label="Tomador">
              <input value={form.nombre_tomador} onChange={e => set('nombre_tomador', e.target.value)}
                placeholder="Nombre del tomador de la póliza" className={cls} />
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Asegurado (nombre)">
                <input value={form.asegurado_nombre} onChange={e => set('asegurado_nombre', e.target.value)}
                  placeholder="Nombre del asegurado" className={cls} />
              </Field>
              <Field label="Asegurado (documento)">
                <input value={form.asegurado_documento} onChange={e => set('asegurado_documento', e.target.value)}
                  placeholder="Cédula / NIT" className={cls} />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Beneficiario (nombre)">
                <input value={form.beneficiario_nombre} onChange={e => set('beneficiario_nombre', e.target.value)}
                  placeholder="Nombre del beneficiario" className={cls} />
              </Field>
              <Field label="Beneficiario (documento)">
                <input value={form.beneficiario_documento} onChange={e => set('beneficiario_documento', e.target.value)}
                  placeholder="Cédula / NIT" className={cls} />
              </Field>
            </div>
            <div className="flex gap-4">
              <CheckToggle
                checked={form.beneficiario_oneroso}
                onChange={v => set('beneficiario_oneroso', v)}
                label="Endoso oneroso"
              />
              <CheckToggle
                checked={form.beneficiario_en_remision}
                onChange={v => set('beneficiario_en_remision', v)}
                label="En remisión"
              />
            </div>
          </Section>

          {/* ── 5. Prima y comisiones ── */}
          <Section title="Prima y comisiones">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Prima neta (COP)">
                <input value={form.prima_neta} onChange={e => set('prima_neta', e.target.value)}
                  type="number" min="0" placeholder="Ej: 1564000" className={cls} />
              </Field>
              <Field label="% IVA">
                <div className="relative">
                  <input value={form.porcentaje_iva} onChange={e => set('porcentaje_iva', e.target.value)}
                    type="number" min="0" max="100" step="0.01" className={cls + ' pr-7'} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">%</span>
                </div>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Gastos (COP)">
                <input value={form.gastos} onChange={e => set('gastos', e.target.value)}
                  type="number" min="0" placeholder="0" className={cls} />
              </Field>
              <Field label="% Comisión agencia">
                <div className="relative">
                  <input value={form.porcentaje_comision_agencia} onChange={e => set('porcentaje_comision_agencia', e.target.value)}
                    type="number" min="0" max="100" step="0.01" placeholder="Ej: 12.5" className={cls + ' pr-7'} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">%</span>
                </div>
              </Field>
            </div>

            {/* auto-calc summary */}
            {primaNeta > 0 && (
              <div className="bg-cream-100 border border-ink-200 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-ink-500">
                  <span>IVA ({pctIva}%)</span>
                  <span className="font-medium">$ {fmt(iva)}</span>
                </div>
                <div className="flex justify-between text-ink-500">
                  <span>Comisión agencia ({pctAgencia}%)</span>
                  <span className="font-medium text-primary-700">$ {fmt(comisionAgencia)}</span>
                </div>
                <div className="flex justify-between text-ink-700 font-semibold border-t border-ink-200 pt-1.5 mt-1">
                  <span>Total prima</span>
                  <span>$ {fmt(totalPrima)}</span>
                </div>
              </div>
            )}

            {/* Recaudo legacy (solo cumplimiento) */}
            {esCumplimiento && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Recaudo oficina">
                  <input type="number" min="0" value={form.recaudado_oficina} onChange={e => set('recaudado_oficina', e.target.value)}
                    placeholder="0" className={cls} />
                </Field>
                <Field label="Recaudo aseg.">
                  <input type="number" min="0" value={form.recaudado_aseguradora} onChange={e => set('recaudado_aseguradora', e.target.value)}
                    placeholder="0" className={cls} />
                </Field>
              </div>
            )}
          </Section>

          {/* ── 6. Vendedor ── */}
          <Section title="Vendedor">
            <Field label="Vendedor">
              <select value={form.vendedor_id} onChange={e => onVendedorChange(e.target.value)} className={cls}>
                <option value="">Sin vendedor asignado</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </Field>
            {form.vendedor_id && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="% Comisión vendedor (sobre agencia)">
                  <div className="relative">
                    <input value={form.porcentaje_comision_vendedor} onChange={e => set('porcentaje_comision_vendedor', e.target.value)}
                      type="number" min="0" max="100" step="0.01" placeholder="Ej: 45" className={cls + ' pr-7'} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">%</span>
                  </div>
                </Field>
                <Field label="% Retención en la fuente">
                  <div className="relative">
                    <input value={form.retencion_vendedor} onChange={e => set('retencion_vendedor', e.target.value)}
                      type="number" min="0" max="100" step="0.01" className={cls + ' pr-7'} />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">%</span>
                  </div>
                </Field>
              </div>
            )}
            {form.vendedor_id && comisionAgencia > 0 && pctVendedor > 0 && (
              <div className="bg-info/10 border border-blue-100 rounded-lg p-3 text-sm">
                <div className="flex justify-between text-info">
                  <span>Comisión vendedor ({pctVendedor}% de $ {fmt(comisionAgencia)})</span>
                  <span className="font-semibold">$ {fmt(comisionVendedor)}</span>
                </div>
                <div className="flex justify-between text-info mt-1">
                  <span>Retención ({form.retencion_vendedor}%)</span>
                  <span>- $ {fmt(comisionVendedor * n(form.retencion_vendedor) / 100)}</span>
                </div>
                <div className="flex justify-between text-info font-semibold border-t border-info/30 pt-1.5 mt-1">
                  <span>Neto a pagar</span>
                  <span>$ {fmt(comisionVendedor - comisionVendedor * n(form.retencion_vendedor) / 100)}</span>
                </div>
              </div>
            )}
          </Section>

          {/* ── 7. Pagos ── */}
          <Section title="Forma de pago">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Periodicidad">
                <select value={form.periodicidad_pago} onChange={e => set('periodicidad_pago', e.target.value)} className={cls}>
                  <option value="">Seleccionar...</option>
                  {PERIODICIDADES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </Field>
              <Field label="Forma de pago">
                <select value={form.forma_pago} onChange={e => set('forma_pago', e.target.value)} className={cls}>
                  <option value="">Seleccionar...</option>
                  {FORMAS_PAGO.map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Medio de pago">
                <select value={form.medio_pago} onChange={e => set('medio_pago', e.target.value)} className={cls}>
                  <option value="">Seleccionar...</option>
                  {MEDIOS_PAGO.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Banco">
                <select value={form.banco_pago} onChange={e => set('banco_pago', e.target.value)} className={cls}>
                  <option value="">Seleccionar...</option>
                  {BANCOS_PAGO.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </Field>
            </div>
          </Section>

          {/* ── 8. Notas ── */}
          <Section title="Notas">
            <textarea value={form.notas} onChange={e => set('notas', e.target.value)}
              placeholder="Coberturas adicionales, observaciones..." rows={2} className={cls} />
          </Section>

          {error && <p className="text-sm text-error bg-error-soft rounded-lg px-3 py-2">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 border-t border-ink-200">
          <button onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg border border-ink-200 text-ink-500 text-sm hover:bg-cream-100 transition-colors">
            Cancelar
          </button>
          <button onClick={save} disabled={saving}
            className="flex-1 px-4 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium hover:bg-primary-700 disabled:opacity-60 transition-colors">
            {saving ? 'Guardando...' : 'Guardar póliza'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── helpers ── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-400 mb-3">{title}</p>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-ink-500 mb-1">{label}</label>
      {children}
    </div>
  )
}

function CheckToggle({ checked, onChange, label }: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <button type="button" onClick={() => onChange(!checked)}
      className={[
        'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium border transition-colors',
        checked
          ? 'bg-primary-50 border-primary-300 text-primary-700'
          : 'bg-white border-ink-200 text-ink-400 hover:border-ink-300',
      ].join(' ')}>
      <span className={[
        'w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0',
        checked ? 'bg-primary-500 border-primary-500' : 'border-ink-300',
      ].join(' ')}>
        {checked && <span className="text-white text-[10px] font-bold">✓</span>}
      </span>
      {label}
    </button>
  )
}

const cls = "w-full px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400 focus:border-transparent bg-white"
