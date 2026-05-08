export type Etapa = 'nuevo' | 'contactado' | 'cotizacion' | 'cerrado'
export type TipoActividad = 'llamada' | 'email' | 'reunion' | 'nota'
export type EstadoPoliza = 'activa' | 'vencida' | 'cancelada' | 'pendiente'
export type TipoCliente = 'persona_natural' | 'empresa' | 'consorcio'
export type TipoSolicitud = 'cotizacion' | 'expedicion' | 'renovacion' | 'endoso' | 'cancelacion' | 'certificado' | 'siniestro' | 'inclusion' | 'exclusion' | 'otro'
export type EstadoSolicitud = 'nueva' | 'en_proceso' | 'resuelta' | 'cancelada' | 'inactiva'
export type PrioridadSolicitud = 'normal' | 'urgente'

export interface Cliente {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  cedula: string | null
  ciudad: string | null
  departamento: string | null
  etapa: Etapa
  notas: string | null
  tipo_cliente: TipoCliente
  razon_social: string | null
  sobrenombre: string | null
  nit: string | null
  fecha_constitucion: string | null
  fecha_nacimiento: string | null
  // Sprint A
  genero: string | null
  fecha_vencimiento_cedula: string | null
  estado_civil: string | null
  tiene_vehiculo: boolean
  tiene_hijos: boolean
  num_hijos: number | null
  ocupacion: string | null
  empresa_trabajo: string | null
  ingresos_aprox: number | null
  categoria: string | null
  autoriza_datos: boolean
  created_at: string
  updated_at: string
}

export interface Poliza {
  id: string
  client_id: string
  numero_poliza: string | null
  aseguradora: string
  ramo: string
  prima: number | null
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: EstadoPoliza
  notas: string | null
  tipo_poliza: string | null
  riesgo: string | null
  eliminada: boolean
  nombre_tomador: string | null
  comision: number | null
  recaudado_oficina: number | null
  recaudado_aseguradora: number | null
  // Sprint A
  tipo_modalidad: 'individual' | 'colectiva' | 'agrupadora' | null
  fecha_expedicion: string | null
  fecha_recepcion: string | null
  asegurado_nombre: string | null
  asegurado_documento: string | null
  beneficiario_nombre: string | null
  beneficiario_documento: string | null
  beneficiario_oneroso: boolean
  beneficiario_en_remision: boolean
  prima_neta: number | null
  porcentaje_iva: number | null
  iva: number | null
  gastos: number | null
  porcentaje_comision_agencia: number | null
  comision_agencia: number | null
  total_prima: number | null
  vendedor_id: string | null
  porcentaje_comision_vendedor: number | null
  retencion_vendedor: number | null
  comision_vendedor: number | null
  periodicidad_pago: string | null
  forma_pago: string | null
  medio_pago: string | null
  banco_pago: string | null
  valor_asegurado: number | null
  created_at: string
  cliente?: Cliente
}

export interface PolizaAnexo {
  id: string
  poliza_id: string
  client_id: string | null
  numero_anexo: string | null
  estado: 'activo' | 'inactivo' | 'cancelado'
  documento: string | null
  created_at: string
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>
  cliente?: Pick<Cliente, 'id' | 'nombre'>
}

export interface PolizaVinculado {
  id: string
  poliza_id: string
  numero_anexo_pago: string | null
  numero_afiliado_objeto: string | null
  fecha_inicio: string | null
  beneficiario: string | null
  created_at: string
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>
}

export interface Actividad {
  id: string
  client_id: string
  tipo: TipoActividad
  descripcion: string
  fecha: string
  created_at: string
}

export interface Contacto {
  id: string
  client_id: string
  nombre: string
  tipo_documento: string | null
  numero_documento: string | null
  cargo: string | null
  created_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre'>
}

export type PrioridadTarea = 'normal' | 'alta' | 'urgente'

export interface Tarea {
  id: string
  client_id: string | null
  titulo: string
  descripcion: string | null
  fecha_vencimiento: string | null
  completada: boolean
  prioridad: PrioridadTarea
  asignado_a: string | null
  created_at: string
  updated_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre'>
}

export type EstadoGestion = 'pendiente' | 'contactado' | 'en_negociacion' | 'renovado' | 'no_renueva'

export interface GestionRenovacion {
  id: string
  poliza_id: string
  estado: EstadoGestion
  notas: string | null
  fecha: string
}

