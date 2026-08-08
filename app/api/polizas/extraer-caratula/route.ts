import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { extraerTextoPdf } from '@/lib/colillas/parsers/pdf'
import { extraerHeuristica } from '@/lib/caratulas/heuristica'
import { detectarAseguradora } from '@/lib/caratulas/aseguradoras'
import { SYSTEM_EXTRACCION_CARATULA, buildPromptCaratula, parseRespuestaIA } from '@/lib/caratulas/promptIA'
import { resolverConfigIA } from '@/lib/ia/resolverConfig'
import { completar } from '@/lib/ia/motor'
import { BorradorPoliza, ResultadoExtraccionCaratula } from '@/types'

const CAMPOS_CLAVE: (keyof BorradorPoliza)[] = ['numero_poliza', 'aseguradora', 'fecha_inicio', 'fecha_fin', 'prima']

// Extrae un borrador de póliza desde el PDF de una carátula (fase 4.1).
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

  // Leer el PDF del FormData
  let form: FormData
  try { form = await req.formData() } catch { return NextResponse.json({ error: 'Se esperaba un archivo (FormData)' }, { status: 400 }) }
  const file = form.get('file')
  const workspaceId = form.get('workspaceId')?.toString()
  if (!(file instanceof File)) return NextResponse.json({ error: 'Falta el archivo PDF' }, { status: 400 })
  if (file.type && !file.type.includes('pdf')) return NextResponse.json({ error: 'El archivo debe ser un PDF' }, { status: 400 })

  // 1. Texto del PDF
  let texto: string
  try {
    texto = await extraerTextoPdf(await file.arrayBuffer())
  } catch (e) {
    console.error('Carátula: error leyendo PDF:', e)
    return NextResponse.json({ error: 'No se pudo leer el PDF' }, { status: 422 })
  }
  if (!texto || texto.trim().length < 20) {
    return NextResponse.json({ error: 'El PDF no tiene texto extraíble (¿es una imagen escaneada?)' }, { status: 422 })
  }

  // 2. Extracción heurística (determinística)
  const { borrador, camposFaltantes } = extraerHeuristica(texto)
  let origen: ResultadoExtraccionCaratula['origen'] = 'parser'

  // 3. Fallback IA si faltan campos clave (best-effort: si la IA falla, se devuelve lo heurístico)
  if (camposFaltantes.length > 0 && workspaceId) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (serviceKey) {
      try {
        const service = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey)
        const cfg = await resolverConfigIA(service, workspaceId)
        const respuesta = await completar(cfg, {
          system: SYSTEM_EXTRACCION_CARATULA,
          messages: [{ role: 'user', content: buildPromptCaratula(texto, camposFaltantes) }],
          maxTokens: 400,
          temperature: 0,
        })
        const iaParcial = parseRespuestaIA(respuesta)
        if (iaParcial) {
          origen = 'ia'
          // La heurística gana donde ya tiene valor; la IA rellena los huecos.
          for (const k of Object.keys(borrador) as (keyof BorradorPoliza)[]) {
            if (borrador[k] == null && iaParcial[k] != null) {
              // @ts-expect-error asignación por clave homogénea
              borrador[k] = iaParcial[k]
            }
          }
        }
      } catch (e) {
        console.error('Carátula: fallback IA falló, se devuelve lo heurístico:', e instanceof Error ? e.message : e)
      }
    }
  }

  const faltantesFinales = CAMPOS_CLAVE.filter(c => borrador[c] == null).map(String)
  const resultado: ResultadoExtraccionCaratula = {
    borrador,
    origen,
    // La IA siempre exige revisión; el parser puro con todo lo clave es 'alta'.
    confianza: origen === 'ia' || faltantesFinales.length > 0 ? 'requiere_revision' : 'alta',
    aseguradora_detectada: detectarAseguradora(texto),
    campos_faltantes: faltantesFinales,
  }
  return NextResponse.json(resultado)
}
