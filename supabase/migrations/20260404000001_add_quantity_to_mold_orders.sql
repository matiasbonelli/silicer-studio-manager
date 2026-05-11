-- Agrega columna cantidad a pedidos de moldes
ALTER TABLE public.mold_orders
  ADD COLUMN quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0);
