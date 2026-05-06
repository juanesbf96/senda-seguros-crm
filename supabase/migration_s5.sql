-- ══════════════════════════════════════════════════════════════════════
-- Senda Seguros CRM — Migración S5
-- Sprint 5: Liquidar Vendedores + CRM Prospectos
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────
-- VENDEDORES: registro de asesores / agentes
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
-- LIQUIDACIONES: liquidación de comisiones por vendedor y periodo
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS liquidaciones (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendedor_id     uuid NOT NULL REFERENCES vendedores(id) ON DELETE CASCADE,
  periodo         TEXT NOT NULL,   -- Ej: '2024-01', '2024-02'
  total_primas    NUMERIC(14,2) NOT NULL DEFAULT 0,
  total_comision  NUMERIC(14,2) NOT NULL DEFAULT 0,
  estado          TEXT NOT NULL DEFAULT 'pendiente'
                  CHECK (estado IN ('pendiente','pagado','anulado')),
  fecha_pago      DATE,
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER liquidaciones_updated_at
  BEFORE UPDATE ON liquidaciones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Relacionar cobros/polizas con vendedor (opcional: asignar un vendedor)
ALTER TABLE cobros
  ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES vendedores(id) ON DELETE SET NULL;

ALTER TABLE polizas
  ADD COLUMN IF NOT EXISTS vendedor_id uuid REFERENCES vendedores(id) ON DELETE SET NULL;

-- ──────────────────────────────────────────────────────────────────────
-- PROSPECTOS: CRM de oportunidades de negocio
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospectos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  empresa     TEXT,
  email       TEXT,
  telefono    TEXT,
  ciudad      TEXT,
  fuente      TEXT    CHECK (fuente IN ('referido','web','llamada','red_social','evento','otro')),
  etapa       TEXT NOT NULL DEFAULT 'nuevo'
              CHECK (etapa IN ('nuevo','contactado','calificado','propuesta','cerrado_ganado','cerrado_perdido')),
  ramo_interes TEXT,
  valor_estimado NUMERIC(14,2),
  asignado_a  TEXT,
  notas       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER prospectos_updated_at
  BEFORE UPDATE ON prospectos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Actividades de prospectos (seguimiento)
CREATE TABLE IF NOT EXISTS prospecto_actividades (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prospecto_id uuid NOT NULL REFERENCES prospectos(id) ON DELETE CASCADE,
  tipo         TEXT NOT NULL CHECK (tipo IN ('llamada','email','reunion','nota','cotizacion')),
  descripcion  TEXT NOT NULL,
  fecha        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
