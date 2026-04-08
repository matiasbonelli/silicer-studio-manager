-- Tabla de asistencia: trackea presencia, ausencias, recuperaciones y cambios de día
CREATE TABLE public.attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES public.students(id) ON DELETE CASCADE NOT NULL,
    schedule_id UUID REFERENCES public.schedules(id) NOT NULL,
    class_date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'present',
    -- status: 'present' | 'absent' | 'recovery' | 'day_switch'
    original_schedule_id UUID REFERENCES public.schedules(id),
    -- para recovery/day_switch: el horario regular del alumno
    recovery_source_date DATE,
    -- para recovery: la fecha de la clase que se está recuperando
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(student_id, class_date)
);

-- RLS
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage attendance"
ON public.attendance FOR ALL
USING (public.has_role(auth.uid(), 'admin'));

-- Trigger updated_at
CREATE TRIGGER update_attendance_updated_at
    BEFORE UPDATE ON public.attendance
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
