-- ══════════════════════════════════════════════════════════════════════
-- Senda Seguros CRM — Migración S3
-- Sprint 3: Tareas, Gestión de Renovaciones, Remisiones
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════

-- ★ tareas: gestión de pendientes con fecha límite
CREATE TABLE IF NOT EXISTS tareas (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid REFERENCES clientes(id) ON DELETE SET NULL,
  titulo            TEXT NOT NULL,
  descripcion       TEXT,
  fecha_vencimiento DATE,
  completada        BOOLEAN NOT NULL DEFAULT FALSE,
  prioridad         TEXT NOT NULL DEFAULT 'normal'
                    CHECK (prioridad IN ('normal','alta','urgente')),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER tareas_updated_at
  BEFORE UPDATE ON tareas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ★ gestiones_renovacion: seguimiento de contacto por póliza en renovación
CREATE TABLE IF NOT EXISTS gestiones_renovacion (
  id        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  poliza_id uuid NOT NULL REFERENCES polizas(id) ON DELETE CASCADE,
  estado    TEXT NOT NULL
            CHECK (estado IN ('pendiente','contactado','en_negociacion','renovado','no_renueva')),
  notas     TEXT,
  fecha     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ★ remisiones: envíos de solicitudes / documentos a aseguradoras
CREATE TABLE IF NOT EXISTS remisiones (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id    uuid REFERENCES clientes(id) ON DELETE SET NULL,
  poliza_id    uuid REFERENCES polizas(id)  ON DELETE SET NULL,
  aseguradora  TEXT NOT NULL,
  ramo         TEXT NOT NULL,
  descripcion  TEXT,
  estado       TEXT NOT NULL DEFAULT 'borrador'
               CHECK (estado IN ('borrador','enviada','recibida','aprobada','rechazada')),
  fecha        DATE,
  notas        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER remisiones_updated_at
  BEFORE UPDATE ON remisiones
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
