import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Student, Schedule, Attendance, DAY_NAMES, DAY_ORDER } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User } from 'lucide-react';
import { parseISO, format, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { getRecoverableAbsences, canRecoverAbsence } from '@/lib/attendance';

type Mode = 'recovery' | 'day_switch';

const DAY_OF_WEEK_MAP: Record<number, string> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
};

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
  allStudents: Student[];
  allSchedules: Schedule[];
  /**
   * Fecha pre-seleccionada. Cuando se abre desde un slot → es la fecha del día actual.
   * Cuando se abre desde el nombre de un alumno → NO se pasa (el admin elige la fecha de recuperación).
   */
  initialDate?: string;
  /** Horario pre-seleccionado al abrir desde un slot específico */
  initialScheduleId?: string;
  /** Alumno pre-seleccionado (abriendo desde su nombre en la vista diaria) */
  initialStudentId?: string;
  /**
   * Fecha de la clase que el alumno faltó.
   * Cuando se pasa, "Clase a recuperar" queda bloqueada mostrando esa fecha.
   */
  initialAbsenceDate?: string;
}

export default function AttendanceRecoveryDialog({
  isOpen,
  onClose,
  onSaved,
  allStudents,
  allSchedules,
  initialDate,
  initialScheduleId,
  initialStudentId,
  initialAbsenceDate,
}: Props) {
  const { toast } = useToast();

  // ¿Se abrió desde el nombre de un alumno?
  const fromStudent = !!initialStudentId;

  const [mode, setMode] = useState<Mode>('recovery');
  // Desde alumno: fecha vacía (admin elige cuándo recupera). Desde slot: pre-rellena.
  const [recoveryDate, setRecoveryDate] = useState(initialDate ?? '');
  const [selectedScheduleId, setSelectedScheduleId] = useState(initialScheduleId ?? '');
  const [selectedStudentId, setSelectedStudentId] = useState(initialStudentId ?? '');
  // Si hay ausencia pre-conocida, la pre-seleccionamos directamente
  const [selectedAbsenceDate, setSelectedAbsenceDate] = useState(initialAbsenceDate ?? '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  // Ausencias recuperables (solo cuando NO tenemos initialAbsenceDate)
  const [recoverableAbsences, setRecoverableAbsences] = useState<Attendance[]>([]);
  const [loadingAbsences, setLoadingAbsences] = useState(false);

  // Asistencia del día elegido (todos los horarios), para calcular cupos reales y alumnos ya tomados
  const [dayAttendance, setDayAttendance] = useState<{ student_id: string; schedule_id: string; status: string }[]>([]);
  const [loadingDayAttendance, setLoadingDayAttendance] = useState(false);

  // -------------------------------------------------------------------------
  // Reset al abrir
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!isOpen) return;
    setMode('recovery');
    setRecoveryDate(initialDate ?? '');
    setSelectedScheduleId(initialScheduleId ?? '');
    setSelectedStudentId(initialStudentId ?? '');
    setSelectedAbsenceDate(initialAbsenceDate ?? '');
    setNotes('');
    setRecoverableAbsences([]);
    setDayAttendance([]);
  }, [isOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  // Al cambiar de modo, limpiar alumno/ausencia (solo si no hay pre-selección)
  useEffect(() => {
    if (!isOpen) return;
    if (!initialStudentId) setSelectedStudentId('');
    if (!initialAbsenceDate) setSelectedAbsenceDate('');
    setRecoverableAbsences([]);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Horarios disponibles para el día de recoveryDate
  // -------------------------------------------------------------------------
  const recoveryDayOfWeek = recoveryDate ? DAY_OF_WEEK_MAP[getDay(parseISO(recoveryDate))] : null;

  const schedulesForDay = recoveryDayOfWeek
    ? [...allSchedules]
        .filter((sc) => sc.day_of_week === recoveryDayOfWeek)
        .sort((a, b) => {
          const d = (DAY_ORDER[a.day_of_week] ?? 9) - (DAY_ORDER[b.day_of_week] ?? 9);
          return d !== 0 ? d : a.start_time.localeCompare(b.start_time);
        })
    : [];

  // Al cambiar la fecha: intentar pre-seleccionar el mismo horario habitual del alumno (por start_time).
  // Si no hay match exacto, resetear si el horario actual ya no aplica para ese día.
  useEffect(() => {
    if (!recoveryDate) return;

    if (fromStudent && initialStudentId) {
      const student = allStudents.find((s) => s.id === initialStudentId);
      const studentSchedule = student ? allSchedules.find((sc) => sc.id === student.schedule_id) : null;
      if (studentSchedule) {
        const matching = schedulesForDay.find((sc) => sc.start_time === studentSchedule.start_time);
        if (matching) {
          setSelectedScheduleId(matching.id);
          return;
        }
      }
    }

    // Fallback: si el horario actual ya no es válido para este día, resetearlo
    if (selectedScheduleId) {
      const stillValid = schedulesForDay.some((sc) => sc.id === selectedScheduleId);
      if (!stillValid) setSelectedScheduleId('');
    }
  }, [recoveryDate]); // eslint-disable-line react-hooks/exhaustive-deps

  // -------------------------------------------------------------------------
  // Asistencia del día elegido (todos los horarios), para cupos reales y alumnos tomados
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!recoveryDate) {
      setDayAttendance([]);
      return;
    }
    const fetch = async () => {
      setLoadingDayAttendance(true);
      const { data } = await supabase
        .from('attendance')
        .select('student_id, schedule_id, status')
        .eq('class_date', recoveryDate);
      if (data) {
        setDayAttendance(data as { student_id: string; schedule_id: string; status: string }[]);
      }
      setLoadingDayAttendance(false);
    };
    fetch();
  }, [recoveryDate]);

  // Alumnos ya presentes (no-ausentes) en el horario seleccionado para esa fecha
  const takenStudentIds = new Set(
    dayAttendance
      .filter((a) => a.schedule_id === selectedScheduleId && a.status !== 'absent')
      .map((a) => a.student_id)
  );

  // -------------------------------------------------------------------------
  // Cupos reales ocupados de un horario para recoveryDate:
  // alumnos habituales que asisten ese día (sin contar ausentes/movidos a otro horario)
  // + alumnos externos con recuperación/cambio de día hacia ese horario
  // -------------------------------------------------------------------------
  const getOccupiedCount = (scheduleId: string) => {
    const baseRoster = allStudents.filter((s) => s.schedule_id === scheduleId);
    const baseRosterIds = new Set(baseRoster.map((s) => s.id));

    let occupied = 0;
    for (const s of baseRoster) {
      const record = dayAttendance.find((a) => a.student_id === s.id);
      if (!record) {
        occupied += 1; // sin novedades, asiste normalmente
      } else if (record.schedule_id === scheduleId && record.status !== 'absent') {
        occupied += 1; // sigue asistiendo a este horario
      }
      // si está ausente o se movió a otro horario, libera el cupo acá
    }

    for (const a of dayAttendance) {
      if (a.schedule_id === scheduleId && !baseRosterIds.has(a.student_id) &&
          (a.status === 'recovery' || a.status === 'day_switch')) {
        occupied += 1; // alumno externo que ocupa un cupo este día
      }
    }

    return occupied;
  };

  // -------------------------------------------------------------------------
  // Alumnos elegibles para el selector
  // -------------------------------------------------------------------------
  const eligibleStudents = allStudents.filter((s) => {
    if (takenStudentIds.has(s.id)) return false;
    if (mode === 'day_switch') {
      if (!s.schedule_id) return false;
      const sc = allSchedules.find((x) => x.id === s.schedule_id);
      if (!sc) return false;
      return sc.day_of_week !== recoveryDayOfWeek;
    }
    return true;
  });

  const sortedEligible = [...eligibleStudents].sort((a, b) => {
    const schA = allSchedules.find((sc) => sc.id === a.schedule_id);
    const schB = allSchedules.find((sc) => sc.id === b.schedule_id);
    const dayA = schA ? (DAY_ORDER[schA.day_of_week] ?? 9) : 9;
    const dayB = schB ? (DAY_ORDER[schB.day_of_week] ?? 9) : 9;
    if (dayA !== dayB) return dayA - dayB;
    return (schA?.start_time ?? '').localeCompare(schB?.start_time ?? '');
  });

  // -------------------------------------------------------------------------
  // Cargar ausencias recuperables (solo cuando la ausencia NO está pre-conocida)
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (initialAbsenceDate) return; // ya la tenemos, no necesitamos buscar
    if (mode !== 'recovery' || !selectedStudentId || !recoveryDate) {
      setRecoverableAbsences([]);
      return;
    }
    const fetchAbs = async () => {
      setLoadingAbsences(true);
      setSelectedAbsenceDate('');
      const twoMonthsAgo = new Date(recoveryDate);
      twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
      const fromDate = twoMonthsAgo.toISOString().slice(0, 10);
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('student_id', selectedStudentId)
        .gte('class_date', fromDate);
      if (data) {
        const eligible = getRecoverableAbsences(data as Attendance[], parseISO(recoveryDate));
        setRecoverableAbsences(eligible);
      }
      setLoadingAbsences(false);
    };
    fetchAbs();
  }, [selectedStudentId, mode, recoveryDate, initialAbsenceDate]);

  // -------------------------------------------------------------------------
  // Datos de display para el alumno pre-seleccionado
  // -------------------------------------------------------------------------
  const lockedStudent = fromStudent ? allStudents.find((s) => s.id === initialStudentId) : null;
  const lockedStudentSchedule = lockedStudent
    ? allSchedules.find((sc) => sc.id === lockedStudent.schedule_id)
    : null;

  // -------------------------------------------------------------------------
  // Guardar
  // -------------------------------------------------------------------------
  const handleSave = async () => {
    if (!recoveryDate) { toast({ title: 'Seleccioná una fecha', variant: 'destructive' }); return; }
    if (!selectedScheduleId) { toast({ title: 'Seleccioná un horario', variant: 'destructive' }); return; }
    if (!selectedStudentId) { toast({ title: 'Seleccioná un alumno', variant: 'destructive' }); return; }
    if (mode === 'recovery' && !selectedAbsenceDate) {
      toast({ title: 'Seleccioná la clase a recuperar', variant: 'destructive' }); return;
    }

    // Validar regla de recuperación si la ausencia es pre-conocida
    if (mode === 'recovery' && selectedAbsenceDate && recoveryDate) {
      const valid = canRecoverAbsence(parseISO(selectedAbsenceDate), parseISO(recoveryDate));
      if (!valid) {
        toast({
          title: 'No se puede recuperar',
          description: 'Las clases del mes anterior solo se pueden recuperar durante la primera semana del mes siguiente.',
          variant: 'destructive',
        });
        return;
      }
    }

    setSaving(true);
    const student = allStudents.find((s) => s.id === selectedStudentId)!;

    if (mode === 'recovery') {
      // Si el alumno tiene un registro 'absent' en recoveryDate por el constraint unique,
      // el upsert lo pisa correctamente con los datos de recuperación.
      const { error } = await supabase.from('attendance').upsert(
        {
          student_id: selectedStudentId,
          schedule_id: selectedScheduleId,
          class_date: recoveryDate,
          status: 'recovery',
          original_schedule_id: student.schedule_id,
          recovery_source_date: selectedAbsenceDate,
          notes: notes || null,
        },
        { onConflict: 'student_id,class_date' }
      );
      if (error) {
        toast({ title: 'Error al guardar', description: error.message, variant: 'destructive' });
        setSaving(false); return;
      }
    } else {
      // day_switch
      const { error: switchError } = await supabase.from('attendance').upsert(
        {
          student_id: selectedStudentId,
          schedule_id: selectedScheduleId,
          class_date: recoveryDate,
          status: 'day_switch',
          original_schedule_id: student.schedule_id,
          notes: notes || null,
        },
        { onConflict: 'student_id,class_date' }
      );
      if (switchError) {
        toast({ title: 'Error al guardar', description: switchError.message, variant: 'destructive' });
        setSaving(false); return;
      }
    }

    toast({ title: mode === 'recovery' ? 'Recuperación registrada' : 'Cambio de día registrado' });
    setSaving(false);
    onSaved();
    onClose();
  };

  const formatAbsenceLabel = (absence: Attendance) => {
    const date = parseISO(absence.class_date);
    const schedule = allSchedules.find((sc) => sc.id === absence.schedule_id);
    const dayLabel = schedule ? DAY_NAMES[schedule.day_of_week] ?? '' : '';
    return `${format(date, "d 'de' MMMM", { locale: es })} (${dayLabel})`;
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------
  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {mode === 'recovery' ? 'Registrar recuperación' : 'Registrar cambio de día'}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">

          {/* ── ALUMNO BLOQUEADO (flujo desde nombre de alumno) ── */}
          {fromStudent && lockedStudent && (
            <div className="space-y-1.5">
              <Label>Alumno</Label>
              <div className="flex items-center gap-2 px-3 py-2 border rounded-md bg-muted/50">
                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm font-medium">
                  {lockedStudent.first_name} {lockedStudent.last_name}
                </span>
                {lockedStudentSchedule && (
                  <span className="text-xs text-muted-foreground ml-1">
                    — {DAY_NAMES[lockedStudentSchedule.day_of_week]} {lockedStudentSchedule.start_time.slice(0, 5)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── TIPO ── */}
          <div className="space-y-1.5">
            <Label>Tipo</Label>
            <div className="flex gap-2">
              <Button variant={mode === 'recovery' ? 'default' : 'outline'} size="sm" onClick={() => setMode('recovery')}>
                Recuperación
              </Button>
              <Button variant={mode === 'day_switch' ? 'default' : 'outline'} size="sm" onClick={() => setMode('day_switch')}>
                Cambio de día
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {mode === 'recovery'
                ? 'El alumno recupera una clase que faltó (del mes actual o primera semana del anterior).'
                : 'El alumno asiste otro día en lugar de su día habitual (misma semana). Se marcará ausente en su día original.'}
            </p>
          </div>

          {/* ── CLASE A RECUPERAR BLOQUEADA (flujo desde alumno, ausencia conocida) ── */}
          {fromStudent && initialAbsenceDate && mode === 'recovery' && (
            <div className="space-y-1.5">
              <Label>Clase a recuperar</Label>
              <div className="px-3 py-2 border rounded-md bg-muted/50 text-sm">
                {format(parseISO(initialAbsenceDate), "EEEE d 'de' MMMM", { locale: es })}
                {lockedStudentSchedule && (
                  <span className="text-muted-foreground ml-1">
                    ({lockedStudentSchedule.start_time.slice(0, 5)} – {lockedStudentSchedule.end_time.slice(0, 5)})
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── FECHA DE ASISTENCIA (cuando va a recuperar) ── */}
          <div className="space-y-1.5">
            <Label>
              {fromStudent ? 'Fecha en que asistirá' : 'Fecha de asistencia'}
            </Label>
            <input
              type="date"
              value={recoveryDate}
              onChange={(e) => {
                setRecoveryDate(e.target.value);
                if (!initialStudentId) setSelectedStudentId('');
                if (!initialAbsenceDate) setSelectedAbsenceDate('');
              }}
              className="w-full border rounded-md px-3 py-1.5 text-sm bg-background"
            />
            {recoveryDate && (
              <p className="text-xs text-muted-foreground capitalize">
                {format(parseISO(recoveryDate), "EEEE d 'de' MMMM yyyy", { locale: es })}
              </p>
            )}
          </div>

          {/* ── HORARIO ── */}
          <div className="space-y-1.5">
            <Label>Horario</Label>
            {!recoveryDate ? (
              <p className="text-sm text-muted-foreground">Seleccioná una fecha primero.</p>
            ) : schedulesForDay.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay horarios para ese día.</p>
            ) : (
              <Select
                value={selectedScheduleId}
                onValueChange={(v) => {
                  setSelectedScheduleId(v);
                  // Solo resetear alumno si no viene pre-seleccionado
                  if (!initialStudentId) setSelectedStudentId('');
                  if (!initialAbsenceDate) setSelectedAbsenceDate('');
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccioná un horario..." />
                </SelectTrigger>
                <SelectContent>
                  {schedulesForDay.map((sc) => {
                    const occupied = getOccupiedCount(sc.id);
                    const isFull = occupied >= sc.max_capacity;
                    return (
                      <SelectItem key={sc.id} value={sc.id}>
                        {sc.start_time.slice(0, 5)} – {sc.end_time.slice(0, 5)}
                        <span className={isFull ? 'text-destructive ml-1' : 'text-muted-foreground ml-1'}>
                          ({occupied}/{sc.max_capacity}{isFull ? ' · sin cupo' : ''})
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            )}
          </div>

          {/* ── SELECTOR DE ALUMNO (solo flujo desde slot, no desde alumno) ── */}
          {!fromStudent && selectedScheduleId && (
            <div className="space-y-1.5">
              <Label>Alumno</Label>
              {loadingDayAttendance ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
                </div>
              ) : (
                <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná un alumno..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sortedEligible.length === 0 ? (
                      <SelectItem value="__empty" disabled>No hay alumnos elegibles</SelectItem>
                    ) : (
                      sortedEligible.map((s) => {
                        const schedule = allSchedules.find((sc) => sc.id === s.schedule_id);
                        const scheduleLabel = schedule
                          ? ` — ${DAY_NAMES[schedule.day_of_week] ?? ''} ${schedule.start_time.slice(0, 5)}`
                          : '';
                        return (
                          <SelectItem key={s.id} value={s.id}>
                            {s.first_name} {s.last_name}{scheduleLabel}
                          </SelectItem>
                        );
                      })
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* ── SELECTOR DE CLASE A RECUPERAR (flujo desde slot, sin ausencia pre-conocida) ── */}
          {!initialAbsenceDate && mode === 'recovery' && selectedStudentId && recoveryDate && (
            <div className="space-y-1.5">
              <Label>Clase a recuperar</Label>
              {loadingAbsences ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Buscando ausencias...
                </div>
              ) : recoverableAbsences.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No hay clases recuperables para este alumno en esta fecha.
                </p>
              ) : (
                <Select value={selectedAbsenceDate} onValueChange={setSelectedAbsenceDate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccioná la clase..." />
                  </SelectTrigger>
                  <SelectContent>
                    {recoverableAbsences.map((absence) => (
                      <SelectItem key={absence.id} value={absence.class_date}>
                        {formatAbsenceLabel(absence)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          )}

          {/* ── NOTAS ── */}
          <div className="space-y-1.5">
            <Label>Notas (opcional)</Label>
            <Textarea
              placeholder="Observaciones..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
