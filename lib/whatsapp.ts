// Helper de WhatsApp — deep links wa.me con mensaje opcional.
//
// La app es de una agencia colombiana: si el teléfono no trae indicativo de país,
// se antepone 57 (Colombia). Números que ya vienen con indicativo (10+ dígitos
// empezando en 57, o con +) se respetan.

const COLOMBIA_CC = '57'

/** Normaliza un teléfono a solo dígitos con indicativo de país (default Colombia). */
export function normalizarTelefono(telefono: string): string {
  const soloDigitos = telefono.replace(/\D/g, '')
  if (!soloDigitos) return ''
  // Ya trae indicativo Colombia (57 + 10 dígitos = 12) → tal cual.
  if (soloDigitos.startsWith(COLOMBIA_CC) && soloDigitos.length >= 12) return soloDigitos
  // Celular colombiano típico (10 dígitos, empieza en 3) → anteponer 57.
  if (soloDigitos.length === 10) return COLOMBIA_CC + soloDigitos
  // Otro caso (fijo, internacional sin +): se deja como está.
  return soloDigitos
}

/** Construye un link wa.me con mensaje opcional. Devuelve '' si el teléfono es inválido. */
export function whatsappLink(telefono: string | null | undefined, mensaje?: string): string {
  if (!telefono) return ''
  const num = normalizarTelefono(telefono)
  if (!num) return ''
  const base = `https://wa.me/${num}`
  return mensaje ? `${base}?text=${encodeURIComponent(mensaje)}` : base
}

/** Plantilla de recordatorio de pago de un cobro pendiente/vencido. */
export function plantillaRecordatorioPago(opts: {
  nombre?: string | null
  ramo?: string | null
  aseguradora?: string | null
  valor: string        // ya formateado (ej. "$1.200.000")
  fecha?: string | null // ya formateada (ej. "15 ago 2026")
  vencido?: boolean
  agencia?: string | null
}): string {
  const saludo = opts.nombre ? `Hola ${opts.nombre.split(' ')[0]}` : 'Hola'
  const poliza = [opts.ramo, opts.aseguradora].filter(Boolean).join(' · ')
  const refPoliza = poliza ? ` de tu póliza ${poliza}` : ''
  const cuerpo = opts.vencido
    ? `${saludo} 👋, tenemos registrado un pago pendiente${refPoliza} por ${opts.valor}` +
      (opts.fecha ? ` con vencimiento el ${opts.fecha}` : '') +
      `. Te agradecemos ponerte al día para mantener tu cobertura activa.`
    : `${saludo} 👋, te recordamos el próximo pago${refPoliza} por ${opts.valor}` +
      (opts.fecha ? ` con fecha ${opts.fecha}` : '') +
      `. Cualquier duda quedamos atentos.`
  const firma = opts.agencia ? `\n\n— ${opts.agencia}` : ''
  return cuerpo + firma
}
