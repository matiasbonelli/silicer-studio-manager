-- Fix has_role function used by RLS policies.
-- Existing policies depend on has_role(uuid, text), so we normalize that variant
-- to compare safely against enum-backed user_roles.role.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role::text = _role
  );
$$;
