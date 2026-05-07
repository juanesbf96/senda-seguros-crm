-- ══════════════════════════════════════════════════════════════════════
-- Senda Seguros CRM — Migración S6
-- Sprint 6: Informes + Archivos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────
-- 0. Función set_updated_at (idempotente)
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────
-- 1. ARCHIVOS
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS archivos (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT NOT NULL,
  nombre_original  TEXT NOT NULL,
  url              TEXT NOT NULL,
  tipo_mime        TEXT,
  tamano           INTEGER,
  client_id        uuid REFERENCES clientes(id)   ON DELETE CASCADE,
  poliza_id        uuid REFERENCES polizas(id)    ON DELETE SET NULL,
  prospecto_id     uuid REFERENCES prospectos(id) ON DELETE SET NULL,
  descripcion      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
