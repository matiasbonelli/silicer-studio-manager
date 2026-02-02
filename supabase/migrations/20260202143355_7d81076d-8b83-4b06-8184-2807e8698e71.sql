-- Fix 1: Remove the overly permissive inventory delete policy
-- The "Admins can manage inventory" policy with FOR ALL already covers DELETE
DROP POLICY IF EXISTS "Allow delete inventory" ON public.inventory;

-- Fix 2: Create the receipts storage bucket with proper security
INSERT INTO storage.buckets (id, name, public) 
VALUES ('receipts', 'receipts', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for receipts bucket - admin only access
CREATE POLICY "Admins can upload receipts"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can view receipts"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update receipts"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete receipts"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'receipts' AND public.has_role(auth.uid(), 'admin'));