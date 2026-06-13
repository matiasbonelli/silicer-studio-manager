-- Permite vender la "cuota mensual" como producto desde Ventas (cobro con
-- efectivo, transferencia o Mercado Pago/QR), sincronizando automáticamente
-- la tabla payments existente cuando la venta se marca como pagada.

-- 1. Columnas para asociar una línea de venta "cuota" a un alumno y mes.
ALTER TABLE public.sale_items
  ADD COLUMN IF NOT EXISTS cuota_student_id UUID REFERENCES public.students(id),
  ADD COLUMN IF NOT EXISTS cuota_month TEXT;

ALTER TABLE public.sale_items
  ADD CONSTRAINT cuota_month_format CHECK (cuota_month IS NULL OR cuota_month ~ '^\d{4}-\d{2}$');

-- 2. Trazabilidad: referencia a la venta que generó/actualizó un pago de cuota.
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS sale_id UUID REFERENCES public.sales(id) ON DELETE SET NULL;

-- 3. Al confirmarse el pago de una venta (payment_status -> 'paid'), sincronizar
-- la tabla payments para cada item "cuota" de esa venta, igual que el upsert
-- manual que hace el tab Alumnos.
CREATE OR REPLACE FUNCTION public.sync_cuota_payments_on_sale_paid()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.payment_status = 'paid' AND (OLD.payment_status IS DISTINCT FROM 'paid') THEN
    INSERT INTO public.payments (student_id, month, status, amount, payment_date, sale_id, notes)
    SELECT si.cuota_student_id, si.cuota_month, 'paid', NULL, now(), NEW.id,
           'Pagado vía Ventas (sale_id: ' || NEW.id || ')'
    FROM public.sale_items si
    WHERE si.sale_id = NEW.id
      AND si.cuota_student_id IS NOT NULL
      AND si.cuota_month IS NOT NULL
    ON CONFLICT (student_id, month) DO UPDATE
      SET status = 'paid',
          amount = NULL,
          payment_date = now(),
          sale_id = EXCLUDED.sale_id,
          notes = EXCLUDED.notes;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cuota_payments_on_sale_paid ON public.sales;

CREATE TRIGGER trg_sync_cuota_payments_on_sale_paid
  AFTER UPDATE ON public.sales
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cuota_payments_on_sale_paid();

-- 4. La categoría "cuota" no es inventario físico: no valida ni descuenta stock.
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_current_quantity numeric;
  v_product_name text;
  v_category text;
BEGIN
    -- Skip historical imports from CSV to avoid double-discounting stock.
    IF NEW.created_at < (now() - interval '1 hour') THEN
      RETURN NEW;
    END IF;

    SELECT quantity, name, category INTO v_current_quantity, v_product_name, v_category
    FROM public.inventory
    WHERE id = NEW.inventory_id;

    IF v_current_quantity IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado (id: %)', NEW.inventory_id;
    END IF;

    IF v_category = 'cuota' THEN
      RETURN NEW;
    END IF;

    IF v_current_quantity < NEW.quantity THEN
      RAISE EXCEPTION 'Stock insuficiente para "%": disponible % pero se solicitan %',
        v_product_name, v_current_quantity, NEW.quantity;
    END IF;

    UPDATE public.inventory
    SET quantity = quantity - NEW.quantity
    WHERE id = NEW.inventory_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 5. Seed: productos "Cuota Mensual" para adultos y niños.
INSERT INTO public.inventory (name, description, quantity, unit, min_stock, price, cost, for_sale, category)
SELECT 'Cuota Mensual - Adultos', 'Cuota mensual de taller para alumnos adultos', 999999, 'unidad', 0, 40000, 0, true, 'cuota'
WHERE NOT EXISTS (SELECT 1 FROM public.inventory WHERE name = 'Cuota Mensual - Adultos');

INSERT INTO public.inventory (name, description, quantity, unit, min_stock, price, cost, for_sale, category)
SELECT 'Cuota Mensual - Niños', 'Cuota mensual de taller para alumnos niños', 999999, 'unidad', 0, 40000, 0, true, 'cuota'
WHERE NOT EXISTS (SELECT 1 FROM public.inventory WHERE name = 'Cuota Mensual - Niños');
