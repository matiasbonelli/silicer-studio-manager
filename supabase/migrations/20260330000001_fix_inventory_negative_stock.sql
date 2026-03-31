-- Prevent inventory from going negative when a sale is made.
-- Raises an exception if there is not enough stock.
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_sale()
RETURNS TRIGGER AS $$
DECLARE
  v_current_quantity numeric;
  v_product_name text;
BEGIN
    -- Skip historical imports from CSV to avoid double-discounting stock.
    IF NEW.created_at < (now() - interval '1 hour') THEN
      RETURN NEW;
    END IF;

    -- Check current stock before deducting
    SELECT quantity, name INTO v_current_quantity, v_product_name
    FROM public.inventory
    WHERE id = NEW.inventory_id;

    IF v_current_quantity IS NULL THEN
      RAISE EXCEPTION 'Producto no encontrado (id: %)', NEW.inventory_id;
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
