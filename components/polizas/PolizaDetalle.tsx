'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { Poliza, Cliente } from '@/types'
import { formatCOP, formatDate, daysUntil } from '@/lib/utils'
import {
  ArrowLeft, Pencil, AlertTriangle, FileText, Shield,
  Calendar, DollarSign, User, Building2, RefreshCw,
} from 'lucide-react'
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
  const [poliza, setPoliza] = useState<PolizaConCliente | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)

  async function load() {
    if (!currentWorkspace) return
    const { data } = await supabase
      .from('polizas')
      .select('*, cliente:clientes(*)')
      .eq('id', id)
      .eq('workspace_id', currentWorkspace.id)
      .maybeSingle()
    setPoliza(data as PolizaConCliente | null)
    setLoading(false)
  }

  useEffect(() => { load() }, [id, currentWorkspace])

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
            <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
              <Shield className="w-6 h-6 text-primary-500" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-ink-800">{poliza.aseguradora}</h1>
                <span className="text-ink-400">·</span>
                <span className="text-ink-500">{poliza.ramo}</span>
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
        <Field label="Com. ABC recibida"     value={poliza.comision_abc_recibida} />
        <Field label="Fecha pago ABC"        value={poliza.fecha_pago_abc ? formatDate(poliza.fecha_pago_abc) : null} />
      </Section>

      {/* ── Vendedor / asesor ── */}
      {(poliza.comision_vendedor || poliza.comision_asesor_pagada || poliza.intermediario || poliza.referido) && (
        <Section title="Vendedor / Intermediario / Referido" icon={<User className="w-4 h-4" />}>
          <Field label="% Comisión vendedor"  value={poliza.porcentaje_comision_vendedor != null ? `${poliza.porcentaje_comision_vendedor}%` : null} />
          <Field label="Retención vendedor"   value={poliza.retencion_vendedor} />
          <Field label="Comisión vendedor"    value={poliza.comision_vendedor} accent />
          <Field label="Com. asesor pagada"   value={poliza.comision_asesor_pagada} />
          <Field label="Fecha pago asesor"    value={poliza.fecha_pago_asesor ? formatDate(poliza.fecha_pago_asesor) : null} />
          <Field label="Intermediario"        value={poliza.intermediario} />
          <Field label="% Com. intermediario" value={poliza.pct_comision_int != null ? `${poliza.pct_comision_int}%` : null} />
          <Field label="Com. intermediario"   value={poliza.comision_intermediario} />
          <Field label="Referido"             value={poliza.referido} />
          <Field label="% Com. referido"      value={poliza.pct_comision_referido != null ? `${poliza.pct_comision_referido}%` : null} />
          <Field label="Retención referido"   value={poliza.retencion_referido} />
          <Field label="Comisión referido"    value={poliza.comision_referido} />
        </Section>
      )}

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
