-- ============================================================
-- FIX: porcentajes importados como decimal en lugar de porcentaje
--
-- Problema:
--   1. Algunas columnas tienen NUMERIC(5,4) (max 9.9999), insuficiente
--      para guardar porcentajes como 10, 12.5, etc.
--   2. Datos importados desde Excel quedaron como fracción (0.1 = 10%)
--      porque Excel almacena 10% → 0.1 internamente.
--
-- Solución (ejecutar en orden):
--   PASO 1 → ALTER de columnas a NUMERIC(7,2) para admitir hasta 99999.99
--   PASO 2 → UPDATE: multiplicar por 100 todos los valores entre 0 y 1
--   PASO 3 → SELECT de verificación final
-- ============================================================


-- ══════════════════════════════════════════════════════════════
-- PASO 1: Ampliar la precisión de las columnas de porcentaje
-- ══════════════════════════════════════════════════════════════

ALTER TABLE polizas
  ALTER COLUMN porcentaje_comision_agencia  TYPE NUMERIC(7,2),
  ALTER COLUMN porcentaje_comision_vendedor  TYPE NUMERIC(7,2),
  ALTER COLUMN pct_comision_negocio         TYPE NUMERIC(7,2),
  ALTER COLUMN pct_comision_int             TYPE NUMERIC(7,2),
  ALTER COLUMN pct_comision_abc             TYPE NUMERIC(7,2),
  ALTER COLUMN pct_comision_referido        TYPE NUMERIC(7,2);


-- ══════════════════════════════════════════════════════════════
-- PASO 2: Corregir valores < 1 → multiplicar por 100
-- ══════════════════════════════════════════════════════════════

UPDATE polizas
SET
  porcentaje_comision_agencia  = CASE WHEN porcentaje_comision_agencia  > 0 AND porcentaje_comision_agencia  < 1 THEN ROUND(porcentaje_comision_agencia  * 100, 2) ELSE porcentaje_comision_agencia  END,
  pct_comision_negocio         = CASE WHEN pct_comision_negocio         > 0 AND pct_comision_negocio         < 1 THEN ROUND(pct_comision_negocio         * 100, 2) ELSE pct_comision_negocio         END,
  pct_comision_int             = CASE WHEN pct_comision_int             > 0 AND pct_comision_int             < 1 THEN ROUND(pct_comision_int             * 100, 2) ELSE pct_comision_int             END,
  porcentaje_comision_vendedor  = CASE WHEN porcentaje_comision_vendedor  > 0 AND porcentaje_comision_vendedor  < 1 THEN ROUND(porcentaje_comision_vendedor  * 100, 2) ELSE porcentaje_comision_vendedor  END,
  pct_comision_abc             = CASE WHEN pct_comision_abc             > 0 AND pct_comision_abc             < 1 THEN ROUND(pct_comision_abc             * 100, 2) ELSE pct_comision_abc             END,
  pct_comision_referido        = CASE WHEN pct_comision_referido        > 0 AND pct_comision_referido        < 1 THEN ROUND(pct_comision_referido        * 100, 2) ELSE pct_comision_referido        END
WHERE eliminada = false
  AND (
    (porcentaje_comision_agencia  > 0 AND porcentaje_comision_agencia  < 1) OR
    (pct_comision_negocio         > 0 AND pct_comision_negocio         < 1) OR
    (pct_comision_int             > 0 AND pct_comision_int             < 1) OR
    (porcentaje_comision_vendedor  > 0 AND porcentaje_comision_vendedor  < 1) OR
    (pct_comision_abc             > 0 AND pct_comision_abc             < 1) OR
    (pct_comision_referido        > 0 AND pct_comision_referido        < 1)
  );


-- ══════════════════════════════════════════════════════════════
-- PASO 3: Verificación — todos deben ser 0
-- ══════════════════════════════════════════════════════════════

SELECT
  COUNT(*) FILTER (WHERE porcentaje_comision_agencia  > 0 AND porcentaje_comision_agencia  < 1) AS pct_agencia_pendientes,
  COUNT(*) FILTER (WHERE pct_comision_negocio         > 0 AND pct_comision_negocio         < 1) AS pct_negocio_pendientes,
  COUNT(*) FILTER (WHERE pct_comision_int             > 0 AND pct_comision_int             < 1) AS pct_int_pendientes,
  COUNT(*) FILTER (WHERE porcentaje_comision_vendedor  > 0 AND porcentaje_comision_vendedor  < 1) AS pct_vendedor_pendientes,
  COUNT(*) FILTER (WHERE pct_comision_abc             > 0 AND pct_comision_abc             < 1) AS pct_abc_pendientes,
  COUNT(*) FILTER (WHERE pct_comision_referido        > 0 AND pct_comision_referido        < 1) AS pct_referido_pendientes,
  COUNT(*) AS total_revisadas
FROM polizas
WHERE eliminada = false;
