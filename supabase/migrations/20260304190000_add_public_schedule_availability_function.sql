-- Public, safe schedule availability for enrollment form.
-- Returns only schedule metadata + occupied seats count.
CREATE OR REPLACE FUNCTION public.get_public_schedule_availability()
RETURNS TABLE (
  id uuid,
  day_of_week text,
  start_time time,
  end_time time,
  max_capacity integer,
  created_at timestamp with time zone,
  current_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    s.id,
    s.day_of_week,
    s.start_time,
    s.end_time,
    s.max_capacity,
    s.created_at,
    COALESCE(COUNT(st.id), 0)::bigint AS current_count
  FROM public.schedules s
  LEFT JOIN public.students st
    ON st.schedule_id = s.id
  GROUP BY s.id, s.day_of_week, s.start_time, s.end_time, s.max_capacity, s.created_at
  ORDER BY s.day_of_week, s.start_time;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_schedule_availability() TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_schedule_availability() TO authenticated;
