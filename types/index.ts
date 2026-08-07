export type Etapa = 'nuevo' | 'contactado' | 'cotizacion' | 'cerrado'

export interface ClienteHistorial {
  id: string
  cliente_id: string
  workspace_id: string
  batch_id: string
  tipo: 'creacion' | 'actualizacion'
  campo: string | null
  label_campo: string | null
  valor_anterior: string | null
  valor_nuevo: string | null
  usuario_id: string | null
  usuario_nombre: string | null
  created_at: string
}
export type TipoActividad = 'llamada' | 'email' | 'reunion' | 'nota'
export type EstadoPoliza = 'activa' | 'vencida' | 'cancelada' | 'pendiente'
export type TipoCliente = 'persona_natural' | 'empresa' | 'consorcio' | 'grupo_familiar'
export type TipoSolicitud = 'cotizacion' | 'expedicion' | 'renovacion' | 'endoso' | 'cancelacion' | 'certificado' | 'siniestro' | 'inclusion' | 'exclusion' | 'otro'
export type EstadoSolicitud = 'nueva' | 'en_proceso' | 'resuelta' | 'cancelada' | 'inactiva'
export type PrioridadSolicitud = 'normal' | 'urgente'

export interface Cliente {
  id: string
  nombre: string
  email: string | null
  telefono: string | null
  cedula: string | null
  tipo_documento: string | null
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
  fecha_expedicion_cedula: string | null
  estado_civil: string | null
  tiene_vehiculo: boolean
  tiene_hijos: boolean
  num_hijos: number | null
  ocupacion: string | null
  empresa_trabajo: string | null
  ingresos_aprox: number | null
  categoria: string | null
  autoriza_datos: boolean
  assigned_to: string | null   // user_id del responsable del cliente
  created_at: string
  updated_at: string
}

export type OrigenCreacion = 'manual' | 'import_excel' | 'colilla' | 'extractor_pdf' | 'api'
export type MotivoCancelacion = 'por_no_pago' | 'por_peticion_cliente' | 'por_cambio_intermediario' | 'otro'
export type MotivoNoRenovacion = 'por_no_pago' | 'por_peticion_cliente' | 'por_cambio_intermediario' | 'precio' | 'competencia' | 'otro'

export interface RegistroCambio {
  id: string
  workspace_id: string
  tabla: string
  registro_id: string
  usuario_id: string | null
  accion: 'insert' | 'update' | 'delete'
  campos_cambiados: Record<string, { antes: unknown; despues: unknown }> | null
  created_at: string
}

export interface Poliza {
  id: string
  client_id: string
  origen_creacion: OrigenCreacion | null
  numero_poliza: string | null
  /** Derivada en BD (columna generada) desde numero_poliza: sin separadores ni ceros a la izquierda. Solo lectura. */
  numero_poliza_recortado: string | null
  aseguradora: string
  ramo: string
  prima: number | null
  fecha_inicio: string | null
  fecha_fin: string | null
  estado: EstadoPoliza
  motivo_cancelacion: MotivoCancelacion | null
  motivo_cancelacion_otro: string | null
  fecha_cancelacion: string | null
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
  /** Usuario que GESTIONA la póliza (técnico) — distinto de vendedor_id, que la vendió. */
  tecnico_id: string | null
  porcentaje_comision_vendedor: number | null
  retencion_vendedor: number | null
  comision_vendedor: number | null
  // ── Campos financieros finos (Fase 2.5) ──
  pct_sobrecomision: number | null
  pct_retorno: number | null
  gastos_expedicion: number | null
  /** Si la carátula discrimina IVA. null = desconocido (filas históricas). */
  iva_caratula: boolean | null
  tasa_runt: number | null
  periodicidad_pago: string | null
  forma_pago: string | null
  medio_pago: string | null
  banco_pago: string | null
  valor_asegurado: number | null
  // Campos financieros extendidos
  prima_periodica: number | null
  pct_comision_negocio: number | null
  comision_negocio_anual: number | null
  comision_periodica: number | null
  pct_comision_abc: number | null
  retencion_agencia: number | null
  comision_abc_periodica: number | null
  comision_abc_anual: number | null
  comision_abc_recibida: number | null
  fecha_pago_abc: string | null
  comision_recibida: boolean | null
  intermediario: string | null
  pct_comision_int: number | null
  comision_intermediario: number | null
  referido: string | null
  pct_comision_referido: number | null
  retencion_referido: number | null
  comision_referido: number | null
  comision_asesor_pagada: number | null
  fecha_pago_asesor: string | null
  asesor_pago_estado: 'pagada' | 'pendiente' | 'no_aplica' | null
  es_renovacion: boolean
  mes_emision: string | null
  endoso_enviado: boolean
  cancelada_anterior: boolean
  aseguradora_anterior: string | null
  // Póliza colectiva
  es_colectiva: boolean
  prima_por_afiliado: number | null
  created_at: string
  cliente?: Cliente
}

