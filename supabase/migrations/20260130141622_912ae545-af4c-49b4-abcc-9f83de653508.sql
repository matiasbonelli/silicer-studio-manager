-- Enum para estado de cuota
CREATE TYPE public.payment_status AS ENUM ('paid', 'pending');

-- Enum para método de pago
CREATE TYPE public.payment_method AS ENUM ('cash', 'card', 'transfer', 'mercadopago');

-- Enum para roles de usuario
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- Tabla de roles de usuario
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL DEFAULT 'user',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Función para verificar rol
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Tabla de horarios fijos
CREATE TABLE public.schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week TEXT NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    max_capacity INTEGER NOT NULL DEFAULT 10,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Insertar horarios fijos
INSERT INTO public.schedules (day_of_week, start_time, end_time) VALUES
('monday', '14:00', '16:00'),
('monday', '16:00', '18:00'),
('monday', '18:30', '20:30'),
('tuesday', '09:30', '11:30'),
('tuesday', '16:00', '18:00'),
('tuesday', '18:30', '20:30'),
('wednesday', '14:00', '16:00'),
('wednesday', '16:00', '18:00'),
('wednesday', '18:30', '20:30'),
('thursday', '09:30', '11:30'),
('thursday', '16:00', '18:00'),
('thursday', '18:30', '20:30'),
('friday', '16:00', '18:00'),
('friday', '18:30', '20:30');

-- Tabla de alumnos
CREATE TABLE public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT,
    birthday DATE,
    schedule_id UUID REFERENCES public.schedules(id),
    payment_status payment_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de inventario
CREATE TABLE public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    description TEXT,
    quantity INTEGER NOT NULL DEFAULT 0,
    unit TEXT NOT NULL DEFAULT 'unidad',
    min_stock INTEGER NOT NULL DEFAULT 0,
    price DECIMAL(10,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de ventas
CREATE TABLE public.sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id),
    total_amount DECIMAL(10,2) NOT NULL,
    payment_method payment_method NOT NULL DEFAULT 'cash',
    payment_status payment_status NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de items de venta
CREATE TABLE public.sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES public.sales(id) ON DELETE CASCADE NOT NULL,
    inventory_id UUID REFERENCES public.inventory(id) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabla de inscripciones (desde el formulario público)
CREATE TABLE public.enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    schedule_id UUID REFERENCES public.schedules(id) NOT NULL,
    message TEXT,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Función para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Triggers para updated_at
CREATE TRIGGER update_students_updated_at
    BEFORE UPDATE ON public.students
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at
    BEFORE UPDATE ON public.inventory
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- Función para descontar inventario al registrar venta
CREATE OR REPLACE FUNCTION public.deduct_inventory_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.inventory
    SET quantity = quantity - NEW.quantity
    WHERE id = NEW.inventory_id;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER deduct_inventory_trigger
    AFTER INSERT ON public.sale_items
    FOR EACH ROW
    EXECUTE FUNCTION public.deduct_inventory_on_sale();

-- Habilitar RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sale_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles FOR SELECT
USING (auth.uid() = user_id);

-- Políticas RLS para schedules (lectura pública)
CREATE POLICY "Anyone can view schedules"
ON public.schedules FOR SELECT
USING (true);

CREATE POLICY "Admins can manage schedules"
ON public.schedules FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Políticas RLS para students
CREATE POLICY "Admins can view all students"
ON public.students FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert students"
ON public.students FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update students"
ON public.students FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete students"
ON public.students FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Políticas RLS para inventory
CREATE POLICY "Admins can view inventory"
ON public.inventory FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage inventory"
ON public.inventory FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Políticas RLS para sales
CREATE POLICY "Admins can view sales"
ON public.sales FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage sales"
ON public.sales FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Políticas RLS para sale_items
CREATE POLICY "Admins can view sale_items"
ON public.sale_items FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage sale_items"
ON public.sale_items FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Políticas RLS para enrollments (inserción pública, gestión admin)
CREATE POLICY "Anyone can create enrollment"
ON public.enrollments FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view enrollments"
ON public.enrollments FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage enrollments"
ON public.enrollments FOR ALL
USING (public.has_role(auth.uid(), 'admin'));