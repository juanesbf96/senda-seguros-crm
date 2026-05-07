-- ══════════════════════════════════════════════════════════════════════
-- Senda Seguros CRM — Sprint A
-- Clientes + Pólizas + Vendedores: campos obligatorios + RLS fixes
-- ══════════════════════════════════════════════════════════════════════

-- ── 1. CLIENTES ──────────────────────────────────────────────────────
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS genero                TEXT,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento_cedula DATE,
  ADD COLUMN IF NOT EXISTS estado_civil          TEXT,
  ADD COLUMN IF NOT EXISTS tiene_vehiculo        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS tiene_hijos           BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS num_hijos             INTEGER,
  ADD COLUMN IF NOT EXISTS ocupacion             TEXT,
  ADD COLUMN IF NOT EXISTS empresa_trabajo       TEXT,
  ADD COLUMN IF NOT EXISTS ingresos_aprox        NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS categoria             TEXT,
  ADD COLUMN IF NOT EXISTS autoriza_datos        BOOLEAN NOT NULL DEFAULT FALSE;

-- ── 2. PÓLIZAS ───────────────────────────────────────────────────────
ALTER TABLE polizas
  -- Tipo de modalidad
  ADD COLUMN IF NOT EXISTS tipo_modalidad            TEXT CHECK (tipo_modalidad IN ('individual','colectiva','agrupadora')),
  -- Fechas
  ADD COLUMN IF NOT EXISTS fecha_expedicion          DATE,
  ADD COLUMN IF NOT EXISTS fecha_recepcion           DATE,
  -- Roles
  ADD COLUMN IF NOT EXISTS asegurado_nombre          TEXT,
  ADD COLUMN IF NOT EXISTS asegurado_documento       TEXT,
  ADD COLUMN IF NOT EXISTS beneficiario_nombre       TEXT,
  ADD COLUMN IF NOT EXISTS beneficiario_documento    TEXT,
  ADD COLUMN IF NOT EXISTS beneficiario_oneroso      BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS beneficiario_en_remision  BOOLEAN NOT NULL DEFAULT FALSE,
  -- Prima y comisiones
  ADD COLUMN IF NOT EXISTS prima_neta                NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS porcentaje_iva            NUMERIC(5,2) DEFAULT 19,
  ADD COLUMN IF NOT EXISTS iva                       NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS gastos                    NUMERIC(14,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS porcentaje_comision_agencia NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS comision_agencia          NUMERIC(14,2),
  ADD COLUMN IF NOT EXISTS total_prima               NUMERIC(14,2),
  -- Vendedor en póliza
  ADD COLUMN IF NOT EXISTS vendedor_id               UUID REFERENCES vendedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS porcentaje_comision_vendedor NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS retencion_vendedor        NUMERIC(5,2) DEFAULT 10,
  ADD COLUMN IF NOT EXISTS comision_vendedor         NUMERIC(14,2),
  -- Pagos
  ADD COLUMN IF NOT EXISTS periodicidad_pago         TEXT,
  ADD COLUMN IF NOT EXISTS forma_pago                TEXT,
  ADD COLUMN IF NOT EXISTS medio_pago                TEXT,
  ADD COLUMN IF NOT EXISTS banco_pago                TEXT,
  -- Valor asegurado (ya existe riesgo, añadimos valor)
  ADD COLUMN IF NOT EXISTS valor_asegurado           NUMERIC(14,2);

-- ── 3. VENDEDORES ────────────────────────────────────────────────────
ALTER TABLE vendedores
  ADD COLUMN IF NOT EXISTS banco              TEXT,
  ADD COLUMN IF NOT EXISTS numero_cuenta      TEXT,
  ADD COLUMN IF NOT EXISTS tipo_cuenta        TEXT,
  ADD COLUMN IF NOT EXISTS comisiones_por_anio JSONB NOT NULL DEFAULT '[]';

-- ── 4. RLS — políticas para usuario autenticado ───────────────────────
-- (habilita si las tablas tienen RLS activo y dan "row-level security" errors)

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['clientes','polizas','poliza_anexos','poliza_vinculados',
    'actividades','tareas','cobros','recibos','solicitudes','remisiones','vendedores',
    'liquidaciones','prospectos','prospecto_actividades','agenda_eventos','archivos',
    'siniestros','siniestro_amparos','facturas','diligencias','metas','configuracion']
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'DO $inner$ BEGIN
         IF NOT EXISTS (
           SELECT 1 FROM pg_policies WHERE tablename = %L AND policyname = %L
         ) THEN
           EXECUTE %L;
         END IF;
       END $inner$',
      t,
      t || '_auth_all',
      format('CREATE POLICY "%s_auth_all" ON %I FOR ALL TO authenticated USING (true) WITH CHECK (true)', t, t)
    );
  END LOOP;
END $$;
