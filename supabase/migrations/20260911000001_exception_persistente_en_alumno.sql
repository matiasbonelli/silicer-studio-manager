-- La excepción de cuota se pidió que sea fija hasta que se saque a mano, no algo
-- que se resetee cada mes — por eso se mueve de payments (por mes) a students
-- (persistente), quitándola de payments.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS is_exception boolean NOT NULL DEFAULT false;

ALTER TABLE public.payments
  DROP COLUMN IF EXISTS is_exception;
