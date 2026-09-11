import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  Student,
  Sale,
  InventoryItem,
  PaymentMethod,
  PAYMENT_METHOD_LABELS,
  MONTH_NAMES,
} from '@/types/database';
import { formatCurrency } from '@/lib/format';
import { isStudentActiveThisMonth } from '@/lib/utils';
import { sendTemplateMessage, sendTemplateMessageBulk, whatsAppChatUrl, type BulkTemplateTarget } from '@/lib/whatsapp';
import type { TemplateKey } from '@/lib/messageTemplates';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { Input } from '@/components/ui/input';
import {
  Users,
  ShoppingCart,
  Package,
  Cake,
  MessageCircle,
  AlertTriangle,
  TrendingUp,
  Clock,
  CheckCircle,
  RefreshCw,
  Bell,
  ClipboardCheck,
  Pencil,
  Search,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonth = (monthStr: string): string => {
  const [year, month] = monthStr.split('-');
  return `${MONTH_NAMES[month]} ${year}`;
};

const formatMonthShort = (monthStr: string): string => {
  const [year, month] = monthStr.split('-');
  const name = MONTH_NAMES[month] ?? month;
  return `${name.slice(0, 3)} ${year.slice(2)}`;
};

const isBirthdayThisWeek = (birthday: string | null): boolean => {
  if (!birthday) return false;
  const today = new Date();
  const bDay = new Date(birthday);
  for (let i = 0; i < 7; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + i);
    if (
      bDay.getMonth() === checkDate.getMonth() &&
      bDay.getDate() === checkDate.getDate()
    ) {
      return true;
    }
  }
  return false;
};

const formatBirthday = (birthday: string): string => {
  const [, month, day] = birthday.split('-');
  return `${day}/${month}`;
};

// WhatsApp helper removed – using shared utilities from @/lib/whatsapp

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MethodBreakdown {
  method: PaymentMethod;
  label: string;
  amount: number;
  count: number;
}

interface HistoricPoint {
  month: string;
  label: string;
  amount: number;
  count: number;
}

interface DashboardData {
  currentMonth: string;
  // Cuotas
  cuotasPaid: number;
  cuotasPartial: number;
  cuotasPending: number;
  totalStudents: number;
  pendingStudents: Student[];
  partialStudents: Student[];
  /** IDs de alumnos a los que ya se les mandó el recordatorio de cuota este mes. */
  remindedStudentIds: Set<string>;
  cuotasPaidAmount: number;
  cuotasPartialAmount: number;
  // Ventas
  totalRevenue: number;
  paidRevenue: number;
  pendingRevenue: number;
  transactionCount: number;
  pendingTransactionCount: number;
  methodBreakdown: MethodBreakdown[];
  // Inventario
  lowStockItems: InventoryItem[];
  // Cumpleaños
  birthdayStudents: Student[];
  // Histórico
  historicData: HistoricPoint[];
  // Pedidos
  pendingOrdersCount: number;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

// Se usa como template_key al consultar/loguear en whatsapp_message_log — no confundir con
// el nombre de la plantilla de Meta (eso vive en messageTemplates.ts / templates.ts).
const REMINDER_MSG_KEY = 'msg_reminder_pago';

interface DashboardProps {
  refreshTrigger?: number;
}

export default function Dashboard({ refreshTrigger }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [pendingSearch, setPendingSearch] = useState('');
  const [selectedReminderIds, setSelectedReminderIds] = useState<Set<string>>(new Set());
  const [sendingReminderId, setSendingReminderId] = useState<string | null>(null);
  const [bulkSendingReminders, setBulkSendingReminders] = useState(false);
  // Optimista: se suma a data.remindedStudentIds sin esperar a recargar todo el dashboard.
  const [justRemindedIds, setJustRemindedIds] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  const CUOTA_KEY_ADULTO = 'cuota_adulto';
  const CUOTA_KEY_NINO   = 'cuota_nino';
  const RECARGO_KEY = 'recargo_percent';
  const [cuotaAdulto, setCuotaAdulto] = useState<string>('');
  const [cuotaNino, setCuotaNino] = useState<string>('');
  // cuota_adulto/cuota_nino guardan el precio SIN el recargo por método de pago (se cargan
  // así a propósito para que el total en Ventas cierre redondo) — para los recordatorios de
  // WhatsApp necesitamos el precio final real, así que le sumamos este recargo acá.
  const [recargoPercent, setRecargoPercent] = useState<number>(0);
  const [editingCuota, setEditingCuota] = useState<'adulto' | 'niño' | null>(null);

  const handleSaveCuota = async (cat: 'adulto' | 'niño') => {
    const raw = cat === 'adulto' ? cuotaAdulto : cuotaNino;
    const key = cat === 'adulto' ? CUOTA_KEY_ADULTO : CUOTA_KEY_NINO;
    const val = parseFloat(raw);
    if (!raw || isNaN(val) || val <= 0) {
      toast({ title: 'Ingresá un precio válido', variant: 'destructive' });
      return;
    }
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key, value: val.toString(), updated_at: new Date().toISOString() });
    if (error) {
      toast({ title: 'Error al guardar la cuota', variant: 'destructive' });
      return;
    }
    setEditingCuota(null);
    toast({ title: `Cuota ${cat} actualizada a ${formatCurrency(val)}` });
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const currentMonth = getCurrentMonth();

