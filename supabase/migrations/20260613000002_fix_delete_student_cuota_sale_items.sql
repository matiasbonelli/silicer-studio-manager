-- Al eliminar un alumno, desvincular (no borrar) las líneas de venta "cuota"
-- que lo referencian, igual que ya se hace con sales.student_id. Sin esto,
-- la FK sale_items.cuota_student_id impide eliminar al alumno.

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
  UPDATE public.sale_items SET cuota_student_id = NULL WHERE cuota_student_id = student_uuid;

  -- Borrados explícitos (disparan los triggers de auditoría)
  DELETE FROM public.mold_orders WHERE student_id = student_uuid;
  DELETE FROM public.attendance WHERE student_id = student_uuid;
  DELETE FROM public.payments WHERE student_id = student_uuid;
  DELETE FROM public.students WHERE id = student_uuid;

  RETURN json_build_object('success', true);
END;
$$;
