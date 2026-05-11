import {
  eachDayOfInterval,
  startOfMonth,
  endOfMonth,
  getDay,
  isSameMonth,
  subMonths,
  startOfWeek,
  endOfWeek,
  isWithinInterval,
  parseISO,
} from 'date-fns';
import type { Attendance } from '@/types/database';

const DAY_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6,
};

/**
 * Devuelve todas las fechas de un día de la semana dentro de un mes.
 * Ej: todos los lunes de abril 2026 → [6, 13, 20, 27]
 */
export function getExpectedClassDates(year: number, month: number, dayOfWeek: string): Date[] {
  const start = startOfMonth(new Date(year, month - 1));
  const end = endOfMonth(start);
  const targetDay = DAY_MAP[dayOfWeek];
  if (targetDay === undefined) return [];

  return eachDayOfInterval({ start, end }).filter((date) => getDay(date) === targetDay);
}

export function getExpectedClassCount(year: number, month: number, dayOfWeek: string): number {
  return getExpectedClassDates(year, month, dayOfWeek).length;
}

/**
 * Devuelve el fin (domingo) de la primera semana calendario del mes.
 * La primera semana calendario es la semana (lunes-domingo) que contiene el día 1 del mes.
 */
export function getFirstCalendarWeekEnd(year: number, month: number): Date {
  const firstDay = new Date(year, month - 1, 1);
  // startOfWeek con locale lunes = weekStartsOn: 1
  const weekStart = startOfWeek(firstDay, { weekStartsOn: 1 });
  return endOfWeek(weekStart, { weekStartsOn: 1 });
}

/**
 * Determina si una ausencia puede ser recuperada en la fecha dada.
 * - Mismo mes → siempre OK
 * - Mes anterior → solo si recoveryDate cae en la primera semana calendario del mes
 * - Más antiguo → NO
 */
export function canRecoverAbsence(absenceDate: Date, recoveryDate: Date): boolean {
  // Mismo mes → OK
  if (isSameMonth(absenceDate, recoveryDate)) return true;

  // Mes anterior → solo primera semana calendario
  const prevMonth = subMonths(recoveryDate, 1);
  if (isSameMonth(absenceDate, prevMonth)) {
    const weekEnd = getFirstCalendarWeekEnd(
      recoveryDate.getFullYear(),
      recoveryDate.getMonth() + 1
    );
    const weekStart = startOfWeek(new Date(recoveryDate.getFullYear(), recoveryDate.getMonth(), 1), {
      weekStartsOn: 1,
    });
    return isWithinInterval(recoveryDate, { start: weekStart, end: weekEnd });
  }

  return false;
}

/**
 * Verifica si dos fechas caen en la misma semana (lunes a domingo).
 */
export function isSameWeek(date1: Date, date2: Date): boolean {
  const start1 = startOfWeek(date1, { weekStartsOn: 1 });
  const start2 = startOfWeek(date2, { weekStartsOn: 1 });
  return start1.getTime() === start2.getTime();
}

/**
 * Dado un día de la semana (ej: 'monday') y una fecha objetivo,
 * devuelve la fecha de ese día en la misma semana.
 */
export function getDayInSameWeek(targetDate: Date, dayOfWeek: string): Date {
  const weekStart = startOfWeek(targetDate, { weekStartsOn: 1 }); // lunes
  const targetDayNum = DAY_MAP[dayOfWeek];
  if (targetDayNum === undefined) return targetDate;
  // lunes = 1, así que offset desde weekStart (lunes) = targetDayNum - 1
  // pero sunday = 0, necesitamos mapearlo a 6 (último día de la semana)
  const offset = targetDayNum === 0 ? 6 : targetDayNum - 1;
  const result = new Date(weekStart);
  result.setDate(result.getDate() + offset);
  return result;
}

/**
 * Filtra ausencias que pueden ser recuperadas en la fecha objetivo
 * y que no hayan sido ya recuperadas.
 */
export function getRecoverableAbsences(
  allRecords: Attendance[],
  targetDate: Date
): Attendance[] {
  // Obtener las fechas que ya fueron recuperadas
  const recoveredDates = new Set(
    allRecords
      .filter((r) => r.status === 'recovery' && r.recovery_source_date)
      .map((r) => r.recovery_source_date!)
  );

  return allRecords.filter((r) => {
    if (r.status !== 'absent') return false;
    if (recoveredDates.has(r.class_date)) return false;
    return canRecoverAbsence(parseISO(r.class_date), targetDate);
  });
}

/**
 * Convierte day_of_week string a nombre legible en español corto
 */
export function dayOfWeekToShort(dayOfWeek: string): string {
  const map: Record<string, string> = {
    monday: 'Lun',
    tuesday: 'Mar',
    wednesday: 'Mié',
    thursday: 'Jue',
    friday: 'Vie',
    saturday: 'Sáb',
  };
  return map[dayOfWeek] ?? dayOfWeek;
}
