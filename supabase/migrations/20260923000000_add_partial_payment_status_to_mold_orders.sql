-- Los pedidos de moldes pueden quedar "señados" (pago parcial) igual que una venta,
-- pero el trigger de sincronización original solo distinguía pending/paid: una seña
-- registrada en Ventas nunca se reflejaba en el pedido (se quedaba en "No pagado"
-- para siempre, aunque la venta ya estuviera en 'partial').

DO $$
DECLARE
  con_name text;
BEGIN
  SELECT conname INTO con_name
  FROM pg_constraint
  WHERE conrelid = 'public.mold_orders'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%payment_status%';
  IF con_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.mold_orders DROP CONSTRAINT %I', con_name);
  END IF;
END $$;

ALTER TABLE public.mold_orders
  ADD CONSTRAINT mold_orders_payment_status_check
  CHECK (payment_status IN ('pending', 'partial', 'paid'));

CREATE OR REPLACE FUNCTION public.sync_mold_order_status_on_sale_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status IS DISTINCT FROM OLD.payment_status
     AND NEW.payment_status IN ('pending', 'partial', 'paid') THEN
    UPDATE public.mold_orders
    SET payment_status = NEW.payment_status
    WHERE sale_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
