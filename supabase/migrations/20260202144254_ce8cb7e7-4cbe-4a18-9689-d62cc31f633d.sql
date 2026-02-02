-- Add payment tracking columns to enrollments table
ALTER TABLE public.enrollments 
ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS payment_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_date timestamp with time zone,
ADD COLUMN IF NOT EXISTS payment_notes text,
ADD COLUMN IF NOT EXISTS converted_to_student_id uuid REFERENCES public.students(id);

-- Add comment for clarity on status values
COMMENT ON COLUMN public.enrollments.status IS 'Enrollment status: pending, contacted, confirmed, cancelled';
COMMENT ON COLUMN public.enrollments.payment_status IS 'Payment status: pending, deposit, paid';
