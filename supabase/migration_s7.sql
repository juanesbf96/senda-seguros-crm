-- ══════════════════════════════════════════════════════════════════════
-- Senda Seguros CRM — Migración S7
-- Sprint 7: Siniestros + Facturas + Diligencias
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

-- ──────────────────────────────────────────────────────────────────────
-- 1. SINIESTROS
-- ──────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS siniestros_num_seq START 1;

CREATE TABLE IF NOT EXISTS siniestros (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_siniestro INTEGER UNIQUE DEFAULT nextval('siniestros_num_seq'),
  client_id        uuid REFERENCES clientes(id) ON DELETE SET NULL,
  poliza_id        uuid REFERENCES polizas(id)  ON DELETE SET NULL,
  aseguradora      TEXT,
  ramo             TEXT,
  fecha_ocurrencia DATE,
  fecha_reporte    DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion      TEXT NOT NULL,
  amparo           TEXT,
  valor_reclamado  NUMERIC(14,2),
  valor_aprobado   NUMERIC(14,2),
  estado           TEXT NOT NULL DEFAULT 'reportado'
                   CHECK (estado IN ('reportado','en_estudio','en_pago','cerrado','rechazado')),
  notas            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS siniestros_updated_at ON siniestros;
CREATE TRIGGER siniestros_updated_at
  BEFORE UPDATE ON siniestros
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Amparos del siniestro (coberturas activadas)
CREATE TABLE IF NOT EXISTS siniestro_amparos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  siniestro_id uuid NOT NULL REFERENCES siniestros(id) ON DELETE CASCADE,
  nombre       TEXT NOT NULL,
  valor        NUMERIC(14,2),
  estado       TEXT NOT NULL DEFAULT 'pendiente'
               CHECK (estado IN ('pendiente','aprobado','rechazado')),
  notas        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────────
-- 2. FACTURAS
-- ──────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS facturas_num_seq START 1;

CREATE TABLE IF NOT EXISTS facturas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_factura   INTEGER UNIQUE DEFAULT nextval('facturas_num_seq'),
  tipo             TEXT NOT NULL DEFAULT 'emitida'
                   CHECK (tipo IN ('emitida','recibida')),
  client_id        uuid REFERENCES clientes(id) ON DELETE SET NULL,
  poliza_id        uuid REFERENCES polizas(id)  ON DELETE SET NULL,
  aseguradora      TEXT,
  concepto         TEXT NOT NULL,
  valor_base       NUMERIC(14,2) NOT NULL DEFAULT 0,
  iva              NUMERIC(14,2) NOT NULL DEFAULT 0,
  total            NUMERIC(14,2) NOT NULL DEFAULT 0,
  retencion        NUMERIC(14,2) NOT NULL DEFAULT 0,
  fecha_emision    DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  estado           TEXT NOT NULL DEFAULT 'pendiente'
                   CHECK (estado IN ('pendiente','pagada','vencida','anulada')),
  notas            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS facturas_updated_at ON facturas;
CREATE TRIGGER facturas_updated_at
  BEFORE UPDATE ON facturas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ──────────────────────────────────────────────────────────────────────
-- 3. DILIGENCIAS
-- ──────────────────────────────────────────────────────────────────────
CREATE SEQUENCE IF NOT EXISTS diligencias_num_seq START 1;

CREATE TABLE IF NOT EXISTS diligencias (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_diligencia INTEGER UNIQUE DEFAULT nextval('diligencias_num_seq'),
  client_id         uuid REFERENCES clientes(id) ON DELETE SET NULL,
  poliza_id         uuid REFERENCES polizas(id)  ON DELETE SET NULL,
  tipo              TEXT NOT NULL DEFAULT 'tramite'
                    CHECK (tipo IN ('tramite','certificado','paz_y_salvo','inclusion','exclusion','endoso','otro')),
  descripcion       TEXT NOT NULL,
  asignado_a        TEXT,
  fecha_limite      DATE,
  estado            TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','en_proceso','completada','cancelada')),
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS diligencias_updated_at ON diligencias;
CREATE TRIGGER diligencias_updated_at
  BEFORE UPDATE ON diligencias
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
