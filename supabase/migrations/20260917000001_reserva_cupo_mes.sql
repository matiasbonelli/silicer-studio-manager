-- Reserva de cupo: un alumno activo paga una seña para guardar su lugar pero no
-- cursa este mes (empieza el que viene). Se guarda el mes exacto que se salta
-- (no un simple booleano) para que se desactive solo al pasar de mes, sin
-- depender de que alguien se acuerde de sacarlo a mano.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS reserved_month text;
