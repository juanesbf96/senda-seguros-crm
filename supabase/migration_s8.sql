-- ── S8: Metas + Configuración ────────────────────────────────────────────────

-- Metas
CREATE TABLE IF NOT EXISTS metas (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre        TEXT        NOT NULL,
  tipo          TEXT        NOT NULL DEFAULT 'personalizada'
                            CHECK (tipo IN ('prima_total','clientes_nuevos','renovaciones',
                                            'polizas_activas','comisiones','cobros','personalizada')),
  periodo       TEXT        NOT NULL DEFAULT 'mensual'
                            CHECK (periodo IN ('mensual','trimestral','anual','personalizado')),
  valor_meta    NUMERIC(15,2) NOT NULL DEFAULT 0,
  valor_actual  NUMERIC(15,2) NOT NULL DEFAULT 0,
  fecha_inicio  DATE        NOT NULL,
  fecha_fin     DATE        NOT NULL,
  color         TEXT        NOT NULL DEFAULT '#10b981',
  descripcion   TEXT,
  auto_calcular BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Configuración (clave-valor para la agencia)
CREATE TABLE IF NOT EXISTS configuracion (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  clave      TEXT        UNIQUE NOT NULL,
  valor      TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Valores por defecto
INSERT INTO configuracion (clave, valor) VALUES
  ('nombre_agencia',    'Senda Seguros'),
  ('nit',               ''),
  ('ciudad',            'Bogotá'),
  ('departamento',      'Cundinamarca'),
  ('telefono',          ''),
  ('email',             ''),
  ('direccion',         ''),
  ('aseguradoras_lista','Sura,Bolívar,Allianz,Zurich,AXA Colpatria,Positiva,Liberty,Mapfre,Mundial,HDI,Generali,QBE,BBVA Seguros'),
  ('ramos_lista',       'Vida,Salud,Automóviles,SOAT,Hogar,Empresarial,Responsabilidad Civil,Transporte,Incendio,Cumplimiento,Cédula Hipotecaria,Accidentes Personales')
ON CONFLICT (clave) DO NOTHING;

-- Trigger updated_at en metas
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS metas_updated_at ON metas;
CREATE TRIGGER metas_updated_at
  BEFORE UPDATE ON metas
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
