-- 1. Ampliar márgenes para evitar overflow DECIMAL(5,2) (máx 999.99)
-- Al guardar un margen >= 1000 PostgREST devolvía 400 por numeric_overflow.
ALTER TABLE public.pricing_config
  ALTER COLUMN margen_default TYPE DECIMAL(7,2);

ALTER TABLE public.pricing_products
  ALTER COLUMN margen TYPE DECIMAL(7,2),
  ALTER COLUMN margen_bizcochado TYPE DECIMAL(7,2),
  ALTER COLUMN margen_final TYPE DECIMAL(7,2);

-- 2. Flag "pieza del cliente" en sale_items.
-- Permite cobrar solo los servicios (bizcochado / esmaltado) cuando el cliente
-- aporta su propia pieza en estado molde, sin incluir el costo del molde.
ALTER TABLE public.sale_items
  ADD COLUMN is_customer_piece BOOLEAN NOT NULL DEFAULT false;
