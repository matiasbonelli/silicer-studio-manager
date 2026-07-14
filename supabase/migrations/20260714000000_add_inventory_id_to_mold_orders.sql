-- Permite vincular cada pedido de molde a un producto real de inventario,
-- necesario para poder generar un sale_item (inventory_id NOT NULL) al cobrar
-- el pedido a través del mismo flujo de pago que usa Ventas.

ALTER TABLE public.mold_orders
  ADD COLUMN IF NOT EXISTS inventory_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mold_orders_inventory ON public.mold_orders(inventory_id);
