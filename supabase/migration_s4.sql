-- ══════════════════════════════════════════════════════════════════════
-- Senda Seguros CRM — Migración S4
-- Sprint 4: Cobros, Recibos, Cuadre de caja
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════

-- ★ cobros: cuentas por cobrar a clientes
CREATE TABLE IF NOT EXISTS cobros (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id         uuid REFERENCES clientes(id) ON DELETE SET NULL,
  poliza_id         uuid REFERENCES polizas(id)  ON DELETE SET NULL,
  concepto          TEXT NOT NULL,
  valor             NUMERIC(14,2) NOT NULL,
  fecha_vencimiento DATE,
  estado            TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','pagado','vencido','anulado')),
  notas             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE OR REPLACE TRIGGER cobros_updated_at
  BEFORE UPDATE ON cobros
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ★ recibos: pagos efectivamente recibidos
CREATE TABLE IF NOT EXISTS recibos (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id      uuid REFERENCES clientes(id) ON DELETE SET NULL,
  cobro_id       uuid REFERENCES cobros(id)   ON DELETE SET NULL,
  numero_recibo  TEXT,
  concepto       TEXT NOT NULL,
  valor          NUMERIC(14,2) NOT NULL,
  fecha_pago     DATE NOT NULL DEFAULT CURRENT_DATE,
  forma_pago     TEXT NOT NULL DEFAULT 'efectivo'
                 CHECK (forma_pago IN ('efectivo','transferencia','cheque','tarjeta','consignacion')),
  banco          TEXT,
  referencia     TEXT,
  notas          TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
