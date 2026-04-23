import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const htmlEscapeMap: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(str: string): string {
  return str.replace(/[&<>"']/g, (char) => htmlEscapeMap[char]);
}

export function isNewStudent(student: { start_date: string | null }): boolean {
  if (!student.start_date) return false;
  const today = new Date().toISOString().slice(0, 10);
  return student.start_date > today;
}

/**
 * True si el mes de inicio del alumno ya empezó (mes <= mes actual).
 * Un alumno sin start_date se considera activo.
 * Se usa para ocultar inscripciones señadas/pagadas cuyo mes aún no llegó.
 */
export function isStudentActiveThisMonth(student: { start_date: string | null }): boolean {
  if (!student.start_date) return true;
  const now = new Date();
  const currentYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  return student.start_date.slice(0, 7) <= currentYM;
}

/**
 * Calcula la fecha de la primera ocurrencia de un día de la semana
 * dentro de un mes dado (YYYY-MM). Devuelve 'YYYY-MM-DD'.
 */
export function firstOccurrenceInMonth(yearMonth: string, dayOfWeek: string): string {
  const [year, month] = yearMonth.split('-').map(Number);
  const DAY_MAP: Record<string, number> = {
    sunday: 0, monday: 1, tuesday: 2, wednesday: 3,
    thursday: 4, friday: 5, saturday: 6,
  };
  const target = DAY_MAP[dayOfWeek.toLowerCase()] ?? 1;
  const date = new Date(year, month - 1, 1);
  const diff = (target - date.getDay() + 7) % 7;
  date.setDate(1 + diff);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
