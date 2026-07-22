'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Poliza, Cliente, Archivo } from '@/types'
import AfiliadosTab from '@/components/afiliados/AfiliadosTab'
import AfiliadosPorPlan from '@/components/afiliados/AfiliadosPorPlan'
import { formatCOP, formatDate, daysUntil } from '@/lib/utils'
import { comisionVendedor as calcComisionVendedor, retencion, comisionNeta } from '@/lib/comisiones'
import {
  ArrowLeft, Pencil, AlertTriangle, FileText, Shield,
  Calendar, DollarSign, User, Building2, RefreshCw,
  Car, Heart, Home, Zap, Truck, Plane, Briefcase,
  Stethoscope, Sprout, Baby, ShieldAlert, Anchor,
  Paperclip, Download, File, FileImage, Film, Music,
  CheckCircle2, Clock,
} from 'lucide-react'

function FileIcon({ mime }: { mime: string | null }) {
  if (!mime) return <File className="w-4 h-4 text-ink-400" />
  if (mime.startsWith('image/'))  return <FileImage className="w-4 h-4 text-info" />
  if (mime.startsWith('video/'))  return <Film      className="w-4 h-4 text-violet-400" />
  if (mime.startsWith('audio/'))  return <Music     className="w-4 h-4 text-pink-400" />
  if (mime.includes('pdf'))       return <FileText  className="w-4 h-4 text-error" />
  return <File className="w-4 h-4 text-ink-400" />
}

function formatBytes(b: number | null): string {
  if (!b) return ''
  if (b < 1024) return `${b} B`
  if (b < 1048576) return `${(b/1024).toFixed(1)} KB`
  return `${(b/1048576).toFixed(1)} MB`
}

const RAMO_ICONS: Record<string, React.ReactNode> = {
  'automóviles':            <Car          className="w-6 h-6" />,
  'automoviles':            <Car          className="w-6 h-6" />,
  'todo riesgo vehículo':   <Car          className="w-6 h-6" />,
  'soat':                   <Car          className="w-6 h-6" />,
  'vida individual':        <Heart        className="w-6 h-6" />,
  'vida grupo':             <Heart        className="w-6 h-6" />,
  'vida deudor':            <Heart        className="w-6 h-6" />,
  'hogar':                  <Home         className="w-6 h-6" />,
  'incendio':               <Home         className="w-6 h-6" />,
  'responsabilidad civil':  <ShieldAlert  className="w-6 h-6" />,
  'empresarial':            <Briefcase    className="w-6 h-6" />,
  'salud':                  <Stethoscope  className="w-6 h-6" />,
  'arl':                    <Stethoscope  className="w-6 h-6" />,
  'transportes':            <Truck        className="w-6 h-6" />,
  'agrícola':               <Sprout       className="w-6 h-6" />,
  'cumplimiento':           <Shield       className="w-6 h-6" />,
  'fianzas':                <Anchor       className="w-6 h-6" />,
  'aviación':               <Plane        className="w-6 h-6" />,
  'energía':                <Zap          className="w-6 h-6" />,
}

function getRamoIcon(ramo: string | null): React.ReactNode {
  if (!ramo) return <Shield className="w-6 h-6" />
  return RAMO_ICONS[ramo.toLowerCase()] ?? <Shield className="w-6 h-6" />
}
import Link from 'next/link'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import PolizaModal from './PolizaModal'


type PolizaConCliente = Poliza & { cliente: Cliente | null }

const ESTADO_COLORS = {
  activa:    'bg-primary-100 text-primary-700',
  vencida:   'bg-error-soft text-error',
  cancelada: 'bg-cream-200 text-ink-500',
  pendiente: 'bg-warning-soft text-ink-700',
}

function Field({ label, value, accent }: { label: string; value?: string | number | null; accent?: boolean }) {
  if (!value && value !== 0) return null
  return (
    <div>
      <p className="text-xs text-ink-400 mb-0.5">{label}</p>
      <p className={`text-sm font-medium ${accent ? 'text-primary-700' : 'text-ink-700'}`}>
        {typeof value === 'number' ? formatCOP(value) : value}
      </p>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-ink-200 p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="text-primary-500">{icon}</span>
        <h3 className="font-semibold text-ink-700 text-sm">{title}</h3>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {children}
      </div>
    </div>
  )
}

