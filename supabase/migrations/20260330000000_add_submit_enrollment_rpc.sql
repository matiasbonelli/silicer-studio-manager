-- Atomic enrollment submission with server-side capacity validation.
-- Prevents race conditions where two simultaneous submissions could exceed max_capacity.
CREATE OR REPLACE FUNCTION public.submit_enrollment(
  p_first_name text,
  p_last_name text,
  p_email text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_birthday date DEFAULT NULL,
  p_schedule_id uuid DEFAULT NULL,
  p_message text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_capacity integer;
  v_current_count bigint;
  v_enrollment_id uuid;
BEGIN
  -- Validate required fields
  IF p_first_name IS NULL OR trim(p_first_name) = '' THEN
    RETURN json_build_object('success', false, 'message', 'El nombre es requerido');
  END IF;

  IF p_last_name IS NULL OR trim(p_last_name) = '' THEN
    RETURN json_build_object('success', false, 'message', 'El apellido es requerido');
  END IF;

  IF p_schedule_id IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Selecciona un horario');
  END IF;

  -- Lock the schedule row to prevent concurrent capacity checks
  SELECT max_capacity INTO v_max_capacity
  FROM public.schedules
  WHERE id = p_schedule_id
  FOR UPDATE;

  IF v_max_capacity IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'El horario seleccionado no existe');
  END IF;

  -- Count current students assigned to this schedule
  SELECT COUNT(*) INTO v_current_count
  FROM public.students
  WHERE schedule_id = p_schedule_id;

  IF v_current_count >= v_max_capacity THEN
    RETURN json_build_object('success', false, 'message', 'Este horario ya no tiene lugares disponibles');
  END IF;

  -- Insert the enrollment
  INSERT INTO public.enrollments (first_name, last_name, email, phone, birthday, schedule_id, message)
  VALUES (trim(p_first_name), trim(p_last_name), NULLIF(trim(COALESCE(p_email, '')), ''), trim(p_phone), p_birthday, p_schedule_id, NULLIF(trim(COALESCE(p_message, '')), ''))
  RETURNING id INTO v_enrollment_id;

  RETURN json_build_object('success', true, 'message', 'Inscripción enviada correctamente', 'enrollment_id', v_enrollment_id);
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_enrollment(text, text, text, text, date, uuid, text) TO anon;
GRANT EXECUTE ON FUNCTION public.submit_enrollment(text, text, text, text, date, uuid, text) TO authenticated;
