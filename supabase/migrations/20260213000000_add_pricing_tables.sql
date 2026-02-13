-- Tabla de configuración de precios (una sola fila por usuario/admin)
CREATE TABLE public.pricing_config (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
    precio_barbotina DECIMAL(12,2) NOT NULL DEFAULT 11500,
    peso_bidon DECIMAL(12,2) NOT NULL DEFAULT 9000,
    margen_default DECIMAL(5,2) NOT NULL DEFAULT 50,
    costo_mano_obra_default DECIMAL(12,2) NOT NULL DEFAULT 1500,
    costo_horneado_default DECIMAL(12,2) NOT NULL DEFAULT 0,
    costo_esmaltado_default DECIMAL(12,2) NOT NULL DEFAULT 0,
    precio_esmalte_kg DECIMAL(12,2) NOT NULL DEFAULT 0,
    porcentaje_esmalte DECIMAL(5,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de productos para el calculador de precios
CREATE TABLE public.pricing_products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    nombre TEXT NOT NULL DEFAULT '',
    categoria TEXT NOT NULL DEFAULT '',
    peso_gramos DECIMAL(10,2) NOT NULL DEFAULT 0,
    costo_mano_obra DECIMAL(12,2) NOT NULL DEFAULT 0,
    margen DECIMAL(5,2) NOT NULL DEFAULT 50,
    image_url TEXT,
    costo_horneado1 DECIMAL(12,2) NOT NULL DEFAULT 0,
    margen_bizcochado DECIMAL(5,2) NOT NULL DEFAULT 50,
    costo_esmaltado DECIMAL(12,2) NOT NULL DEFAULT 0,
    costo_horneado2 DECIMAL(12,2) NOT NULL DEFAULT 0,
    margen_final DECIMAL(5,2) NOT NULL DEFAULT 50,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Triggers para updated_at
CREATE TRIGGER update_pricing_config_updated_at
    BEFORE UPDATE ON public.pricing_config
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pricing_products_updated_at
    BEFORE UPDATE ON public.pricing_products
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Habilitar RLS
ALTER TABLE public.pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_products ENABLE ROW LEVEL SECURITY;

-- Políticas RLS: solo admins pueden gestionar
CREATE POLICY "Admins can view pricing_config"
ON public.pricing_config FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage pricing_config"
ON public.pricing_config FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view pricing_products"
ON public.pricing_products FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage pricing_products"
ON public.pricing_products FOR ALL
USING (public.has_role(auth.uid(), 'admin'));
