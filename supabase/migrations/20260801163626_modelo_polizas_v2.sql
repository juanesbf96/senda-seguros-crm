-- ============================================================================
-- Modelo de pólizas v2 — Fase 2 (paridad de modelo de datos)
--
-- Solo SCHEMA. La UI que lo consume va en un PR aparte (PR-08).
-- Contenido:
--   2.1  polizas.tecnico_id            — quien gestiona ≠ quien vendió
--   2.3  tabla coberturas              — amparos por póliza
--   2.4  tabla certificados            — para cumplimiento y colectivas
--   2.5  campos financieros finos + numero_poliza_recortado (matching)
--
-- NO incluye 2.2 (asegurados) porque `poliza_afiliados` YA tiene la forma
-- requerida (poliza_id, cliente_id nullable, nombre, documento, parentesco).
-- Generalizarlo a pólizas no-colectivas es un cambio de UI (el gate
-- `poliza.es_colectiva &&` en PolizaDetalle), no de schema → va en PR-08.
-- NO incluye 2.6 (ramos_aseguradora) → PR-09.
-- ============================================================================


-- ── 2.1 Técnico asignado ────────────────────────────────────────────────────
-- El plan decía "REFERENCES workspace_members", pero la convención del schema
-- para referencias a personas es auth.users (ver clientes.assigned_to,
-- polizas.created_by). Se sigue la convención: un técnico es un usuario, y la
-- membresía puede cambiar sin que la póliza pierda su histórico.
ALTER TABLE public.polizas
  ADD COLUMN IF NOT EXISTS tecnico_id uuid;

