-- ══════════════════════════════════════════════════════════════════════
-- Senda Seguros CRM — Migración Agenda
-- Módulo: Agenda (día / semana / mes)
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
-- 1. AGENDA_EVENTOS
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS agenda_eventos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo       TEXT NOT NULL,
  descripcion  TEXT,
  fecha_inicio TIMESTAMPTZ NOT NULL,
  fecha_fin    TIMESTAMPTZ NOT NULL,
  todo_el_dia  BOOLEAN NOT NULL DEFAULT FALSE,
  color        TEXT NOT NULL DEFAULT '#10b981',
  tipo         TEXT NOT NULL DEFAULT 'evento'
               CHECK (tipo IN ('evento','reunion','llamada','recordatorio','otro')),
  notas        TEXT,
  client_id    uuid REFERENCES clientes(id) ON DELETE SET NULL,
  poliza_id    uuid REFERENCES polizas(id)  ON DELETE SET NULL,
  prospecto_id uuid REFERENCES prospectos(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS agenda_eventos_updated_at ON agenda_eventos;
CREATE TRIGGER agenda_eventos_updated_at
  BEFORE UPDATE ON agenda_eventos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