      // Build last 12 months range for historic query
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString();

      const [salesRes, studentsRes, inventoryRes, paymentsRes, historicRes, ordersRes, cuotaSettingsRes, reminderLogRes] = await Promise.all([
        supabase.from('sales').select('*').gte('created_at', startOfMonth),
        supabase.from('students').select('*'),
        supabase.from('inventory').select('*'),
        supabase.from('payments').select('student_id, status, amount').eq('month', currentMonth),
        supabase
          .from('payments')
          .select('month, status, amount, student_id')
          .gte('month', currentMonth.slice(0, 7).replace(/-\d+$/, '') + '-01' /* fallback */)
          .gte('payment_date', twelveMonthsAgo)
          .in('status', ['paid', 'partial']),
        supabase.from('mold_orders').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('app_settings').select('key, value').in('key', [CUOTA_KEY_ADULTO, CUOTA_KEY_NINO, RECARGO_KEY]),
        supabase
          .from('whatsapp_message_log')
          .select('related_entity_id')
          .eq('template_key', REMINDER_MSG_KEY)
          .eq('related_entity_type', 'student')
          .eq('status', 'sent')
          .gte('created_at', startOfMonth),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (studentsRes.error) throw studentsRes.error;
      if (inventoryRes.error) throw inventoryRes.error;

      const sales = (salesRes.data ?? []) as Sale[];
      // Ocultar alumnos cuya inscripción señada/pagada aún no llegó al mes de inicio
      const students = ((studentsRes.data ?? []) as Student[]).filter(isStudentActiveThisMonth);
      const inventory = (inventoryRes.data ?? []) as InventoryItem[];

      // Precios configurados (fallback cuando amount es null)
      const cuotaSettings: Record<string, string> = {};
      for (const s of cuotaSettingsRes.data ?? []) cuotaSettings[s.key] = s.value;
      const precioAdulto = parseFloat(cuotaSettings[CUOTA_KEY_ADULTO] ?? '0') || 0;
      const precioNino   = parseFloat(cuotaSettings[CUOTA_KEY_NINO] ?? '0') || 0;
      const getPrecio = (cat: string) => cat === 'niño' ? precioNino : precioAdulto;
      setCuotaAdulto(cuotaSettings[CUOTA_KEY_ADULTO] ?? '');
      setCuotaNino(cuotaSettings[CUOTA_KEY_NINO] ?? '');
      setRecargoPercent(parseFloat(cuotaSettings[RECARGO_KEY] ?? '0') || 0);

      // Mapa student_id → { status, amount, categoria }
      const categoriaMap: Record<string, string> = {};
      for (const s of students) categoriaMap[s.id] = s.categoria ?? 'adulto';

      const paymentsMap: Record<string, { status: string; amount: number | null; categoria: string }> = {};
      if (paymentsRes.data) {
        for (const p of paymentsRes.data) {
          paymentsMap[p.student_id] = {
            status: p.status,
            amount: p.amount,
            categoria: categoriaMap[p.student_id] ?? 'adulto',
          };
        }
      }

      // Cuotas: solo alumnos con horario asignado deben cuota (sin horario, no cursa).
      // El registro de pago (pagado/parcial/pendiente) sigue existiendo normalmente para
      // los marcados como excepción (alumno.is_exception, persistente hasta que se sac) —
      // la excepción solo los saca de la lista de avisos de WhatsApp (pendingStudents/
      // partialStudents), no de los contadores del Dashboard.
      const studentsWithSchedule = students.filter((s) => s.schedule_id);
      const cuotasPaid = studentsWithSchedule.filter((s) => paymentsMap[s.id]?.status === 'paid').length;
      const cuotasPartial = studentsWithSchedule.filter((s) => paymentsMap[s.id]?.status === 'partial').length;
      const cuotasPending = studentsWithSchedule.filter(
        (s) => !paymentsMap[s.id] || paymentsMap[s.id].status === 'pending'
      ).length;
      const pendingStudents = studentsWithSchedule.filter(
        (s) => (!paymentsMap[s.id] || paymentsMap[s.id].status === 'pending') && !s.is_exception
      );
      const partialStudents = studentsWithSchedule.filter(
        (s) => paymentsMap[s.id]?.status === 'partial' && !s.is_exception
      );
      const remindedStudentIds = new Set(
        (reminderLogRes.data ?? [])
          .map((r) => r.related_entity_id as string | null)
          .filter((id): id is string => !!id)
      );

      // Ingresos por cuotas: si amount es null, usamos el precio configurado según categoría
      const cuotasPartialAmount = Object.values(paymentsMap)
        .filter((p) => p.status === 'partial')
        .reduce((sum, p) => sum + (p.amount ?? 0), 0);
      const cuotasPaidAmount = Object.values(paymentsMap)
        .filter((p) => p.status === 'paid')
        .reduce((sum, p) => sum + (p.amount && p.amount > 0 ? p.amount : getPrecio(p.categoria)), 0);

      // Ventas
      const totalRevenue = sales.reduce((sum, s) => sum + (s.total_amount ?? 0), 0);
      const paidSales = sales.filter((s) => s.payment_status === 'paid');
      const pendingSales = sales.filter((s) => s.payment_status !== 'paid');
      const paidRevenue = paidSales.reduce((sum, s) => sum + (s.total_amount ?? 0), 0);
      const pendingRevenue = pendingSales.reduce((sum, s) => sum + (s.total_amount ?? 0), 0);
      const transactionCount = sales.length;
      const pendingTransactionCount = pendingSales.length;

      const allMethods: PaymentMethod[] = ['cash', 'card', 'transfer', 'mercadopago'];
      const methodBreakdown: MethodBreakdown[] = allMethods
        .map((method) => {
          const subset = sales.filter((s) => s.payment_method === method);
          return {
            method,
            label: PAYMENT_METHOD_LABELS[method],
            amount: subset.reduce((sum, s) => sum + (s.total_amount ?? 0), 0),
            count: subset.length,
          };
        })
        .filter((m) => m.count > 0);

      // Inventario bajo stock
      const lowStockItems = inventory.filter((i) => i.quantity <= i.min_stock);

      // Cumpleaños esta semana
      const birthdayStudents = students.filter((s) => isBirthdayThisWeek(s.birthday));

      // Histórico: agrupar por mes
      const historicMap: Record<string, { amount: number; count: number }> = {};
      // Generar los últimos 12 meses como keys base
      for (let i = 11; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        historicMap[key] = { amount: 0, count: 0 };
      }
      if (historicRes.data) {
        for (const p of historicRes.data) {
          if (historicMap[p.month] !== undefined) {
            const cat = categoriaMap[(p as { student_id?: string }).student_id ?? ''] ?? 'adulto';
            const fallback = p.status === 'paid' ? getPrecio(cat) : 0;
            historicMap[p.month].amount += (p.amount && p.amount > 0 ? p.amount : fallback);
            historicMap[p.month].count += 1;
          }
        }
      }
      const historicData: HistoricPoint[] = Object.entries(historicMap).map(([month, v]) => ({
        month,
        label: formatMonthShort(month),
        amount: v.amount,
        count: v.count,
      }));

      setData({
        currentMonth,
        cuotasPaid,
        cuotasPartial,
        cuotasPending,
        totalStudents: studentsWithSchedule.length,
        pendingStudents,
        partialStudents,
        remindedStudentIds,
        cuotasPaidAmount,
        cuotasPartialAmount,
        totalRevenue,
        paidRevenue,
        pendingRevenue,
        transactionCount,
        pendingTransactionCount,
        methodBreakdown,
        lowStockItems,
        birthdayStudents,
        historicData,
        pendingOrdersCount: ordersRes.count ?? 0,
      });
    } catch (err) {
      console.error('Dashboard fetchData error:', err);
      setError('No se pudieron cargar los datos del dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData, refreshTrigger]);

  // ---------------------------------------------------------------------------
  // Skeletons durante carga
  // ---------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="space-y-6 p-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-9 w-28" />
        </div>
        {/* Row 1 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
        {/* Rows 2-3 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-48 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Error
  // ---------------------------------------------------------------------------

  if (error || !data) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
        <AlertTriangle className="h-10 w-10 text-destructive" />
        <p className="text-muted-foreground">{error ?? 'Error desconocido.'}</p>
        <Button variant="outline" onClick={fetchData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Reintentar
        </Button>
      </div>
    );
  }

  const {
    currentMonth,
    cuotasPaid,
    cuotasPartial,
    cuotasPending,
    totalStudents,
    pendingStudents,
    partialStudents,
    remindedStudentIds,
    cuotasPaidAmount,
    cuotasPartialAmount,
    totalRevenue,
    paidRevenue,
    pendingRevenue,
    transactionCount,
    pendingTransactionCount,
    methodBreakdown,
    lowStockItems,
    birthdayStudents,
    historicData,
    pendingOrdersCount,
  } = data;

  // Todos los alumnos a avisar: pendientes + parciales
  const allStudentsToRemind = [
    ...pendingStudents.map((s) => ({ student: s, status: 'pending' as const })),
    ...partialStudents.map((s) => ({ student: s, status: 'partial' as const })),
  ];

  // De la base (este mes) + los que se acaban de mandar en esta sesión, sin recargar todo.
  const remindedIds = new Set([...remindedStudentIds, ...justRemindedIds]);

  // Filtrado por búsqueda en el card
  const filteredStudentsToRemind = pendingSearch
    ? allStudentsToRemind.filter(({ student }) => {
        const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
        const searchDigits = pendingSearch.replace(/\D/g, '');
        const matchesName = fullName.includes(pendingSearch.toLowerCase());
        const matchesPhone = searchDigits.length > 0 && student.phone != null &&
          student.phone.replace(/\D/g, '').includes(searchDigits);
        return matchesName || matchesPhone;
      })
    : allStudentsToRemind;

  const paidProgress =
    totalStudents > 0 ? Math.round((cuotasPaid / totalStudents) * 100) : 0;

  const monthLabel = formatMonth(currentMonth);

  // Mora: a partir del día 11 la cuota sube por tramos. El porcentaje es el mismo para
  // adultos y niños, pero el monto en pesos depende de la cuota base de cada categoría.
  const getMoraPercent = (day: number): number | null => {
    if (day <= 10) return null;
    if (day <= 15) return 10;
    if (day <= 20) return 20;
    return 30;
  };

  const buildReminderPayload = (student: Student) => {
    const percent = getMoraPercent(new Date().getDate());
    const rawPrice = (student.categoria === 'niño' ? parseFloat(cuotaNino) : parseFloat(cuotaAdulto)) || 0;
    // cuota_adulto/cuota_nino son el precio SIN el recargo por método de pago — el precio
    // final real (el que ve el alumno) le suma ese recargo.
    const basePrice = Math.round(rawPrice * (1 + recargoPercent / 100));

    if (percent === null) {
      return {
        templateKey: 'msg_reminder_pago' as const,
        variables: { nombre: student.first_name, mes: monthLabel, monto: basePrice.toLocaleString('es-AR') },
      };
    }
    const monto = Math.round(basePrice * (1 + percent / 100));
    return {
      templateKey: 'msg_recordatorio_cuota_mora' as const,
      variables: {
        nombre: student.first_name,
        mes: monthLabel,
        monto: monto.toLocaleString('es-AR'),
        porcentaje: String(percent),
      },
    };
  };

  const handleSendReminder = async (student: Student) => {
    setSendingReminderId(student.id);
    const { templateKey, variables } = buildReminderPayload(student);
    const ok = await sendTemplateMessage(
      student.phone!,
      templateKey,
      variables,
      toast,
      { type: 'student', id: student.id },
    );
    setSendingReminderId(null);
    if (ok) setJustRemindedIds((prev) => new Set(prev).add(student.id));
  };

  const toggleReminderSelected = (studentId: string) => {
    setSelectedReminderIds((prev) => {
      const next = new Set(prev);
      if (next.has(studentId)) next.delete(studentId);
      else next.add(studentId);
      return next;
    });
  };

  const selectableReminderIds = filteredStudentsToRemind
    .filter(({ student }) => student.phone && !remindedIds.has(student.id))
    .map(({ student }) => student.id);
  const allSelectableChecked =
    selectableReminderIds.length > 0 && selectableReminderIds.every((id) => selectedReminderIds.has(id));

  const toggleSelectAllReminders = () => {
    setSelectedReminderIds(allSelectableChecked ? new Set() : new Set(selectableReminderIds));
  };

  const handleSendSelectedReminders = async () => {
    const selected = allStudentsToRemind.filter(
      ({ student }) => student.phone && selectedReminderIds.has(student.id)
    );
    if (selected.length === 0) {
      toast({ title: 'Seleccioná al menos un alumno', variant: 'destructive' });
      return;
    }

    // Agrupado por plantilla (hoy siempre es la misma para todos, ya que la mora depende
    // solo de la fecha de envío — pero se agrupa por las dudas de que algún día no sea así).
    const groups = new Map<TemplateKey, BulkTemplateTarget[]>();
    for (const { student } of selected) {
      const { templateKey, variables } = buildReminderPayload(student);
      const list = groups.get(templateKey) ?? [];
      list.push({ phone: student.phone!, variables, relatedEntityId: student.id });
      groups.set(templateKey, list);
    }

    setBulkSendingReminders(true);
    const allSucceeded = new Set<string>();
    for (const [templateKey, targets] of groups) {
      const succeeded = await sendTemplateMessageBulk(templateKey, targets, toast, 'student');
      succeeded.forEach((id) => allSucceeded.add(id));
    }
    setBulkSendingReminders(false);
    setJustRemindedIds((prev) => new Set([...prev, ...allSucceeded]));
    setSelectedReminderIds(new Set());
    setReminderOpen(false);
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Resumen — {monthLabel}
        </h1>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* ── Row 1: KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">

        {/* Card 1: Ingresos del mes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ingresos del mes
            </CardTitle>
            <TrendingUp className="h-5 w-5 text-green-500" />
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold text-green-600">
              {formatCurrency(totalRevenue)}
            </p>
            <p className="text-xs text-muted-foreground">
              {transactionCount} {transactionCount === 1 ? 'venta' : 'ventas'} este mes
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              <Badge variant="secondary" className="text-xs">
                Cobrado: {formatCurrency(paidRevenue)}
              </Badge>
              <Badge variant="outline" className="text-xs">
                Pendiente: {formatCurrency(pendingRevenue)}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Cuotas del mes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cuotas del mes
            </CardTitle>
            <Users className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent className="space-y-2">
            <p className="text-2xl font-bold">
              {cuotasPaid + cuotasPartial}{' '}
              <span className="text-base font-normal text-muted-foreground">
                / {totalStudents} pagaron
              </span>
            </p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-500"
                style={{ width: `${paidProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              {cuotasPending} pendientes · {cuotasPartial} parciales
            </p>
          </CardContent>
        </Card>

        {/* Card 3: Ingresos por cuotas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Ingresos por cuotas
            </CardTitle>
            <Clock className="h-5 w-5 text-violet-500" />
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold text-violet-600">
              {formatCurrency(cuotasPaidAmount + cuotasPartialAmount)}
            </p>
            <p className="text-xs text-muted-foreground">
              recaudado en cuotas este mes
            </p>
            <div className="flex flex-wrap gap-1 pt-1">
              {cuotasPaidAmount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  Total: {formatCurrency(cuotasPaidAmount)}
                </Badge>
              )}
              {cuotasPartialAmount > 0 && (
                <Badge variant="outline" className="text-xs">
                  Parcial: {formatCurrency(cuotasPartialAmount)}
                </Badge>
              )}
            </div>

            {/* Precios de cuota configurables */}
            <div className="pt-2 border-t mt-2 space-y-1.5">
              {/* Adulto */}
              {editingCuota === 'adulto' ? (
                <div className="flex items-center gap-1.5">
                  <Input type="number" className="h-7 text-xs" placeholder="Cuota adulto"
                    value={cuotaAdulto} onChange={(e) => setCuotaAdulto(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCuota('adulto'); if (e.key === 'Escape') setEditingCuota(null); }}
                    autoFocus />
                  <Button size="sm" className="h-7 text-xs px-2" onClick={() => handleSaveCuota('adulto')}>Guardar</Button>
                </div>
              ) : (
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                  onClick={() => setEditingCuota('adulto')}>
                  <Pencil className="w-3 h-3 shrink-0" />
                  {cuotaAdulto ? `Adulto: ${formatCurrency(parseFloat(cuotaAdulto))}` : 'Fijar cuota adulto'}
                </button>
              )}
              {/* Niño */}
              {editingCuota === 'niño' ? (
                <div className="flex items-center gap-1.5">
                  <Input type="number" className="h-7 text-xs" placeholder="Cuota niño"
                    value={cuotaNino} onChange={(e) => setCuotaNino(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleSaveCuota('niño'); if (e.key === 'Escape') setEditingCuota(null); }}
                    autoFocus />
                  <Button size="sm" className="h-7 text-xs px-2" onClick={() => handleSaveCuota('niño')}>Guardar</Button>
                </div>
              ) : (
                <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                  onClick={() => setEditingCuota('niño')}>
                  <Pencil className="w-3 h-3 shrink-0" />
                  {cuotaNino ? `Niño: ${formatCurrency(parseFloat(cuotaNino))}` : 'Fijar cuota niño'}
                </button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Stock bajo */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Stock bajo
            </CardTitle>
            <Package className="h-5 w-5 text-red-500" />
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold text-red-600">{lowStockItems.length}</p>
            <p className="text-xs text-muted-foreground">
              {lowStockItems.length === 1 ? 'producto' : 'productos'} bajo mínimo
            </p>
          </CardContent>
        </Card>

        {/* Card 5: Pedidos pendientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Pedidos pendientes
            </CardTitle>
            <ClipboardCheck className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold text-orange-600">{pendingOrdersCount}</p>
            <p className="text-xs text-muted-foreground">
              {pendingOrdersCount === 1 ? 'pedido' : 'pedidos'} por preparar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ── Row 2: Cuotas pendientes + Ventas por método ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Cuotas pendientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-base">Cuotas pendientes</CardTitle>
              {allStudentsToRemind.length > 0 && (
                <Badge variant="secondary" className="text-xs">{allStudentsToRemind.length}</Badge>
              )}
            </div>
            {allStudentsToRemind.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-green-600 hover:text-green-700"
                disabled={selectedReminderIds.size === 0}
                onClick={() => setReminderOpen(true)}
              >
                <Bell className="h-4 w-4" />
                {selectedReminderIds.size > 0
                  ? `Avisar a ${selectedReminderIds.size} seleccionados`
                  : 'Avisar por WhatsApp'}
              </Button>
            )}
          </CardHeader>
          <CardContent>
            {allStudentsToRemind.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <p className="text-sm font-medium">¡Todos al día!</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nombre o teléfono..."
                    value={pendingSearch}
                    onChange={(e) => setPendingSearch(e.target.value)}
                    className="pl-8 h-8 text-sm"
                  />
                </div>
                {selectableReminderIds.length > 0 && (
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground cursor-pointer w-fit">
                    <Checkbox checked={allSelectableChecked} onCheckedChange={toggleSelectAllReminders} />
                    Seleccionar todos
                  </label>
                )}
                <ul className="divide-y max-h-64 overflow-y-auto">
                  {filteredStudentsToRemind.map(({ student, status }) => (
                    <li
                      key={student.id}
                      className="flex items-center gap-2 py-2"
                    >
                      {student.phone && (
                        <Checkbox
                          checked={selectedReminderIds.has(student.id)}
                          onCheckedChange={() => toggleReminderSelected(student.id)}
                        />
                      )}
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-sm font-medium truncate">
                          {student.first_name} {student.last_name}
                        </span>
                        {status === 'partial' && (
                          <Badge className="text-[10px] bg-yellow-500 hover:bg-yellow-600 shrink-0">Parcial</Badge>
                        )}
                        {student.categoria === 'niño' && (
                          <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-500 shrink-0">Niño</Badge>
                        )}
                        {remindedIds.has(student.id) && (
                          <Badge className="text-[10px] bg-green-600 hover:bg-green-700 shrink-0">Enviado</Badge>
                        )}
                      </div>
                      {student.phone && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-green-600 hover:text-green-700 shrink-0"
                          disabled={sendingReminderId === student.id}
                          onClick={() => handleSendReminder(student)}
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span className="text-xs">
                            {sendingReminderId === student.id ? 'Enviando...' : 'WhatsApp'}
                          </span>
                        </Button>
                      )}
                    </li>
                  ))}
                  {filteredStudentsToRemind.length === 0 && (
                    <li className="py-4 text-center text-sm text-muted-foreground">
                      Sin resultados
                    </li>
                  )}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Ventas por método de pago */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Ventas por método de pago</CardTitle>
          </CardHeader>
          <CardContent>
            {methodBreakdown.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
                <ShoppingCart className="h-8 w-8" />
                <p className="text-sm">Sin ventas este mes</p>
              </div>
            ) : (
              <ul className="divide-y">
                {methodBreakdown.map((m) => (
                  <li
                    key={m.method}
                    className="flex items-center justify-between py-2"
                  >
                    <div>
                      <span className="text-sm font-medium">{m.label}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {m.count} {m.count === 1 ? 'venta' : 'ventas'}
                      </span>
                    </div>
                    <span className="text-sm font-semibold">
                      {formatCurrency(m.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 3: Stock bajo + Cumpleaños ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Stock bajo */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Package className="h-5 w-5 text-red-500" />
            <CardTitle className="text-base">Stock bajo</CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockItems.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <p className="text-sm">Todo el inventario tiene stock suficiente</p>
              </div>
            ) : (
              <ul className="divide-y">
                {lowStockItems.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div>
                      <span className="text-sm font-medium">{item.name}</span>
                      {item.category && (
                        <span className="ml-2 text-xs text-muted-foreground capitalize">
                          {item.category}
                        </span>
                      )}
                    </div>
                    <Badge variant="destructive" className="shrink-0 text-xs">
                      {item.quantity} / mín {item.min_stock} {item.unit}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Cumpleaños esta semana */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Cake className="h-5 w-5 text-pink-500" />
            <CardTitle className="text-base">Cumpleaños esta semana</CardTitle>
          </CardHeader>
          <CardContent>
            {birthdayStudents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
                <Cake className="h-8 w-8" />
                <p className="text-sm">Sin cumpleaños esta semana</p>
              </div>
            ) : (
              <ul className="divide-y">
                {birthdayStudents.map((student) => (
                  <li
                    key={student.id}
                    className="flex items-center justify-between py-2"
                  >
                    <div>
                      <span className="text-sm font-medium">
                        {student.first_name} {student.last_name}
                      </span>
                      {student.birthday && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {formatBirthday(student.birthday)}
                        </span>
                      )}
                    </div>
                    {student.phone && (
                      <a
                        href={whatsAppChatUrl(student.phone)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 gap-1 text-green-600 hover:text-green-700"
                        >
                          <MessageCircle className="h-4 w-4" />
                          <span className="text-xs">WhatsApp</span>
                        </Button>
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Row 4: Gráfico histórico de recaudación ── */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-2">
          <TrendingUp className="h-5 w-5 text-violet-500" />
          <CardTitle className="text-base">Recaudación por cuotas — últimos 12 meses</CardTitle>
        </CardHeader>
        <CardContent>
          {historicData.every((d) => d.amount === 0) ? (
            <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
              <TrendingUp className="h-8 w-8" />
              <p className="text-sm">Sin datos de cuotas registrados</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={historicData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 11 }}
                  className="text-muted-foreground"
                />
                <YAxis
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                  className="text-muted-foreground"
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'amount') return [formatCurrency(value), 'Recaudado'];
                    if (name === 'count') return [value, 'Alumnos pagaron'];
                    return [value, name];
                  }}
                  labelFormatter={(label) => label}
                  contentStyle={{ fontSize: 12 }}
                />
                <Bar dataKey="amount" name="amount" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* ── Modal: Recordar pendientes ── */}
      <Dialog open={reminderOpen} onOpenChange={setReminderOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirmar envío — {monthLabel}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">
                Le vamos a avisar a {selectedReminderIds.size} {selectedReminderIds.size === 1 ? 'persona' : 'personas'}:
              </p>
              <ul className="divide-y rounded-lg border max-h-60 overflow-y-auto">
                {allStudentsToRemind
                  .filter(({ student }) => selectedReminderIds.has(student.id))
                  .map(({ student, status }) => (
                    <li
                      key={student.id}
                      className="flex items-center gap-2 px-3 py-2"
                    >
                      <Checkbox
                        checked
                        onCheckedChange={() => toggleReminderSelected(student.id)}
                      />
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <span className="text-sm font-medium truncate">
                          {student.first_name} {student.last_name}
                        </span>
                        {status === 'partial' && (
                          <Badge className="text-[10px] bg-yellow-500 hover:bg-yellow-600 shrink-0">Parcial</Badge>
                        )}
                        <span className="text-xs text-muted-foreground shrink-0">{student.phone}</span>
                      </div>
                    </li>
                  ))}
              </ul>
            </div>

            <div className="flex items-center justify-end gap-3 pt-1">
              <Button
                className="gap-2 shrink-0"
                onClick={handleSendSelectedReminders}
                disabled={selectedReminderIds.size === 0 || bulkSendingReminders}
              >
                <MessageCircle className="h-4 w-4" />
                {bulkSendingReminders ? 'Enviando...' : `Confirmar y enviar (${selectedReminderIds.size})`}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
