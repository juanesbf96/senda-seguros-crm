'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Poliza, EstadoPoliza, Cliente, Vendedor } from '@/types'
import { X, Calculator } from 'lucide-react'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import {
  pctDe, comisionAgencia as calcComisionAgencia, comisionVendedor as calcComisionVendedor,
  comisionIntermediario as calcComisionIntermediario, retencion, comisionNeta, RETENCION_AGENCIA,
} from '@/lib/comisiones'
import { pctComisionPorDefecto, type TarifaCatalogo } from '@/lib/polizas/tarifas'

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

const ASEGURADORAS_DEFAULT = [
  'Sura','Bolívar','Allianz','Colseguros','Liberty Mutual','AXA Colpatria',
  'La Equidad','Mapfre','Positiva','Previsora','BBVA Seguros','Seguros del Estado',
]

/** Etiquetas de motivo de cancelación (fase 1.1). Fuente única: la usa el
 *  selector del formulario y la operación `cancelacion` de fase 3. */
const MOTIVO_CANCELACION_LABELS: Record<string, string> = {
  por_no_pago:              'Por no pago',
  por_peticion_cliente:     'Por petición del cliente',
  por_cambio_intermediario: 'Por cambio de intermediario',
  otro:                     'Otro',
}

const PERIODICIDADES = ['Anual','Semestral','Trimestral','Mensual','Prima única']
const FORMAS_PAGO    = ['Contado','Financiación','Mensual']
const FINANCIERAS    = ['Crediseguro','Finesa','Servicrédito']
const MEDIOS_PAGO    = ['Efectivo','Transferencia','Cheque','PSE','Débito automático','Tarjeta crédito']
const BANCOS_PAGO    = [
  'Bancolombia','Banco de Bogotá','Davivienda','BBVA','Banco de Occidente',
  'Banco Popular','Colpatria','Banco Agrario','Nequi','Daviplata','Otro',
]

/* ────────────────────────────────────────────────────────── */
/*  Types / helpers                                           */
/* ────────────────────────────────────────────────────────── */

