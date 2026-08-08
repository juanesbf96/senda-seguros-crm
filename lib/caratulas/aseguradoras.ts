// Detección de la aseguradora a partir del texto de una carátula (fase 4.1).
// Cuando existan PDFs de muestra, cada aseguradora puede tener su parser
// determinístico propio; por ahora esto solo identifica cuál es, para etiquetar
// el borrador y elegir el parser específico si existe.

export interface AseguradoraPatron {
  nombre: string        // nombre canónico como se guarda en polizas.aseguradora
  patrones: RegExp[]    // marcas de agua / textos que aparecen en su carátula
}

export const ASEGURADORAS_CARATULA: AseguradoraPatron[] = [
  { nombre: 'Sura',                patrones: [/\bsura\b/i, /suramericana/i] },
  { nombre: 'Seguros Bolívar',     patrones: [/bol[ií]var/i] },
  { nombre: 'Allianz',             patrones: [/allianz/i] },
  { nombre: 'AXA Colpatria',       patrones: [/axa/i, /colpatria/i] },
  { nombre: 'Mapfre',              patrones: [/mapfre/i] },
  { nombre: 'HDI',                 patrones: [/\bhdi\b/i] },
  { nombre: 'Zurich',              patrones: [/zurich/i] },
  { nombre: 'Seguros del Estado',  patrones: [/seguros del estado/i] },
  { nombre: 'Previsora',           patrones: [/previsora/i] },
  { nombre: 'Solidaria',           patrones: [/solidaria/i] },
  { nombre: 'Mundial',             patrones: [/seguros mundial/i, /\bmundial\b/i] },
  { nombre: 'Confianza',           patrones: [/confianza/i] },
  { nombre: 'Equidad Seguros',     patrones: [/equidad/i] },
  { nombre: 'SBS',                 patrones: [/\bsbs\b/i] },
]

/** Devuelve el nombre canónico de la aseguradora detectada, o null. */
export function detectarAseguradora(texto: string): string | null {
  for (const a of ASEGURADORAS_CARATULA) {
    if (a.patrones.some(p => p.test(texto))) return a.nombre
  }
  return null
}
