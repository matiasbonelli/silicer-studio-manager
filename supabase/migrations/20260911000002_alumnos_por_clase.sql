-- Alumnos que pagan por clase (no cuota mensual): no entran al sistema de cuotas
-- mensuales ni a sus recordatorios de WhatsApp, y cada clase pagada se registra
-- como una fila propia (fecha + monto manual), pudiendo existir varias en el
-- mismo mes — a diferencia de payments, que es un registro único por mes.
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS pays_per_class boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.class_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_date date NOT NULL,
  amount numeric NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS class_payments_student_id_idx ON public.class_payments(student_id);

ALTER TABLE public.class_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view class_payments"
  ON public.class_payments FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage class_payments"
  ON public.class_payments FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));
