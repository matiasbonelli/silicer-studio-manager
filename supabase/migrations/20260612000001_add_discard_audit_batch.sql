-- Ciclo de vida del historial de eliminaciones:
-- - "Restaurar" ahora borra las filas de audit_log del lote (ya cumplieron su función).
-- - "Descartar" permite eliminar definitivamente un lote sin restaurarlo
--   (ej. el alumno pidió que se borren sus datos).

CREATE OR REPLACE FUNCTION public.restore_audit_batch(p_batch_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  restored_count INTEGER := 0;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Restaurar primero el alumno (padre) y luego sus registros relacionados,
  -- para no violar las foreign keys.
  FOR r IN
    SELECT * FROM public.audit_log
    WHERE batch_id = p_batch_id AND restored_at IS NULL
    ORDER BY CASE table_name WHEN 'students' THEN 0 ELSE 1 END, deleted_at
  LOOP
    EXECUTE format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)',
      r.table_name, r.table_name
    ) USING r.record_data;

    restored_count := restored_count + 1;
  END LOOP;

  DELETE FROM public.audit_log WHERE batch_id = p_batch_id;

  RETURN json_build_object('success', true, 'restored_count', restored_count);
END;
$$;

-- RPC para descartar definitivamente un lote (no se restaura, se borra del historial)
CREATE OR REPLACE FUNCTION public.discard_audit_batch(p_batch_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  discarded_count INTEGER;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  DELETE FROM public.audit_log WHERE batch_id = p_batch_id AND restored_at IS NULL;
  GET DIAGNOSTICS discarded_count = ROW_COUNT;

  RETURN json_build_object('success', true, 'discarded_count', discarded_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.discard_audit_batch(text) TO authenticated;
