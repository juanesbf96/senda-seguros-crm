-- ══════════════════════════════════════════════════════════════════════
-- Senda Seguros CRM — Migración S5
-- Sprint 5: Liquidar Vendedores + CRM Prospectos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────
-- 0. Función set_updated_at (crea si no existe)
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- ──────────────────────────────────────────────────────────────────────
-- 1. VENDEDORES
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS vendedores (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre              TEXT NOT NULL,
  email               TEXT,
  telefono            TEXT,
  cedula              TEXT,
  porcentaje_comision NUMERIC(5,2) NOT NULL DEFAULT 0,
  activo              BOOLEAN NOT NULL DEFAULT TRUE,
  notas               TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────────
-- 2. LIQUIDACIONES
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS liquidaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id     uuid NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
  periodo         TEXT NOT NULL,
  total_primas    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_comision  NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','pagado','anulado')),
  fecha_pago      DATE,
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS liquidaciones_updated_at ON liquidaciones;
CREATE TRIGGER liquidaciones_updated_at
  BEFORE UPDATE ON liquidaciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────
-- 3. FK vendedor_id en cobros y polizas
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE cobros
  ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES vendedores(id) ON DELETE SET NULL;

ALTER TABLE polizas
  ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES vendedores(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────────────────────────────
-- 4. PROSPECTOS
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospectos (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre          TEXT NOT NULL,
  empresa         TEXT,
  email           TEXT,
  telefono        TEXT,
  ciudad          TEXT,
  fuente          TEXT CHECK (fuente IN ('referido','web','llamada','red_social','evento','otro')),
  etapa           TEXT NOT NULL DEFAULT 'nuevo'
                  CHECK (etapa IN ('nuevo','contactado','calificado','propuesta','cerrado_ganado','cerrado_perdido')),
  ramo_interes    TEXT,
  valor_estimado  NUMERIC(14,2),
  asignado_a      TEXT,
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS prospectos_updated_at ON prospectos;
CREATE TRIGGER prospectos_updated_at
  BEFORE UPDATE ON prospectos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────
-- 5. PROSPECTO_ACTIVIDADES
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospecto_actividades (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecto_id uuid NOT NULL REFERENCES prospectos(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL CHECK (tipo IN ('llamada','email','reunion','nota','cotizacion')),
  descripcion  TEXT NOT NULL,
  fecha        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
