-- Vincula un pedido de molde a la venta que lo cobró (mismo patrón que la
-- cuota mensual: la tabla origen guarda sale_id, y un trigger sobre sales
-- sincroniza el estado cuando la venta se marca como pagada).
--
-- No hay backfill retroactivo: pedidos históricos con payment_status='paid'
-- pero sin venta asociada quedan con sale_id NULL. La UI los distingue como
-- "pagado (histórico)" en vez de generar ventas sintéticas con fecha incorrecta.

ALTER TABLE public.mold_orders
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mold_orders_sale ON public.mold_orders(sale_id);

CREATE OR REPLACE FUNCTION public.sync_mold_order_status_on_sale_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
    UPDATE public.mold_orders
    SET payment_status = 'paid'
    WHERE sale_id = NEW.id;
  ELSIF OLD.payment_status = 'paid' AND NEW.payment_status IS DISTINCT FROM 'paid' THEN
    UPDATE public.mold_orders
    SET payment_status = 'pending'
    WHERE sale_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_mold_order_status_on_sale_paid ON public.sales;

CREATE TRIGGER trg_sync_mold_order_status_on_sale_paid
  AFTER UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_mold_order_status_on_sale_paid();
