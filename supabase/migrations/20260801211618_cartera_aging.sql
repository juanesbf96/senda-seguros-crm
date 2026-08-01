-- Aging de cartera (buckets de mora) — Fase 1.2 del PLAN_EJECUCION_AUDITORIAS.md
--
-- Agrupa la cartera por cobrar pendiente en buckets según los días vencidos,
-- calculados EN VIVO como current_date - compromiso_pago (no se usa la columna
-- dias_vencidos, que puede quedar obsoleta desde la importación).
--
-- Notas de esquema (post-reconciliación de cobros):
--   * El monto de cartera es `saldo_pendiente` (lo que aún se debe), no prima_total.
--   * El estado de pago es DERIVADO: un cobro está pendiente si saldo_pendiente > 0
--     y fecha_pago IS NULL.
--   * "Cartera por cobrar" = cobros de tipo 'por_cobrar' (lo que el cliente debe).
--   * `compromiso_pago` puede ser NULL (cobro sin fecha pactada) → bucket 'sin_fecha'.
--
-- Devuelve una fila por (bucket, aseguradora) con cantidad (#) y total ($ saldo),
-- para que el frontend pueda mostrar el total por bucket y el desglose por aseguradora.

CREATE OR REPLACE FUNCTION public.get_cartera_aging(p_workspace_id uuid)
  RETURNS TABLE (
    bucket      text,
    orden       int,
    aseguradora text,
    cantidad    bigint,
    total       numeric
  )
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    b.bucket,
    b.orden,
    COALESCE(NULLIF(btrim(b.aseguradora), ''), 'Sin aseguradora') AS aseguradora,
    COUNT(*)                             AS cantidad,
    COALESCE(SUM(b.saldo_pendiente), 0)  AS total
  FROM (
    SELECT
      aseguradora,
      COALESCE(saldo_pendiente, 0) AS saldo_pendiente,
      CASE
        WHEN compromiso_pago IS NULL                              THEN 'sin_fecha'
        WHEN compromiso_pago >= current_date                     THEN 'por_vencer'
        WHEN current_date - compromiso_pago BETWEEN 1  AND 30     THEN 'd1_30'
        WHEN current_date - compromiso_pago BETWEEN 31 AND 60     THEN 'd31_60'
        WHEN current_date - compromiso_pago BETWEEN 61 AND 90     THEN 'd61_90'
        ELSE 'd90_mas'
      END AS bucket,
      CASE
        WHEN compromiso_pago IS NULL                              THEN 5
        WHEN compromiso_pago >= current_date                     THEN 0
        WHEN current_date - compromiso_pago BETWEEN 1  AND 30     THEN 1
        WHEN current_date - compromiso_pago BETWEEN 31 AND 60     THEN 2
        WHEN current_date - compromiso_pago BETWEEN 61 AND 90     THEN 3
        ELSE 4
      END AS orden
    FROM cobros
    WHERE workspace_id = p_workspace_id
      AND tipo = 'por_cobrar'
      AND COALESCE(saldo_pendiente, 0) > 0
      AND fecha_pago IS NULL
  ) b
  WHERE is_workspace_member(p_workspace_id)
  GROUP BY b.bucket, b.orden, 3
  ORDER BY b.orden, total DESC;
$$;

ALTER FUNCTION public.get_cartera_aging(uuid) OWNER TO postgres;

GRANT EXECUTE ON FUNCTION public.get_cartera_aging(uuid) TO anon, authenticated, service_role;
