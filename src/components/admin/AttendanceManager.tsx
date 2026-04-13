import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Student,
  Schedule,
  Attendance,
  AttendanceStatus,
  DAY_NAMES,
  DAY_ORDER,
  MONTH_NAMES,
} from '@/types/database';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Check,
  X,
  Plus,
  Loader2,
  CalendarDays,
  BarChart2,
  User,
  RotateCcw,
  ArrowLeftRight,
  RefreshCcw,
} from 'lucide-react';
import { format, parseISO, getDay } from 'date-fns';
import { es } from 'date-fns/locale';
import { getExpectedClassDates, isSameWeek } from '@/lib/attendance';
import AttendanceRecoveryDialog from '@/components/admin/AttendanceRecoveryDialog';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const DAY_OF_WEEK_MAP: Record<number, string> = {
  0: 'sunday', 1: 'monday', 2: 'tuesday', 3: 'wednesday',
  4: 'thursday', 5: 'friday', 6: 'saturday',
};

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const todayStr = () => format(new Date(), 'yyyy-MM-dd');

/** Ordena horarios por día de la semana luego por hora */
const sortedSchedules = (list: Schedule[]) =>
  [...list].sort((a, b) => {
    const dayDiff = (DAY_ORDER[a.day_of_week] ?? 9) - (DAY_ORDER[b.day_of_week] ?? 9);
    if (dayDiff !== 0) return dayDiff;
    return a.start_time.localeCompare(b.start_time);
  });

