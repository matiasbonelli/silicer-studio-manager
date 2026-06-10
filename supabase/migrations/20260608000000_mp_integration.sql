-- Tabla de configuración global de la app
CREATE TABLE public.app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admin_read_settings" ON public.app_settings
  FOR SELECT USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "admin_write_settings" ON public.app_settings
  FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Valor inicial: 1% de recargo (aplica a todos los métodos de pago)
INSERT INTO public.app_settings (key, value) VALUES ('recargo_percent', '1');

-- Nuevos valores del enum payment_method para distinguir débito y crédito
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'debit_card';
ALTER TYPE payment_method ADD VALUE IF NOT EXISTS 'credit_card';
-- Nota: 'card' permanece en el enum por compatibilidad con ventas históricas

-- Columnas nuevas en sales para integración MP y facturación
ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS mp_payment_id TEXT,
  ADD COLUMN IF NOT EXISTS invoiced_at TIMESTAMPTZ;

-- Habilitar Realtime en sales para que el frontend reciba confirmaciones automáticas
ALTER PUBLICATION supabase_realtime ADD TABLE public.sales;
