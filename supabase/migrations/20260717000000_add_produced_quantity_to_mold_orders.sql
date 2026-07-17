-- Seguimiento de producción: cuántas unidades del pedido ya están hechas,
-- para pedidos de varias unidades que se producen de a poco (no se puede
-- entregar todo junto porque la producción lleva su tiempo).

ALTER TABLE public.mold_orders
  ADD COLUMN IF NOT EXISTS produced_quantity INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.mold_orders
  ADD CONSTRAINT produced_quantity_range CHECK (produced_quantity >= 0 AND produced_quantity <= quantity);
