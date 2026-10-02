-- Los niños dejan de pagar cuota mensual y pasan a pagar por clase. Todos los niños
-- actuales se marcan como "por clase", y de acá en más cualquier alumno que entre o
-- cambie a categoría 'niño' (desde Alumnos, Inscripciones o donde sea) lo hereda solo,
-- sin depender de que cada pantalla se acuerde de setearlo.
UPDATE public.students
SET pays_per_class = true
WHERE categoria = 'niño' AND pays_per_class IS DISTINCT FROM true;

CREATE OR REPLACE FUNCTION public.set_pays_per_class_for_ninos()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.categoria = 'niño' AND (TG_OP = 'INSERT' OR OLD.categoria IS DISTINCT FROM 'niño') THEN
    NEW.pays_per_class := true;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_pays_per_class_for_ninos ON public.students;

CREATE TRIGGER trg_set_pays_per_class_for_ninos
  BEFORE INSERT OR UPDATE OF categoria ON public.students
  FOR EACH ROW
  EXECUTE FUNCTION public.set_pays_per_class_for_ninos();
