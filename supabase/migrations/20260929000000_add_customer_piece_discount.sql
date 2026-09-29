-- Descuento "Pieza o Molde del cliente" por unidad.
-- unit_price guarda el precio ya descontado; esta columna guarda cuánto se
-- descontó (normalmente el precio del Molde), para poder mostrar el desglose
-- en historial y comprobantes aunque después cambien los precios.
ALTER TABLE public.sale_items
  ADD COLUMN customer_piece_discount NUMERIC(12,2) NOT NULL DEFAULT 0;

-- Backfill de ventas anteriores: mejor estimación con el precio actual del inventario.
UPDATE public.sale_items si
SET customer_piece_discount = GREATEST(inv.price - si.unit_price, 0)
FROM public.inventory inv
WHERE si.inventory_id = inv.id
  AND si.is_customer_piece = true;
