-- Unifica el precio de la cuota mensual: el tab Resumen (Dashboard) pasa a
-- guardarlo en app_settings (antes era localStorage, por navegador) y un
-- trigger lo propaga automáticamente a los productos "Cuota Mensual" de
-- Ventas (inventory.price), evitando que ambos valores se desincronicen.

-- 1. Seed de configuración (mismo valor por defecto que el seed de inventory).
INSERT INTO public.app_settings (key, value)
SELECT 'cuota_adulto', '40000'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'cuota_adulto');

INSERT INTO public.app_settings (key, value)
SELECT 'cuota_nino', '40000'
WHERE NOT EXISTS (SELECT 1 FROM public.app_settings WHERE key = 'cuota_nino');

-- 2. Al guardar cuota_adulto/cuota_nino desde Resumen, actualizar el precio
-- de los productos "Cuota Mensual - Adultos/Niños" en inventory.
CREATE OR REPLACE FUNCTION public.sync_cuota_price_to_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.key = 'cuota_adulto' THEN
    UPDATE public.inventory
    SET price = NEW.value::numeric
    WHERE name = 'Cuota Mensual - Adultos';
  ELSIF NEW.key = 'cuota_nino' THEN
    UPDATE public.inventory
    SET price = NEW.value::numeric
    WHERE name = 'Cuota Mensual - Niños';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_cuota_price_to_inventory ON public.app_settings;

CREATE TRIGGER trg_sync_cuota_price_to_inventory
  AFTER INSERT OR UPDATE ON public.app_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_cuota_price_to_inventory();

-- 3. Aplicar el precio configurado a los productos existentes (por si el seed
-- de inventory ya corrió con el valor por defecto $40.000 y app_settings
-- tenía otro valor).
UPDATE public.inventory
SET price = (SELECT value::numeric FROM public.app_settings WHERE key = 'cuota_adulto')
WHERE name = 'Cuota Mensual - Adultos';

UPDATE public.inventory
SET price = (SELECT value::numeric FROM public.app_settings WHERE key = 'cuota_nino')
WHERE name = 'Cuota Mensual - Niños';
