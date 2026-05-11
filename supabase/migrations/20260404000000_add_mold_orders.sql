-- Tabla de pedidos de moldes
CREATE TABLE public.mold_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  product_name TEXT NOT NULL,
  product_price DECIMAL(12,2) NOT NULL DEFAULT 0,
  pricing_product_id UUID REFERENCES public.pricing_products(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'ready', 'delivered')),
  payment_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (payment_status IN ('pending', 'paid')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Trigger updated_at (reutiliza función existente)
CREATE TRIGGER set_mold_orders_updated_at
  BEFORE UPDATE ON public.mold_orders
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Indexes
CREATE INDEX idx_mold_orders_student ON public.mold_orders(student_id);
CREATE INDEX idx_mold_orders_status ON public.mold_orders(status);

-- RLS
ALTER TABLE public.mold_orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin select mold_orders" ON public.mold_orders
  FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admin all mold_orders" ON public.mold_orders
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));
