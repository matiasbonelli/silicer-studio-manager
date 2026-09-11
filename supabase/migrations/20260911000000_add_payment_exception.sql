-- Permite marcar la cuota de un alumno en un mes puntual como "excepción":
-- se excluye de los recordatorios de WhatsApp (cuota pendiente y mora) y de
-- los contadores de "Cuotas del mes" en el Dashboard, sin necesidad de
-- registrar un pago.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS is_exception boolean NOT NULL DEFAULT false;
