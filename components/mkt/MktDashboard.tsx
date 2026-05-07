'use client'
import { Users, Megaphone, GitBranch, Zap, BarChart3, MessageSquare, Filter, UserPlus, FileText, ArrowRight } from 'lucide-react'

const MODULES = [
  {
    icon: UserPlus, label: 'Leads', color: 'from-violet-500 to-violet-600',
    desc: 'Captura y gestiona leads entrantes de todos tus canales. Asigna etapas, prioridades y haz seguimiento.',
    tag: 'Captación',
  },
  {
    icon: Filter, label: 'Segmentos', color: 'from-blue-500 to-blue-600',
    desc: 'Crea audiencias dinámicas: clientes con SOAT por vencer, empresas sin póliza de vida, prospectos fríos.',
    tag: 'Captación',
  },
  {
    icon: GitBranch, label: 'Follow-up Funnel', color: 'from-indigo-500 to-indigo-600',
    desc: 'Visualiza tu funnel de conversión. Identifica en qué etapa se pierden tus oportunidades.',
    tag: 'Captación',
  },
  {
    icon: Megaphone, label: 'Campañas', color: 'from-fuchsia-500 to-fuchsia-600',
    desc: 'Diseña y lanza campañas de WhatsApp, email y redes. Programa envíos y mide el impacto.',
    tag: 'Campañas',
  },
  {
    icon: FileText, label: 'Plantillas', color: 'from-pink-500 to-pink-600',
    desc: 'Crea mensajes predefinidos para cada situación: renovaciones, cumpleaños, cross-selling.',
    tag: 'Campañas',
  },
  {
    icon: MessageSquare, label: 'Mensajes', color: 'from-rose-500 to-rose-600',
    desc: 'Bandeja unificada con mensajes de WhatsApp, Instagram y Facebook. Icono de canal por conversación.',
    tag: 'Campañas',
  },
  {
    icon: Zap, label: 'Automatizaciones', color: 'from-amber-500 to-orange-500',
    desc: 'Reglas automáticas: 30 días antes del vencimiento → enviar recordatorio → si no responde → escalar.',
    tag: 'Campañas',
  },
  {
    icon: BarChart3, label: 'Métricas', color: 'from-emerald-500 to-teal-500',
    desc: 'Tasas de apertura, conversión por canal, ROI por campaña, costo por lead adquirido.',
    tag: 'Analytics',
  },
]

const TAG_COLORS: Record<string, string> = {
  'Captación': 'bg-sky-100 text-sky-700',
  'Campañas':  'bg-fuchsia-100 text-fuchsia-700',
  'Analytics': 'bg-emerald-100 text-emerald-700',
}

export default function MktDashboard() {
  return (
    <div className="p-6 max-w-7xl mx-auto">

      {/* Hero */}
      <div className="mb-8 mt-2">
        <div className="inline-flex items-center gap-2 bg-sky-100 text-sky-700 text-xs font-semibold px-3 py-1 rounded-full mb-3">
          <span>🚀</span> MKT HQ — Marketing Command Center
        </div>
        <h1 className="text-3xl font-bold text-slate-900 mb-2">
          El CRM de marketing está <span className="text-sky-600">en construcción</span>
        </h1>
        <p className="text-slate-500 max-w-2xl">
          Aquí vivirán todas las herramientas para atraer, convertir y fidelizar clientes.
          Diseñado para aseguradoras que quieren crecer con estrategia, no con suerte.
        </p>
      </div>

      {/* Stats placeholder */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Leads activos',     value: '—', icon: UserPlus,   color: 'bg-violet-50 text-sky-600' },
          { label: 'Campañas activas',  value: '—', icon: Megaphone,  color: 'bg-fuchsia-50 text-fuchsia-600' },
          { label: 'Mensajes hoy',      value: '—', icon: MessageSquare, color: 'bg-blue-50 text-blue-600' },
          { label: 'Conversión',        value: '—', icon: BarChart3,  color: 'bg-emerald-50 text-emerald-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center gap-3">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-slate-300">{value}</p>
              <p className="text-xs text-slate-500">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Módulos en construcción */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold text-slate-900">Módulos en construcción</h2>
        <span className="text-xs text-slate-400">{MODULES.length} módulos planificados</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {MODULES.map(({ icon: Icon, label, color, desc, tag }) => (
          <div key={label}
            className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col gap-3 hover:shadow-md transition-shadow group">
            <div className="flex items-start justify-between">
              <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center flex-shrink-0`}>
                <Icon className="w-5 h-5 text-white" />
              </div>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${TAG_COLORS[tag]}`}>{tag}</span>
            </div>
            <div>
              <h3 className="font-semibold text-slate-900 mb-1">{label}</h3>
              <p className="text-sm text-slate-500 leading-relaxed">{desc}</p>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 group-hover:text-sky-600 transition-colors mt-auto pt-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
              Próximamente
              <ArrowRight className="w-3 h-3 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </div>
        ))}
      </div>

      {/* Bottom note */}
      <div className="mt-8 p-4 bg-sky-50 border border-sky-100 rounded-xl flex items-start gap-3">
        <span className="text-2xl flex-shrink-0">💡</span>
        <div>
          <p className="text-sm font-semibold text-sky-900 mb-1">Ingeniería inversa en curso</p>
          <p className="text-sm text-sky-700">
            Los módulos se construirán basados en las mejores herramientas de marketing para aseguradoras.
            Follow-up funnels, mensajería multicanal y automatizaciones serán el núcleo.
          </p>
        </div>
      </div>
    </div>
  )
}
