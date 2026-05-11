ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS categoria TEXT NOT NULL DEFAULT 'adulto'
  CHECK (categoria IN ('adulto', 'niño'));
