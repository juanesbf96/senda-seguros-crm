import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { completar, modeloEfectivo } from '@/lib/ia/motor'
import { resolverConfigIA } from '@/lib/ia/resolverConfig'
import { familiaSeguro } from '@/lib/crossSell'

// Genera (y cachea 30 días) el mensaje sugerido de cross-sell para un cliente.
export async function POST(req: NextRequest) {
  const token = (req.headers.get('authorization') || '').replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await authClient.auth.getUser()
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const { workspaceId, clientId, clienteNombre, familiaTiene, familiaSugerida } = await req.json()
  if (!workspaceId || !clientId || !familiaSugerida) {
    return NextResponse.json({ error: 'Faltan datos de la oportunidad' }, { status: 400 })
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return NextResponse.json({ error: 'Servidor sin service-role' }, { status: 500 })
  const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

  // 1) Verificar caché: mismo (workspace, cliente, familia destino) en los últimos 30 días.
  const hace30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
  const { data: cache } = await service
    .from('analisis_ia')
    .select('resultado, modelo, created_at')
    .eq('workspace_id', workspaceId)
    .eq('tipo', 'cross_sell')
    .eq('entidad_id', clientId)
    .eq('clave', familiaSugerida)
    .gte('created_at', hace30)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (cache?.resultado?.mensaje) {
    return NextResponse.json({ mensaje: cache.resultado.mensaje, cacheado: true, modelo: cache.modelo })
  }

  // 2) Generar con el motor de IA del workspace.
  try {
    const cfg = await resolverConfigIA(service, workspaceId)
    const nombre = (clienteNombre || 'el cliente').split(' ')[0]
    const system = `Eres un asesor comercial de una agencia de seguros colombiana. Escribes mensajes de WhatsApp cordiales, breves y naturales en español colombiano. Sin listas, sin markdown, máximo 3 frases. No inventes precios ni coberturas.`
    const prompt = `Escribe un mensaje de WhatsApp para ${nombre}, que ya tiene con nosotros ${familiaSeguro(familiaTiene)}, para ofrecerle además un ${familiaSeguro(familiaSugerida)}. Tono cercano y profesional, invitando a una asesoría sin compromiso.`

    const mensaje = (await completar(cfg, {
      system,
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 220,
      temperature: 0.6,
    })).trim()

    // 3) Guardar en caché (service-role bypassa RLS).
    await service.from('analisis_ia').insert({
      workspace_id: workspaceId,
      tipo: 'cross_sell',
      entidad_id: clientId,
      clave: familiaSugerida,
      resultado: { mensaje, familia_tiene: familiaTiene, familia_sugerida: familiaSugerida },
      modelo: `${cfg.proveedor}:${modeloEfectivo(cfg)}`,
    })

    return NextResponse.json({ mensaje, cacheado: false, modelo: `${cfg.proveedor}:${modeloEfectivo(cfg)}` })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al generar el mensaje'
    console.error('Cross-sell IA error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
