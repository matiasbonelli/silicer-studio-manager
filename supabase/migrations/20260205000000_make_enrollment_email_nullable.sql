-- Make email column nullable in enrollments table
-- Email is not a required field in the enrollment form
ALTER TABLE public.enrollments ALTER COLUMN email DROP NOT NULL;