function statusBadge(status: AttendanceStatus | undefined) {
  if (!status) return null;
  const variants: Record<AttendanceStatus, { label: string; className: string }> = {
    present:    { label: 'Presente',      className: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' },
    absent:     { label: 'Ausente',       className: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200' },
    recovery:   { label: 'Recuperación',  className: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
    day_switch: { label: 'Cambio de día', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  };
  const v = variants[status];
  return <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${v.className}`}>{v.label}</span>;
}

function statusIcon(status: AttendanceStatus | undefined) {
  if (status === 'present')    return <Check         className="w-4 h-4 text-green-600" />;
  if (status === 'absent')     return <X             className="w-4 h-4 text-red-500" />;
  if (status === 'recovery')   return <RotateCcw     className="w-4 h-4 text-blue-500" />;
  if (status === 'day_switch') return <ArrowLeftRight className="w-4 h-4 text-purple-500" />;
  return <span className="text-muted-foreground">—</span>;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

type ViewMode = 'daily' | 'monthly';

export default function AttendanceManager() {
  const { toast } = useToast();

  const [viewMode, setViewMode] = useState<ViewMode>('daily');

  // Vista diaria
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [dayAttendance, setDayAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<string | null>(null);

  // Vista mensual
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonth());
  const [scheduleFilter, setScheduleFilter] = useState('all');
  const [monthAttendance, setMonthAttendance] = useState<Attendance[]>([]);
  const [loadingMonth, setLoadingMonth] = useState(false);

  // Reset contador
  const [resetDialog, setResetDialog] = useState<{ studentId: string; name: string } | null>(null);

  const [resetting, setResetting] = useState(false);

  // Dialog recuperación
  const [recoveryDialog, setRecoveryDialog] = useState<{
    isOpen: boolean;
    initialScheduleId?: string;
    initialStudentId?: string;
    initialAbsenceDate?: string;
  }>({ isOpen: false });

  // IDs de recuperaciones/cambios de día confirmados manualmente en esta sesión
  const [confirmedExtraIds, setConfirmedExtraIds] = useState<Set<string>>(new Set());

  // ---------------------------------------------------------------------------
  // Fetch base data
  // ---------------------------------------------------------------------------
  const fetchBaseData = useCallback(async () => {
    const [schRes, stuRes] = await Promise.all([
      supabase.from('schedules').select('*'),
      supabase.from('students').select('*, schedule:schedules(*)').order('first_name'),
    ]);
    if (schRes.data) setSchedules(schRes.data as Schedule[]);
    if (stuRes.data) setAllStudents(stuRes.data as Student[]);
  }, []);

  const fetchDayAttendance = useCallback(async (date: string) => {
    const { data } = await supabase.from('attendance').select('*').eq('class_date', date);
    if (data) setDayAttendance(data as Attendance[]);
  }, []);

  const fetchMonthAttendance = useCallback(async (month: string) => {
    setLoadingMonth(true);
    const [year, m] = month.split('-').map(Number);
    const from = `${month}-01`;
    const lastDay = new Date(year, m, 0).getDate();
    const to = `${month}-${String(lastDay).padStart(2, '0')}`;
    const { data } = await supabase
      .from('attendance').select('*').gte('class_date', from).lte('class_date', to);
    if (data) setMonthAttendance(data as Attendance[]);
    setLoadingMonth(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      setLoading(true);
      await fetchBaseData();
      await fetchDayAttendance(selectedDate);
      setLoading(false);
    };
    init();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (viewMode === 'monthly' && allStudents.length > 0) {
      fetchMonthAttendance(selectedMonth);
    }
  }, [viewMode, selectedMonth, fetchMonthAttendance, allStudents.length]);

  // ---------------------------------------------------------------------------
  // Marcar presente / ausente (toggle)
  // ---------------------------------------------------------------------------
  const markAttendance = async (student: Student, schedule: Schedule, status: 'present' | 'absent') => {
    const key = `${student.id}-${status}`;
    setSavingId(key);
    const existing = dayAttendance.find((a) => a.student_id === student.id);

    if (existing && existing.status === status) {
      const { error } = await supabase.from('attendance').delete().eq('id', existing.id);
      if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
      else setDayAttendance((prev) => prev.filter((a) => a.id !== existing.id));
      setSavingId(null);
      return;
    }

    const { data, error } = await supabase
      .from('attendance')
      .upsert({ student_id: student.id, schedule_id: schedule.id, class_date: selectedDate, status },
        { onConflict: 'student_id,class_date' })
      .select().single();

    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else if (data) {
      setDayAttendance((prev) => [...prev.filter((a) => a.student_id !== student.id), data as Attendance]);
    }
    setSavingId(null);
  };

  // ---------------------------------------------------------------------------
  // Confirmar / cancelar registro de recovery o day_switch
  // ---------------------------------------------------------------------------
  const deleteExtraRecord = async (record: Attendance) => {
    const { error } = await supabase.from('attendance').delete().eq('id', record.id);
    if (error) {
      toast({ title: 'Error al eliminar', description: error.message, variant: 'destructive' });
    } else {
      setDayAttendance((prev) => prev.filter((a) => a.id !== record.id));
      toast({ title: 'Registro eliminado' });
    }
  };

  // ---------------------------------------------------------------------------
  // Reset contador mensual de un alumno
  // ---------------------------------------------------------------------------
  const handleResetAttendance = async () => {
    if (!resetDialog) return;
    setResetting(true);
    const [year, m] = selectedMonth.split('-').map(Number);
    const from = `${selectedMonth}-01`;
    const lastDay = new Date(year, m, 0).getDate();
    const to = `${selectedMonth}-${String(lastDay).padStart(2, '0')}`;

    const { error } = await supabase
      .from('attendance')
      .delete()
      .eq('student_id', resetDialog.studentId)
      .gte('class_date', from)
      .lte('class_date', to);

    if (error) {
      toast({ title: 'Error al resetear', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Asistencia reseteada', description: `Se borraron los registros de ${resetDialog.name} para este mes.` });
      await fetchMonthAttendance(selectedMonth);
    }
    setResetting(false);
    setResetDialog(null);
  };

  // ---------------------------------------------------------------------------
  // Helpers de vista diaria
  // ---------------------------------------------------------------------------
  const selectedDayOfWeek = DAY_OF_WEEK_MAP[getDay(parseISO(selectedDate))];
  const daySchedules = sortedSchedules(schedules.filter((sc) => sc.day_of_week === selectedDayOfWeek));
  const studentsBySchedule = (id: string) => allStudents.filter((s) => s.schedule_id === id);
  const getAttendanceRecord = (studentId: string) => dayAttendance.find((a) => a.student_id === studentId);
  const getPresentIdsForSlot = (scheduleId: string) =>
    new Set(dayAttendance.filter((a) => a.schedule_id === scheduleId).map((a) => a.student_id));

  const handleRecoverySaved = async () => {
    await fetchDayAttendance(selectedDate);
    if (viewMode === 'monthly') fetchMonthAttendance(selectedMonth);
  };

  // ---------------------------------------------------------------------------
  // Vista mensual
  // ---------------------------------------------------------------------------
  const [year, month] = selectedMonth.split('-').map(Number);

  const monthlyStudents = allStudents.filter((s) => {
    if (!s.schedule_id) return false;
    if (scheduleFilter !== 'all' && s.schedule_id !== scheduleFilter) return false;
    return true;
  });

  interface StudentMonthSummary {
    student: Student;
    expectedDates: Date[];
    attendance: Record<string, AttendanceStatus>;
    count: number;
  }

  const monthlySummary: StudentMonthSummary[] = monthlyStudents.map((student) => {
    const schedule = schedules.find((s) => s.id === student.schedule_id);
    const expectedDates = schedule ? getExpectedClassDates(year, month, schedule.day_of_week) : [];

    const attendanceMap: Record<string, AttendanceStatus> = {};
    monthAttendance
      .filter((a) => a.student_id === student.id)
      .forEach((a) => {
        if (a.status === 'day_switch') {
          // Mapear el day_switch a la fecha esperada de esa misma semana
          const switchDate = parseISO(a.class_date);
          const matchingExpected = expectedDates.find((d) => isSameWeek(d, switchDate));
          const key = matchingExpected ? format(matchingExpected, 'yyyy-MM-dd') : a.class_date;
          attendanceMap[key] = a.status;
        } else if (a.status === 'recovery' && a.recovery_source_date) {
          // Mostrar la recuperación en la columna de la CLASE ORIGINAL que se está recuperando.
          // Si esa clase original está en las fechas esperadas del mes → la pisa (reemplaza 'absent').
          // Si es de un mes anterior → la mostramos igualmente en recovery_source_date
          // para que el admin sepa cuál clase cubrió (aunque no sea columna esperada,
          // el count ya la contabiliza correctamente).
          attendanceMap[a.recovery_source_date] = 'recovery';
        } else {
          attendanceMap[a.class_date] = a.status;
        }
      });

    const count = Object.values(attendanceMap).filter(
      (s) => s === 'present' || s === 'recovery' || s === 'day_switch'
    ).length;

    return { student, expectedDates, attendance: attendanceMap, count };
  });

  const maxExpected = Math.max(...monthlySummary.map((s) => s.expectedDates.length), 0);
  const sortedForFilter = sortedSchedules(schedules);

  // ---------------------------------------------------------------------------
  // Loading
  // ---------------------------------------------------------------------------
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <h2 className="text-xl font-semibold">Asistencia</h2>
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'daily' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('daily')}
          >
            <CalendarDays className="w-4 h-4 mr-1.5" />
            Vista diaria
          </Button>
          <Button
            variant={viewMode === 'monthly' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('monthly')}
          >
            <BarChart2 className="w-4 h-4 mr-1.5" />
            Resumen mensual
          </Button>
        </div>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* VISTA DIARIA                                                        */}
      {/* ------------------------------------------------------------------ */}
      {viewMode === 'daily' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <label className="text-sm font-medium">Fecha:</label>
            <input
              type="date"
              value={selectedDate}
              onChange={async (e) => {
                setSelectedDate(e.target.value);
                await fetchDayAttendance(e.target.value);
              }}
              className="border rounded-md px-3 py-1.5 text-sm bg-background"
            />
            <span className="text-sm text-muted-foreground capitalize">
              {format(parseISO(selectedDate), "EEEE d 'de' MMMM yyyy", { locale: es })}
            </span>
          </div>

          {daySchedules.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No hay horarios para este día.
              </CardContent>
            </Card>
          ) : (
            daySchedules.map((schedule) => {
              const students = studentsBySchedule(schedule.id);
              const presentIds = getPresentIdsForSlot(schedule.id);

              // Alumnos externos con recovery o day_switch en este slot
              const extraAttendance = dayAttendance.filter(
                (a) => a.schedule_id === schedule.id && !students.find((s) => s.id === a.student_id)
              );
              const extraStudents = extraAttendance
                .map((a) => ({ record: a, student: allStudents.find((s) => s.id === a.student_id) }))
                .filter((x) => x.student != null) as { record: Attendance; student: Student }[];

              return (
                <Card key={schedule.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base font-semibold">
                        {schedule.start_time.slice(0, 5)} – {schedule.end_time.slice(0, 5)}
                        <span className="ml-2 text-sm font-normal text-muted-foreground">
                          ({students.length}/{schedule.max_capacity} alumnos)
                        </span>
                      </CardTitle>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setRecoveryDialog({ isOpen: true, initialScheduleId: schedule.id })}
                      >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Recuperación / Cambio de día
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    {students.length === 0 && extraStudents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Sin alumnos asignados.</p>
                    ) : (
                      <>
                        {/* Alumnos regulares */}
                        {students.map((student) => {
                          const record = getAttendanceRecord(student.id);
                          const isPresentSaving = savingId === `${student.id}-present`;
                          const isAbsentSaving  = savingId === `${student.id}-absent`;
                          return (
                            <div
                              key={student.id}
                              className="flex items-center justify-between py-1.5 border-b last:border-0"
                            >
                              <button
                                className="flex items-center gap-2 text-left hover:opacity-70 transition-opacity"
                                title="Registrar recuperación / cambio de día para este alumno"
                                onClick={() => setRecoveryDialog({
                                  isOpen: true,
                                  initialStudentId: student.id,
                                  // La clase que faltó es la del día actual; el admin elige cuándo recupera
                                  initialAbsenceDate: selectedDate,
                                  // Sin initialScheduleId ni initialDate: el admin elige fecha+horario de recuperación
                                })}
                              >
                                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium underline decoration-dotted underline-offset-2">
                                  {student.first_name} {student.last_name}
                                </span>
                              </button>
                              <div className="flex items-center gap-2">
                                {record && statusBadge(record.status)}
                                <Button
                                  size="sm"
                                  variant={record?.status === 'present' ? 'default' : 'outline'}
                                  className={record?.status === 'present' ? 'bg-green-600 hover:bg-green-700' : ''}
                                  onClick={() => markAttendance(student, schedule, 'present')}
                                  disabled={!!savingId}
                                >
                                  {isPresentSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                                </Button>
                                <Button
                                  size="sm"
                                  variant={record?.status === 'absent' ? 'destructive' : 'outline'}
                                  onClick={() => markAttendance(student, schedule, 'absent')}
                                  disabled={!!savingId}
                                >
                                  {isAbsentSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                </Button>
                              </div>
                            </div>
                          );
                        })}

                        {/* Alumnos externos (recovery / day_switch) */}
                        {extraStudents.map(({ record, student }) => {
                          const isBusy = savingId === `extra-${record.id}`;
                          const isConfirmed = confirmedExtraIds.has(record.id);
                          return (
                            <div
                              key={student.id}
                              className="flex items-center justify-between py-1.5 border-b last:border-0 bg-muted/20 rounded px-1"
                            >
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground shrink-0" />
                                <span className="text-sm font-medium">
                                  {student.first_name} {student.last_name}
                                </span>
                                {statusBadge(record.status)}
                              </div>
                              <div className="flex items-center gap-2">
                                {/* ✓ — confirmar que el alumno vino (no elimina el registro) */}
                                <Button
                                  size="sm"
                                  variant={isConfirmed ? 'default' : 'outline'}
                                  className={isConfirmed ? 'bg-green-600 hover:bg-green-700' : ''}
                                  onClick={() => {
                                    setConfirmedExtraIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(record.id)) next.delete(record.id);
                                      else next.add(record.id);
                                      return next;
                                    });
                                  }}
                                  disabled={isBusy}
                                  title={isConfirmed ? 'Desmarcar asistencia' : 'Confirmar que vino'}
                                >
                                  <Check className="w-3.5 h-3.5" />
                                </Button>
                                {/* ✗ — no vino, elimina el registro de recuperación/cambio de día */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={async () => {
                                    setSavingId(`extra-${record.id}`);
                                    await deleteExtraRecord(record);
                                    setConfirmedExtraIds((prev) => {
                                      const next = new Set(prev);
                                      next.delete(record.id);
                                      return next;
                                    });
                                    setSavingId(null);
                                  }}
                                  disabled={isBusy}
                                  title="No vino — cancelar recuperación"
                                >
                                  {isBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <X className="w-3.5 h-3.5" />}
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* VISTA MENSUAL                                                        */}
      {/* ------------------------------------------------------------------ */}
      {viewMode === 'monthly' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Mes:</label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="border rounded-md px-3 py-1.5 text-sm bg-background"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium">Horario:</label>
              <Select value={scheduleFilter} onValueChange={setScheduleFilter}>
                <SelectTrigger className="w-52">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {sortedForFilter.map((sc) => (
                    <SelectItem key={sc.id} value={sc.id}>
                      {DAY_NAMES[sc.day_of_week]} {sc.start_time.slice(0, 5)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {loadingMonth ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : monthlySummary.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                No hay alumnos para este filtro.
              </CardContent>
            </Card>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="text-left px-4 py-3 font-medium min-w-[180px]">Alumno</th>
                    <th className="text-left px-3 py-3 font-medium text-muted-foreground text-xs">Horario</th>
                    {Array.from({ length: maxExpected }, (_, i) => (
                      <th key={i} className="text-center px-3 py-3 font-medium text-xs w-16">
                        Clase {i + 1}
                      </th>
                    ))}
                    <th className="text-center px-4 py-3 font-medium">Total</th>
                    <th className="w-10 px-2 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {monthlySummary.map(({ student, expectedDates, attendance, count }) => {
                    const schedule = schedules.find((s) => s.id === student.schedule_id);
                    return (
                      <tr key={student.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-2.5 font-medium">
                          {student.first_name} {student.last_name}
                        </td>
                        <td className="px-3 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                          {schedule ? `${DAY_NAMES[schedule.day_of_week]} ${schedule.start_time.slice(0, 5)}` : '—'}
                        </td>
                        {Array.from({ length: maxExpected }, (_, i) => {
                          const date = expectedDates[i];
                          if (!date) return (
                            <td key={i} className="px-3 py-2.5 text-center text-muted-foreground">—</td>
                          );
                          const dateStr = format(date, 'yyyy-MM-dd');
                          const status = attendance[dateStr];
                          return (
                            <td
                              key={i}
                              className="px-3 py-2.5 text-center"
                              title={format(date, "EEEE d 'de' MMMM", { locale: es })}
                            >
                              <div className="flex flex-col items-center gap-0.5">
                                <span className="text-xs text-muted-foreground">{format(date, 'd/M')}</span>
                                {statusIcon(status)}
                              </div>
                            </td>
                          );
                        })}
                        <td className="px-4 py-2.5 text-center">
                          <Badge
                            variant={
                              count >= expectedDates.length ? 'default'
                              : count === 0 ? 'destructive'
                              : 'secondary'
                            }
                          >
                            {count}/{expectedDates.length}
                          </Badge>
                        </td>
                        <td className="px-2 py-2.5 text-center">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-muted-foreground hover:text-red-600 hover:bg-red-50"
                            title="Resetear asistencia de este mes"
                            onClick={() => setResetDialog({
                              studentId: student.id,
                              name: `${student.first_name} ${student.last_name}`,
                            })}
                          >
                            <RefreshCcw className="w-3.5 h-3.5" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Leyenda */}
          <div className="flex flex-wrap gap-3 text-xs text-muted-foreground pt-1">
            <span className="flex items-center gap-1"><Check className="w-3.5 h-3.5 text-green-600" /> Presente</span>
            <span className="flex items-center gap-1"><X className="w-3.5 h-3.5 text-red-500" /> Ausente</span>
            <span className="flex items-center gap-1"><RotateCcw className="w-3.5 h-3.5 text-blue-500" /> Recuperación</span>
            <span className="flex items-center gap-1"><ArrowLeftRight className="w-3.5 h-3.5 text-purple-500" /> Cambio de día</span>
            <span className="flex items-center gap-1"><span className="text-muted-foreground">—</span> Sin registrar</span>
          </div>
        </div>
      )}

      {/* Dialog recuperación / cambio de día */}
      <AttendanceRecoveryDialog
        isOpen={recoveryDialog.isOpen}
        onClose={() => setRecoveryDialog({ isOpen: false })}
        onSaved={handleRecoverySaved}
        allStudents={allStudents}
        allSchedules={schedules}
        initialDate={recoveryDialog.initialStudentId ? undefined : selectedDate}
        initialScheduleId={recoveryDialog.initialScheduleId}
        initialStudentId={recoveryDialog.initialStudentId}
        initialAbsenceDate={recoveryDialog.initialAbsenceDate}
      />

      {/* Dialog confirmar reset */}
      <AlertDialog open={!!resetDialog} onOpenChange={(open) => { if (!open) setResetDialog(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Resetear asistencia?</AlertDialogTitle>
            <AlertDialogDescription>
              Se borrarán <strong>todos</strong> los registros de asistencia de{' '}
              <strong>{resetDialog?.name}</strong> para{' '}
              <strong>
                {selectedMonth
                  ? `${MONTH_NAMES[selectedMonth.split('-')[1]]} ${selectedMonth.split('-')[0]}`
                  : 'este mes'}
              </strong>.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={resetting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetAttendance}
              disabled={resetting}
              className="bg-destructive hover:bg-destructive/90"
            >
              {resetting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Resetear
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
