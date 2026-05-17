'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Cliente, Poliza, Actividad, TipoActividad, Cobro, Remision } from '@/types'
import { formatCOP, formatDate, daysUntil } from '@/lib/utils'
import {
  ArrowLeft, Phone, Mail, MapPin, Pencil, AlertTriangle,
  FileText, Clock, CheckSquare, Paperclip, Users, ClipboardList,
  ShieldAlert, Plus, Trash2, PhoneCall, AtSign, StickyNote,
  User, Building2, Car, Baby, Briefcase, DollarSign, Tag,
  ShieldCheck, Calendar, IdCard, MessageCircle, Wallet, FileCheck,
} from 'lucide-react'
import Link from 'next/link'
import ClienteModal from './ClienteModal'
import PolizaModal from '@/components/polizas/PolizaModal'
import TareasList from '@/components/tareas/TareasList'
import ContactosTab from './ContactosTab'
import ArchivosView from '@/components/archivos/ArchivosView'
import SolicitudesList from '@/components/solicitudes/SolicitudesList'
import SiniestrosList from '@/components/siniestros/SiniestrosList'

/* ────────────────────────────────── constants ── */

const TIPO_ICONS: Record<TipoActividad, React.ReactNode> = {
  llamada: <PhoneCall className="w-4 h-4 text-blue-500" />,
  email:   <AtSign    className="w-4 h-4 text-purple-500" />,
  reunion: <Users     className="w-4 h-4 text-emerald-500" />,
  nota:    <StickyNote className="w-4 h-4 text-amber-500" />,
}

const ESTADO_COLORS: Record<string, string> = {
  activa:    'bg-emerald-100 text-emerald-700',
  vencida:   'bg-red-100 text-red-700',
  cancelada: 'bg-slate-100 text-slate-600',
  pendiente: 'bg-amber-100 text-amber-700',
}

const ETAPA_COLORS: Record<string, string> = {
  nuevo:      'bg-blue-100 text-blue-700',
  contactado: 'bg-amber-100 text-amber-700',
  cotizacion: 'bg-purple-100 text-purple-700',
  cerrado:    'bg-emerald-100 text-emerald-700',
}
const ETAPA_LABELS: Record<string, string> = {
  nuevo: 'Nuevo', contactado: 'Contactado', cotizacion: 'Cotización', cerrado: 'Cerrado',
}

const CATEGORIA_COLORS: Record<string, string> = {
  VIP:         'bg-yellow-100 text-yellow-700 border-yellow-200',
  Preferencial:'bg-violet-100 text-violet-700 border-violet-200',
  Estándar:    'bg-slate-100 text-slate-600 border-slate-200',
  Nuevo:       'bg-sky-100 text-sky-700 border-sky-200',
  Inactivo:    'bg-red-100 text-red-500 border-red-200',
}

const COBRO_ESTADO_COLORS: Record<string, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  pagado:    'bg-emerald-100 text-emerald-700',
  vencido:   'bg-red-100 text-red-700',
  anulado:   'bg-slate-100 text-slate-500',
}

const COBRO_TIPO_LABELS: Record<string, string> = {
  por_cobrar:           'Por cobrar',
  por_pagar:            'Por pagar',
  comision_por_cobrar:  'Comisión p/c',
  comision_recibida:    'Comisión rec.',
}

const REMISION_ESTADO_COLORS: Record<string, string> = {
  borrador:  'bg-slate-100 text-slate-600',
  enviada:   'bg-blue-100 text-blue-700',
  recibida:  'bg-purple-100 text-purple-700',
  aprobada:  'bg-emerald-100 text-emerald-700',
  rechazada: 'bg-red-100 text-red-700',
  anulada:   'bg-red-100 text-red-700',
}

type TabKey = 'datos' | 'polizas' | 'actividades' | 'tareas' | 'archivos' | 'contactos' | 'solicitudes' | 'siniestros' | 'cobros' | 'remisiones'

/* ────────────────────────────────── inline tab components ── */

