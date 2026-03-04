-- Align schema with the latest CSV exports in data/lovable-csv
-- and with the fields currently used by the frontend.

ALTER TYPE public.payment_status ADD VALUE IF NOT EXISTS 'partial';

ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS payment_date TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS payment_month TEXT,
  ADD COLUMN IF NOT EXISTS payment_receipt_url TEXT;

ALTER TABLE public.inventory
  ADD COLUMN IF NOT EXISTS image_url TEXT,
  ADD COLUMN IF NOT EXISTS for_sale BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cost NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS margin_percent NUMERIC(8,2),
  ADD COLUMN IF NOT EXISTS category TEXT;

ALTER TABLE public.sales
  ADD COLUMN IF NOT EXISTS paid_amount NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS receipt_url TEXT;

ALTER TABLE public.enrollments
  ADD COLUMN IF NOT EXISTS birthday DATE;

-- CSV data comes from another Supabase project, so imported user_id values
-- can be orphaned until they are manually remapped to current auth users.
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_fkey;

ALTER TABLE public.pricing_config
  DROP CONSTRAINT IF EXISTS pricing_config_user_id_fkey;

ALTER TABLE public.pricing_products
  DROP CONSTRAINT IF EXISTS pricing_products_user_id_fkey;

CREATE OR REPLACE FUNCTION public.handle_new_auth_user_role()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  assigned_role public.app_role;
BEGIN
  IF (SELECT COUNT(*) FROM auth.users) = 1 THEN
    assigned_role := 'admin';
  ELSE
    assigned_role := 'user';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, assigned_role)
  ON CONFLICT (user_id, role) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created_assign_role ON auth.users;

CREATE TRIGGER on_auth_user_created_assign_role
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_auth_user_role();

CREATE OR REPLACE FUNCTION public.deduct_inventory_on_sale()
RETURNS TRIGGER AS $$
BEGIN
    -- Skip historical imports from CSV to avoid double-discounting stock.
    IF NEW.created_at < (now() - interval '1 hour') THEN
      RETURN NEW;
    END IF;

    UPDATE public.inventory
    SET quantity = quantity - NEW.quantity
    WHERE id = NEW.inventory_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

UPDATE public.inventory
SET for_sale = false
WHERE for_sale IS NULL;
