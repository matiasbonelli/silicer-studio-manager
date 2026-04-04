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