interface TarifaComision {
  id: string
  codigo: string
  ramo: string
  aseguradora: string
  porcentaje: number
}

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
  const [clientes,        setClientes]        = useState<Pick<Cliente, 'id' | 'nombre'>[]>([])
  const [vendedores,      setVendedores]      = useState<Pick<Vendedor, 'id' | 'nombre' | 'comisiones_por_anio'>[]>([])
  // Miembros del workspace para el selector de TÉCNICO (quien gestiona la póliza)
  const [miembros,        setMiembros]        = useState<{ user_id: string; nombre: string; email: string }[]>([])
  const [aseguradoras,    setAseguradoras]    = useState<string[]>(ASEGURADORAS_DEFAULT)
  const [tarifas,         setTarifas]         = useState<TarifaComision[]>([])
  // Catálogo formal ramo-por-aseguradora (fase 2.6): tiene precedencia sobre `tarifas` (JSON heredado)
  const [catalogoRamos,   setCatalogoRamos]   = useState<TarifaCatalogo[]>([])
  const [showNuevaTarifa, setShowNuevaTarifa] = useState(false)
  const [nuevaTarifaForm, setNuevaTarifaForm] = useState<Omit<TarifaComision,'id'>>({ codigo:'', ramo:'', aseguradora:'', porcentaje:0 })
  const [nuevaTarifaErr,  setNuevaTarifaErr]  = useState('')
  const [savingTarifa,    setSavingTarifa]    = useState(false)
  // Generador de cuotas (fase 3, ítem 2)
  const [generandoCuotas, setGenerandoCuotas] = useState(false)
  const [cuotasMsg,       setCuotasMsg]       = useState<{ ok: boolean; texto: string } | null>(null)
  // Pre-poblar búsqueda con nombre_tomador cuando se crea desde colilla (sin client_id aún)
  const [clienteSearch,   setClienteSearch]   = useState(
    !poliza?.id && !poliza?.client_id && poliza?.nombre_tomador ? poliza.nombre_tomador : ''
  )
  const [showClienteList, setShowClienteList] = useState(false)
  const clienteRef = useRef<HTMLDivElement>(null)

  const defaultRamo = isCumplimiento ? 'Fianzas' : ''
  const [aseguradoraOtro, setAseguradoraOtro] = useState(
    !!poliza?.aseguradora && !ASEGURADORAS_DEFAULT.includes(poliza.aseguradora)
  )

  const [form, setForm] = useState({
    // identidad
    client_id:     poliza?.client_id    || clientId || '',
    aseguradora:   poliza?.aseguradora  || '',
    ramo:          poliza?.ramo         || defaultRamo,
    tipo_poliza:   poliza?.tipo_poliza  || '',
    tipo_modalidad:(poliza?.tipo_modalidad || 'individual') as TipoModalidad,
    numero_poliza: poliza?.numero_poliza || '',
    estado:        (poliza?.estado      || 'activa') as EstadoPoliza,
    motivo_cancelacion:      poliza?.motivo_cancelacion      || '',
    motivo_cancelacion_otro: poliza?.motivo_cancelacion_otro || '',
    fecha_cancelacion:       poliza?.fecha_cancelacion       || '',
    // fechas
    fecha_expedicion: poliza?.fecha_expedicion || '',
    fecha_recepcion:  poliza?.fecha_recepcion  || '',
    fecha_inicio:     poliza?.fecha_inicio     || (poliza?.id ? '' : new Date().toISOString().slice(0, 10)),
    fecha_fin:        poliza?.fecha_fin        || (poliza?.id ? '' : (() => { const d = new Date(); d.setFullYear(d.getFullYear() + 1); return d.toISOString().slice(0, 10) })()),
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
    tarifa_codigo:              '',
    // intermediario
    intermediario:    poliza?.intermediario    || '',
    pct_comision_int: poliza?.pct_comision_int?.toString() || '',
    // vendedor
    vendedor_id:                poliza?.vendedor_id                    || '',
    tecnico_id:                 poliza?.tecnico_id                     || '',
    porcentaje_comision_vendedor:poliza?.porcentaje_comision_vendedor?.toString() || '',
    retencion_vendedor:         (poliza?.retencion_vendedor ?? 10).toString(),
    // pagos
    periodicidad_pago: poliza?.periodicidad_pago || '',
    prima_mensual:     (poliza as any)?.prima_mensual?.toString() || '',
    forma_pago:        poliza?.forma_pago        || '',
    financiera:        (poliza as any)?.financiera || '',
    num_cuotas:        (poliza as any)?.num_cuotas?.toString() || '',
    medio_pago:        poliza?.medio_pago        || '',
    banco_pago:        poliza?.banco_pago        || '',
    // recaudo (legacy cumplimiento)
    comision:              poliza?.comision?.toString()              || '',
    recaudado_oficina:     poliza?.recaudado_oficina?.toString()     || '',
    recaudado_aseguradora: poliza?.recaudado_aseguradora?.toString() || '',
    // notas
    notas: poliza?.notas || '',
    // colectiva
    es_colectiva:       poliza?.es_colectiva       ?? false,
    prima_por_afiliado: poliza?.prima_por_afiliado?.toString() ?? '',
  })

  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  /* derived */
  // El RPC de cuotas lee la póliza persistida; si estos campos cambiaron en el
  // formulario y no se guardaron, generaría cuotas con los valores viejos.
  const financiacionSinGuardar = !!poliza?.id && (
    (form.num_cuotas || '')        !== (((poliza as { num_cuotas?: number }).num_cuotas ?? '') + '') ||
    (form.periodicidad_pago || '') !== (poliza.periodicidad_pago ?? '') ||
    (form.fecha_inicio || '')      !== (poliza.fecha_inicio ?? '')
  )

  const esCumplimiento    = RAMOS_CUMPLIMIENTO.includes(form.ramo)
  const primaNeta         = n(form.prima_neta)
  const pctIva            = n(form.porcentaje_iva)
  const gastos            = n(form.gastos)
  const pctAgencia        = n(form.porcentaje_comision_agencia)
  const iva               = pctDe(primaNeta, pctIva)
  const comisionAgencia     = calcComisionAgencia(primaNeta, pctAgencia)  // bruta (sobre prima neta)
  const retencionAgencia    = retencion(comisionAgencia, RETENCION_AGENCIA)  // retención fija 10%
  const comisionAgenciaNeta = comisionAgencia - retencionAgencia  // neta a recibir
  const totalPrima          = primaNeta + iva + gastos
  const pctIntermedario     = n(form.pct_comision_int)
  const comisionIntermedario = calcComisionIntermediario(comisionAgencia, pctIntermedario)
  const pctVendedor         = n(form.porcentaje_comision_vendedor)
  const comisionVendedor    = calcComisionVendedor(comisionAgencia, pctVendedor)
  // mensual
  const primaMensual        = n(form.prima_mensual)
  const comisionMensualBruta = calcComisionAgencia(primaMensual, pctAgencia)
  const comisionMensualNeta  = comisionMensualBruta - retencion(comisionMensualBruta, RETENCION_AGENCIA)

  /* click-outside para cerrar dropdown de cliente */
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (clienteRef.current && !clienteRef.current.contains(e.target as Node)) {
        setShowClienteList(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  /* load */
  useEffect(() => {
    if (!clientId) {
      supabase.from('clientes').select('id, nombre').order('nombre')
        .then(({ data }) => {
          setClientes(data || [])
          if (poliza?.client_id) {
            const found = (data || []).find(c => c.id === poliza.client_id)
            if (found) setClienteSearch(found.nombre)
          }
        })
    }
    supabase.from('vendedores').select('id, nombre, comisiones_por_anio').eq('activo', true).order('nombre')
      .then(({ data }) => setVendedores((data || []) as Pick<Vendedor, 'id' | 'nombre' | 'comisiones_por_anio'>[]))

    if (currentWorkspace) {
      supabase.rpc('get_workspace_members', { p_workspace_id: currentWorkspace.id })
        .then(({ data }) => setMiembros((data || []) as { user_id: string; nombre: string; email: string }[]))
    }

    if (currentWorkspace) {
      supabase.from('ramos_aseguradora')
        .select('aseguradora, ramo, pct_comision_default, activo')
        .eq('workspace_id', currentWorkspace.id)
        .not('pct_comision_default', 'is', null)
        .then(({ data }) => setCatalogoRamos((data ?? []) as TarifaCatalogo[]))

      supabase.from('configuracion')
        .select('clave, valor')
        .eq('workspace_id', currentWorkspace.id)
        .in('clave', ['aseguradoras_lista', 'comisiones_tarifas'])
        .then(({ data }) => {
          if (!data) return
          for (const row of data) {
            if (row.clave === 'aseguradoras_lista' && row.valor) {
              const lista = row.valor.split(',').map((s: string) => s.trim()).filter(Boolean)
              if (lista.length > 0) {
                setAseguradoras(lista)
                if (poliza?.aseguradora) setAseguradoraOtro(!lista.includes(poliza.aseguradora))
              }
            }
            if (row.clave === 'comisiones_tarifas' && row.valor) {
              try { setTarifas(JSON.parse(row.valor)) } catch { /* ignore */ }
            }
          }
        })
    }
  }, [clientId, currentWorkspace])

  /* auto-fill vendedor % when selected */
  function onVendedorChange(id: string) {
    setForm(f => {
      const v = vendedores.find(x => x.id === id)
      const pct = v?.comisiones_por_anio?.[0]?.porcentaje?.toString() || ''
      return { ...f, vendedor_id: id, porcentaje_comision_vendedor: pct }
    })
  }

  /* Al cambiar ramo o aseguradora, autocompletar el % de comisión de agencia.
     Precedencia: catálogo ramos_aseguradora → tarifa JSON exacta → tarifa por ramo
     (ver lib/polizas/tarifas.ts). Si ninguna aplica se conserva el valor actual. */
  function autocompletarPct(aseguradora: string, ramo: string) {
    setForm(f => {
      const pct   = pctComisionPorDefecto(catalogoRamos, tarifas, aseguradora, ramo)
      const match = tarifas.find(t => t.ramo === ramo)
      return {
        ...f,
        ramo,
        aseguradora,
        tarifa_codigo: match?.codigo || '',
        porcentaje_comision_agencia: pct !== null ? pct.toString() : f.porcentaje_comision_agencia,
      }
    })
  }

  function onRamoChange(ramo: string) {
    autocompletarPct(form.aseguradora, ramo)
  }

  function onAseguradoraChange(aseguradora: string) {
    autocompletarPct(aseguradora, form.ramo)
  }

  /* seleccionar tarifa por código → rellena % */
  function onTarifaChange(codigo: string) {
    const tarifa = tarifas.find(t => t.codigo === codigo)
    setForm(f => ({
      ...f,
      tarifa_codigo: codigo,
      porcentaje_comision_agencia: tarifa ? tarifa.porcentaje.toString() : f.porcentaje_comision_agencia,
    }))
  }

  /* guardar nueva tarifa desde el modal inline */
  async function saveNuevaTarifa() {
    const { codigo, ramo, aseguradora, porcentaje } = nuevaTarifaForm
    if (!codigo.trim() || !ramo || !aseguradora) { setNuevaTarifaErr('Completa todos los campos'); return }
    if (codigo.length > 9) { setNuevaTarifaErr('El código no puede tener más de 9 caracteres'); return }
    if (tarifas.some(t => t.codigo === codigo.trim().toUpperCase())) { setNuevaTarifaErr('Ya existe una tarifa con ese código'); return }
    if (!currentWorkspace) return

    setSavingTarifa(true)
    const nueva: TarifaComision = { id: crypto.randomUUID(), codigo: codigo.trim().toUpperCase(), ramo, aseguradora, porcentaje }
    const updated = [...tarifas, nueva]

    await supabase.from('configuracion').upsert({
      clave: 'comisiones_tarifas',
      valor: JSON.stringify(updated),
      workspace_id: currentWorkspace.id,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'clave' })

    setTarifas(updated)
    setForm(f => ({ ...f, tarifa_codigo: nueva.codigo, porcentaje_comision_agencia: nueva.porcentaje.toString() }))
    setShowNuevaTarifa(false)
    setNuevaTarifaForm({ codigo:'', ramo:'', aseguradora:'', porcentaje:0 })
    setNuevaTarifaErr('')
    setSavingTarifa(false)
  }

  function set(field: string, val: string | boolean) {
    setForm(f => ({ ...f, [field]: val }))
  }

  /* ── save ── */
  async function save() {
    if (!form.aseguradora || !form.ramo) { setError('Aseguradora y ramo son obligatorios'); return }
    if (!form.client_id)                  { setError('Debes seleccionar un cliente'); return }
    if (form.estado === 'cancelada') {
      if (!form.motivo_cancelacion) { setError('Indica el motivo de cancelación'); return }
      if (form.motivo_cancelacion === 'otro' && !form.motivo_cancelacion_otro.trim()) {
        setError('Describe el motivo de cancelación'); return
      }
    }
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
      // cancelación (solo se persiste el motivo cuando el estado es cancelada)
      motivo_cancelacion:      form.estado === 'cancelada' ? form.motivo_cancelacion : null,
      motivo_cancelacion_otro: form.estado === 'cancelada' && form.motivo_cancelacion === 'otro' ? form.motivo_cancelacion_otro.trim() : null,
      fecha_cancelacion:       form.estado === 'cancelada' ? (form.fecha_cancelacion || null) : null,
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
      // intermediario
      intermediario:         form.intermediario.trim() || null,
      pct_comision_int:      pctIntermedario || null,
      comision_intermediario: comisionIntermedario || null,
      // vendedor
      vendedor_id:                  form.vendedor_id || null,
      tecnico_id:                   form.tecnico_id  || null,
      porcentaje_comision_vendedor: pctVendedor || null,
      retencion_vendedor:           n(form.retencion_vendedor),
      comision_vendedor:            comisionVendedor || null,
      // pagos
      periodicidad_pago: form.periodicidad_pago || null,
      prima_mensual:     primaMensual || null,
      forma_pago:        form.forma_pago        || null,
      financiera:        form.forma_pago === 'Financiación' ? (form.financiera || null) : null,
      num_cuotas:        form.forma_pago === 'Financiación' ? (form.num_cuotas ? parseInt(form.num_cuotas) : null) : null,
      medio_pago:        form.medio_pago        || null,
      banco_pago:        form.banco_pago        || null,
      // legacy cumplimiento
      comision:              form.comision ? n(form.comision) : null,
      recaudado_oficina:     form.recaudado_oficina ? n(form.recaudado_oficina) : null,
      recaudado_aseguradora: form.recaudado_aseguradora ? n(form.recaudado_aseguradora) : null,
      // notas
      notas: form.notas || null,
      // colectiva
      es_colectiva:       form.es_colectiva,
      prima_por_afiliado: form.prima_por_afiliado ? n(form.prima_por_afiliado) : null,
      workspace_id: currentWorkspace?.id,
    }

    const { data: guardada, error: err } = poliza?.id
      ? await supabase.from('polizas').update(payload).eq('id', poliza.id).select('id').single()
      : await supabase.from('polizas').insert({ ...payload, origen_creacion: 'manual' }).select('id').single()

    if (err) { setError(err.message); setSaving(false); return }

    // Fase 3, ítem 4: cancelar una póliza deja su operación de Producción.
    // Se hace DESPUÉS de guardar (necesita el id) y es best-effort: si falla
    // (p.ej. el usuario no tiene finanzas_cobros_registrar) no se pierde la
    // cancelación, que ya quedó persistida arriba.
    const polizaId = guardada?.id ?? poliza?.id
    if (form.estado === 'cancelada' && polizaId && currentWorkspace) {
      await registrarOperacionCancelacion(polizaId, currentWorkspace.id)
    }

    onSaved()
  }

  /**
   * Genera las cuotas de financiación como operaciones (fase 3, ítem 2).
   *
   * El RPC lee la financiación de la póliza YA GUARDADA (num_cuotas,
   * periodicidad, fecha_inicio), no del formulario — por eso el botón se
   * deshabilita si hay cambios sin guardar en esos campos. El RPC además es
   * anti-duplicado y valida el permiso `finanzas_cobros_registrar`, así que
   * acá solo se traduce su error a algo legible.
   */
  async function generarCuotas() {
    if (!poliza?.id) return
    setGenerandoCuotas(true); setCuotasMsg(null)
    const { data, error: err } = await supabase.rpc('generar_operaciones_cuotas', {
      p_poliza_id: poliza.id,
    })
    setGenerandoCuotas(false)
    if (err) {
      const m = err.message || ''
      setCuotasMsg({ ok: false, texto:
        m.includes('ya tiene cuotas')     ? 'Esta póliza ya tiene sus cuotas generadas.'
      : m.includes('num_cuotas')          ? 'Falta el número de cuotas: complétalo y guarda antes de generar.'
      : m.includes('Sin permiso')         ? 'No tienes permiso para generar cuotas.'
      : m })
      return
    }
    setCuotasMsg({ ok: true, texto: `${data} cuota${data === 1 ? '' : 's'} generada${data === 1 ? '' : 's'}. Aparecen en la sección Operaciones de la póliza.` })
  }

  /** Crea la operación `cancelacion` si la póliza no tiene una ya (evita
   *  duplicar al reeditar una póliza que ya estaba cancelada). */
  async function registrarOperacionCancelacion(polizaId: string, wsId: string) {
    const { data: yaExiste } = await supabase
      .from('operaciones')
      .select('id')
      .eq('poliza_id', polizaId)
      .eq('tipo', 'cancelacion')
      .limit(1)
      .maybeSingle()
    if (yaExiste) return

    const motivo = form.motivo_cancelacion === 'otro'
      ? form.motivo_cancelacion_otro.trim()
      : MOTIVO_CANCELACION_LABELS[form.motivo_cancelacion] ?? form.motivo_cancelacion

    const { error: errOp } = await supabase.from('operaciones').insert({
      workspace_id:     wsId,
      poliza_id:        polizaId,
      tipo:             'cancelacion',
      estado_cartera:   'anulada',   // una cancelación no es cartera por cobrar
      valor:            0,
      fecha_programada: form.fecha_cancelacion || new Date().toISOString().slice(0, 10),
      origen:           'poliza_modal',
      notas:            motivo ? `Motivo: ${motivo}` : null,
    })
    // No se bloquea el flujo: la póliza ya se canceló correctamente.
    if (errOp) console.error('No se pudo registrar la operación de cancelación:', errOp.message)
  }

  /* ────────────────────────────────────────────────────── */
  /*  Render                                                */
  /* ────────────────────────────────────────────────────── */
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">

        {/* header */}
        <div className="flex items-center justify-between p-5 border-b border-ink-200">
          <h2 className="font-semibold text-ink-700">{poliza?.id ? 'Editar póliza' : 'Nueva póliza'}</h2>
          <button onClick={onClose} className="text-ink-400 hover:text-ink-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* ── 1. Info básica ── */}
          <Section title="Información básica">
            {!clientId && (
              <Field label="Cliente CRM *">
                <div ref={clienteRef} className="relative">
                  <div className="relative">
                    <input
                      value={clienteSearch}
                      onChange={e => { setClienteSearch(e.target.value); setShowClienteList(true) }}
                      onFocus={() => setShowClienteList(true)}
                      placeholder="Buscar cliente..."
                      className={cls}
                    />
                    {clienteSearch && (
                      <button
                        type="button"
                        onMouseDown={e => { e.preventDefault(); setClienteSearch(''); set('client_id', ''); setShowClienteList(false) }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  {showClienteList && (
                    <div className="absolute z-20 w-full bg-white border border-ink-200 rounded-lg shadow-lg mt-1 max-h-48 overflow-y-auto">
                      {clientes
                        .filter(c => c.nombre.toLowerCase().includes(clienteSearch.toLowerCase()))
                        .slice(0, 20)
                        .map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onMouseDown={() => { set('client_id', c.id); setClienteSearch(c.nombre); setShowClienteList(false) }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-primary-50 hover:text-primary-700 transition-colors"
                          >
                            {c.nombre}
                          </button>
                        ))
                      }
                      {clientes.filter(c => c.nombre.toLowerCase().includes(clienteSearch.toLowerCase())).length === 0 && (
                        <p className="px-3 py-2 text-sm text-ink-400">Sin resultados</p>
                      )}
                    </div>
                  )}
                </div>
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
                <select
                  value={aseguradoraOtro ? 'Otro' : form.aseguradora}
                  onChange={e => {
                    if (e.target.value === 'Otro') {
                      setAseguradoraOtro(true)
                      set('aseguradora', '')
                    } else {
                      setAseguradoraOtro(false)
                      onAseguradoraChange(e.target.value)
                    }
                  }}
                  className={cls}>
                  <option value="">Seleccionar...</option>
                  {aseguradoras.map(a => <option key={a} value={a}>{a}</option>)}
                  <option value="Otro">Otro</option>
                </select>
                {aseguradoraOtro && (
                  <input
                    value={form.aseguradora}
                    onChange={e => onAseguradoraChange(e.target.value)}
                    placeholder="Nombre de la aseguradora..."
                    autoFocus
                    className={`${cls} mt-2`}
                  />
                )}
              </Field>
              <Field label="Ramo *">
                <select value={form.ramo} onChange={e => onRamoChange(e.target.value)} className={cls}>
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

            {/* Motivo de cancelación — obligatorio al cancelar */}
            {form.estado === 'cancelada' && (
              <div className="grid grid-cols-2 gap-4 rounded-lg border border-warning/40 bg-warning-soft/40 p-4">
                <Field label="Motivo de cancelación *">
                  <select value={form.motivo_cancelacion} onChange={e => set('motivo_cancelacion', e.target.value)} className={cls}>
                    <option value="">Seleccionar…</option>
                    {Object.entries(MOTIVO_CANCELACION_LABELS).map(([v, label]) => (
                      <option key={v} value={v}>{label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Fecha de cancelación">
                  <input type="date" value={form.fecha_cancelacion} onChange={e => set('fecha_cancelacion', e.target.value)} className={cls} />
                </Field>
                {form.motivo_cancelacion === 'otro' && (
                  <div className="col-span-2">
                    <Field label="¿Cuál motivo? *">
                      <input value={form.motivo_cancelacion_otro} onChange={e => set('motivo_cancelacion_otro', e.target.value)}
                        placeholder="Describe el motivo" className={cls} />
                    </Field>
                  </div>
                )}
              </div>
            )}

            <Field label="Nombre del tomador (en la póliza)">
              <input value={form.nombre_tomador} onChange={e => set('nombre_tomador', e.target.value)}
                placeholder="Nombre exacto como aparece en la póliza de la aseguradora" className={cls} />
            </Field>
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
                <input type="date" value={form.fecha_inicio}
                  onChange={e => {
                    const inicio = e.target.value
                    set('fecha_inicio', inicio)
                    if (inicio) {
                      const d = new Date(inicio + 'T00:00:00')
                      d.setFullYear(d.getFullYear() + 1)
                      set('fecha_fin', d.toISOString().slice(0, 10))
                    }
                  }}
                  className={cls} />
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

            {/* Tarifa de comisión */}
            <Field label="Tarifa de comisión">
              <div className="flex gap-2">
                <select
                  value={form.tarifa_codigo}
                  onChange={e => onTarifaChange(e.target.value)}
                  className={cls + ' flex-1'}
                >
                  <option value="">— Sin tarifa / ingresar % manual —</option>
                  {tarifas.map(t => (
                    <option key={t.id} value={t.codigo}>
                      {t.codigo} · {t.ramo} · {t.aseguradora} · {t.porcentaje}%
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => { setShowNuevaTarifa(true); setNuevaTarifaErr('') }}
                  className="flex-shrink-0 px-3 py-2 text-xs font-medium border border-primary-300 text-primary-600 bg-primary-50 hover:bg-primary-100 rounded-lg transition-colors whitespace-nowrap"
                >
                  + Crear tarifa
                </button>
              </div>
              {form.tarifa_codigo && (
                <p className="text-xs text-emerald-600 mt-1">
                  Tarifa <span className="font-mono font-bold">{form.tarifa_codigo}</span> — % auto-aplicado
                </p>
              )}
            </Field>

            {/* auto-calc summary */}
            {primaNeta > 0 && (
              <div className="bg-cream-100 border border-ink-200 rounded-lg p-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-ink-500">
                  <span>IVA ({pctIva}%)</span>
                  <span className="font-medium">$ {fmt(iva)}</span>
                </div>
                <div className="flex justify-between text-ink-700 font-semibold border-t border-ink-200 pt-1.5 mt-1">
                  <span>Total prima</span>
                  <span>$ {fmt(totalPrima)}</span>
                </div>
                {pctAgencia > 0 && (
                  <div className="border-t border-ink-200 pt-1.5 mt-1 space-y-1">
                    <div className="flex justify-between text-ink-500">
                      <span>Comisión bruta agencia ({pctAgencia}%)</span>
                      <span>$ {fmt(comisionAgencia)}</span>
                    </div>
                    <div className="flex justify-between text-ink-400">
                      <span>Retención en la fuente (10%)</span>
                      <span>- $ {fmt(retencionAgencia)}</span>
                    </div>
                    <div className="flex justify-between text-primary-700 font-semibold">
                      <span>Comisión neta agencia</span>
                      <span>$ {fmt(comisionAgenciaNeta)}</span>
                    </div>
                  </div>
                )}
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

          {/* ── 6. Intermediario ── */}
          <Section title="Intermediario">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Nombre del intermediario">
                <input value={form.intermediario} onChange={e => set('intermediario', e.target.value)}
                  placeholder="Ej: Juan García" className={cls} />
              </Field>
              <Field label="% Comisión intermediario">
                <div className="relative">
                  <input value={form.pct_comision_int} onChange={e => set('pct_comision_int', e.target.value)}
                    type="number" min="0" max="100" step="0.01" placeholder="Ej: 20" className={cls + ' pr-7'} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">%</span>
                </div>
              </Field>
            </div>
            {form.intermediario && comisionAgencia > 0 && pctIntermedario > 0 && (
              <div className="bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm">
                <div className="flex justify-between text-amber-700">
                  <span>Comisión intermediario ({pctIntermedario}% de $ {fmt(comisionAgencia)})</span>
                  <span className="font-semibold">$ {fmt(comisionIntermedario)}</span>
                </div>
                <div className="flex justify-between text-amber-700 font-semibold border-t border-amber-200 pt-1.5 mt-1">
                  <span>Comisión agencia restante</span>
                  <span>$ {fmt(comisionAgencia - comisionIntermedario)}</span>
                </div>
              </div>
            )}
          </Section>

          {/* ── 7. Vendedor y técnico ── */}
          <Section title="Vendedor y técnico">
            <Field label="Vendedor">
              <select value={form.vendedor_id} onChange={e => onVendedorChange(e.target.value)} className={cls}>
                <option value="">Sin vendedor asignado</option>
                {vendedores.map(v => <option key={v.id} value={v.id}>{v.nombre}</option>)}
              </select>
            </Field>
            {/* Técnico = quien GESTIONA la póliza; distinto de quien la vendió (fase 2.1) */}
            <Field label="Técnico asignado (gestiona la póliza)">
              <select value={form.tecnico_id} onChange={e => set('tecnico_id', e.target.value)} className={cls}>
                <option value="">Sin técnico asignado</option>
                {miembros.map(m => (
                  <option key={m.user_id} value={m.user_id}>{m.nombre || m.email}</option>
                ))}
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
                  <span>- $ {fmt(retencion(comisionVendedor, n(form.retencion_vendedor)))}</span>
                </div>
                <div className="flex justify-between text-info font-semibold border-t border-info/30 pt-1.5 mt-1">
                  <span>Neto a pagar</span>
                  <span>$ {fmt(comisionNeta(comisionVendedor, n(form.retencion_vendedor)))}</span>
                </div>
              </div>
            )}
          </Section>

          {/* ── 8. Pagos ── */}
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

            {form.periodicidad_pago === 'Mensual' && (
              <>
                <Field label="Prima mensual antes de IVA (COP)">
                  <input
                    type="number" min="0" step="1"
                    value={form.prima_mensual}
                    onChange={e => set('prima_mensual', e.target.value)}
                    placeholder="Ej: 52.367"
                    className={cls}
                  />
                </Field>
                {primaMensual > 0 && pctAgencia > 0 && (
                  <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm space-y-1">
                    <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1.5">Comisión mensual estimada</p>
                    <div className="flex justify-between text-ink-500">
                      <span>Comisión bruta ({pctAgencia}% de $ {fmt(primaMensual)})</span>
                      <span>$ {fmt(comisionMensualBruta)}</span>
                    </div>
                    <div className="flex justify-between text-ink-400">
                      <span>Retención en la fuente (10%)</span>
                      <span>- $ {fmt(retencion(comisionMensualBruta, RETENCION_AGENCIA))}</span>
                    </div>
                    <div className="flex justify-between text-emerald-700 font-semibold border-t border-emerald-200 pt-1.5 mt-1">
                      <span>Comisión neta mensual</span>
                      <span>$ {fmt(comisionMensualNeta)}</span>
                    </div>
                  </div>
                )}
              </>
            )}
            {form.forma_pago === 'Financiación' && (
              <div className="grid grid-cols-2 gap-4">
                <Field label="Financiera">
                  <select value={form.financiera} onChange={e => set('financiera', e.target.value)} className={cls}>
                    <option value="">Seleccionar...</option>
                    {FINANCIERAS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </Field>
                <Field label="Número de cuotas">
                  <input
                    type="number" min="1" max="60" step="1"
                    value={form.num_cuotas}
                    onChange={e => set('num_cuotas', e.target.value)}
                    placeholder="Ej: 12"
                    className={cls}
                  />
                </Field>

                {/* Generador de cuotas (fase 3). Solo en pólizas ya guardadas:
                    el RPC lee la financiación persistida, no el formulario. */}
                {poliza?.id && (
                  <div className="col-span-2">
                    {financiacionSinGuardar ? (
                      <p className="text-xs text-ink-400">
                        Guarda los cambios de financiación para poder generar las cuotas.
                      </p>
                    ) : (
                      <button
                        type="button"
                        onClick={generarCuotas}
                        disabled={generandoCuotas || !form.num_cuotas}
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-primary-300 bg-primary-50 text-primary-700 text-sm font-medium hover:bg-primary-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">
                        <Calculator className="w-4 h-4" />
                        {generandoCuotas ? 'Generando…' : 'Generar cuotas'}
                      </button>
                    )}
                    {cuotasMsg && (
                      <p className={`text-xs mt-2 ${cuotasMsg.ok ? 'text-primary-700' : 'text-error'}`}>
                        {cuotasMsg.texto}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}

          </Section>

          {/* ── 8. Póliza colectiva ── */}
          <Section title="Póliza colectiva">
            <label className="flex items-center gap-3 cursor-pointer">
              <div
                onClick={() => setForm(f => ({ ...f, es_colectiva: !f.es_colectiva }))}
                className={`relative w-10 h-5 rounded-full transition-colors ${form.es_colectiva ? 'bg-primary-500' : 'bg-slate-200'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.es_colectiva ? 'translate-x-5' : ''}`} />
              </div>
              <span className="text-sm text-ink-600">Esta es una póliza colectiva / grupal</span>
            </label>
            {form.es_colectiva && (
              <div className="mt-3">
                <label className="block text-xs text-ink-400 mb-1">
                  Prima por afiliado (COP)
                  <span className="ml-1 text-ink-300">— La prima total se calcula automáticamente</span>
                </label>
                <input
                  type="number"
                  value={form.prima_por_afiliado}
                  onChange={e => setForm(f => ({ ...f, prima_por_afiliado: e.target.value }))}
                  placeholder="0"
                  className={cls}
                />
              </div>
            )}
          </Section>

          {/* ── 9. Notas ── */}
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

      {/* ── Mini-modal crear tarifa ── */}
      {showNuevaTarifa && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-base font-semibold text-ink-700 mb-4">Nueva tarifa de comisión</h3>
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">Código <span className="text-error">*</span></label>
                  <input
                    value={nuevaTarifaForm.codigo}
                    onChange={e => setNuevaTarifaForm(f => ({ ...f, codigo: e.target.value.slice(0,9).toUpperCase() }))}
                    placeholder="Ej: SURA-VIDA"
                    maxLength={9}
                    className={cls}
                  />
                  <p className="text-xs text-ink-400 mt-0.5">{nuevaTarifaForm.codigo.length}/9 chars</p>
                </div>
                <div>
                  <label className="block text-xs font-medium text-ink-500 mb-1">% Comisión <span className="text-error">*</span></label>
                  <div className="relative">
                    <input
                      type="number" min="0" max="100" step="0.5"
                      value={nuevaTarifaForm.porcentaje || ''}
                      onChange={e => setNuevaTarifaForm(f => ({ ...f, porcentaje: parseFloat(e.target.value) || 0 }))}
                      placeholder="12.5"
                      className={cls + ' pr-6'}
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-ink-400">%</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1">Ramo <span className="text-error">*</span></label>
                <select
                  value={nuevaTarifaForm.ramo}
                  onChange={e => setNuevaTarifaForm(f => ({ ...f, ramo: e.target.value }))}
                  className={cls}
                >
                  <option value="">Seleccionar ramo...</option>
                  {[...RAMOS_SEGUROS, ...RAMOS_CUMPLIMIENTO].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-ink-500 mb-1">Aseguradora <span className="text-error">*</span></label>
                <select
                  value={nuevaTarifaForm.aseguradora}
                  onChange={e => setNuevaTarifaForm(f => ({ ...f, aseguradora: e.target.value }))}
                  className={cls}
                >
                  <option value="">Seleccionar aseguradora...</option>
                  {aseguradoras.map(a => <option key={a} value={a}>{a}</option>)}
                  {!aseguradoras.includes('Otra') && <option value="Otra">Otra</option>}
                </select>
              </div>
              {nuevaTarifaErr && <p className="text-xs text-error">{nuevaTarifaErr}</p>}
            </div>
            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowNuevaTarifa(false); setNuevaTarifaErr('') }}
                className="flex-1 px-4 py-2 text-sm border border-ink-200 text-ink-500 rounded-lg hover:bg-cream-100"
              >
                Cancelar
              </button>
              <button
                onClick={saveNuevaTarifa}
                disabled={savingTarifa || !nuevaTarifaForm.codigo || !nuevaTarifaForm.ramo || !nuevaTarifaForm.aseguradora}
                className="flex-1 px-4 py-2 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 font-medium"
              >
                {savingTarifa ? 'Guardando...' : 'Crear y seleccionar'}
              </button>
            </div>
          </div>
        </div>
      )}
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
