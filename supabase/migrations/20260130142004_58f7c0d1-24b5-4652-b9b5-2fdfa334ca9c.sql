-- Función para asignar rol admin al primer usuario registrado (o manualmente)
-- El admin puede ser asignado ejecutando: INSERT INTO user_roles (user_id, role) VALUES ('tu-user-id', 'admin');

-- También agregamos política para que los admins puedan gestionar roles
CREATE POLICY "Admins can manage user_roles"
ON public.user_roles FOR ALL
USING (public.has_role(auth.uid(), 'admin'));