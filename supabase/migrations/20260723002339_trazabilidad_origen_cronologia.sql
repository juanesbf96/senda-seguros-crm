-- ============================================================================
-- Trazabilidad: origen de creación de pólizas + registro de cambios (cronología)
-- Fase 0.3 del PLAN_EJECUCION_AUDITORIAS.md
--
-- Motivación: el desastre del import (jul 2026) corrompió pólizas en producción
-- sin dejar rastro de qué registro vino de dónde ni quién/qué lo modificó. La
-- tabla `clientes_historial` existente es poblada por la app, así que se le
-- escapan los cambios hechos por fuera (scripts SQL, rollbacks). Aquí se agrega:
--   1. polizas.origen_creacion  -> de dónde nació cada póliza
--   2. registro_cambios + triggers -> auditoría a nivel de BASE DE DATOS, que
--      captura TODO insert/update/delete sin importar el origen.
-- ============================================================================

-- 1. Origen de creación de pólizas ------------------------------------------
ALTER TABLE public.polizas
  ADD COLUMN IF NOT EXISTS origen_creacion text;

COMMENT ON COLUMN public.polizas.origen_creacion IS
  'De donde nacio la poliza: manual | import_excel | colilla | extractor_pdf | api. NULL en filas historicas (origen desconocido).';

-- Las filas existentes quedan NULL (no sabemos su origen real; no lo inventamos).
-- Las nuevas lo setean explicitamente desde el codigo.

-- 2. Tabla de registro de cambios (cronología) ------------------------------
CREATE TABLE IF NOT EXISTS public.registro_cambios (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  tabla            text NOT NULL,
  registro_id      uuid NOT NULL,
  usuario_id       uuid,                 -- auth.uid(); NULL si el cambio vino de service role / cron
  accion           text NOT NULL CHECK (accion IN ('insert','update','delete')),
  campos_cambiados jsonb,                -- solo en updates: { campo: {"antes":..., "despues":...} }
  created_at       timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.registro_cambios IS
  'Auditoria a nivel de BD (por trigger) de las tablas criticas. Captura todo cambio, incluso los hechos por fuera de la app.';

CREATE INDEX IF NOT EXISTS idx_registro_cambios_lookup
  ON public.registro_cambios (workspace_id, tabla, registro_id, created_at DESC);

-- RLS: los miembros del workspace LEEN su historial. Los inserts los hace el
-- trigger (SECURITY DEFINER), nunca el cliente directamente.
ALTER TABLE public.registro_cambios ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rc_select" ON public.registro_cambios;
CREATE POLICY "rc_select" ON public.registro_cambios
  FOR SELECT USING (public.is_workspace_member(workspace_id));

-- Sin politicas de INSERT/UPDATE/DELETE para el cliente: la tabla es de solo
-- lectura desde la app; solo el trigger escribe (bypasea RLS por SECURITY DEFINER).

-- 3. Funcion de trigger ------------------------------------------------------
CREATE OR REPLACE FUNCTION public.registrar_cambio()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
DECLARE
  v_ws     uuid;
  v_id     uuid;
  v_campos jsonb;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_ws := OLD.workspace_id; v_id := OLD.id;
  ELSIF TG_OP = 'INSERT' THEN
    v_ws := NEW.workspace_id; v_id := NEW.id;
  ELSE  -- UPDATE: capturar solo los campos que realmente cambiaron
    v_ws := NEW.workspace_id; v_id := NEW.id;
    SELECT jsonb_object_agg(o.key, jsonb_build_object('antes', o.value, 'despues', n.value))
      INTO v_campos
    FROM jsonb_each(to_jsonb(OLD)) o
    JOIN jsonb_each(to_jsonb(NEW)) n ON n.key = o.key
    WHERE o.value IS DISTINCT FROM n.value
      AND o.key NOT IN ('updated_at');  -- ignorar timestamp de sistema
    -- Update sin cambios relevantes (p.ej. solo se toco updated_at): no registrar.
    IF v_campos IS NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO public.registro_cambios (workspace_id, tabla, registro_id, usuario_id, accion, campos_cambiados)
  VALUES (v_ws, TG_TABLE_NAME, v_id, auth.uid(), lower(TG_OP), v_campos);

  RETURN COALESCE(NEW, OLD);
END;
$$;

ALTER FUNCTION public.registrar_cambio() OWNER TO postgres;

-- 4. Enganchar el trigger a las 4 tablas criticas ---------------------------
DROP TRIGGER IF EXISTS trg_registro_cambios ON public.polizas;
CREATE TRIGGER trg_registro_cambios
  AFTER INSERT OR UPDATE OR DELETE ON public.polizas
  FOR EACH ROW EXECUTE FUNCTION public.registrar_cambio();

DROP TRIGGER IF EXISTS trg_registro_cambios ON public.clientes;
CREATE TRIGGER trg_registro_cambios
  AFTER INSERT OR UPDATE OR DELETE ON public.clientes
  FOR EACH ROW EXECUTE FUNCTION public.registrar_cambio();

DROP TRIGGER IF EXISTS trg_registro_cambios ON public.cobros;
CREATE TRIGGER trg_registro_cambios
  AFTER INSERT OR UPDATE OR DELETE ON public.cobros
  FOR EACH ROW EXECUTE FUNCTION public.registrar_cambio();

DROP TRIGGER IF EXISTS trg_registro_cambios ON public.liquidaciones;
CREATE TRIGGER trg_registro_cambios
  AFTER INSERT OR UPDATE OR DELETE ON public.liquidaciones
  FOR EACH ROW EXECUTE FUNCTION public.registrar_cambio();