// ─── Colillas de comisiones ───────────────────────────────────────────────────

export type EstadoColilla       = 'borrador' | 'confirmada'
export type EstadoConciliacion  = 'conciliada' | 'no_encontrada' | 'corregida_manual'

export interface ColillaImportacion {
  id: string
  workspace_id: string
  aseguradora: string
  periodo: string                      // 'YYYY-MM'
  archivo_nombre: string
  total_lineas: number
  conciliadas: number
  no_encontradas: number
  corregidas_manual: number
  estado: EstadoColilla
  creado_por: string | null
  created_at: string
  confirmed_at: string | null
}

export interface ColillaLinea {
  id: string
  colilla_id: string
  workspace_id: string
  poliza_id: string | null
  numero_poliza_raw: string
  nombre_tomador: string | null
  valor_prima: number | null
  valor_comision: number | null
  porcentaje_comision: number | null
  fecha_pago: string | null
  fecha_recaudo: string | null
  retefuente: number | null
  estado_conciliacion: EstadoConciliacion
  notas: string | null
  created_at: string
  // Joins opcionales
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'>
  colilla?: Pick<ColillaImportacion, 'id' | 'aseguradora' | 'periodo' | 'estado'>
}

export interface PolizaPlan {
  id: string
  workspace_id: string
  poliza_id: string
  nombre: string
  valor_cobertura: number | null
  prima_plan: number | null         // calculada: SUM(prima_individual activos)
  created_at: string
  updated_at: string
}

