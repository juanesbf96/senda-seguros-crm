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

export interface DashboardMetrics {
  totalClientes: number
  clientesPorEtapa: Record<Etapa, number>
  polizasActivas: number
  primaTotal: number
  renovacionesProximas30: number
  renovacionesProximas60: number
}
