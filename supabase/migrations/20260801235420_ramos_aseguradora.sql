-- Catálogo ramos-por-aseguradora — Fase 2.6 del PLAN_EJECUCION_AUDITORIAS.md
--
-- Formaliza qué ramos maneja cada aseguradora (la matriz de disponibilidad que
-- la agencia tenía en Excel), con espacio para el % de comisión por defecto que
-- el plan pedía (nullable — se llena después; el import/PolizaModal podrán leerlo).
--
-- `disponible`: si | no | condicionado (algunas aseguradoras aceptan el ramo solo
-- con condiciones — "solo privados", "mínimo 3", "solo zonas comunes", etc., que
-- quedan en `nota`).

CREATE TABLE IF NOT EXISTS public.ramos_aseguradora (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  aseguradora          text NOT NULL,
  ramo                 text NOT NULL,
  disponible           text NOT NULL DEFAULT 'si'
                         CHECK (disponible IN ('si','no','condicionado')),
  nota                 text,
  pct_comision_default numeric(5,2),
  activo               boolean NOT NULL DEFAULT true,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ramos_aseguradora_uniq UNIQUE (workspace_id, aseguradora, ramo)
);

COMMENT ON TABLE public.ramos_aseguradora IS
  'Catalogo de disponibilidad ramo-por-aseguradora (fase 2.6). disponible: si|no|condicionado; pct_comision_default nullable para uso futuro.';

CREATE INDEX IF NOT EXISTS idx_ramos_aseguradora_ws
  ON public.ramos_aseguradora (workspace_id, aseguradora);

ALTER TABLE public.ramos_aseguradora ENABLE ROW LEVEL SECURITY;

-- Lectura: cualquier miembro del workspace (es un catálogo de referencia).
DROP POLICY IF EXISTS "ramos_aseg_select" ON public.ramos_aseguradora;
CREATE POLICY "ramos_aseg_select" ON public.ramos_aseguradora
  FOR SELECT USING (public.is_workspace_member(workspace_id));

-- Escritura: solo admin (se gestiona desde Configuración).
DROP POLICY IF EXISTS "ramos_aseg_insert" ON public.ramos_aseguradora;
CREATE POLICY "ramos_aseg_insert" ON public.ramos_aseguradora
  FOR INSERT WITH CHECK (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "ramos_aseg_update" ON public.ramos_aseguradora;
CREATE POLICY "ramos_aseg_update" ON public.ramos_aseguradora
  FOR UPDATE USING (public.is_workspace_admin(workspace_id));

DROP POLICY IF EXISTS "ramos_aseg_delete" ON public.ramos_aseguradora;
CREATE POLICY "ramos_aseg_delete" ON public.ramos_aseguradora
  FOR DELETE USING (public.is_workspace_admin(workspace_id));