function ClienteCobros({ id }: { id: string }) {
  const [cobros, setCobros] = useState<Cobro[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('cobros')
      .select('*')
      .eq('client_id', id)
      .order('fecha_vencimiento', { ascending: true })
      .then(({ data }) => { setCobros(data || []); setLoading(false) })
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
    </div>
  )

  const totalPendiente = cobros.filter(c => c.estado === 'pendiente').reduce((s, c) => s + c.valor, 0)
  const totalPagado    = cobros.filter(c => c.estado === 'pagado').reduce((s, c) => s + c.valor, 0)

  return (
    <div className="p-6">
      <h2 className="font-semibold text-slate-800 text-sm mb-4">Cobros ({cobros.length})</h2>
      {cobros.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400">
          <Wallet className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin cobros registrados</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">Concepto</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Tipo</th>
                <th className="px-4 py-3 font-medium">Valor</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Vencimiento</th>
                <th className="px-4 py-3 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {cobros.map(c => (
                <tr key={c.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-slate-700 font-medium">{c.concepto}</td>
                  <td className="px-4 py-3 text-slate-500 hidden sm:table-cell text-xs">
                    {COBRO_TIPO_LABELS[c.tipo] ?? c.tipo}
                  </td>
                  <td className="px-4 py-3 font-semibold text-slate-800">{formatCOP(c.valor)}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs">
                    {c.fecha_vencimiento ? formatDate(c.fecha_vencimiento) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${COBRO_ESTADO_COLORS[c.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                      {c.estado}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr className="text-xs text-slate-500">
                <td colSpan={2} className="px-4 py-2.5 font-semibold">Subtotales</td>
                <td colSpan={3} className="px-4 py-2.5">
                  <div className="flex gap-4">
                    <span>Pendiente: <strong className="text-amber-700">{totalPendiente > 0 ? formatCOP(totalPendiente) : '—'}</strong></span>
                    <span>Pagado: <strong className="text-emerald-700">{totalPagado > 0 ? formatCOP(totalPagado) : '—'}</strong></span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  )
}

function ClienteRemisiones({ id }: { id: string }) {
  const [remisiones, setRemisiones] = useState<Remision[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('remisiones')
      .select('*')
      .eq('client_id', id)
      .order('created_at', { ascending: false })
      .then(({ data }) => { setRemisiones(data || []); setLoading(false) })
  }, [id])

  if (loading) return (
    <div className="flex items-center justify-center py-12">
      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-emerald-600" />
    </div>
  )

  return (
    <div className="p-6">
      <h2 className="font-semibold text-slate-800 text-sm mb-4">Remisiones ({remisiones.length})</h2>
      {remisiones.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400">
          <FileCheck className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Sin remisiones registradas</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr className="text-left text-xs text-slate-500">
                <th className="px-4 py-3 font-medium">N° Remisión</th>
                <th className="px-4 py-3 font-medium hidden sm:table-cell">Aseguradora</th>
                <th className="px-4 py-3 font-medium hidden md:table-cell">Ramo</th>
                <th className="px-4 py-3 font-medium">Estado</th>
                <th className="px-4 py-3 font-medium hidden lg:table-cell">Fecha</th>
                <th className="px-4 py-3 font-medium hidden xl:table-cell">Notas</th>
              </tr>
            </thead>
            <tbody>
              {remisiones.map(r => (
                <tr key={r.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-700">
                    {r.numero_remision ? `#${r.numero_remision}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 hidden sm:table-cell">{r.aseguradora}</td>
                  <td className="px-4 py-3 text-slate-500 hidden md:table-cell text-xs">{r.ramo}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${REMISION_ESTADO_COLORS[r.estado] ?? 'bg-slate-100 text-slate-600'}`}>
                      {r.estado}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-500 hidden lg:table-cell text-xs">
                    {r.fecha ? formatDate(r.fecha) : formatDate(r.created_at)}
                  </td>
                  <td className="px-4 py-3 text-slate-400 hidden xl:table-cell text-xs truncate max-w-[180px]">
                    {r.notas || '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ────────────────────────────────── component ── */

export default function ClienteDetalle({ id }: { id: string }) {
  const [cliente,      setCliente]    = useState<Cliente | null>(null)
  const [polizas,      setPolizas]    = useState<Poliza[]>([])
  const [actividades,  setActividades]= useState<Actividad[]>([])
  const [cobrosPendientes, setCobrosPendientes] = useState<{ id: string; valor: number; estado: string }[]>([])
  const [loading,      setLoading]    = useState(true)
  const [activeTab,    setActiveTab]  = useState<TabKey>('datos')

  const [showEditCliente, setShowEditCliente] = useState(false)
  const [showPolizaModal, setShowPolizaModal] = useState(false)
  const [editingPoliza,   setEditingPoliza]   = useState<Poliza | undefined>()
  const [actForm, setActForm] = useState({
    tipo: 'nota' as TipoActividad,
    descripcion: '',
    fecha: new Date().toISOString().split('T')[0],
  })
  const [savingAct, setSavingAct] = useState(false)

  async function load() {
    const [{ data: c }, { data: p }, { data: a }, { data: cb }] = await Promise.all([
      supabase.from('clientes').select('*').eq('id', id).single(),
      supabase.from('polizas').select('*').eq('client_id', id).eq('eliminada', false).order('created_at', { ascending: false }),
      supabase.from('actividades').select('*').eq('client_id', id).order('fecha', { ascending: false }),
      supabase.from('cobros').select('id, valor, estado').eq('client_id', id).eq('estado', 'pendiente'),
    ])
    setCliente(c)
    setPolizas(p || [])
    setActividades(a || [])
    setCobrosPendientes(cb || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [id])

  async function saveActividad() {
    if (!actForm.descripcion.trim()) return
    setSavingAct(true)
    await supabase.from('actividades').insert({
      client_id:   id,
      tipo:        actForm.tipo,
      descripcion: actForm.descripcion.trim(),
      fecha:       actForm.fecha,
    })
    setActForm({ tipo: 'nota', descripcion: '', fecha: new Date().toISOString().split('T')[0] })
    setSavingAct(false)
    load()
  }

  async function deleteActividad(actId: string) {
    await supabase.from('actividades').delete().eq('id', actId)
    setActividades(prev => prev.filter(a => a.id !== actId))
  }

  async function deletePoliza(polizaId: string) {
    if (!confirm('¿Eliminar esta póliza?')) return
    await supabase.from('polizas').delete().eq('id', polizaId)
    setPolizas(prev => prev.filter(p => p.id !== polizaId))
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600" />
    </div>
  )
  if (!cliente) return <div className="p-6 text-slate-500">Cliente no encontrado.</div>

  /* derived */
  const polizasActivas = polizas.filter(p => p.estado === 'activa')
  const primaTotal     = polizasActivas.reduce((s, p) => s + (p.prima_neta || p.prima || 0), 0)
  const proximoVence   = polizas
    .filter(p => p.estado === 'activa' && p.fecha_fin)
    .sort((a, b) => (a.fecha_fin! > b.fecha_fin! ? 1 : -1))[0]

  const totalCobrosPendientes = cobrosPendientes.reduce((s, c) => s + c.valor, 0)

  const TABS: { key: TabKey; label: string; icon: React.ElementType; count?: number }[] = [
    { key: 'datos',       label: 'Datos',        icon: User },
    { key: 'polizas',     label: 'Pólizas',      icon: FileText,      count: polizas.length },
    { key: 'actividades', label: 'Actividades',  icon: Clock,         count: actividades.length },
    { key: 'tareas',      label: 'Tareas',       icon: CheckSquare },
    { key: 'archivos',    label: 'Archivos',     icon: Paperclip },
    { key: 'contactos',   label: 'Contactos',    icon: Users },
    { key: 'solicitudes', label: 'Solicitudes',  icon: ClipboardList },
    { key: 'siniestros',  label: 'Siniestros',   icon: ShieldAlert },
    { key: 'cobros',      label: 'Cobros',       icon: Wallet },
    { key: 'remisiones',  label: 'Remisiones',   icon: FileCheck },
  ]

  return (
    <div className="flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="flex-shrink-0 bg-white border-b border-slate-200 px-6 pt-5 pb-0">
        <Link href="/clientes" className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 mb-3 w-fit">
          <ArrowLeft className="w-3.5 h-3.5" /> Volver a clientes
        </Link>

        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            {/* Avatar */}
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              {cliente.tipo_cliente === 'persona_natural'
                ? <User className="w-6 h-6 text-emerald-600" />
                : <Building2 className="w-6 h-6 text-emerald-600" />
              }
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900">{cliente.nombre}</h1>
                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ETAPA_COLORS[cliente.etapa]}`}>
                  {ETAPA_LABELS[cliente.etapa]}
                </span>
                {cliente.categoria && (
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${CATEGORIA_COLORS[cliente.categoria] || 'bg-slate-100 text-slate-600 border-slate-200'}`}>
                    {cliente.categoria}
                  </span>
                )}
              </div>
              {/* Quick action buttons */}
              <div className="flex flex-wrap gap-2 mt-2">
                {cliente.telefono && (
                  <a href={`tel:${cliente.telefono}`}
                    className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 text-slate-600 transition-colors">
                    <Phone className="w-3.5 h-3.5" />{cliente.telefono}
                  </a>
                )}
                {cliente.telefono && (
                  <a href={`https://wa.me/57${cliente.telefono.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 text-emerald-600 transition-colors">
                    <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                  </a>
                )}
                {cliente.email && (
                  <a href={`mailto:${cliente.email}`}
                    className="flex items-center gap-1.5 text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 hover:bg-slate-50 text-slate-600 transition-colors">
                    <Mail className="w-3.5 h-3.5" />{cliente.email}
                  </a>
                )}
                {cliente.ciudad && (
                  <span className="flex items-center gap-1 text-xs text-slate-500 px-1">
                    <MapPin className="w-3 h-3" />{cliente.ciudad}{cliente.departamento ? `, ${cliente.departamento}` : ''}
                  </span>
                )}
                {cliente.cedula && (
                  <span className="flex items-center gap-1 text-xs text-slate-500 px-1">
                    <IdCard className="w-3 h-3" />CC {cliente.cedula}
                  </span>
                )}
              </div>
            </div>
          </div>

          <button onClick={() => setShowEditCliente(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600 hover:bg-slate-50 transition-colors flex-shrink-0">
            <Pencil className="w-3.5 h-3.5" /> Editar
          </button>
        </div>

        {/* KPIs */}
        <div className="flex gap-4 mb-4 flex-wrap">
          <KPI label="Pólizas activas" value={String(polizasActivas.length)} />
          <KPI label="Prima total" value={primaTotal > 0 ? formatCOP(primaTotal) : '—'} accent />
          {proximoVence?.fecha_fin && (
            <KPI
              label="Próximo vencimiento"
              value={formatDate(proximoVence.fecha_fin)}
              warn={daysUntil(proximoVence.fecha_fin) <= 30}
            />
          )}
          <KPI
            label="Cobros pend."
            value={totalCobrosPendientes > 0 ? formatCOP(totalCobrosPendientes) : '—'}
            warn={cobrosPendientes.length > 0}
          />
        </div>

        {/* Tab bar */}
        <div className="flex gap-0.5 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon, count }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={[
                'flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-medium border-b-2 -mb-px whitespace-nowrap transition-colors',
                activeTab === key
                  ? 'border-emerald-600 text-emerald-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700',
              ].join(' ')}>
              <Icon className="w-3.5 h-3.5" />
              {label}
              {count !== undefined && (
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${activeTab === key ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                  {count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto">

        {/* ── TAB: DATOS ── */}
        {activeTab === 'datos' && (
          <div className="p-6 max-w-3xl mx-auto space-y-5">

            {/* Identificación */}
            <DataSection title="Identificación">
              <DataGrid>
                <DataItem label="Tipo" value={
                  cliente.tipo_cliente === 'persona_natural' ? 'Persona Natural'
                  : cliente.tipo_cliente === 'empresa' ? 'Empresa' : 'Consorcio'
                } />
                {cliente.cedula    && <DataItem label="Cédula" value={cliente.cedula} />}
                {cliente.nit       && <DataItem label="NIT" value={cliente.nit} />}
                {cliente.fecha_nacimiento && <DataItem label="Fecha nacimiento" value={formatDate(cliente.fecha_nacimiento)} />}
                {cliente.fecha_expedicion_cedula && <DataItem label="Expedición cédula" value={formatDate(cliente.fecha_expedicion_cedula)} />}
                {cliente.genero    && <DataItem label="Género" value={cliente.genero} icon={<User className="w-3.5 h-3.5" />} />}
                {cliente.estado_civil && <DataItem label="Estado civil" value={cliente.estado_civil} />}
                {cliente.sobrenombre && <DataItem label="Alias" value={cliente.sobrenombre} />}
              </DataGrid>
            </DataSection>

            {/* Perfil personal */}
            {cliente.tipo_cliente === 'persona_natural' && (
              <DataSection title="Perfil personal">
                <DataGrid>
                  <DataItem
                    label="Vehículo"
                    value={cliente.tiene_vehiculo ? 'Sí' : 'No'}
                    icon={<Car className="w-3.5 h-3.5" />}
                    accent={cliente.tiene_vehiculo}
                  />
                  <DataItem
                    label="Hijos"
                    value={cliente.tiene_hijos ? `Sí${cliente.num_hijos ? ` (${cliente.num_hijos})` : ''}` : 'No'}
                    icon={<Baby className="w-3.5 h-3.5" />}
                    accent={cliente.tiene_hijos}
                  />
                </DataGrid>
              </DataSection>
            )}

            {/* Información laboral */}
            {(cliente.ocupacion || cliente.empresa_trabajo || cliente.ingresos_aprox) && (
              <DataSection title="Información laboral">
                <DataGrid>
                  {cliente.ocupacion      && <DataItem label="Ocupación" value={cliente.ocupacion} icon={<Briefcase className="w-3.5 h-3.5" />} />}
                  {cliente.empresa_trabajo && <DataItem label="Empresa" value={cliente.empresa_trabajo} icon={<Building2 className="w-3.5 h-3.5" />} />}
                  {cliente.ingresos_aprox && <DataItem label="Ingresos aprox." value={formatCOP(cliente.ingresos_aprox)} icon={<DollarSign className="w-3.5 h-3.5" />} />}
                </DataGrid>
              </DataSection>
            )}

            {/* Contacto */}
            <DataSection title="Contacto y ubicación">
              <DataGrid>
                {cliente.telefono    && <DataItem label="Teléfono" value={cliente.telefono} icon={<Phone className="w-3.5 h-3.5" />} />}
                {cliente.email       && <DataItem label="Email" value={cliente.email} icon={<Mail className="w-3.5 h-3.5" />} />}
                {cliente.ciudad      && <DataItem label="Ciudad" value={cliente.ciudad} icon={<MapPin className="w-3.5 h-3.5" />} />}
                {cliente.departamento && <DataItem label="Departamento" value={cliente.departamento} />}
              </DataGrid>
            </DataSection>

            {/* CRM */}
            <DataSection title="CRM">
              <DataGrid>
                <DataItem label="Etapa" value={ETAPA_LABELS[cliente.etapa]} />
                {cliente.categoria && <DataItem label="Categoría" value={cliente.categoria} icon={<Tag className="w-3.5 h-3.5" />} />}
                <DataItem
                  label="Autoriza datos"
                  value={cliente.autoriza_datos ? 'Sí' : 'No'}
                  icon={<ShieldCheck className="w-3.5 h-3.5" />}
                  accent={cliente.autoriza_datos}
                />
                <DataItem label="Desde" value={formatDate(cliente.created_at)} icon={<Calendar className="w-3.5 h-3.5" />} />
              </DataGrid>
            </DataSection>

            {cliente.notas && (
              <DataSection title="Notas">
                <p className="text-sm text-slate-600 leading-relaxed">{cliente.notas}</p>
              </DataSection>
            )}
          </div>
        )}

        {/* ── TAB: PÓLIZAS ── */}
        {activeTab === 'polizas' && (
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-slate-800 text-sm">Pólizas ({polizas.length})</h2>
              <button
                onClick={() => { setEditingPoliza(undefined); setShowPolizaModal(true) }}
                className="flex items-center gap-1.5 text-xs bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Nueva póliza
              </button>
            </div>

            {polizas.length === 0 ? (
              <div className="bg-white rounded-xl border border-dashed border-slate-300 p-12 text-center text-slate-400">
                <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p className="text-sm">Sin pólizas registradas</p>
                <button onClick={() => setShowPolizaModal(true)}
                  className="mt-3 text-xs text-emerald-600 hover:underline">+ Agregar primera póliza</button>
              </div>
            ) : (
              <div className="space-y-3">
                {polizas.map(p => {
                  const days   = p.fecha_fin ? daysUntil(p.fecha_fin) : null
                  const urgent = days !== null && days >= 0 && days <= 30
                  const primaDisplay = p.prima_neta ?? p.prima
                  return (
                    <div key={p.id} className={`bg-white rounded-xl border p-4 ${urgent ? 'border-amber-300' : 'border-slate-200'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold text-slate-800">{p.aseguradora}</span>
                            <span className="text-slate-400">·</span>
                            <span className="text-slate-600 text-sm">{p.ramo}</span>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[p.estado]}`}>
                              {p.estado}
                            </span>
                            {p.tipo_modalidad && (
                              <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-500 capitalize">
                                {p.tipo_modalidad}
                              </span>
                            )}
                            {urgent && (
                              <span className="flex items-center gap-1 text-xs text-amber-700 bg-amber-100 px-2 py-0.5 rounded-full">
                                <AlertTriangle className="w-3 h-3" /> Vence en {days}d
                              </span>
                            )}
                          </div>
                          {p.numero_poliza && <p className="text-xs text-slate-400 mt-1">Póliza: {p.numero_poliza}</p>}
                          {p.nombre_tomador && <p className="text-xs text-slate-400">Tomador: {p.nombre_tomador}</p>}
                        </div>
                        <div className="flex gap-2 ml-3 flex-shrink-0">
                          <button onClick={() => { setEditingPoliza(p); setShowPolizaModal(true) }}
                            className="text-slate-400 hover:text-slate-700">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => deletePoliza(p.id)}
                            className="text-slate-400 hover:text-red-600">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs text-slate-500">
                        {primaDisplay && (
                          <div>
                            <p className="text-slate-400">Prima</p>
                            <p className="font-semibold text-slate-700">{formatCOP(primaDisplay)}</p>
                          </div>
                        )}
                        {p.total_prima && (
                          <div>
                            <p className="text-slate-400">Total prima</p>
                            <p className="font-semibold text-slate-700">{formatCOP(p.total_prima)}</p>
                          </div>
                        )}
                        {p.fecha_inicio && (
                          <div>
                            <p className="text-slate-400">Inicio</p>
                            <p>{formatDate(p.fecha_inicio)}</p>
                          </div>
                        )}
                        {p.fecha_fin && (
                          <div>
                            <p className="text-slate-400">Vencimiento</p>
                            <p className={urgent ? 'text-amber-700 font-medium' : ''}>{formatDate(p.fecha_fin)}</p>
                          </div>
                        )}
                        {p.comision_agencia && (
                          <div>
                            <p className="text-slate-400">Comisión agencia</p>
                            <p className="font-semibold text-emerald-700">{formatCOP(p.comision_agencia)}</p>
                          </div>
                        )}
                        {p.periodicidad_pago && (
                          <div>
                            <p className="text-slate-400">Periodicidad</p>
                            <p>{p.periodicidad_pago}</p>
                          </div>
                        )}
                      </div>
                      {p.notas && <p className="mt-2 text-xs text-slate-400 italic">{p.notas}</p>}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ── TAB: ACTIVIDADES ── */}
        {activeTab === 'actividades' && (
          <div className="p-6 max-w-2xl">
            {/* Form nueva actividad */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 mb-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Nueva actividad</p>
              <div className="flex gap-2 mb-3">
                {(['llamada','email','reunion','nota'] as TipoActividad[]).map(t => (
                  <button key={t} onClick={() => setActForm(f => ({ ...f, tipo: t }))}
                    className={`flex-1 py-1.5 text-xs rounded-lg capitalize transition-colors ${
                      actForm.tipo === t ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}>
                    {t}
                  </button>
                ))}
              </div>
              <textarea
                value={actForm.descripcion}
                onChange={e => setActForm(f => ({ ...f, descripcion: e.target.value }))}
                placeholder="Descripción de la actividad..."
                rows={2}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400 resize-none mb-2"
              />
              <div className="flex gap-2 items-center">
                <input type="date" value={actForm.fecha}
                  onChange={e => setActForm(f => ({ ...f, fecha: e.target.value }))}
                  className="flex-1 px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-400"
                />
                <button onClick={saveActividad} disabled={savingAct || !actForm.descripcion.trim()}
                  className="px-3 py-1.5 bg-emerald-600 text-white text-xs rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                  {savingAct ? '...' : 'Registrar'}
                </button>
              </div>
            </div>

            {/* Timeline */}
            <div className="space-y-3">
              {actividades.length === 0 ? (
                <p className="text-center text-sm text-slate-400 py-10">Sin actividades registradas</p>
              ) : actividades.map(a => (
                <div key={a.id} className="bg-white rounded-xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {TIPO_ICONS[a.tipo]}
                      <span className="text-xs text-slate-500 capitalize">{a.tipo}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs text-slate-400">{new Date(a.fecha).toLocaleDateString('es-CO')}</span>
                    </div>
                    <button onClick={() => deleteActividad(a.id)} className="text-slate-300 hover:text-red-500">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="text-sm text-slate-700 mt-1.5">{a.descripcion}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── TAB: TAREAS ── */}
        {activeTab === 'tareas' && (
          <div className="p-6">
            <TareasList clienteId={id} />
          </div>
        )}

        {/* ── TAB: ARCHIVOS ── */}
        {activeTab === 'archivos' && (
          <div className="p-6">
            <ArchivosView clienteId={id} />
          </div>
        )}

        {/* ── TAB: CONTACTOS ── */}
        {activeTab === 'contactos' && (
          <div className="p-6">
            <ContactosTab clienteId={id} />
          </div>
        )}

        {/* ── TAB: SOLICITUDES ── */}
        {activeTab === 'solicitudes' && (
          <SolicitudesList clienteId={id} />
        )}

        {/* ── TAB: SINIESTROS ── */}
        {activeTab === 'siniestros' && (
          <SiniestrosList clienteId={id} />
        )}

        {/* ── TAB: COBROS ── */}
        {activeTab === 'cobros' && (
          <ClienteCobros id={id} />
        )}

        {/* ── TAB: REMISIONES ── */}
        {activeTab === 'remisiones' && (
          <ClienteRemisiones id={id} />
        )}
      </div>

      {/* ── Modals ── */}
      {showEditCliente && (
        <ClienteModal
          cliente={cliente}
          onClose={() => setShowEditCliente(false)}
          onSaved={() => { setShowEditCliente(false); load() }}
        />
      )}
      {showPolizaModal && (
        <PolizaModal
          poliza={editingPoliza}
          clientId={id}
          onClose={() => setShowPolizaModal(false)}
          onSaved={() => { setShowPolizaModal(false); load() }}
        />
      )}
    </div>
  )
}

/* ── small helpers ── */

function KPI({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-slate-400 uppercase tracking-wide">{label}</span>
      <span className={`text-sm font-bold ${warn ? 'text-amber-600' : accent ? 'text-emerald-700' : 'text-slate-800'}`}>
        {value}
      </span>
    </div>
  )
}

function DataSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-4">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">{title}</p>
      {children}
    </div>
  )
}

function DataGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">{children}</div>
}

function DataItem({ label, value, icon, accent }: {
  label: string; value: string; icon?: React.ReactNode; accent?: boolean
}) {
  return (
    <div>
      <p className="text-[10px] text-slate-400 uppercase tracking-wide mb-0.5">{label}</p>
      <div className="flex items-center gap-1">
        {icon && <span className={accent ? 'text-emerald-600' : 'text-slate-400'}>{icon}</span>}
        <p className={`text-sm font-medium ${accent ? 'text-emerald-700' : 'text-slate-700'}`}>{value}</p>
      </div>
    </div>
  )
}
