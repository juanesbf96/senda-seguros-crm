-- ══════════════════════════════════════════════════════════════════════
-- Senda Seguros CRM — Migración S2 v2
-- Sprint 2 (rehecho fiel al doc): Solicitudes completo + Pólizas expandido
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────
-- SOLICITUDES: ampliar campos según spec del doc
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE solicitudes
  ADD COLUMN IF NOT EXISTS numero_solicitud INTEGER,
  ADD COLUMN IF NOT EXISTS asignado_a        TEXT,
  ADD COLUMN IF NOT EXISTS ramo              TEXT,
  ADD COLUMN IF NOT EXISTS riesgo            TEXT;

-- Agregar 'cotizacion' e 'inactiva' a los constraints existentes
ALTER TABLE solicitudes DROP CONSTRAINT IF EXISTS solicitudes_tipo_check;
ALTER TABLE solicitudes ADD CONSTRAINT solicitudes_tipo_check
  CHECK (tipo IN (
    'cotizacion','expedicion','endoso','renovacion','cancelacion',
    'certificado','siniestro','inclusion','exclusion','otro'
  ));

ALTER TABLE solicitudes DROP CONSTRAINT IF EXISTS solicitudes_estado_check;
ALTER TABLE solicitudes ADD CONSTRAINT solicitudes_estado_check
  CHECK (estado IN ('nueva','en_proceso','resuelta','cancelada','inactiva'));

-- Secuencia para auto-numerar solicitudes
CREATE SEQUENCE IF NOT EXISTS solicitudes_num_seq START 1;
-- Poblamos numero_solicitud en filas existentes que no lo tengan
UPDATE solicitudes SET numero_solicitud = nextval('solicitudes_num_seq')
  WHERE numero_solicitud IS NULL;
-- Default para nuevas filas
ALTER TABLE solicitudes
  ALTER COLUMN numero_solicitud SET DEFAULT nextval('solicitudes_num_seq');

-- ──────────────────────────────────────────────────────────────────────
-- PÓLIZAS: campos de cumplimiento
-- ──────────────────────────────────────────────────────────────────────
ALTER TABLE polizas
  ADD COLUMN IF NOT EXISTS nombre_tomador         TEXT,
  ADD COLUMN IF NOT EXISTS comision               NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recaudado_oficina      NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recaudado_aseguradora  NUMERIC(14,2) DEFAULT 0;

-- ──────────────────────────────────────────────────────────────────────
-- POLIZA_ANEXOS: tab Anexos
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poliza_anexos (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poliza_id    uuid NOT NULL REFERENCES polizas(id)  ON DELETE CASCADE,
  client_id    uuid          REFERENCES clientes(id) ON DELETE SET NULL,
  numero_anexo TEXT,
  estado       TEXT NOT NULL DEFAULT 'activo'
               CHECK (estado IN ('activo','inactivo','cancelado')),
  documento    TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ──────────────────────────────────────────────────────────────────────
-- POLIZA_VINCULADOS: tab Vinculados
-- ──────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS poliza_vinculados (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poliza_id               uuid NOT NULL REFERENCES polizas(id) ON DELETE CASCADE,
  numero_anexo_pago       TEXT,
  numero_afiliado_objeto  TEXT,
  fecha_inicio            DATE,
  beneficiario            TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