export type EstadoRemision = 'borrador' | 'enviada' | 'recibida' | 'aprobada' | 'rechazada' | 'anulada'

export interface Remision {
  id: string
  client_id: string | null
  poliza_id: string | null
  aseguradora: string
  ramo: string
  descripcion: string | null
  estado: EstadoRemision
  fecha: string | null
  notas: string | null
  numero_remision: number | null
  created_at: string
  updated_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre'>
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>
}

export interface Solicitud {
  id: string
  client_id: string | null
  poliza_id: string | null
  tipo: TipoSolicitud
  estado: EstadoSolicitud
  prioridad: PrioridadSolicitud
  descripcion: string | null
  fecha_limite: string | null
  notas: string | null
  numero_solicitud: number | null
  asignado_a: string | null
  ramo: string | null
  riesgo: string | null
  created_at: string
  updated_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre'>
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>
}

export type EstadoCobro = 'pendiente' | 'pagado' | 'vencido' | 'anulado'
export type TipoCobro = 'por_cobrar' | 'por_pagar' | 'comision_por_cobrar' | 'comision_recibida'
export type FormaPago = 'efectivo' | 'transferencia' | 'cheque' | 'tarjeta' | 'consignacion'
export type TipoRecibo = 'anticipo' | 'activo' | 'pago_directo' | 'anulado' | 'certificado'

export interface Cobro {
  id: string
  client_id: string | null
  poliza_id: string | null
  concepto: string
  valor: number
  fecha_vencimiento: string | null
  fecha_emision: string | null
  estado: EstadoCobro
  tipo: TipoCobro
  notas: string | null
  numero_cobro: number | null
  aseguradora: string | null
  ramo: string | null
  numero_poliza: string | null
  porcentaje_comision: number | null
  created_at: string
  updated_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre'>
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>
}

export interface Recibo {
  id: string
  client_id: string | null
  cobro_id: string | null
  poliza_id: string | null
  numero_recibo: string | null
  numero_certificado: string | null
  concepto: string
  valor: number
  fecha_pago: string
  forma_pago: FormaPago
  tipo: TipoRecibo
  banco: string | null
  referencia: string | null
  notas: string | null
  created_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre'>
  cobro?: Pick<Cobro, 'id' | 'concepto' | 'valor'>
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>
}

// ── S7: Siniestros / Facturas / Diligencias ──────────────────────────────────

export type EstadoSiniestro = 'reportado' | 'en_estudio' | 'en_pago' | 'cerrado' | 'rechazado'

export interface Siniestro {
  id: string
  numero_siniestro: number | null
  client_id: string | null
  poliza_id: string | null
  aseguradora: string | null
  ramo: string | null
  fecha_ocurrencia: string | null
  fecha_reporte: string
  descripcion: string
  amparo: string | null
  valor_reclamado: number | null
  valor_aprobado: number | null
  estado: EstadoSiniestro
  notas: string | null
  created_at: string
  updated_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre'>
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>
  amparos?: SiniestroAmparo[]
}

export interface SiniestroAmparo {
  id: string
  siniestro_id: string
  nombre: string
  valor: number | null
  estado: 'pendiente' | 'aprobado' | 'rechazado'
  notas: string | null
  created_at: string
}

export type EstadoFactura = 'pendiente' | 'pagada' | 'vencida' | 'anulada' | 'borrador'
export type TipoFactura   = 'emitida' | 'recibida' | 'nota_credito' | 'nota_debito'

export interface Factura {
  id: string
  numero_factura: number | null
  tipo: TipoFactura
  client_id: string | null
  poliza_id: string | null
  aseguradora: string | null
  concepto: string
  // Legacy fields (kept for backward compat)
  valor_base: number
  iva: number
  retencion: number
  total: number
  // v2 — spec tributaria colombiana
  fecha_corte: string | null
  comision_gravada: number
  comision_no_gravada: number
  pct_iva: number
  pct_ret_iva: number
  ret_iva: number
  pct_ret_ica: number
  ret_ica: number
  pct_ret_fuente: number
  ret_fuente: number
  otros: number
  gran_total: number
  es_borrador: boolean
  sede: string | null
  fecha_emision: string
  fecha_vencimiento: string | null
  estado: EstadoFactura
  notas: string | null
  created_at: string
  updated_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre'>
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora'>
}

