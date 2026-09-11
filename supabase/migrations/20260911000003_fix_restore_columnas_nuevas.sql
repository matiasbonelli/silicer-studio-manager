-- El restore de audit_log reconstruye la fila desde el JSON guardado al momento
-- del borrado. Si el alumno se borró antes de que existieran columnas NOT NULL
-- nuevas (is_exception, pays_per_class), esas claves faltan en el JSON y
-- jsonb_populate_record las deja en NULL, violando el NOT NULL al insertar.
-- Se completan con su default (false) solo para students, antes de restaurar.
CREATE OR REPLACE FUNCTION public.restore_audit_batch(p_batch_id text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  restored_count INTEGER := 0;
  v_data jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  FOR r IN
    SELECT * FROM public.audit_log
    WHERE batch_id = p_batch_id AND restored_at IS NULL
    ORDER BY CASE table_name WHEN 'students' THEN 0 ELSE 1 END, deleted_at
  LOOP
    v_data := r.record_data;

    IF r.table_name = 'students' THEN
      v_data := v_data || jsonb_build_object(
        'is_exception', COALESCE(v_data->>'is_exception', 'false')::boolean,
        'pays_per_class', COALESCE(v_data->>'pays_per_class', 'false')::boolean
      );
    END IF;

    EXECUTE format(
      'INSERT INTO public.%I SELECT * FROM jsonb_populate_record(NULL::public.%I, $1)',
      r.table_name, r.table_name
    ) USING v_data;

    restored_count := restored_count + 1;
  END LOOP;

  UPDATE public.audit_log
  SET restored_at = now()
  WHERE batch_id = p_batch_id AND restored_at IS NULL;

  RETURN json_build_object('success', true, 'restored_count', restored_count);
END;
$$;
