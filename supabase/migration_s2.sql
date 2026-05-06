-- ══════════════════════════════════════════════════════════════════════
-- Senda Seguros CRM — Migración S2
-- Sprint 2: Solicitudes
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════

-- ★ solicitudes: gestión de solicitudes de servicio
CREATE TABLE IF NOT EXISTS solicitudes (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clientes(id) ON DELETE SET NULL,
  poliza_id       uuid REFERENCES polizas(id)  ON DELETE SET NULL,
  tipo            TEXT NOT NULL
                  CHECK (tipo IN (
                    'expedicion','renovacion','endoso','cancelacion',
                    'certificado','siniestro','inclusion','exclusion','otro'
                  )),
  estado          TEXT NOT NULL DEFAULT 'nueva'
                  CHECK (estado IN ('nueva','en_proceso','resuelta','cancelada')),
  prioridad       TEXT NOT NULL DEFAULT 'normal'
                  CHECK (prioridad IN ('normal','urgente')),
  descripcion     TEXT,
  fecha_limite    DATE,
  notas           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Trigger updated_at para solicitudes
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER solicitudes_updated_at
  BEFORE UPDATE ON solicitudes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
