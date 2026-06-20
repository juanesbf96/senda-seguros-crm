'use client'

import { useState, useEffect } from 'react'
import { supabase }      from '@/lib/supabase/client'
import { useWorkspace }  from '@/contexts/WorkspaceContext'
import { usePermissions } from '@/contexts/PermissionsContext'
import {
  X, Pencil, ExternalLink, Loader2,
  Shield, Car, Heart, Home, Briefcase, Stethoscope, Truck,
  Plane, Zap, Sprout, Anchor, ShieldAlert, AlertTriangle,
  CheckCircle2, Clock, Calendar, DollarSign, User, Building2,
} from 'lucide-react'
import PolizaModal from './PolizaModal'
import type { Poliza, Cliente } from '@/types'

/* ── helpers ──────────────────────────────────────────────── */
function formatCOP(n: number | null) {
  if (!n) return '—'
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n)
}
function formatDate(d: string | null) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}
function daysLeft(d: string | null) {
  if (!d) return null
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86_400_000)
}

const RAMO_ICONS: Record<string, React.ReactNode> = {
  'automóviles':           <Car         className="w-5 h-5" />,
  'automoviles':           <Car         className="w-5 h-5" />,
  'todo riesgo vehículo':  <Car         className="w-5 h-5" />,
  'soat':                  <Car         className="w-5 h-5" />,
  'vida individual':       <Heart       className="w-5 h-5" />,
  'vida grupo':            <Heart       className="w-5 h-5" />,
  'vida deudor':           <Heart       className="w-5 h-5" />,
  'hogar':                 <Home        className="w-5 h-5" />,
  'incendio':              <Home        className="w-5 h-5" />,
  'responsabilidad civil': <ShieldAlert className="w-5 h-5" />,
  'empresarial':           <Briefcase   className="w-5 h-5" />,
  'salud':                 <Stethoscope className="w-5 h-5" />,
  'arl':                   <Stethoscope className="w-5 h-5" />,
  'transportes':           <Truck       className="w-5 h-5" />,
  'agrícola':              <Sprout      className="w-5 h-5" />,
  'cumplimiento':          <Shield      className="w-5 h-5" />,
  'fianzas':               <Anchor      className="w-5 h-5" />,
  'aviación':              <Plane       className="w-5 h-5" />,
  'energía':               <Zap         className="w-5 h-5" />,
}
function getRamoIcon(ramo: string | null) {
  if (!ramo) return <Shield className="w-5 h-5" />
  return RAMO_ICONS[ramo.toLowerCase()] ?? <Shield className="w-5 h-5" />
}

const ESTADO_BADGE: Record<string, string> = {
  activa:    'bg-emerald-100 text-emerald-700',
  vencida:   'bg-red-100 text-red-600',
  cancelada: 'bg-slate-100 text-slate-500',
  pendiente: 'bg-amber-100 text-amber-700',
}

function Field({ label, value, money }: { label: string; value?: string | number | null; money?: boolean }) {
  if (value == null || value === '') return null
  return (
    <div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-700">
        {money ? formatCOP(value as number) : value}
      </p>
    </div>
  )
}

/* ── Props ────────────────────────────────────────────────── */
interface Props {
  polizaId: string
  onClose:  () => void
}

type PolizaConCliente = Poliza & { cliente: Cliente | null }