DO $$ BEGIN
  ALTER TABLE public.polizas
    ADD CONSTRAINT polizas_tecnico_id_fkey
    FOREIGN KEY (tecnico_id) REFERENCES auth.users(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN public.polizas.tecnico_id IS
  'Usuario que GESTIONA la poliza (tecnico). Distinto de vendedor_id, que es quien la vendio.';

CREATE INDEX IF NOT EXISTS idx_polizas_tecnico
  ON public.polizas (workspace_id, tecnico_id);


-- ── 2.5a Campos financieros finos ───────────────────────────────────────────
-- numeric(7,2) para porcentajes: mismo tipo que dejó migration_fix_porcentajes_decimal.
ALTER TABLE public.polizas
  ADD COLUMN IF NOT EXISTS pct_sobrecomision  numeric(7,2),
  ADD COLUMN IF NOT EXISTS pct_retorno        numeric(7,2),
  ADD COLUMN IF NOT EXISTS gastos_expedicion  numeric(15,2),
  ADD COLUMN IF NOT EXISTS iva_caratula       boolean,
  ADD COLUMN IF NOT EXISTS tasa_runt          numeric(15,2);

COMMENT ON COLUMN public.polizas.iva_caratula IS
  'Si la caratula de la poliza discrimina IVA. NULL = desconocido (filas historicas).';


-- ── 2.5b Número de póliza normalizado (para matching) ───────────────────────
-- POR QUÉ: la conciliación de colillas y el import fallan al comparar números
-- entre formatos de aseguradora. Verificado contra datos reales de producción:
-- la colilla de AXA trae '000000108969' y la BD guarda '108969' → el match
-- exacto falla. Los números reales NO traen guiones/slashes/espacios (0 de 400
-- revisados), así que el problema NO son "prefijos de sucursal" sino los CEROS
-- A LA IZQUIERDA (y, en colillas de Allianz, un sufijo '/N' de renovación que
-- el parser ya recorta).
--
-- Regla: mayúsculas → quitar todo lo no alfanumérico → quitar ceros a la izq.
-- Verificado sobre 1.000 pólizas de producción: 0 colisiones (ningún par de
-- números distintos colapsa al mismo valor normalizado dentro de un workspace).
CREATE OR REPLACE FUNCTION public.normalizar_numero_poliza(p_numero text)
  RETURNS text
  LANGUAGE sql
  IMMUTABLE
  PARALLEL SAFE
AS $$
  SELECT CASE
    WHEN p_numero IS NULL OR btrim(p_numero) = '' THEN NULL
    -- si todo eran ceros, conservar '0' en vez de cadena vacía
    ELSE COALESCE(
      NULLIF(ltrim(regexp_replace(upper(p_numero), '[^A-Z0-9]', '', 'g'), '0'), ''),
      '0'
    )
  END
$$;

COMMENT ON FUNCTION public.normalizar_numero_poliza(text) IS
  'Normaliza un numero de poliza para matching: mayusculas, sin separadores, sin ceros a la izquierda. IMMUTABLE para poder usarse en columnas generadas e indices.';

-- Columna GENERADA (no trigger, como sugería el plan): no se puede desincronizar
-- ni saltar con un update directo, y Postgres la mantiene sola.
ALTER TABLE public.polizas
  ADD COLUMN IF NOT EXISTS numero_poliza_recortado text
  GENERATED ALWAYS AS (public.normalizar_numero_poliza(numero_poliza)) STORED;

COMMENT ON COLUMN public.polizas.numero_poliza_recortado IS
  'Derivada de numero_poliza via normalizar_numero_poliza(). Usar como fallback de matching en conciliacion de colillas e import.';

-- NO único: dos aseguradoras distintas pueden usar el mismo número.
CREATE INDEX IF NOT EXISTS idx_polizas_numero_recortado
  ON public.polizas (workspace_id, numero_poliza_recortado)
  WHERE numero_poliza_recortado IS NOT NULL;


-- ── 2.3 Coberturas (amparos) por póliza ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.coberturas (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  poliza_id        uuid NOT NULL REFERENCES public.polizas(id)    ON DELETE CASCADE,
  nombre           text NOT NULL,
  valor_asegurado  numeric(15,2),
  deducible        numeric(15,2),
  valor_prima      numeric(15,2),
  valor_extraprima numeric(15,2),
  orden            integer NOT NULL DEFAULT 0,   -- para ordenar en la UI
  created_by       uuid REFERENCES auth.users(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.coberturas IS
  'Amparos/coberturas de una poliza. El extractor PDF (fase 4) la poblara automaticamente.';

CREATE INDEX IF NOT EXISTS idx_coberturas_poliza
  ON public.coberturas (workspace_id, poliza_id, orden);


-- ── 2.4 Certificados (cumplimiento y colectivas) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.certificados (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  poliza_id     uuid NOT NULL REFERENCES public.polizas(id)    ON DELETE CASCADE,
  numero        text,
  fecha_inicio  date,
  fecha_fin     date,
  valor         numeric(15,2),
  estado        text NOT NULL DEFAULT 'activo'
                CHECK (estado IN ('activo','vencido','cancelado')),
  notas         text,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.certificados IS
  'Certificados de una poliza (cumplimiento/colectivas). Su fecha_fin debe considerarse en las alertas de renovacion ademas de la de la poliza.';

CREATE INDEX IF NOT EXISTS idx_certificados_poliza
  ON public.certificados (workspace_id, poliza_id);

-- Índice pensado para el cron de renovaciones (PR-08): buscar certificados
-- activos por vencer sin escanear la tabla.
CREATE INDEX IF NOT EXISTS idx_certificados_vencimiento
  ON public.certificados (workspace_id, fecha_fin)
  WHERE estado = 'activo';


-- ── updated_at automático (set_updated_at ya existe en el schema) ────────────
DROP TRIGGER IF EXISTS coberturas_updated_at ON public.coberturas;
CREATE TRIGGER coberturas_updated_at
  BEFORE UPDATE ON public.coberturas
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS certificados_updated_at ON public.certificados;
CREATE TRIGGER certificados_updated_at
  BEFORE UPDATE ON public.certificados
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Lectura: cualquier miembro del workspace (igual que poliza_afiliados).
-- Escritura: atada al permiso de editar pólizas — una cobertura/certificado es
-- parte de la póliza, así que quien no puede editarla tampoco debería poder
-- alterar sus amparos. Coherente con la ola 1 de RLS (has_permission).
ALTER TABLE public.coberturas   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.certificados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coberturas_select" ON public.coberturas;
CREATE POLICY "coberturas_select" ON public.coberturas
  FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "coberturas_insert" ON public.coberturas;
CREATE POLICY "coberturas_insert" ON public.coberturas
  FOR INSERT WITH CHECK (public.has_permission(workspace_id, 'polizas_editar'));

DROP POLICY IF EXISTS "coberturas_update" ON public.coberturas;
CREATE POLICY "coberturas_update" ON public.coberturas
  FOR UPDATE USING (public.has_permission(workspace_id, 'polizas_editar'));

DROP POLICY IF EXISTS "coberturas_delete" ON public.coberturas;
CREATE POLICY "coberturas_delete" ON public.coberturas
  FOR DELETE USING (public.has_permission(workspace_id, 'polizas_editar'));

DROP POLICY IF EXISTS "certificados_select" ON public.certificados;
CREATE POLICY "certificados_select" ON public.certificados
  FOR SELECT USING (public.is_workspace_member(workspace_id));

DROP POLICY IF EXISTS "certificados_insert" ON public.certificados;
CREATE POLICY "certificados_insert" ON public.certificados
  FOR INSERT WITH CHECK (public.has_permission(workspace_id, 'polizas_editar'));

DROP POLICY IF EXISTS "certificados_update" ON public.certificados;
CREATE POLICY "certificados_update" ON public.certificados
  FOR UPDATE USING (public.has_permission(workspace_id, 'polizas_editar'));

DROP POLICY IF EXISTS "certificados_delete" ON public.certificados;
CREATE POLICY "certificados_delete" ON public.certificados
  FOR DELETE USING (public.has_permission(workspace_id, 'polizas_editar'));


-- ============================================================================
-- VERIFICACIÓN SUGERIDA EN STAGING (esta migración NO se probó en staging;
-- esta máquina no tiene el CLI/entorno — la valida el equipo que sí lo tiene)
--
-- 1) La normalización resuelve el caso real de AXA:
--    SELECT public.normalizar_numero_poliza('000000108969');   -- → '108969'
--    SELECT public.normalizar_numero_poliza('23475157/0');     -- → '234751570'
--    SELECT public.normalizar_numero_poliza(NULL);             -- → NULL
--    SELECT public.normalizar_numero_poliza('000');            -- → '0'
--
-- 2) La columna generada se llena sola y no se puede escribir a mano:
--    INSERT INTO polizas (...) VALUES (... '000000108969' ...);
--    SELECT numero_poliza, numero_poliza_recortado FROM polizas WHERE ...;
--    UPDATE polizas SET numero_poliza_recortado = 'x';  -- debe FALLAR
--
-- 3) Sin colisiones tras backfill (debe devolver 0 filas):
--    SELECT workspace_id, numero_poliza_recortado, count(DISTINCT numero_poliza)
--    FROM polizas WHERE numero_poliza_recortado IS NOT NULL
--    GROUP BY 1,2 HAVING count(DISTINCT numero_poliza) > 1;
--
-- 4) RLS: un usuario con polizas_editar=false NO puede insertar una cobertura
--    de su workspace, pero SÍ puede leerlas.
-- ============================================================================
