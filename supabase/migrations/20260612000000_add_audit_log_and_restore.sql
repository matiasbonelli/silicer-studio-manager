-- Historial de cambios: registra eliminaciones para poder restaurarlas (undo)
-- desde Utilidades > Historial de cambios.

-- 1. Tabla de auditoría de eliminaciones
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name TEXT NOT NULL,
  record_id UUID NOT NULL,
  record_data JSONB NOT NULL,
  batch_id TEXT NOT NULL,
  deleted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_by UUID REFERENCES auth.users(id),
  restored_at TIMESTAMPTZ
);

CREATE INDEX idx_audit_log_batch_id ON public.audit_log(batch_id);
CREATE INDEX idx_audit_log_table_restored ON public.audit_log(table_name, restored_at);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view audit_log"
ON public.audit_log FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Función trigger genérica: registra la fila eliminada antes de borrarla
CREATE OR REPLACE FUNCTION public.log_deleted_row()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_log (table_name, record_id, record_data, batch_id, deleted_by)
  VALUES (TG_TABLE_NAME, OLD.id, row_to_json(OLD)::jsonb, txid_current()::text, auth.uid());
  RETURN OLD;
END;
$$;

-- 3. Triggers en las tablas que pueden borrarse en cascada al eliminar un alumno
CREATE TRIGGER audit_log_students
  BEFORE DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.log_deleted_row();

CREATE TRIGGER audit_log_payments
  BEFORE DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.log_deleted_row();

CREATE TRIGGER audit_log_attendance
  BEFORE DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.log_deleted_row();

CREATE TRIGGER audit_log_mold_orders
  BEFORE DELETE ON public.mold_orders
  FOR EACH ROW EXECUTE FUNCTION public.log_deleted_row();

-- 4. Recrear delete_student_cascade de forma explícita y versionada.
-- Borra explícitamente las filas relacionadas (en vez de depender solo de
-- ON DELETE CASCADE) para que los triggers de auditoría las registren bajo
-- el mismo batch_id (misma transacción) y puedan restaurarse juntas.
-- Se elimina primero porque la función existente tiene un tipo de retorno
-- distinto (CREATE OR REPLACE no permite cambiarlo).
DROP FUNCTION IF EXISTS public.delete_student_cascade(uuid);

CREATE OR REPLACE FUNCTION public.delete_student_cascade(student_uuid UUID)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'No autorizado';
  END IF;

  -- Desvincular referencias que no se borran junto con el alumno
  UPDATE public.sales SET student_id = NULL WHERE student_id = student_uuid;
  UPDATE public.enrollments SET converted_to_student_id = NULL WHERE converted_to_student_id = student_uuid;

  -- Borrados explícitos (disparan los triggers de auditoría)
  DELETE FROM public.mold_orders WHERE student_id = student_uuid;
  DELETE FROM public.attendance WHERE student_id = student_uuid;
  DELETE FROM public.payments WHERE student_id = student_uuid;
  DELETE FROM public.students WHERE id = student_uuid;

  RETURN json_build_object('success', true);
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_student_cascade(uuid) TO authenticated;

-- 5. RPC para restaurar un lote de eliminaciones (un alumno + sus registros relacionados)
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

  UPDATE public.audit_log
  SET restored_at = now()
  WHERE batch_id = p_batch_id AND restored_at IS NULL;

  RETURN json_build_object('success', true, 'restored_count', restored_count);
END;
$$;

GRANT EXECUTE ON FUNCTION public.restore_audit_batch(text) TO authenticated;