/* ── Componente ───────────────────────────────────────────── */
export default function PolizaQuickView({ polizaId, onClose }: Props) {
  const { isAdmin } = useWorkspace()
  const { can }     = usePermissions()
  const [poliza, setPoliza] = useState<PolizaConCliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [editModal, setEditModal] = useState(false)

  const puedeEditar = isAdmin || can('polizas_editar')

  useEffect(() => {
    async function cargar() {
      setLoading(true)
      const { data } = await supabase
        .from('polizas')
        .select('*, cliente:clientes(id, nombre, cedula, telefono, email)')
        .eq('id', polizaId)
        .single()
      setPoliza(data as PolizaConCliente)
      setLoading(false)
    }
    cargar()
  }, [polizaId])

  const dias = daysLeft(poliza?.fecha_fin ?? null)

  /* ── Backdrop + panel ────────────────────────────────────── */
  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/30 z-40 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Slide-over panel */}
      <div className="fixed top-0 right-0 h-full w-full max-w-[480px] bg-white shadow-2xl z-50 flex flex-col animate-slide-in-right">

        {/* ── Header ── */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-500">
              {getRamoIcon(poliza?.ramo ?? null)}
            </div>
            <div>
              {loading
                ? <div className="h-5 w-32 bg-slate-100 rounded animate-pulse" />
                : <>
                    <p className="font-semibold text-slate-800 text-sm leading-tight">
                      {poliza?.numero_poliza ?? 'Sin número'}
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {poliza?.aseguradora} · {poliza?.ramo}
                    </p>
                  </>
              }
            </div>
          </div>
          <div className="flex items-center gap-2">
            {puedeEditar && !loading && poliza && (
              <button
                onClick={() => setEditModal(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-slate-600 hover:text-emerald-600 border border-slate-200 hover:border-emerald-300 px-3 py-1.5 rounded-lg transition-colors"
              >
                <Pencil className="w-3.5 h-3.5" />
                Editar
              </button>
            )}
            <a
              href={`/polizas?id=${polizaId}`}
              target="_blank"
              rel="noopener noreferrer"
              title="Ver póliza completa"
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* ── Body ── */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-slate-300" />
          </div>
        ) : !poliza ? (
          <div className="flex-1 flex items-center justify-center text-slate-400 text-sm">
            Póliza no encontrada
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-6">

            {/* Estado + vigencia */}
            <div className="flex items-center gap-3">
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${ESTADO_BADGE[poliza.estado] ?? 'bg-slate-100 text-slate-500'}`}>
                {poliza.estado === 'activa'    && <CheckCircle2 className="w-3 h-3" />}
                {poliza.estado === 'vencida'   && <AlertTriangle className="w-3 h-3" />}
                {poliza.estado === 'pendiente' && <Clock className="w-3 h-3" />}
                {poliza.estado.charAt(0).toUpperCase() + poliza.estado.slice(1)}
              </span>

              {dias !== null && poliza.estado === 'activa' && (
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                  dias < 0  ? 'bg-red-50 text-red-500'   :
                  dias < 30 ? 'bg-amber-50 text-amber-600' :
                              'bg-slate-50 text-slate-500'
                }`}>
                  {dias < 0
                    ? `Venció hace ${Math.abs(dias)} días`
                    : dias === 0 ? 'Vence hoy'
                    : `Vence en ${dias} días`}
                </span>
              )}
            </div>

            {/* Tomador / Cliente */}
            <div className="bg-slate-50 rounded-xl p-4 flex items-start gap-3">
              <User className="w-4 h-4 text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Tomador / Cliente</p>
                <p className="text-sm font-semibold text-slate-800">
                  {poliza.nombre_tomador || poliza.cliente?.nombre || '—'}
                </p>
                {poliza.cliente?.cedula && (
                  <p className="text-xs text-slate-500 mt-0.5">{poliza.cliente.cedula}</p>
                )}
                {poliza.cliente?.telefono && (
                  <p className="text-xs text-slate-500">{poliza.cliente.telefono}</p>
                )}
              </div>
            </div>

            {/* Vigencia */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" /> Vigencia
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Inicio"      value={formatDate(poliza.fecha_inicio)} />
                <Field label="Vencimiento" value={formatDate(poliza.fecha_fin)} />
                <Field label="Expedición"  value={formatDate(poliza.fecha_expedicion)} />
                <Field label="Recepción"   value={formatDate(poliza.fecha_recepcion)} />
              </div>
            </div>

            {/* Valores */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5" /> Valores
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Prima total"        value={poliza.total_prima ?? poliza.prima} money />
                <Field label="Prima periódica"    value={poliza.prima_periodica}              money />
                <Field label="Valor asegurado"    value={poliza.valor_asegurado}              money />
                <Field label="Comisión agencia"   value={poliza.comision_agencia}             money />
                <Field label="Comisión vendedor"  value={poliza.comision_vendedor}            money />
                <Field label="Periodicidad"       value={poliza.periodicidad_pago} />
              </div>
            </div>

            {/* Póliza */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5" /> Póliza
              </p>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Aseguradora"   value={poliza.aseguradora} />
                <Field label="Ramo"          value={poliza.ramo} />
                <Field label="Tipo"          value={poliza.tipo_poliza} />
                <Field label="Riesgo"        value={poliza.riesgo} />
                <Field label="Intermediario" value={poliza.intermediario} />
              </div>
            </div>

            {/* Asegurado */}
            {(poliza.asegurado_nombre || poliza.beneficiario_nombre) && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                  Asegurado / Beneficiario
                </p>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Asegurado"   value={poliza.asegurado_nombre} />
                  <Field label="Doc. asegurado" value={poliza.asegurado_documento} />
                  <Field label="Beneficiario"  value={poliza.beneficiario_nombre} />
                </div>
              </div>
            )}

            {/* Notas */}
            {poliza.notas && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
                <p className="text-xs font-semibold text-amber-500 mb-1">Notas</p>
                {poliza.notas}
              </div>
            )}
          </div>
        )}

        {/* ── Footer ── */}
        {!loading && poliza && puedeEditar && (
          <div className="border-t border-slate-100 px-6 py-4">
            <button
              onClick={() => setEditModal(true)}
              className="w-full flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-xl transition-colors"
            >
              <Pencil className="w-4 h-4" />
              Editar póliza
            </button>
          </div>
        )}
      </div>

      {/* Modal de edición */}
      {editModal && poliza && (
        <PolizaModal
          poliza={poliza}
          onClose={() => setEditModal(false)}
          onSaved={async () => {
            setEditModal(false)
            // Recargar datos actualizados
            const { data } = await supabase
              .from('polizas')
              .select('*, cliente:clientes(id, nombre, cedula, telefono, email)')
              .eq('id', polizaId)
              .single()
            setPoliza(data as PolizaConCliente)
          }}
        />
      )}
    </>
  )
}
