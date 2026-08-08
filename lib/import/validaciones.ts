/**
 * Validaciones de fila del import de Excel.
 *
 * Funciones PURAS: el import de pólizas ya corrompió producción dos veces por
 * columnas mal mapeadas, y los dos bugs que se atacan acá siguen abiertos en
 * los datos (ver HANDOFF.md → "Bugs conocidos"). La regla que se sigue es la
 * misma que ya usa el import para los asesores ("un asesor que empieza en
 * dígito indica una columna mal mapeada"): ante una señal clara de columna
 * corrida, no escribir el dato.
 */

/** Mínimo de dígitos para considerar que un valor es un número, no un nombre. */
const MIN_DIGITOS_SOSPECHA = 5

/**
 * Detecta una aseguradora que en realidad es un número — típicamente el
 * teléfono del cliente, por una columna corrida en el Excel de origen.
 *
 * Solo marca valores SIN una sola letra: nombres reales como "48 Horas" o
 * "AXA Colpatria 2" tienen letras y pasan intactos. Se exige un mínimo de
 * dígitos para no rechazar una aseguradora que alguien haya codificado como
 * un número corto.
 */
export function aseguradoraEsNumerica(valor: string | null | undefined): boolean {
  if (!valor) return false
  const limpio = valor.trim()
  if (!limpio) return false
  if (/\p{L}/u.test(limpio)) return false          // tiene letras → es un nombre
  const digitos = limpio.replace(/\D/g, '')
  return digitos.length >= MIN_DIGITOS_SOSPECHA
}

/** Retención por defecto cuando el Excel no la trae o trae un valor imposible. */
export const RETENCION_VENDEDOR_DEFAULT = 10

export interface RetencionNormalizada {
  valor: number
  /** true si el valor del Excel se descartó por estar fuera de rango. */
  corregido: boolean
}

/**
 * La retención del vendedor es un PORCENTAJE (0–100). En el Excel de generales
 * de SURA venía el valor en pesos en esa columna, y quedó guardado como si
 * fuera un porcentaje: eso produce comisiones netas absurdas en PolizaDetalle,
 * que calcula sobre este número.
 *
 * Un valor fuera de 0–100 no es un porcentaje, sea cual sea su origen, así que
 * se descarta y se usa el default. No se intenta "adivinar" el porcentaje real
 * a partir del monto: no hay forma de derivarlo sin la base, y una conversión
 * inventada sería peor que el default.
 */
export function normalizarRetencionVendedor(valor: number | null | undefined): RetencionNormalizada {
  if (valor == null || Number.isNaN(valor)) {
    return { valor: RETENCION_VENDEDOR_DEFAULT, corregido: false }
  }
  if (valor < 0 || valor > 100) {
    return { valor: RETENCION_VENDEDOR_DEFAULT, corregido: true }
  }
  return { valor, corregido: false }
}
