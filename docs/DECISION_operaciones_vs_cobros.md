# Decisión pendiente: `operaciones` vs `cobros` (cartera de cobros)

> Brief para el owner. Preparado por Carril A (dueño del aging de cartera, fase 1.2).
> Fecha: 7-ago-2026.

## El problema en una línea

La **cartera de cobros** (lo que deben los clientes) hoy puede vivir en **dos tablas**,
y si no se decide cuál manda, la mora se cuenta mal o doble.

## Contexto (ya aclarado por el owner)

Existen **dos carteras distintas**, no una:

1. **Producción total** — prima − IVA, alimentada por cada póliza completa. Es una
   métrica de ventas/producción, **no** un saldo por cobrar.
2. **Cartera de cobros** — lo que deben los clientes de pólizas emitidas (en mora o
   dentro del período de pago). **Esta** es la que nos ocupa.

El choque técnico: la cartera de cobros (#2) está representada en dos lugares:

- **Tabla `cobros`** — es la fuente actual. La lee el **aging** (`get_cartera_aging`,
  fase 1.2) y sobre ella están construidos **Cobros, Caja, recibos y el RPC de pago**
  (`registrar_pago_cobro`). Tiene todos los datos históricos (import + colillas).
- **`operaciones` tipo `cobro`** — las **cuotas** que genera `generar_operaciones_cuotas`
  (fase 3) viven acá.

Son **el mismo concepto** (cartera de cobros) en dos tablas por un accidente de
implementación. Mientras el aging lea solo `cobros`, las cuotas generadas en
`operaciones` **no aparecen en la mora**; y si alguien registra lo mismo en los dos
lados, se **cuenta doble**.

## Opciones

### Opción 1 — `operaciones` como fuente de verdad (migrar el aging)
Mover toda la cartera a `operaciones` y que el aging (y Cobros/Caja/recibos) lea de ahí.
- ✅ Un solo modelo de movimientos, estilo Cider.
- ❌ **Rework enorme y riesgoso**: reescribir la capa de finanzas que **acabamos de
  reconciliar** (el bug de cobros en ceros). Migrar datos históricos. Alto riesgo sobre
  dinero. **No recomendado ahora.**

### Opción 2 — `cobros` es la fuente; `operaciones` es la bitácora de movimientos ⭐
La cartera de cobros vive **solo en `cobros`**. El generador de cuotas escribe las
cuotas **en `cobros`** (tipo `por_cobrar`, con `saldo_pendiente`, `compromiso_pago`,
número de cuota). `operaciones` queda como **timeline de movimientos** (renovación,
cancelación, modificación, expedición) — **no** como fuente de cartera.
- ✅ El aging y toda la capa de finanzas siguen funcionando **sin cambios**.
- ✅ **Cero doble conteo** (una sola tabla de dinero).
- ✅ Cambio **mínimo**: reapuntar `generar_operaciones_cuotas` a `cobros`.
- ✅ El timeline de la póliza muestra cuotas (de `cobros`) + movimientos (de `operaciones`).
- ⚠️ Implica cambiar el RPC `generar_operaciones_cuotas` (territorio compartido con
  Carril B) — no escribir cuotas `tipo='cobro'` en `operaciones`.

### Opción 3 — una vista que une ambas
Que el aging lea una vista `cartera_unificada` = cobros pendientes ∪ operaciones
`cobro` pendientes.
- ✅ Ambas coexisten sin migrar datos.
- ❌ **Frágil**: hay que deduplicar en la vista para no doble-contar la misma cuota;
  dos caminos de escritura que mantener sincronizados. Más superficie de bug sobre plata.

## Recomendación

**Opción 2.** `cobros` es la única fuente de verdad de la cartera de cobros; el generador
de cuotas escribe en `cobros`; `operaciones` se queda como timeline de movimientos (que
es donde aporta valor: renovaciones/cancelaciones gestionables). Es el camino de **menor
riesgo** (no toca la capa de finanzas ya reconciliada), **sin doble conteo**, y con el
**cambio más chico**.

## Qué implica si el owner aprueba la Opción 2

1. **Carril B** ajusta `generar_operaciones_cuotas` para que las cuotas se inserten en
   `cobros` (no en `operaciones`). Va junto con la deuda de `periodicidad_cuota` (misma
   RPC). Probado en staging.
2. **Carril A** (aging) no cambia — sigue leyendo `cobros`; las cuotas aparecen solas.
3. El **timeline de la póliza** (`OperacionesPoliza`, Carril B) suma las cuotas leyendo
   también de `cobros` para esa póliza, además de `operaciones`.
4. Actualizar la bitácora cerrando la deuda.

## Qué NO cambia mientras se decide

Nada urgente: **no hay `num_cuotas` en ninguna póliza de prod**, así que hoy **no se
generan cuotas** y no hay doble conteo real. La decisión debe tomarse **antes** de que la
financiación se use en volumen.
