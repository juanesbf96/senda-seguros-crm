-- ══════════════════════════════════════════════════════════════════════
-- Senda Seguros CRM — Migración v2
-- Basado en: Softseguros_Analisis_Sprints_v2.docx (Sección 5)
-- Ejecutar en: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════════════

-- ──────────────────────────────────────────────────────────────────────
-- SECCIÓN 5.1 — ALTER TABLE (tablas existentes)
-- ──────────────────────────────────────────────────────────────────────

-- ★ clientes: tipo de cliente + campos adicionales por tipo
ALTER TABLE clientes
  ADD COLUMN IF NOT EXISTS tipo_cliente    TEXT NOT NULL DEFAULT 'persona_natural'
                                           CHECK (tipo_cliente IN ('persona_natural','empresa','consorcio')),
  ADD COLUMN IF NOT EXISTS razon_social    TEXT,
  ADD COLUMN IF NOT EXISTS sobrenombre     TEXT,
  ADD COLUMN IF NOT EXISTS nit             TEXT,
  ADD COLUMN IF NOT EXISTS fecha_constitucion DATE,
  ADD COLUMN IF NOT EXISTS fecha_nacimiento   DATE;

-- ★ polizas: tipo de póliza, riesgo y eliminación lógica
ALTER TABLE polizas
  ADD COLUMN IF NOT EXISTS tipo_poliza      TEXT,
  ADD COLUMN IF NOT EXISTS riesgo           TEXT,
  ADD COLUMN IF NOT EXISTS eliminada        BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS fecha_eliminacion TIMESTAMPTZ;

-- ★ actividades: sin cambios por ahora


-- ──────────────────────────────────────────────────────────────────────
-- SECCIÓN 5.2 — CREATE TABLE (tablas nuevas)
-- ──────────────────────────────────────────────────────────────────────

-- ── contactos ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS contactos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id        UUID NOT NULL REFERENCES clientes(id) ON DELETE CASCADE,
  nombre           TEXT NOT NULL,
  tipo_documento   TEXT,
  numero_documento TEXT,
  cargo            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_contactos_client_id ON contactos(client_id);

