/**
 * Import de pólizas server-side con queries en bloque.
 *
 * Reemplaza el flujo anterior del navegador que hacía hasta 4 queries
 * secuenciales POR FILA (buscar cliente, crear cliente, buscar póliza,
 * insert/update). Con ~1.200 filas eso eran miles de round-trips y minutos
 * de espera con la pestaña abierta.
 *
 * Estrategia:
 *   1. Cargas iniciales (3 queries): vendedores, tarifas, y lookups en
 *      bloque de clientes por cédula y pólizas por número (chunked).
 *   2. Clientes nuevos: un insert por lote de 500.
 *   3. Pólizas nuevas: un insert por lote de 500.
 *   4. Pólizas existentes: updates individuales (los datos difieren por
 *      fila) pero en paralelo con concurrencia limitada, desde el servidor.
 *
 * Corre con la sesión del usuario (RLS aplica normal — no service role).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { ExcelRow, ImportResult } from './types'

const LOTE_INSERT = 500
const LOTE_IN     = 200   // tamaño de chunk para filtros .in() (límite de URL)
const CONCURRENCIA_UPDATES = 10

function norm(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim()
}

function chunks<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}

export async function importarPolizas(
  supabase: SupabaseClient,
  rows: ExcelRow[],
  wsId: string,
  userId: string,
): Promise<ImportResult> {
  const result: ImportResult = { clientesCreados: 0, clientesExistentes: 0, polizasCreadas: 0, errores: [] }

  // ── 1a. Vendedores del workspace ──────────────────────────────────
  type VendedorCache = { id: string; pct: number | null }
  const vendedoresMap = new Map<string, VendedorCache>()
  const { data: vData } = await supabase
    .from('vendedores')
    .select('id, nombre, comisiones_por_anio')
    .eq('workspace_id', wsId)
    .eq('activo', true)
  for (const v of vData ?? []) {
    const pct = (v.comisiones_por_anio as { porcentaje?: number }[] | null)?.[0]?.porcentaje ?? null
    vendedoresMap.set(norm(v.nombre ?? ''), { id: v.id, pct })
  }

  // ── 1b. Crear vendedores nuevos (un solo insert) ──────────────────
  // Sólo nombres de texto: un asesor que empieza en dígito indica una columna mal mapeada
  const asesoresNuevos = [...new Set(rows.map(r => r.asesor).filter(a => a && !/^\d/.test(a)))].filter(nombre => {
    const k = norm(nombre)
    if (vendedoresMap.has(k)) return false
    for (const key of vendedoresMap.keys()) {
      if (k.includes(key) || key.includes(k)) return false
    }
    return true
  })
  if (asesoresNuevos.length > 0) {
    const { data: nuevos } = await supabase
      .from('vendedores')
      .insert(asesoresNuevos.map(nombre => ({ nombre, workspace_id: wsId, activo: true, created_by: userId })))
      .select('id, nombre')
    for (const v of nuevos ?? []) {
      vendedoresMap.set(norm(v.nombre ?? ''), { id: v.id, pct: null })
    }
  }

  // ── 1c. Tarifas de comisión configuradas ──────────────────────────
  interface TarifaRow { id: string; codigo: string; ramo: string; aseguradora: string; porcentaje: number }
  const tarifasComision: TarifaRow[] = []
  const { data: cfgData } = await supabase
    .from('configuracion')
    .select('valor')
    .eq('workspace_id', wsId)
    .eq('clave', 'comisiones_tarifas')
    .maybeSingle()
  if (cfgData?.valor) {
    try {
      const parsed: TarifaRow[] = JSON.parse(cfgData.valor)
      tarifasComision.push(...parsed.filter(t => typeof t.porcentaje === 'number'))
    } catch { /* ignore */ }
  }

  function matchTarifa(ramo: string, aseguradora: string): number | null {
    const exact = tarifasComision.find(t => t.ramo === ramo && t.aseguradora === aseguradora)
    if (exact) return exact.porcentaje
    const byRamo = tarifasComision.find(t => t.ramo === ramo)
    return byRamo ? byRamo.porcentaje : null
  }

  function matchVendedor(asesorNombre: string): VendedorCache | null {
    if (!asesorNombre) return null
    const k = norm(asesorNombre)
    if (vendedoresMap.has(k)) return vendedoresMap.get(k)!
    for (const [key, v] of vendedoresMap) {
      if (k.includes(key) || key.includes(k)) return v
    }
    return null
  }

  // ── 2. Clientes: lookup en bloque por cédula ──────────────────────
  const clienteIdPorClave = new Map<string, string>()  // cedula (o nombre-lower) → id
  const cedulas = [...new Set(rows.map(r => r.cedula).filter(Boolean))]

  for (const lote of chunks(cedulas, LOTE_IN)) {
    const { data } = await supabase
      .from('clientes')
      .select('id, cedula')
      .eq('workspace_id', wsId)
      .in('cedula', lote)
    for (const c of data ?? []) {
      if (c.cedula) clienteIdPorClave.set(c.cedula, c.id)
    }
  }
  result.clientesExistentes = clienteIdPorClave.size

  // ── 3. Clientes nuevos: dedupe + insert por lotes ─────────────────
  type ClienteNuevo = { clave: string; data: Record<string, unknown> }
  const nuevosPorClave = new Map<string, ClienteNuevo>()

  for (const r of rows) {
    const clave = r.cedula || r.nombre.toLowerCase()
    if (clienteIdPorClave.has(clave) || nuevosPorClave.has(clave)) continue

    const clienteData: Record<string, unknown> = {
      workspace_id:   wsId,
      created_by:     userId,
      nombre:         r.nombre,
      tipo_documento: r.tipo_documento || null,
      cedula:         r.cedula || null,
      telefono:       r.telefono || null,
      email:          r.email || null,
      etapa:          'cerrado',
    }
    if (r.fecha_nacimiento) clienteData.fecha_nacimiento = r.fecha_nacimiento
    if (r.tipo_documento?.toUpperCase() === 'NIT') {
      clienteData.tipo_cliente = 'empresa'
      clienteData.nit = r.cedula || null
    }
    nuevosPorClave.set(clave, { clave, data: clienteData })
  }

  const nuevosClientes = [...nuevosPorClave.values()]
  for (const lote of chunks(nuevosClientes, LOTE_INSERT)) {
    const { data, error } = await supabase
      .from('clientes')
      .insert(lote.map(c => c.data))
      .select('id, cedula, nombre')
    if (error) {
      result.errores.push(`Error creando ${lote.length} clientes: ${error.message}`)
      continue
    }
    for (const c of data ?? []) {
      const clave = c.cedula || String(c.nombre ?? '').toLowerCase()
      clienteIdPorClave.set(clave, c.id)
      result.clientesCreados++
    }
  }

  // ── 4. Pólizas existentes: lookup en bloque por número ────────────
  const numerosPoliza = [...new Set(rows.map(r => r.numero_poliza).filter(Boolean))]
  const polizaIdPorNumero = new Map<string, string>()

  for (const lote of chunks(numerosPoliza, LOTE_IN)) {
    const { data } = await supabase
      .from('polizas')
      .select('id, numero_poliza')
      .eq('workspace_id', wsId)
      .in('numero_poliza', lote)
    for (const p of data ?? []) {
      if (p.numero_poliza) polizaIdPorNumero.set(p.numero_poliza, p.id)
    }
  }

  // ── 5. Construir payloads y separar inserts de updates ────────────
  // Si el archivo repite un número de póliza, gana la última fila (mismo
  // efecto neto que el flujo secuencial anterior: insert + update encima).
  const hoy = new Date().toISOString().split('T')[0]
  const insertsPorClave = new Map<string, Record<string, unknown>>()  // clave: numero_poliza o clave sintética por fila
  const updatesPorId    = new Map<string, { data: Record<string, unknown>; fila: number }>()

  rows.forEach((r, i) => {
    const clave = r.cedula || r.nombre.toLowerCase()
    const clienteId = clienteIdPorClave.get(clave)
    if (!clienteId) {
      result.errores.push(`Fila ${i + 2}: sin cliente para "${r.nombre}" (falló su creación)`)
      return
    }

    let estadoPoliza = 'activa'
    if (r.fecha_fin && r.fecha_fin < hoy) estadoPoliza = 'vencida'
    else if (!r.fecha_inicio && !r.fecha_fin) estadoPoliza = 'pendiente'

    const vendedorMatch = matchVendedor(r.asesor)
    const vendedorId    = vendedorMatch?.id ?? null
    const pctVendedor   = r.pct_comision_asesor ?? vendedorMatch?.pct ?? null

    const primaNeta       = r.prima_neta ?? 0
    const pctAgencia      = r.pct_comision_negocio ?? matchTarifa(r.ramo, r.aseguradora) ?? null
    const comisionAgencia = r.comision_agencia
      ?? (primaNeta && pctAgencia ? Math.round(primaNeta * pctAgencia / 100 * 100) / 100 : null)
    // Tratar 0 como null para que el cálculo derivado aplique cuando el Excel trae ceros
    const comisionVendedor = (r.comision_asesor || null)
      ?? (comisionAgencia && pctVendedor ? Math.round(comisionAgencia * pctVendedor / 100 * 100) / 100 : null)

    const polizaData: Record<string, unknown> = {
      workspace_id:                wsId,
      client_id:                   clienteId,
      aseguradora:                 r.aseguradora || 'Sin asignar',
      ramo:                        r.ramo || 'Sin ramo',
      numero_poliza:               r.numero_poliza || null,
      tipo_poliza:                 r.tipo_poliza || null,
      fecha_inicio:                r.fecha_inicio || null,
      fecha_fin:                   r.fecha_fin || null,
      periodicidad_pago:           r.periodicidad || null,
      estado:                      estadoPoliza,
      eliminada:                   false,
      es_renovacion:               r.es_renovacion,
      mes_emision:                 r.mes_emision || null,
      beneficiario_oneroso:        r.oneroso,
      endoso_enviado:              r.endoso_enviado,
      cancelada_anterior:          r.cancelada_anterior,
      aseguradora_anterior:        r.aseguradora_anterior || null,
      prima_neta:                  r.prima_neta,
      prima:                       r.prima_neta,
      prima_periodica:             r.prima_periodica,
      porcentaje_comision_agencia: pctAgencia,
      comision_agencia:            comisionAgencia,
      comision_periodica:          r.comision_periodica,
      retencion_agencia:           r.retencion_agencia,
      intermediario:               r.intermediario || null,
      pct_comision_int:            r.pct_comision_int,
      comision_intermediario:      r.comision_intermediario,
      vendedor_id:                 vendedorId,
      porcentaje_comision_vendedor: pctVendedor,
      retencion_vendedor:          r.retencion_asesor ?? 10,
      comision_vendedor:           comisionVendedor,
      referido:                    r.referido || null,
      pct_comision_referido:       r.pct_comision_referido,
      retencion_referido:          r.retencion_referido,
      comision_referido:           r.comision_referido,
      comision_abc_periodica:      r.comision_abc_periodica,
      pct_comision_abc:            r.pct_comision_abc,
      retencion_abc:               r.retencion_abc,
      comision_abc_anual:          r.comision_abc_anual,
      comision_recibida:           r.comision_recibida,
      fecha_pago_abc:              r.fecha_pago_abc || null,
      asesor_pago_estado:          r.asesor_pago_estado,
      fecha_pago_asesor:           r.fecha_pago_asesor || null,
    }

    const existenteId = r.numero_poliza ? polizaIdPorNumero.get(r.numero_poliza) : undefined
    if (existenteId) {
      // En UPDATE: no pisar aseguradora/ramo existentes si el Excel trae vacío o un valor inválido
      const BAD_VALUES = new Set(['cancelada', 'sin asignar', 'sin ramo', ''])
      const updateData = { ...polizaData }
      if (!r.aseguradora || BAD_VALUES.has(r.aseguradora.toLowerCase().trim())) delete updateData.aseguradora
      if (!r.ramo      || BAD_VALUES.has(r.ramo.toLowerCase().trim()))      delete updateData.ramo
      updatesPorId.set(existenteId, { data: updateData, fila: i + 2 })
    } else {
      // Clave de dedupe: el número de póliza; sin número, cada fila es única
      const clave = r.numero_poliza || `__fila_${i}`
      insertsPorClave.set(clave, { ...polizaData, created_by: userId })
    }
  })

  // ── 6. Inserts por lotes ──────────────────────────────────────────
  const inserts = [...insertsPorClave.values()]
  for (const lote of chunks(inserts, LOTE_INSERT)) {
    const { error, data } = await supabase.from('polizas').insert(lote).select('id')
    if (error) {
      result.errores.push(`Error insertando lote de ${lote.length} pólizas: ${error.message}`)
    } else {
      result.polizasCreadas += (data ?? []).length
    }
  }

  // ── 7. Updates con concurrencia limitada ──────────────────────────
  const updates = [...updatesPorId.entries()]
  for (const lote of chunks(updates, CONCURRENCIA_UPDATES)) {
    const resultados = await Promise.all(
      lote.map(([id, u]) => supabase.from('polizas').update(u.data).eq('id', id))
    )
    resultados.forEach((res, j) => {
      if (res.error) {
        result.errores.push(`Fila ${lote[j][1].fila}: no se pudo actualizar la póliza — ${res.error.message}`)
      } else {
        result.polizasCreadas++
      }
    })
  }

  return result
}
