-- ============================================================
-- Migration: Facturas v2 — spec tributaria colombiana completa
-- Ejecutar en Supabase SQL Editor
-- ============================================================

-- 1. Nuevas columnas tributarias en facturas
ALTER TABLE facturas
  ADD COLUMN IF NOT EXISTS fecha_corte          date,
  ADD COLUMN IF NOT EXISTS comision_gravada      numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comision_no_gravada   numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pct_iva               numeric(7,4)  DEFAULT 19.0000,
  ADD COLUMN IF NOT EXISTS pct_ret_iva           numeric(7,4)  DEFAULT 15.0000,
  ADD COLUMN IF NOT EXISTS ret_iva               numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pct_ret_ica           numeric(7,4)  DEFAULT 0.0000,
  ADD COLUMN IF NOT EXISTS ret_ica               numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pct_ret_fuente        numeric(7,4)  DEFAULT 11.0000,
  ADD COLUMN IF NOT EXISTS ret_fuente            numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS otros                 numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gran_total            numeric(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS es_borrador           boolean       DEFAULT false,
  ADD COLUMN IF NOT EXISTS sede                  text;

-- 2. Migrar datos existentes: mapear valor_base → comision_gravada, total → gran_total
UPDATE facturas
SET
  comision_gravada = COALESCE(valor_base, 0),
  gran_total       = COALESCE(total, 0),
  ret_iva          = COALESCE(retencion, 0) * 0.0           -- retención anterior era fuente, no ret_iva
WHERE comision_gravada = 0 AND valor_base > 0;

-- 3. Recalcular ret_fuente desde retencion legada (aprox)
UPDATE facturas
SET ret_fuente = COALESCE(retencion, 0)
WHERE ret_fuente = 0 AND retencion > 0;

-- Verificar estructura resultante
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'facturas'
  AND column_name IN (
    'fecha_corte','comision_gravada','comision_no_gravada',
    'pct_iva','pct_ret_iva','ret_iva','pct_ret_ica','ret_ica',
    'pct_ret_fuente','ret_fuente','otros','gran_total','es_borrador','sede'
  )
ORDER BY column_name;