-- ── solicitudes ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS solicitudes (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_solicitud TEXT,
  client_id        UUID REFERENCES clientes(id) ON DELETE SET NULL,
  tipo             TEXT NOT NULL DEFAULT 'cotizacion'
                   CHECK (tipo IN ('cotizacion','expedicion')),
  estado           TEXT NOT NULL DEFAULT 'activa',
  observaciones    TEXT,
  asignado_a       TEXT,
  ramo             TEXT,
  riesgo           TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_solicitudes_client_id  ON solicitudes(client_id);
CREATE INDEX IF NOT EXISTS idx_solicitudes_tipo       ON solicitudes(tipo);
CREATE INDEX IF NOT EXISTS idx_solicitudes_estado     ON solicitudes(estado);

-- ── tareas ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tareas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT NOT NULL,
  tipo_tarea       TEXT,
  client_id        UUID REFERENCES clientes(id) ON DELETE SET NULL,
  poliza_id        UUID REFERENCES polizas(id) ON DELETE SET NULL,
  asignado_a       TEXT,
  fecha_vencimiento DATE,
  completada       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_tareas_client_id       ON tareas(client_id);
CREATE INDEX IF NOT EXISTS idx_tareas_poliza_id       ON tareas(poliza_id);
CREATE INDEX IF NOT EXISTS idx_tareas_fecha_vencimiento ON tareas(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_tareas_completada      ON tareas(completada);

-- ── cobros ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS cobros (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poliza_id             UUID REFERENCES polizas(id) ON DELETE SET NULL,
  cuota                 INTEGER,
  anexo                 TEXT,
  valor_neto            NUMERIC(15,2) DEFAULT 0,
  prima_neta            NUMERIC(15,2) DEFAULT 0,
  prima_total           NUMERIC(15,2) DEFAULT 0,
  valor_a_pagar         NUMERIC(15,2) DEFAULT 0,
  saldo_pendiente       NUMERIC(15,2) DEFAULT 0,
  pagado_oficina        NUMERIC(15,2) DEFAULT 0,
  pagado_aseguradora    NUMERIC(15,2) DEFAULT 0,
  dias_vencidos         INTEGER DEFAULT 0,
  fecha_pago            DATE,
  compromiso_pago       DATE,
  vendedor              TEXT,
  comision_vendedor     NUMERIC(15,2) DEFAULT 0,
  estado                TEXT NOT NULL DEFAULT 'por_cobrar'
                        CHECK (estado IN ('por_cobrar','por_pagar','comision_por_cobrar','comision_recibida')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_cobros_poliza_id ON cobros(poliza_id);
CREATE INDEX IF NOT EXISTS idx_cobros_estado    ON cobros(estado);
CREATE INDEX IF NOT EXISTS idx_cobros_fecha_pago ON cobros(fecha_pago);

-- ── recibos ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recibos (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cobro_id         UUID REFERENCES cobros(id) ON DELETE SET NULL,
  tipo             TEXT NOT NULL DEFAULT 'activo'
                   CHECK (tipo IN ('anticipo','activo','pago_directo','anulado')),
  valor_recaudado  NUMERIC(15,2) DEFAULT 0,
  fecha            DATE,
  forma_pago       TEXT,
  usuario          TEXT,
  observacion      TEXT,
  anulado_por      TEXT,
  fecha_anulacion  TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recibos_cobro_id ON recibos(cobro_id);
CREATE INDEX IF NOT EXISTS idx_recibos_tipo     ON recibos(tipo);

-- ── siniestros ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS siniestros (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  poliza_id                  UUID REFERENCES polizas(id) ON DELETE SET NULL,
  numero_siniestro           TEXT,
  numero_siniestro_compania  TEXT,
  tipo_siniestro             TEXT NOT NULL,
  fecha_siniestro            DATE,
  fecha_aviso                DATE,
  fecha_notificacion         DATE,
  responsable                TEXT NOT NULL,
  proveedor_asignado         TEXT,
  descripcion                TEXT,
  valor_indemnizacion        NUMERIC(15,2) DEFAULT 0,
  deducible                  NUMERIC(15,2) DEFAULT 0,
  monto_reclamo              NUMERIC(15,2) DEFAULT 0,
  coaseguros                 NUMERIC(15,2) DEFAULT 0,
  estado                     TEXT NOT NULL DEFAULT 'en_proceso'
                             CHECK (estado IN ('en_proceso','objetado','pagado','solicitado')),
  finalizado                 BOOLEAN NOT NULL DEFAULT FALSE,
  fecha_finalizacion         DATE,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_siniestros_poliza_id ON siniestros(poliza_id);
CREATE INDEX IF NOT EXISTS idx_siniestros_estado    ON siniestros(estado);

-- ── amparos_siniestro ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS amparos_siniestro (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  siniestro_id      UUID NOT NULL REFERENCES siniestros(id) ON DELETE CASCADE,
  nombre_reclamante TEXT NOT NULL,
  amparo            TEXT NOT NULL,
  valor             NUMERIC(15,2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_amparos_siniestro_id ON amparos_siniestro(siniestro_id);

-- ── facturas ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS facturas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_factura    INTEGER,
  fecha_expedicion  DATE NOT NULL,
  fecha_corte       DATE NOT NULL,
  aseguradora       TEXT,
  concepto          TEXT DEFAULT 'Comisión',
  comision_gravada  NUMERIC(15,2) DEFAULT 0,
  comision_no_gravada NUMERIC(15,2) DEFAULT 0,
  pct_iva           NUMERIC(8,4)  DEFAULT 19.0000,
  iva               NUMERIC(15,2) DEFAULT 0,
  pct_ret_iva       NUMERIC(8,4)  DEFAULT 15.0000,
  ret_iva           NUMERIC(15,2) DEFAULT 0,
  pct_ret_ica       NUMERIC(8,4)  DEFAULT 0.0000,
  ret_ica           NUMERIC(15,2) DEFAULT 0,
  pct_ret_fuente    NUMERIC(8,4)  DEFAULT 11.0000,
  ret_fuente        NUMERIC(15,2) DEFAULT 0,
  otros             NUMERIC(15,2) DEFAULT 0,
  gran_total        NUMERIC(15,2) DEFAULT 0,
  observaciones     TEXT,
  estado            TEXT NOT NULL DEFAULT 'borrador'
                    CHECK (estado IN ('por_cobrar','recibida','anulada','borrador','nota_credito','nota_debito')),
  sede              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_facturas_estado          ON facturas(estado);
CREATE INDEX IF NOT EXISTS idx_facturas_fecha_expedicion ON facturas(fecha_expedicion);

-- ── diligencias ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diligencias (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_diligencia INTEGER NOT NULL,
  mensajero         TEXT NOT NULL,
  fecha             DATE NOT NULL,
  asunto            TEXT NOT NULL,
  estado            TEXT NOT NULL DEFAULT 'pendiente'
                    CHECK (estado IN ('pendiente','terminada')),
  sede              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diligencias_estado ON diligencias(estado);
CREATE INDEX IF NOT EXISTS idx_diligencias_fecha  ON diligencias(fecha);

-- ── diligencia_tareas ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diligencia_tareas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  diligencia_id   UUID NOT NULL REFERENCES diligencias(id) ON DELETE CASCADE,
  contacto        TEXT,
  telefono        TEXT,
  direccion       TEXT NOT NULL,
  hora            TIME NOT NULL,
  descripcion     TEXT NOT NULL,
  completada      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diligencia_tareas_diligencia_id ON diligencia_tareas(diligencia_id);

-- ── archivos ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS archivos (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre       TEXT NOT NULL,
  tipo_archivo TEXT,
  entidad_tipo TEXT,   -- 'cliente' | 'poliza' | 'siniestro' | 'factura' | etc.
  entidad_id   UUID,
  url          TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_archivos_entidad ON archivos(entidad_tipo, entidad_id);

-- ── prospectos ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prospectos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_negocio  TEXT,
  nombre_negocio  TEXT NOT NULL,
  client_id       UUID REFERENCES clientes(id) ON DELETE SET NULL,
  vendedor        TEXT,
  ramo            TEXT,
  riesgo          TEXT,
  monto           NUMERIC(15,2) DEFAULT 0,
  estado_pipeline TEXT NOT NULL DEFAULT 'no_gestionado'
                  CHECK (estado_pipeline IN ('no_gestionado','contactado','cotizacion_enviada','pendiente_por_cerrar','vendido','perdido')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_prospectos_client_id      ON prospectos(client_id);
CREATE INDEX IF NOT EXISTS idx_prospectos_estado_pipeline ON prospectos(estado_pipeline);

-- ── metas ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS metas (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre           TEXT NOT NULL,
  tipo             TEXT NOT NULL DEFAULT 'nuevas'
                   CHECK (tipo IN ('nuevas','renovadas')),
  meta_prima_total NUMERIC(15,2) DEFAULT 0,
  fecha_inicio     DATE NOT NULL,
  fecha_fin        DATE NOT NULL,
  estado           TEXT NOT NULL DEFAULT 'activa',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── dashboards_custom ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS dashboards_custom (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  config_json JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ══════════════════════════════════════════════════════════════════════
-- FIN DE MIGRACIÓN v2
-- Total: 3 ALTER TABLE + 14 CREATE TABLE
-- ══════════════════════════════════════════════════════════════════════
