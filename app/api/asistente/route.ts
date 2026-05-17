import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const GROQ_API_KEY = process.env.GROQ_API_KEY
  if (!GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY no configurado en .env.local' }, { status: 500 })
  }

  const { messages, contexto } = await req.json()

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

  const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      max_tokens: 600,
      temperature: 0.2,
    }),
  })

  const data = await resp.json()

  if (!resp.ok) {
    console.error('Groq error:', data)
    return NextResponse.json(
      { error: data.error?.message || 'Error al contactar Groq' },
      { status: 500 }
    )
  }

  return NextResponse.json({ respuesta: data.choices[0].message.content })
}
