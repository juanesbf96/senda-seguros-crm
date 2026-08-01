-- Registrar un pago (recibo) contra un cobro, de forma atómica.
--
-- Contexto: el estado de pago de un cobro es DERIVADO de saldo_pendiente +
-- compromiso_pago + fecha_pago (no hay columna de estado de pago). Antes, el
-- frontend marcaba el cobro con estado='pagado', valor inválido para el CHECK
-- de `cobros.estado` (que guarda la categoría: por_cobrar, por_pagar, ...).
--
-- Esta función descuenta lo efectivamente recaudado del saldo, lo que cubre
-- tanto el pago total como el parcial sin tener que decidir entre ambos:
--   * recaudado >= saldo  -> saldo 0 y fecha_pago = fecha del recibo  (pagado)
--   * recaudado <  saldo  -> saldo disminuye, sin fecha_pago          (pendiente)
--
-- Es SECURITY DEFINER para poder escribir de forma atómica, pero valida
-- explícitamente que quien llama sea miembro del workspace del cobro.

CREATE OR REPLACE FUNCTION "public"."registrar_pago_cobro"(
  "p_cobro_id" "uuid",
  "p_valor"    numeric,
  "p_fecha"    "date" DEFAULT CURRENT_DATE
) RETURNS TABLE("saldo_pendiente" numeric, "fecha_pago" "date")
LANGUAGE "plpgsql" SECURITY DEFINER
SET "search_path" = "public"
AS $$
DECLARE
  v_workspace_id uuid;
  v_saldo_actual numeric;
  v_nuevo_saldo  numeric;
BEGIN
  IF p_valor IS NULL OR p_valor <= 0 THEN
    RAISE EXCEPTION 'El valor del pago debe ser mayor que cero';
  END IF;

  -- Bloquear la fila para evitar carreras entre dos recibos simultáneos.
  SELECT c.workspace_id, COALESCE(c.saldo_pendiente, 0)
    INTO v_workspace_id, v_saldo_actual
    FROM cobros c
   WHERE c.id = p_cobro_id
     FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Cobro no encontrado: %', p_cobro_id;
  END IF;

  IF NOT public.is_workspace_member(v_workspace_id) THEN
    RAISE EXCEPTION 'Sin permiso sobre este cobro';
  END IF;

  -- El saldo nunca queda negativo (un recaudo mayor al saldo simplemente lo salda).
  v_nuevo_saldo := GREATEST(v_saldo_actual - p_valor, 0);

  UPDATE cobros c
     SET saldo_pendiente = v_nuevo_saldo,
         -- Solo se marca fecha de pago cuando el cobro queda saldado.
         fecha_pago = CASE WHEN v_nuevo_saldo = 0 THEN p_fecha ELSE c.fecha_pago END
   WHERE c.id = p_cobro_id;

  RETURN QUERY
    SELECT c.saldo_pendiente, c.fecha_pago FROM cobros c WHERE c.id = p_cobro_id;
END;
$$;

ALTER FUNCTION "public"."registrar_pago_cobro"("uuid", numeric, "date") OWNER TO "postgres";

GRANT EXECUTE ON FUNCTION "public"."registrar_pago_cobro"("uuid", numeric, "date") TO "authenticated";
