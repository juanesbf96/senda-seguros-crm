-- ══════════════════════════════════════════════════════════════════════
-- Senda Seguros CRM — Migración S3 v2
-- Sprint 3 (rehecho fiel al doc): Tareas + Remisiones ampliadas
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────
-- TAREAS: agregar asignado_a
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE tareas
  ADD COLUMN IF NOT EXISTS asignado_a TEXT;

-- ──────────────────────────────────────────────────────────────────────
-- REMISIONES: ampliar estados para incluir 'anulada'
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE remisiones DROP CONSTRAINT IF EXISTS remisiones_estado_check;
ALTER TABLE remisiones ADD CONSTRAINT remisiones_estado_check
  CHECK (estado IN ('borrador','enviada','recibida','aprobada','rechazada','anulada'));

-- Agregar numero_remision auto-incremental
CREATE SEQUENCE IF NOT EXISTS remisiones_num_seq START 1;
ALTER TABLE remisiones
  ADD COLUMN IF NOT EXISTS numero_remision INTEGER;

UPDATE remisiones SET numero_remision = nextval('remisiones_num_seq')
  WHERE numero_remision IS NULL;

ALTER TABLE remisiones
  ALTER COLUMN numero_remision SET DEFAULT nextval('remisiones_num_seq');

-- ──────────────────────────────────────────────────────────────────────
-- GESTIONES_RENOVACION: agregar asignado_a
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE gestiones_renovacion
  ADD COLUMN IF NOT EXISTS asignado_a TEXT;
