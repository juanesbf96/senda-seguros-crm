export type Etapa = 'nuevo' | 'contactado' | 'cotizacion' | 'cerrado'
export type TipoActividad = 'llamada' | 'email' | 'reunion' | 'nota'
export type EstadoPoliza = 'activa' | 'vencida' | 'cancelada' | 'pendiente'
export type TipoCliente = 'persona_natural' | 'empresa' | 'consorcio'
export type TipoSolicitud = 'expedicion' | 'renovacion' | 'endoso' | 'cancelacion' | 'certificado' | 'siniestro' | 'inclusion' | 'exclusion' | 'otro'
export type EstadoSolicitud = 'nueva' | 'en_proceso' | 'resuelta' | 'cancelada'
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
  created_at: string
  cliente?: Cliente
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

export type EstadoRemision = 'borrador' | 'enviada' | 'recibida' | 'aprobada' | 'rechazada'

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
  created_at: string
  updated_at: string
  cliente?: Pick<Cliente, 'id' | 'nombre'>
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