export default function PolizaDetalle({ id }: { id: string }) {
  const { currentWorkspace } = useWorkspace()

  const [poliza,        setPoliza]        = useState<PolizaConCliente | null>(null)
  const [loading,       setLoading]       = useState(true)
  const [showEdit,      setShowEdit]      = useState(false)
  const [archivos,      setArchivos]      = useState<Archivo[]>([])
  const [vendedorNombre, setVendedorNombre] = useState<string | null>(null)

  async function load() {
    if (!currentWorkspace) return
    const { data } = await supabase
      .from('polizas')
      .select('*, cliente:clientes(*)')
      .eq('id', id)
      .eq('workspace_id', currentWorkspace.id)
      .maybeSingle()
    const p = data as PolizaConCliente | null
    setPoliza(p)
    setLoading(false)
    if (p?.vendedor_id) {
      supabase.from('vendedores').select('nombre').eq('id', p.vendedor_id).maybeSingle()
        .then(({ data: v }) => setVendedorNombre(v?.nombre ?? null))
    }
  }

  async function loadArchivos() {
    if (!currentWorkspace) return
    const { data } = await supabase
      .from('archivos')
      .select('*')
      .eq('poliza_id', id)
      .eq('workspace_id', currentWorkspace.id)
      .order('created_at', { ascending: false })
    setArchivos((data as Archivo[]) || [])
  }

  useEffect(() => { load(); loadArchivos() }, [id, currentWorkspace])

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  if (!poliza) return (
    <div className="p-8 text-center text-ink-400">
      <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
      <p>Póliza no encontrada</p>
      <Link href="/polizas" className="mt-3 text-sm text-primary-500 hover:underline inline-block">← Volver a Pólizas</Link>
    </div>
  )

  const hoy = new Date().toISOString().split('T')[0]
  const esActiva = poliza.fecha_fin ? poliza.fecha_fin >= hoy : poliza.estado === 'activa'
  const days = poliza.fecha_fin ? daysUntil(poliza.fecha_fin) : null
  const urgent = esActiva && days !== null && days >= 0 && days <= 30
  const estadoKey = esActiva ? 'activa' : poliza.estado === 'cancelada' ? 'cancelada' : 'vencida'
  const primaDisplay = poliza.prima_neta ?? poliza.prima

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-5">

      {/* ── Header ── */}
      <div className="flex items-center gap-3 mb-2">
        <Link href="/polizas" className="text-ink-400 hover:text-ink-600 transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <p className="text-sm text-ink-400">Pólizas</p>
        <span className="text-ink-300">/</span>
        <p className="text-sm text-ink-600 font-medium">{poliza.numero_poliza || poliza.aseguradora}</p>
      </div>

      <div className="bg-white rounded-xl border border-ink-200 p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0 text-primary-500">
              {getRamoIcon(poliza.ramo)}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-ink-800">{poliza.aseguradora}</h1>
                <span className="text-ink-400">·</span>
                <span className="flex items-center gap-1 text-ink-500">
                  <span className="text-ink-400 [&>svg]:w-3.5 [&>svg]:h-3.5">{getRamoIcon(poliza.ramo)}</span>
                  {poliza.ramo}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${ESTADO_COLORS[estadoKey]}`}>
                  {esActiva ? 'Activa' : poliza.estado === 'cancelada' ? 'Cancelada' : 'Vencida'}
                </span>
                {poliza.es_renovacion && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-cream-200 text-ink-500">
                    <RefreshCw className="w-3 h-3" /> Renovación
                  </span>
                )}
                {urgent && (
                  <span className="flex items-center gap-1 text-xs text-ink-700 bg-warning-soft px-2 py-0.5 rounded-full">
                    <AlertTriangle className="w-3 h-3" /> Vence en {days}d
                  </span>
                )}
              </div>
              {poliza.numero_poliza && (
                <p className="text-sm text-ink-400 mt-0.5 font-mono">N° {poliza.numero_poliza}</p>
              )}
              {poliza.tipo_poliza && (
                <p className="text-xs text-ink-400 mt-0.5">{poliza.tipo_poliza}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowEdit(true)}
              className="flex items-center gap-1.5 text-sm bg-white border border-ink-200 text-ink-600 px-3 py-1.5 rounded-lg hover:bg-cream-100 transition-colors">
              <Pencil className="w-3.5 h-3.5" /> Editar
            </button>
          </div>
        </div>

        {/* Cliente link */}
        {poliza.cliente && (
          <div className="mt-4 pt-4 border-t border-ink-100 flex items-center gap-2">
            {poliza.cliente.tipo_cliente === 'empresa'
              ? <Building2 className="w-4 h-4 text-ink-400" />
              : <User className="w-4 h-4 text-ink-400" />}
            <span className="text-sm text-ink-500">Cliente:</span>
            <Link
              href={`/clientes/${poliza.client_id}`}
              className="text-sm font-medium text-primary-600 hover:underline">
              {poliza.cliente.nombre}
            </Link>
            {poliza.cliente.cedula && (
              <span className="text-xs text-ink-400">· CC {poliza.cliente.cedula}</span>
            )}
          </div>
        )}
      </div>

      {/* ── Vigencia y prima ── */}
      <Section title="Vigencia y prima" icon={<Calendar className="w-4 h-4" />}>
        <Field label="Inicio vigencia" value={poliza.fecha_inicio ? formatDate(poliza.fecha_inicio) : null} />
        <Field label="Fin vigencia"    value={poliza.fecha_fin    ? formatDate(poliza.fecha_fin)    : null} />
        <Field label="Prima neta"      value={primaDisplay}   accent />
        <Field label="Total prima"     value={poliza.total_prima} />
        <Field label="Prima periódica" value={poliza.prima_periodica} />
        <Field label="Periodicidad"    value={poliza.periodicidad_pago} />
        <Field label="Forma de pago"   value={poliza.forma_pago} />
        <Field label="Medio de pago"   value={poliza.medio_pago} />
        <Field label="Banco"           value={poliza.banco_pago} />
        <Field label="Valor asegurado" value={poliza.valor_asegurado} />
        <Field label="Mes emisión"     value={poliza.mes_emision} />
        <Field label="Fecha expedición" value={poliza.fecha_expedicion ? formatDate(poliza.fecha_expedicion) : null} />
      </Section>

      {/* ── Comisiones agencia ── */}
      <Section title="Comisiones agencia" icon={<DollarSign className="w-4 h-4" />}>
        <Field label="% Comisión agencia"    value={poliza.porcentaje_comision_agencia != null ? `${poliza.porcentaje_comision_agencia}%` : null} />
        <Field label="Comisión agencia"      value={poliza.comision_agencia}      accent />
        <Field label="% Comisión negocio"    value={poliza.pct_comision_negocio != null ? `${poliza.pct_comision_negocio}%` : null} />
        <Field label="Comisión negocio anual" value={poliza.comision_negocio_anual} />
        <Field label="Comisión periódica"    value={poliza.comision_periodica} />
        <Field label="% Com. ABC"            value={poliza.pct_comision_abc != null ? `${poliza.pct_comision_abc}%` : null} />
        <Field label="Retención agencia"     value={poliza.retencion_agencia} />
        <Field label="Com. ABC periódica"    value={poliza.comision_abc_periodica} />
        <Field label="Com. ABC anual"        value={poliza.comision_abc_anual} />
        <div className="col-span-2">
          <p className="text-xs text-ink-400 mb-1">Comisión de aseguradora</p>
          {poliza.comision_recibida
            ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
                <CheckCircle2 className="w-3.5 h-3.5" />
                Recibida{poliza.fecha_pago_abc ? ` · ${formatDate(poliza.fecha_pago_abc)}` : ''}
              </span>
            : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-warning-soft text-ink-700">
                <Clock className="w-3.5 h-3.5" />
                Pendiente de aseguradora
              </span>
          }
        </div>
      </Section>

      {/* ── Vendedor ── */}
      <div className="bg-white rounded-xl border border-ink-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-primary-500"><User className="w-4 h-4" /></span>
          <h3 className="font-semibold text-ink-700 text-sm">Vendedor</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-ink-400 mb-0.5">Vendedor</p>
            <p className="text-sm font-medium text-ink-700">{vendedorNombre || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400 mb-0.5">% Comisión</p>
            <p className="text-sm font-medium text-ink-700">
              {poliza.porcentaje_comision_vendedor != null ? `${poliza.porcentaje_comision_vendedor}%` : '—'}
            </p>
          </div>
          {(() => {
            // Calcular comisión bruta: usar valor DB si > 0, sino derivar de comision_agencia * %
            const pct = poliza.porcentaje_comision_vendedor
            const base = poliza.comision_agencia
            const bruta = (poliza.comision_vendedor && poliza.comision_vendedor > 0)
              ? poliza.comision_vendedor
              : (base && pct ? Math.round(calcComisionVendedor(base, pct)) : null)
            const ret = poliza.retencion_vendedor ?? 10
            return (<>
              <div>
                <p className="text-xs text-ink-400 mb-0.5">Comisión bruta</p>
                <p className="text-sm font-medium text-primary-700">
                  {bruta != null ? formatCOP(bruta) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-400 mb-0.5">Retención ({ret}%)</p>
                <p className="text-sm font-medium text-ink-700">
                  {bruta != null ? formatCOP(retencion(bruta, ret)) : '—'}
                </p>
              </div>
              <div>
                <p className="text-xs text-ink-400 mb-0.5">Comisión neta</p>
                <p className="text-sm font-semibold text-primary-700">
                  {bruta != null ? formatCOP(comisionNeta(bruta, ret)) : '—'}
                </p>
              </div>
            </>)
          })()}
          <div className="col-span-2">
            <p className="text-xs text-ink-400 mb-1">Estado pago vendedor</p>
            {poliza.asesor_pago_estado === 'no_aplica' || (!poliza.vendedor_id && !poliza.asesor_pago_estado)
              ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-cream-200 text-ink-500">
                  <Building2 className="w-3.5 h-3.5" />
                  Comisión de agencia
                </span>
              : poliza.asesor_pago_estado === 'pagada'
              ? <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-primary-100 text-primary-700">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Liquidado{poliza.fecha_pago_asesor ? ` · ${formatDate(poliza.fecha_pago_asesor)}` : ''}
                </span>
              : <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-warning-soft text-ink-700">
                  <Clock className="w-3.5 h-3.5" />
                  Pendiente de liquidar
                </span>
            }
          </div>
        </div>
      </div>

      {/* ── Intermediario ── */}
      <div className="bg-white rounded-xl border border-ink-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-amber-500"><Building2 className="w-4 h-4" /></span>
          <h3 className="font-semibold text-ink-700 text-sm">Intermediario</h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-ink-400 mb-0.5">Nombre</p>
            <p className="text-sm font-medium text-ink-700">{poliza.intermediario || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-ink-400 mb-0.5">% Comisión</p>
            <p className="text-sm font-medium text-ink-700">
              {poliza.pct_comision_int != null ? `${poliza.pct_comision_int}%` : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400 mb-0.5">Comisión intermediario</p>
            <p className="text-sm font-medium text-primary-700">
              {poliza.comision_intermediario != null ? formatCOP(poliza.comision_intermediario) : '—'}
            </p>
          </div>
          <div>
            <p className="text-xs text-ink-400 mb-0.5">Comisión agencia restante</p>
            <p className="text-sm font-semibold text-primary-700">
              {poliza.comision_agencia != null
                ? formatCOP(poliza.comision_agencia - (poliza.comision_intermediario ?? 0))
                : '—'}
            </p>
          </div>
        </div>
      </div>

      {/* ── Tomador / Asegurado ── */}
      {(poliza.nombre_tomador || poliza.asegurado_nombre || poliza.beneficiario_nombre) && (
        <Section title="Tomador / Asegurado / Beneficiario" icon={<User className="w-4 h-4" />}>
          <Field label="Tomador"                value={poliza.nombre_tomador} />
          <Field label="Asegurado"              value={poliza.asegurado_nombre} />
          <Field label="Doc. asegurado"         value={poliza.asegurado_documento} />
          <Field label="Beneficiario"           value={poliza.beneficiario_nombre} />
          <Field label="Doc. beneficiario"      value={poliza.beneficiario_documento} />
          <Field label="Tipo modalidad"         value={poliza.tipo_modalidad} />
          {poliza.beneficiario_oneroso && (
            <div>
              <p className="text-xs text-ink-400 mb-0.5">Beneficiario oneroso</p>
              <p className="text-sm font-medium text-ink-700">Sí</p>
            </div>
          )}
        </Section>
      )}

      {/* ── Flags administrativos ── */}
      {(poliza.endoso_enviado || poliza.cancelada_anterior || poliza.aseguradora_anterior) && (
        <div className="bg-white rounded-xl border border-ink-200 p-5">
          <h3 className="font-semibold text-ink-700 text-sm mb-3">Datos administrativos</h3>
          <div className="flex flex-wrap gap-3">
            {poliza.endoso_enviado && (
              <span className="px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-xs font-medium">Endoso enviado</span>
            )}
            {poliza.cancelada_anterior && (
              <span className="px-3 py-1 bg-error-soft text-error rounded-full text-xs font-medium">Cancelada anterior</span>
            )}
            {poliza.aseguradora_anterior && (
              <span className="px-3 py-1 bg-cream-200 text-ink-500 rounded-full text-xs font-medium">Aseguradora anterior: {poliza.aseguradora_anterior}</span>
            )}
          </div>
        </div>
      )}

      {/* ── Notas ── */}
      {poliza.notas && (
        <div className="bg-white rounded-xl border border-ink-200 p-5">
          <h3 className="font-semibold text-ink-700 text-sm mb-2">Notas</h3>
          <p className="text-sm text-ink-500 whitespace-pre-wrap">{poliza.notas}</p>
        </div>
      )}

      {/* ── Afiliados (solo pólizas colectivas) ── */}
      {poliza.es_colectiva && poliza.cliente && currentWorkspace && (
        <div className="bg-white rounded-xl border border-ink-200 overflow-hidden">
          <div className="px-5 pt-5 pb-0 border-b border-ink-100">
            <h3 className="font-semibold text-ink-700 text-sm pb-4">Afiliados</h3>
          </div>
          {poliza.ramo?.toLowerCase() === 'vida grupo' ? (
            <AfiliadosPorPlan
              poliza={poliza}
              clienteTipo={poliza.cliente.tipo_cliente}
              workspaceId={currentWorkspace.id}
            />
          ) : (
            <AfiliadosTab
              poliza={poliza}
              clienteTipo={poliza.cliente.tipo_cliente}
              workspaceId={currentWorkspace.id}
            />
          )}
        </div>
      )}

      {/* ── Adjuntos ── */}
      <div className="bg-white rounded-xl border border-ink-200 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Paperclip className="w-4 h-4 text-primary-500" />
          <h3 className="font-semibold text-ink-700 text-sm">Adjuntos</h3>
          <span className="ml-auto text-xs text-ink-400">{archivos.length} archivo{archivos.length !== 1 ? 's' : ''}</span>
        </div>
        {archivos.length === 0 ? (
          <p className="text-sm text-ink-400 text-center py-4">Sin adjuntos para esta póliza</p>
        ) : (
          <div className="divide-y divide-ink-100">
            {archivos.map(a => {
              const { data: { publicUrl } } = supabase.storage.from('archivos').getPublicUrl(a.nombre)
              return (
                <div key={a.id} className="flex items-center gap-3 py-2.5">
                  <FileIcon mime={a.tipo_mime} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink-700 truncate">{a.nombre_original}</p>
                    {a.descripcion && <p className="text-xs text-ink-400 truncate">{a.descripcion}</p>}
                    <p className="text-xs text-ink-300">{formatBytes(a.tamano)} · {new Date(a.created_at).toLocaleDateString('es-CO')}</p>
                  </div>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-lg hover:bg-ink-100 text-ink-400 hover:text-ink-600 transition-colors"
                    title="Descargar"
                  >
                    <Download className="w-4 h-4" />
                  </a>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showEdit && (
        <PolizaModal
          poliza={poliza}
          clientId={poliza.client_id}
          onClose={() => setShowEdit(false)}
          onSaved={() => { setShowEdit(false); load() }}
        />
      )}
    </div>
  )
}