/** Amparo/cobertura de una póliza (Fase 2.3). El extractor PDF la poblará en fase 4. */
export interface Cobertura {
  id: string
  workspace_id: string
  poliza_id: string
  nombre: string
  valor_asegurado: number | null
  deducible: number | null
  valor_prima: number | null
  valor_extraprima: number | null
  orden: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export type EstadoCertificado = 'activo' | 'vencido' | 'cancelado'

/** Certificado de una póliza de cumplimiento/colectiva (Fase 2.4). */
export interface Certificado {
  id: string
  workspace_id: string
  poliza_id: string
  numero: string | null
  fecha_inicio: string | null
  fecha_fin: string | null
  valor: number | null
  estado: EstadoCertificado
  notas: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface PolizaAfiliado {
  id: string
  workspace_id: string
  poliza_id: string
  cliente_id: string | null
  plan_id: string | null            // solo para pólizas con planes (ej: Vida Grupo)
  nombre_completo: string
  tipo_documento: string            // CC | CE | TI | NIT | PA | RC | PPT | NUIP
  numero_documento: string
  fecha_nacimiento: string | null   // opcional
  fecha_inicio: string              // obligatorio
  fecha_retiro: string | null
  numero_poliza_individual: string | null
  parentesco: string | null
  prima_individual: number | null   // prima propia del afiliado
  activo: boolean
  notas: string | null
  created_at: string
  updated_at: string
  // Joins opcionales
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo' | 'tipo_poliza'>
  plan?: Pick<PolizaPlan, 'id' | 'nombre' | 'valor_cobertura'>
}

export interface AfiliadoCambioPlan {
  id: string
  afiliado_id: string
  plan_anterior_id: string | null
  plan_nuevo_id: string | null
  prima_anterior: number | null
  prima_nueva: number | null
  fecha_cambio: string
  notas: string | null
  created_at: string
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
  motivo_no_renovacion: MotivoNoRenovacion | null
  fecha: string
}

// ─── Operaciones de Producción (fase 3) ───────────────────────────────────────
export type TipoOperacion  = 'renovacion' | 'cobro' | 'cancelacion' | 'modificacion' | 'expedicion'
export type EstadoCartera   = 'pendiente' | 'pagada' | 'anulada'

export interface Operacion {
  id: string
  workspace_id: string
  poliza_id: string
  tipo: TipoOperacion
  numero_cuota: number | null
  estado_cartera: EstadoCartera
  valor: number | null
  fecha_programada: string | null
  fecha_pago: string | null
  responsable_id: string | null
  origen: string | null
  notas: string | null
  created_at: string
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'> & { cliente?: Pick<Cliente, 'id' | 'nombre'> }
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
// CHECK real de recibos.tipo — 'certificado' NO es un tipo válido:
// los certificados son recibos con numero_certificado diligenciado.
export type TipoRecibo = 'anticipo' | 'activo' | 'pago_directo' | 'anulado'

// Estado de pago DERIVADO (no es columna): se calcula de saldo_pendiente + compromiso_pago.
export type EstadoPagoCobro = 'pendiente' | 'vencido' | 'pagado'

export interface Cobro {
  id: string
  poliza_id: string | null
  // Categoría del cobro (columna real `tipo`; la columna `estado` guarda el mismo enum).
  tipo: TipoCobro
  estado: TipoCobro
  // Montos reales
  prima_total: number | null
  prima_neta: number | null
  valor_neto: number | null
  valor_a_pagar: number | null
  saldo_pendiente: number | null
  pagado_oficina: number | null
  pagado_aseguradora: number | null
  comision_vendedor: number | null
  porcentaje_comision: number | null
  // Fechas reales
  compromiso_pago: string | null
  fecha_pago: string | null
  fecha_emision: string | null
  dias_vencidos: number | null
  // Identificación
  cuota: number | null
  anexo: string | null
  numero_cobro: number | null
  aseguradora: string | null
  ramo: string | null
  numero_poliza: string | null
  vendedor: string | null
  vendedor_id: string | null
  periodo: string | null
  created_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre' | 'telefono'>
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'> & { cliente?: Pick<Cliente, 'id' | 'nombre' | 'telefono'> }
}

/** Estado de pago derivado de un cobro (no hay columna de estado de pago en la BD). */
export function estadoPagoCobro(c: Pick<Cobro, 'saldo_pendiente' | 'compromiso_pago' | 'fecha_pago'>): EstadoPagoCobro {
  const saldo = c.saldo_pendiente ?? 0
  if (saldo <= 0 || c.fecha_pago) return 'pagado'
  if (c.compromiso_pago && c.compromiso_pago < new Date().toISOString().slice(0, 10)) return 'vencido'
  return 'pendiente'
}

// Aging de cartera (fase 1.2) — buckets de mora calculados por la RPC get_cartera_aging.
export type CarteraBucket = 'por_vencer' | 'd1_30' | 'd31_60' | 'd61_90' | 'd90_mas' | 'sin_fecha'

/** Una fila de la RPC get_cartera_aging: (bucket, aseguradora) con # y $ del saldo pendiente. */
export interface CarteraAgingRow {
  bucket: CarteraBucket
  orden: number
  aseguradora: string
  cantidad: number
  total: number
}

// Ventas cruzadas (fase 4.2) — una fila de get_oportunidades_cross_sell.
export type PrioridadOportunidad = 'alta' | 'media' | 'baja'

export interface OportunidadCrossSell {
  client_id: string
  cliente_nombre: string
  telefono: string | null
  familia_tiene: string
  familia_sugerida: string
  prioridad: PrioridadOportunidad
  num_polizas: number
  prima_total: number
  antiguedad_dias: number
  score: number
}

// Catálogo ramos-por-aseguradora (fase 2.6).
export type DisponibleRamo = 'si' | 'no' | 'condicionado'

export interface RamoAseguradora {
  id: string
  workspace_id: string
  aseguradora: string
  ramo: string
  disponible: DisponibleRamo
  nota: string | null
  pct_comision_default: number | null
  activo: boolean
  created_at: string
  updated_at: string
}

export interface Recibo {
  id: string
  cobro_id: string | null
  poliza_id: string | null
  tipo: TipoRecibo
  valor_recaudado: number | null
  fecha: string | null
  forma_pago: FormaPago | null
  usuario: string | null
  observacion: string | null
  numero_certificado: string | null
  anulado_por: string | null
  fecha_anulacion: string | null
  created_at: string
  cobro?: Pick<Cobro, 'id' | 'numero_cobro' | 'ramo' | 'prima_total' | 'saldo_pendiente'>
  // El cliente de un recibo se resuelve por la póliza (recibos no tiene client_id).
  poliza?: Pick<Poliza, 'id' | 'numero_poliza' | 'aseguradora' | 'ramo'> & {
    client_id?: string
    cliente?: Pick<Cliente, 'id' | 'nombre'>
  }
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

export interface CampanaRenovacion {
  id: string
  nombre: string
  descripcion: string | null
  fecha_inicio_periodo: string
  fecha_fin_periodo: string
  estado: 'activa' | 'cerrada'
  aseguradora: string | null
  ramo: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

export interface DashboardMetrics {
  totalClientes: number
  clientesPorEtapa: Record<Etapa, number>
  polizasActivas: number
  primaTotal: number
  renovacionesProximas30: number
  renovacionesProximas60: number
}
