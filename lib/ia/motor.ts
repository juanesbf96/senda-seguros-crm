// Motor de IA multi-proveedor (fase 4.3).
//
// Interfaz única `completar()` con adaptadores por proveedor. Groq/OpenAI/DeepSeek
// hablan el formato OpenAI (chat/completions); Anthropic y Gemini tienen el suyo.
//
// Este módulo corre SOLO en el servidor (rutas API): recibe la llave ya resuelta
// (BYOK del workspace o la compartida de Groq). Nunca debe importarse en el cliente.

export type ProveedorIA = 'groq' | 'openai' | 'anthropic' | 'deepseek' | 'gemini'

export const PROVEEDORES_IA: ProveedorIA[] = ['groq', 'openai', 'anthropic', 'deepseek', 'gemini']

export const PROVEEDOR_LABEL: Record<ProveedorIA, string> = {
  groq:      'Senda incluido (Groq)',
  openai:    'OpenAI',
  anthropic: 'Anthropic (Claude)',
  deepseek:  'DeepSeek',
  gemini:    'Google Gemini',
}

// Modelo por defecto de cada proveedor (si el workspace no fija uno).
export const MODELO_DEFAULT: Record<ProveedorIA, string> = {
  groq:      'llama-3.3-70b-versatile',
  openai:    'gpt-4o-mini',
  anthropic: 'claude-3-5-haiku-latest',
  deepseek:  'deepseek-chat',
  gemini:    'gemini-1.5-flash',
}

// Endpoints de los proveedores compatibles con el formato OpenAI.
const OPENAI_COMPAT_URL: Partial<Record<ProveedorIA, string>> = {
  groq:     'https://api.groq.com/openai/v1/chat/completions',
  openai:   'https://api.openai.com/v1/chat/completions',
  deepseek: 'https://api.deepseek.com/chat/completions',
}

export interface MensajeIA {
  role: 'user' | 'assistant'
  content: string
}

export interface OpcionesIA {
  system?: string
  messages: MensajeIA[]
  maxTokens?: number
  temperature?: number
}

export interface ConfigIA {
  proveedor: ProveedorIA
  modelo: string | null
  apiKey: string
}

/** Resuelve el modelo efectivo (el fijado por el workspace o el default del proveedor). */
export function modeloEfectivo(cfg: Pick<ConfigIA, 'proveedor' | 'modelo'>): string {
  return cfg.modelo?.trim() || MODELO_DEFAULT[cfg.proveedor]
}

/** Llama al proveedor configurado y devuelve el texto de la respuesta. Lanza en error. */
export async function completar(cfg: ConfigIA, opts: OpcionesIA): Promise<string> {
  if (!cfg.apiKey) throw new Error(`Falta la llave de API para ${PROVEEDOR_LABEL[cfg.proveedor]}`)
  const modelo = modeloEfectivo(cfg)
  const maxTokens = opts.maxTokens ?? 600
  const temperature = opts.temperature ?? 0.2

  if (cfg.proveedor === 'anthropic') return completarAnthropic(cfg.apiKey, modelo, opts, maxTokens, temperature)
  if (cfg.proveedor === 'gemini')    return completarGemini(cfg.apiKey, modelo, opts, maxTokens, temperature)
  return completarOpenAICompat(cfg.proveedor, cfg.apiKey, modelo, opts, maxTokens, temperature)
}

async function completarOpenAICompat(
  proveedor: ProveedorIA, apiKey: string, modelo: string,
  opts: OpcionesIA, maxTokens: number, temperature: number,
): Promise<string> {
  const url = OPENAI_COMPAT_URL[proveedor]
  if (!url) throw new Error(`Proveedor sin endpoint OpenAI-compat: ${proveedor}`)
  const messages = opts.system
    ? [{ role: 'system', content: opts.system }, ...opts.messages]
    : opts.messages
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: modelo, messages, max_tokens: maxTokens, temperature }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data?.error?.message || `Error ${resp.status} de ${PROVEEDOR_LABEL[proveedor]}`)
  const texto = data?.choices?.[0]?.message?.content
  if (typeof texto !== 'string') throw new Error(`Respuesta inesperada de ${PROVEEDOR_LABEL[proveedor]}`)
  return texto
}

async function completarAnthropic(
  apiKey: string, modelo: string, opts: OpcionesIA, maxTokens: number, temperature: number,
): Promise<string> {
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: modelo,
      max_tokens: maxTokens,
      temperature,
      ...(opts.system ? { system: opts.system } : {}),
      messages: opts.messages,
    }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data?.error?.message || `Error ${resp.status} de Anthropic`)
  const texto = data?.content?.[0]?.text
  if (typeof texto !== 'string') throw new Error('Respuesta inesperada de Anthropic')
  return texto
}

// Gemini usa 'model' en vez de 'assistant' y una estructura de contents distinta.
export function mapaMensajesGemini(messages: MensajeIA[]) {
  return messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
}

async function completarGemini(
  apiKey: string, modelo: string, opts: OpcionesIA, maxTokens: number, temperature: number,
): Promise<string> {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${apiKey}`
  const resp = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...(opts.system ? { systemInstruction: { parts: [{ text: opts.system }] } } : {}),
      contents: mapaMensajesGemini(opts.messages),
      generationConfig: { maxOutputTokens: maxTokens, temperature },
    }),
  })
  const data = await resp.json()
  if (!resp.ok) throw new Error(data?.error?.message || `Error ${resp.status} de Gemini`)
  const texto = data?.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof texto !== 'string') throw new Error('Respuesta inesperada de Gemini')
  return texto
}
