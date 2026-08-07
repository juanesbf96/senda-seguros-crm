import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { completar } from '@/lib/ia/motor'
import { resolverConfigIA } from '@/lib/ia/resolverConfig'

export async function POST(req: NextRequest) {
  // Verificar autenticación — la cookie de sesión viene en el header
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  const { messages, contexto, workspaceId } = await req.json()

  const hoy = new Date().toLocaleDateString('es-CO', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const systemPrompt = `Eres el asistente virtual del CRM de Senda Seguros, una agencia de seguros colombiana.

Respondes SIEMPRE en español. Eres conciso, directo y usas terminología de seguros colombiana (pólizas, primas, aseguradoras, ramos, vigencias, siniestros, endosos, cobros, liquidaciones).

Hoy es ${hoy}.

DATOS ACTUALES DEL CRM (extraídos en tiempo real de la base de datos):
${contexto}

INSTRUCCIONES:
- Usa los datos anteriores para responder con precisión.
- Si el dato exacto no está en el contexto, dilo claramente y sugiere cómo obtenerlo.
- Cuando menciones valores en pesos colombianos, usa formato $X.XXX.XXX COP.
- Sé breve: máximo 3-4 oraciones salvo que la pregunta requiera una lista.
- Si te preguntan por un asesor o persona, busca su nombre en los datos disponibles.`

  // Resolver el proveedor de IA del workspace (BYOK) — la llave se lee server-side
  // con service-role; si no hay config, cae al Groq incluido.
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY no configurada en el servidor' }, { status: 500 })
  }
  const serviceClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)

  try {
    const cfg = workspaceId
      ? await resolverConfigIA(serviceClient, workspaceId)
      : { proveedor: 'groq' as const, modelo: null, apiKey: process.env.GROQ_API_KEY || '' }

    const respuesta = await completar(cfg, {
      system: systemPrompt,
      messages,
      maxTokens: 600,
      temperature: 0.2,
    })
    return NextResponse.json({ respuesta })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Error al contactar el proveedor de IA'
    console.error('Motor IA error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
