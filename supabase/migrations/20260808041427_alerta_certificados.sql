-- Alerta de vencimiento de certificados en el cron — cierra la deuda de fase 2.4
--
-- El blocker documentado: `notificaciones_renovacion` (el log de dedup del cron) tenía
-- clave UNIQUE (poliza_id, dias_alerta, fecha_envio) y NINGÚN lugar para el certificado,
-- así que dos certificados de la misma póliza el mismo día chocarían.
--
-- Solución (aditiva y de riesgo mínimo — hay 0 certificados en prod):
--   1. Agregar `tipo` (poliza|certificado) y `certificado_id`.
--   2. Reemplazar la UNIQUE por un índice único sobre COALESCE(certificado_id, poliza_id):
--      las filas de póliza siguen deduplicando por poliza_id; las de certificado por
--      certificado_id. Las filas existentes (todas de póliza, certificado_id NULL)
--      conservan su comportamiento exacto.
--   3. RPC get_certificados_por_vencer, espejo de get_polizas_por_vencer.

-- 1. Columnas nuevas ---------------------------------------------------------
ALTER TABLE public.notificaciones_renovacion
  ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'poliza'
    CHECK (tipo IN ('poliza','certificado')),
  ADD COLUMN IF NOT EXISTS certificado_id uuid REFERENCES public.certificados(id) ON DELETE CASCADE;

-- 2. Dedup: quitar la UNIQUE vieja y crear un índice único sobre la entidad ---
ALTER TABLE public.notificaciones_renovacion
  DROP CONSTRAINT IF EXISTS notificaciones_renovacion_poliza_id_dias_alerta_fecha_envio_key;

CREATE UNIQUE INDEX IF NOT EXISTS notif_renovacion_entidad_uniq
  ON public.notificaciones_renovacion
  (COALESCE(certificado_id, poliza_id), dias_alerta, fecha_envio);

-- 3. Certificados por vencer (mismo shape que get_polizas_por_vencer + datos del cert)
CREATE OR REPLACE FUNCTION public.get_certificados_por_vencer(dias_max integer DEFAULT 30)
  RETURNS TABLE (
    certificado_id     uuid,
    numero_certificado text,
    poliza_id          uuid,
    numero_poliza      text,
    aseguradora        text,
    ramo               text,
    valor              numeric,
    fecha_fin          date,
    dias_restantes     integer,
    cliente_nombre     text,
    workspace_id       uuid,
    workspace_name     text,
    admin_email        text,
    admin_nombre       text
  )
  LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    ce.id               AS certificado_id,
    ce.numero           AS numero_certificado,
    p.id                AS poliza_id,
    p.numero_poliza,
    p.aseguradora,
    p.ramo,
    ce.valor,
    ce.fecha_fin,
    (ce.fecha_fin - CURRENT_DATE)::int AS dias_restantes,
    c.nombre            AS cliente_nombre,
    w.id                AS workspace_id,
    w.name              AS workspace_name,
    au.email            AS admin_email,
    COALESCE(au.raw_user_meta_data->>'nombre', split_part(au.email,'@',1)) AS admin_nombre
  FROM certificados ce
  JOIN polizas p     ON p.id = ce.poliza_id
  JOIN clientes c    ON c.id = p.client_id
  JOIN workspaces w  ON w.id = ce.workspace_id
  JOIN auth.users au ON au.id = w.owner_id
  WHERE
    ce.estado = 'activo'
    AND ce.fecha_fin IS NOT NULL
    AND ce.fecha_fin >= CURRENT_DATE
    AND ce.fecha_fin <= CURRENT_DATE + dias_max
  ORDER BY ce.fecha_fin ASC;
$$;

ALTER FUNCTION public.get_certificados_por_vencer(integer) OWNER TO postgres;
GRANT ALL ON FUNCTION public.get_certificados_por_vencer(integer) TO anon, authenticated, service_role;
