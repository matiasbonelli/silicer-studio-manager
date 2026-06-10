-- Columna para guardar el id de la orden QR híbrida (Orders API), separada
-- de mp_payment_id que se usa para el payment-intent de tarjeta (Point).
ALTER TABLE public.sales ADD COLUMN IF NOT EXISTS mp_order_id TEXT;
