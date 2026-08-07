'use client'
import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import { OportunidadCrossSell, PrioridadOportunidad } from '@/types'
import { familiaCorta, familiaSeguro, PRIORIDAD_STYLE } from '@/lib/crossSell'
import { whatsappLink } from '@/lib/whatsapp'
import { formatCOP } from '@/lib/utils'
import { useWorkspace } from '@/contexts/WorkspaceContext'
import {
  Sparkles, Search, TrendingUp, MessageCircle, Copy, Check, Loader2, Wand2,
} from 'lucide-react'
import Link from 'next/link'

type MensajeState = { loading: boolean; texto?: string; error?: string; copiado?: boolean }

export default function OportunidadesView() {
  const { currentWorkspace } = useWorkspace()
  const [ops, setOps]         = useState<OportunidadCrossSell[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch]   = useState('')
  const [fPrioridad, setFPrioridad] = useState<PrioridadOportunidad | 'all'>('all')
  const [fFamilia, setFFamilia]     = useState<string>('all')
  const [msgs, setMsgs] = useState<Record<string, MensajeState>>({})

  useEffect(() => {
    if (!currentWorkspace) return
    setLoading(true)
    supabase.rpc('get_oportunidades_cross_sell', { p_workspace_id: currentWorkspace.id })
      .then(({ data }) => { setOps((data || []) as OportunidadCrossSell[]); setLoading(false) })
  }, [currentWorkspace])

  const key = (o: OportunidadCrossSell) => `${o.client_id}|${o.familia_sugerida}`

  const familias = useMemo(
    () => [...new Set(ops.map(o => o.familia_sugerida))].sort(), [ops])

  const filtered = useMemo(() => ops.filter(o => {
    const q = search.toLowerCase()
    return (!search || o.cliente_nombre.toLowerCase().includes(q))
      && (fPrioridad === 'all' || o.prioridad === fPrioridad)
      && (fFamilia === 'all' || o.familia_sugerida === fFamilia)
  }), [ops, search, fPrioridad, fFamilia])

  const porPrioridad = (p: PrioridadOportunidad) => ops.filter(o => o.prioridad === p).length

  async function generarMensaje(o: OportunidadCrossSell) {
    const k = key(o)
    setMsgs(m => ({ ...m, [k]: { loading: true } }))
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const resp = await fetch('/api/oportunidades/mensaje', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session?.access_token || ''}` },
        body: JSON.stringify({
          workspaceId: currentWorkspace?.id,
          clientId: o.client_id,
          clienteNombre: o.cliente_nombre,
          familiaTiene: o.familia_tiene,
          familiaSugerida: o.familia_sugerida,
        }),
      })
      const data = await resp.json()
      if (!resp.ok) throw new Error(data.error || 'Error al generar')
      setMsgs(m => ({ ...m, [k]: { loading: false, texto: data.mensaje } }))
    } catch (e) {
      setMsgs(m => ({ ...m, [k]: { loading: false, error: e instanceof Error ? e.message : 'Error' } }))
    }
  }

  async function copiar(k: string, texto: string) {
    try {
      await navigator.clipboard.writeText(texto)
      setMsgs(m => ({ ...m, [k]: { ...m[k], copiado: true } }))
      setTimeout(() => setMsgs(m => ({ ...m, [k]: { ...m[k], copiado: false } })), 2000)
    } catch {}
  }

  if (loading) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
    </div>
  )

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-ink-700 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-primary-500" /> Oportunidades de venta cruzada
        </h1>
        <p className="text-ink-400 text-sm mt-1">
          Clientes con póliza activa a los que les falta un ramo complementario. El mensaje lo redacta la IA.
        </p>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        <Stat label="Oportunidades" value={ops.length} tone="ink" />
        <Stat label="Prioridad alta" value={porPrioridad('alta')} tone="error" />
        <Stat label="Media" value={porPrioridad('media')} tone="warning" />
        <Stat label="Baja" value={porPrioridad('baja')} tone="ink" />
      </div>

      {/* Filtros */}
      <div className="flex gap-3 mb-5 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-ink-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar cliente..."
            className="w-full pl-9 pr-4 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400" />
        </div>
        <select value={fPrioridad} onChange={e => setFPrioridad(e.target.value as PrioridadOportunidad | 'all')}
          className="px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400">
          <option value="all">Toda prioridad</option>
          <option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option>
        </select>
        <select value={fFamilia} onChange={e => setFFamilia(e.target.value)}
          className="px-3 py-2 text-sm border border-ink-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-400">
          <option value="all">Todo ramo sugerido</option>
          {familias.map(f => <option key={f} value={f}>{familiaCorta(f)}</option>)}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-ink-300 p-12 text-center text-ink-400">
          <TrendingUp className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">{ops.length === 0 ? 'No hay oportunidades de venta cruzada por ahora.' : 'Ninguna oportunidad coincide con el filtro.'}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(o => {
            const k = key(o)
            const m = msgs[k]
            return (
              <div key={k} className="bg-white rounded-xl border border-ink-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/clientes/${o.client_id}`} className="font-semibold text-ink-700 hover:text-primary-500">
                      {o.cliente_nombre}
                    </Link>
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span className="text-ink-400">Tiene <strong className="text-ink-600">{familiaCorta(o.familia_tiene)}</strong></span>
                      <span className="text-ink-300">→</span>
                      <span className="px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 font-medium">Ofrecer {familiaCorta(o.familia_sugerida)}</span>
                      <span className={`px-2 py-0.5 rounded-full font-medium ${PRIORIDAD_STYLE[o.prioridad]}`}>{o.prioridad}</span>
                    </div>
                    <div className="text-xs text-ink-400 mt-1">
                      {o.num_polizas} póliza{o.num_polizas !== 1 ? 's' : ''} · prima {formatCOP(o.prima_total)} · cliente hace {Math.floor(o.antiguedad_dias / 30)} meses
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="text-right mr-1">
                      <div className="text-xs text-ink-400">score</div>
                      <div className="font-bold text-ink-700">{Math.round(o.score)}</div>
                    </div>
                    <button onClick={() => generarMensaje(o)} disabled={m?.loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-primary-500 hover:bg-primary-700 text-white disabled:opacity-60 transition-colors">
                      {m?.loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                      {m?.texto ? 'Regenerar' : 'Mensaje IA'}
                    </button>
                  </div>
                </div>

                {m?.error && <p className="text-sm text-error bg-error-soft rounded-lg px-3 py-2 mt-3">{m.error}</p>}
                {m?.texto && (
                  <div className="mt-3 bg-cream-100 border border-cream-200 rounded-lg p-3">
                    <p className="text-sm text-ink-700 whitespace-pre-wrap">{m.texto}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <button onClick={() => copiar(k, m.texto!)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border border-ink-200 text-ink-500 hover:bg-white transition-colors">
                        {m.copiado ? <><Check className="w-3.5 h-3.5 text-primary-600" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                      </button>
                      {o.telefono && (
                        <a href={whatsappLink(o.telefono, m.texto)} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors">
                          <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone: 'ink' | 'warning' | 'error' }) {
  const c = tone === 'error' ? 'text-error' : tone === 'warning' ? 'text-warning' : 'text-ink-700'
  return (
    <div className="bg-white rounded-xl border border-ink-200 p-3 text-center">
      <p className={`text-2xl font-bold ${c}`}>{value}</p>
      <p className="text-xs text-ink-400 mt-0.5">{label}</p>
    </div>
  )
}
