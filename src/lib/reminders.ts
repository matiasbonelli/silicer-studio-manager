import type { TemplateKey } from './messageTemplates';

/** Mora: a partir del día 11 la cuota sube por tramos. El porcentaje es el mismo para
 * adultos y niños, pero el monto en pesos depende de la cuota base de cada categoría. */
export function getMoraPercent(day: number): number | null {
  if (day <= 10) return null;
  if (day <= 15) return 10;
  if (day <= 20) return 20;
  return 30;
}

export interface CuotaSettings {
  cuotaAdulto: number;
  cuotaNino: number;
  /** Recargo por método de pago — cuota_adulto/cuota_nino se guardan SIN este recargo
   * (para que el total en Ventas cierre redondo), así que hay que sumarlo acá para el
   * precio final real que ve el alumno. */
  recargoPercent: number;
}

export interface ReminderPayload {
  templateKey: TemplateKey;
  variables: Record<string, string>;
}

/** Arma el template y las variables para el recordatorio de cuota de un alumno, eligiendo
 * entre el mensaje normal o el de mora según el día del mes en que se envía. */
export function buildPaymentReminderPayload(
  student: { first_name: string; categoria: string },
  monthLabel: string,
  settings: CuotaSettings,
  today: Date = new Date(),
): ReminderPayload {
  const percent = getMoraPercent(today.getDate());
  const rawPrice = student.categoria === 'niño' ? settings.cuotaNino : settings.cuotaAdulto;
  const basePrice = Math.round(rawPrice * (1 + settings.recargoPercent / 100));

  if (percent === null) {
    return {
      templateKey: 'msg_reminder_pago',
      variables: { nombre: student.first_name, mes: monthLabel, monto: basePrice.toLocaleString('es-AR') },
    };
  }
  const monto = Math.round(basePrice * (1 + percent / 100));
  return {
    templateKey: 'msg_recordatorio_cuota_mora',
    variables: {
      nombre: student.first_name,
      mes: monthLabel,
      monto: monto.toLocaleString('es-AR'),
      porcentaje: String(percent),
    },
  };
}
