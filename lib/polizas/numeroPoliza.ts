/**
 * Normalización del número de póliza para matching.
 *
 * ⚠️ Debe replicar EXACTAMENTE la función SQL `public.normalizar_numero_poliza`
 * (ver supabase/migrations/20260801163626_modelo_polizas_v2.sql), porque el
 * matching compara este resultado contra la columna generada
 * `polizas.numero_poliza_recortado`. Si divergen, el match falla en silencio.
 * Hay un test que verifica ambos lados con la misma tabla de casos.
 *
 * Regla: mayúsculas → quitar todo lo no alfanumérico → quitar ceros a la izq.
 *
 * POR QUÉ: la colilla de AXA trae '000000108969' y la BD guarda '108969'; el
 * match exacto falla. Medido sobre las colillas reales: 18 de 85 líneas (21%)
 * pasaban a "sin match" solo por esto.
 */
export function normalizarNumeroPoliza(numero: string | null | undefined): string | null {
  if (numero === null || numero === undefined || numero.trim() === '') return null
  const limpio = numero.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^0+/, '')
  // si eran todos ceros, conservar '0' en vez de cadena vacía (igual que el SQL)
  return limpio || '0'
}

/**
 * Construye un mapa normalizado → id a partir de filas de pólizas, descartando
 * los valores ambiguos (los que apuntan a más de una póliza).
 *
 * La ambigüedad se descarta a propósito: en el import un falso positivo
 * ACTUALIZA la póliza equivocada, que es peor que crear un duplicado. En
 * producción hoy no hay colisiones (verificado sobre 1.000 pólizas), pero el
 * código no debe depender de que eso siga siendo cierto.
 */
export function mapaPorNumeroNormalizado(
  filas: { id: string; numero_poliza_recortado: string | null }[],
): { mapa: Map<string, string>; ambiguos: string[] } {
  const porClave = new Map<string, string[]>()
  for (const f of filas) {
    if (!f.numero_poliza_recortado) continue
    const lista = porClave.get(f.numero_poliza_recortado) ?? []
    lista.push(f.id)
    porClave.set(f.numero_poliza_recortado, lista)
  }

  const mapa = new Map<string, string>()
  const ambiguos: string[] = []
  for (const [clave, ids] of porClave) {
    if (ids.length === 1) mapa.set(clave, ids[0])
    else ambiguos.push(clave)
  }
  return { mapa, ambiguos }
}
