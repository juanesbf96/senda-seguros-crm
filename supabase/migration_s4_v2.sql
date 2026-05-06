-- ══════════════════════════════════════════════════════════════════════
-- Senda Seguros CRM — Migración S4 v2
-- Sprint 4 (rehecho fiel al doc): Cobros 4 tabs + Recibos 5 tabs
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────
-- COBROS: agregar tipo para clasificar las 4 pestañas
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE cobros
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'por_cobrar'
    CHECK (tipo IN ('por_cobrar','por_pagar','comision_por_cobrar','comision_recibida')),
  ADD COLUMN IF NOT EXISTS aseguradora        TEXT,
  ADD COLUMN IF NOT EXISTS ramo               TEXT,
  ADD COLUMN IF NOT EXISTS numero_poliza      TEXT,
  ADD COLUMN IF NOT EXISTS numero_cobro       INTEGER,
  ADD COLUMN IF NOT EXISTS fecha_emision      DATE,
  ADD COLUMN IF NOT EXISTS porcentaje_comision NUMERIC(5,2);

-- Auto-numeración de cobros
CREATE SEQUENCE IF NOT EXISTS cobros_num_seq START 1;
UPDATE cobros SET numero_cobro = nextval('cobros_num_seq') WHERE numero_cobro IS NULL;
ALTER TABLE cobros ALTER COLUMN numero_cobro SET DEFAULT nextval('cobros_num_seq');

-- ──────────────────────────────────────────────────────────────────────
-- RECIBOS: agregar tipo para las 5 pestañas
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE recibos
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'activo'
    CHECK (tipo IN ('anticipo','activo','pago_directo','anulado','certificado')),
  ADD COLUMN IF NOT EXISTS numero_certificado TEXT,
  ADD COLUMN IF NOT EXISTS poliza_id          uuid REFERENCES polizas(id) ON DELETE SET NULL;