export type EstadoDiligencia = 'pendiente' | 'en_proceso' | 'completada' | 'cancelada'
export type TipoDiligencia = 'tramite' | 'certificado' | 'paz_y_salvo' | 'inclusion' | 'exclusion' | 'endoso' | 'otro'

export interface Diligencia {
  id: string
  numero_diligencia: number | null
  client_id: string | null
  poliza_id: string | null
  tipo: TipoDiligencia
  descripcion: string
  asignado_a: string | null
  fecha_limite: string | null
  estado: EstadoDiligencia
  notas: string | null
  created_at: string
  updated_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre'>
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora'>
}

// ── S8: Metas / Configuración ────────────────────────────────────────────────

export type TipoMeta = 'prima_total' | 'clientes_nuevos' | 'renovaciones' | 'polizas_activas' | 'comisiones' | 'cobros' | 'personalizada'
export type PeriodoMeta = 'mensual' | 'trimestral' | 'anual' | 'personalizado'

export interface Meta {
  id: string
  nombre: string
  tipo: TipoMeta
  periodo: PeriodoMeta
  valor_meta: number
  valor_actual: number
  fecha_inicio: string
  fecha_fin: string
  color: string
  descripcion: string | null
  auto_calcular: boolean
  created_at: string
  updated_at: string
}

export interface ConfigItem {
  id: string
  clave: string
  valor: string | null
  updated_at: string
}

// ── Archivos ─────────────────────────────────────────────────────────────────

export interface Archivo {
  id: string
  nombre: string
  nombre_original: string
  url: string
  tipo_mime: string | null
  tamano: number | null
  client_id: string | null
  poliza_id: string | null
  prospecto_id: string | null
  descripcion: string | null
  created_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre'>
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora'>
  prospecto?: Pick<Prospecto, 'id' | 'nombre'>
}

// ── Agenda ───────────────────────────────────────────────────────────────────

export type TipoEvento = 'evento' | 'reunion' | 'llamada' | 'recordatorio' | 'otro'

export interface AgendaEvento {
  id: string
  titulo: string
  descripcion: string | null
  fecha_inicio: string
  fecha_fin: string
  todo_el_dia: boolean
  color: string
  tipo: TipoEvento
  notas: string | null
  client_id: string | null
  poliza_id: string | null
  prospecto_id: string | null
  created_at: string
  updated_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre'>
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora'>
  prospecto?: Pick<Prospecto, 'id' | 'nombre'>
}

// ── S5: Vendedores / Liquidaciones / Prospectos ──────────────────────────────

export interface ComisionAnio {
  anio: number
  porcentaje: number
}

export interface Vendedor {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  cedula: string | null
  porcentaje_comision: number
  activo: boolean
  notas: string | null
  // Sprint A
  banco: string | null
  numero_cuenta: string | null
  tipo_cuenta: string | null
  comisiones_por_anio: ComisionAnio[]
  created_at: string
}

export type EstadoLiquidacion = 'pendiente' | 'pagado' | 'anulado'

export interface Liquidacion {
  id: string
  vendedor_id: string
  periodo: string
  total_primas: number
  total_comision: number
  estado: EstadoLiquidacion
  fecha_pago: string | null
  notas: string | null
  created_at: string
  updated_at: string
  vendedor?: Pick<Vendedor, 'id' | 'nombre' | 'porcentaje_comision'>
}

export type FuenteProspecto = 'referido' | 'web' | 'llamada' | 'red_social' | 'evento' | 'otro'
export type EtapaProspecto = 'nuevo' | 'contactado' | 'calificado' | 'propuesta' | 'cerrado_ganado' | 'cerrado_perdido'
export type TipoActividadProspecto = 'llamada' | 'email' | 'reunion' | 'nota' | 'cotizacion'

export interface Prospecto {
  id: string
  nombre: string
  empresa: string | null
  email: string | null
  telefono: string | null
  ciudad: string | null
  fuente: FuenteProspecto | null
  etapa: EtapaProspecto
  ramo_interes: string | null
  valor_estimado: number | null
  asignado_a: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

export interface ProspectoActividad {
  id: string
  prospecto_id: string
  tipo: TipoActividadProspecto
  descripcion: string
  fecha: string
}

export interface DashboardMetrics {
  totalClientes: number
  clientesPorEtapa: Record<Etapa, number>
  polizasActivas: number
  primaTotal: number
  renovacionesProximas30: number
  renovacionesProximas60: number
}
