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
import { sendWhatsApp, sendWhatsAppBulk, whatsAppChatUrl } from '@/lib/whatsapp';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
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

const DEFAULT_REMINDER_MSG =
  'Hola [nombre], te recordamos que tenés la cuota de [mes] pendiente en Silicer Studio. ¡Cualquier consulta escribinos!';

interface DashboardProps {
  refreshTrigger?: number;
}

export default function Dashboard({ refreshTrigger }: DashboardProps) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [reminderMsg, setReminderMsg] = useState(DEFAULT_REMINDER_MSG);
  const [pendingSearch, setPendingSearch] = useState('');
  const { toast } = useToast();

  const CUOTA_KEY_ADULTO = 'silicer_cuota_adulto';
  const CUOTA_KEY_NINO   = 'silicer_cuota_niño';
  const [cuotaAdulto, setCuotaAdulto] = useState<string>(
    () => localStorage.getItem(CUOTA_KEY_ADULTO) ?? ''
  );
  const [cuotaNino, setCuotaNino] = useState<string>(
    () => localStorage.getItem(CUOTA_KEY_NINO) ?? ''
  );
  const [editingCuota, setEditingCuota] = useState<'adulto' | 'niño' | null>(null);

  const handleSaveCuota = (cat: 'adulto' | 'niño') => {
    const raw = cat === 'adulto' ? cuotaAdulto : cuotaNino;
    const key = cat === 'adulto' ? CUOTA_KEY_ADULTO : CUOTA_KEY_NINO;
    const val = parseFloat(raw);
    if (!raw || isNaN(val) || val <= 0) {
      toast({ title: 'Ingresá un precio válido', variant: 'destructive' });
      return;
    }
    localStorage.setItem(key, val.toString());
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

      const [salesRes, studentsRes, inventoryRes, paymentsRes, historicRes, ordersRes] = await Promise.all([
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
      ]);

      if (salesRes.error) throw salesRes.error;
      if (studentsRes.error) throw studentsRes.error;
      if (inventoryRes.error) throw inventoryRes.error;

      const sales = (salesRes.data ?? []) as Sale[];
      const students = (studentsRes.data ?? []) as Student[];
      const inventory = (inventoryRes.data ?? []) as InventoryItem[];

      // Precios configurados (fallback cuando amount es null)
      const precioAdulto = parseFloat(localStorage.getItem('silicer_cuota_adulto') ?? '0') || 0;
      const precioNino   = parseFloat(localStorage.getItem('silicer_cuota_niño')   ?? '0') || 0;
      const getPrecio = (cat: string) => cat === 'niño' ? precioNino : precioAdulto;

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

      // Cuotas
      const cuotasPaid = students.filter((s) => paymentsMap[s.id]?.status === 'paid').length;
      const cuotasPartial = students.filter((s) => paymentsMap[s.id]?.status === 'partial').length;
      const cuotasPending = students.filter(
        (s) => !paymentsMap[s.id] || paymentsMap[s.id].status === 'pending'
      ).length;
      const pendingStudents = students.filter(
        (s) => !paymentsMap[s.id] || paymentsMap[s.id].status === 'pending'
      );
      const partialStudents = students.filter(
        (s) => paymentsMap[s.id]?.status === 'partial'
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
        totalStudents: students.length,
        pendingStudents,
        partialStudents,
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

  const buildReminderMsg = (student: Student): string => {
    return reminderMsg
      .replace(/\[nombre\]/g, student.first_name)
      .replace(/\[mes\]/g, monthLabel);
  };

  const handleSendReminder = (student: Student) => {
    sendWhatsApp(student.phone!, buildReminderMsg(student), toast);
  };

  const handleOpenAll = () => {
    const targets = allStudentsToRemind
      .filter(({ student }) => student.phone)
      .map(({ student }) => ({ phone: student.phone!, message: buildReminderMsg(student) }));
    sendWhatsAppBulk(targets, toast);
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
            </div>
            {allStudentsToRemind.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-green-600 hover:text-green-700"
                onClick={() => setReminderOpen(true)}
              >
                <Bell className="h-4 w-4" />
                Avisar por WhatsApp
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
                <ul className="divide-y max-h-64 overflow-y-auto">
                  {filteredStudentsToRemind.map(({ student, status }) => (
                    <li
                      key={student.id}
                      className="flex items-center justify-between py-2"
                    >
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="text-sm font-medium truncate">
                          {student.first_name} {student.last_name}
                        </span>
                        {status === 'partial' && (
                          <Badge className="text-[10px] bg-yellow-500 hover:bg-yellow-600 shrink-0">Parcial</Badge>
                        )}
                        {student.categoria === 'niño' && (
                          <Badge variant="outline" className="text-[10px] border-blue-400 text-blue-500 shrink-0">Niño</Badge>
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
                            className="h-7 gap-1 text-green-600 hover:text-green-700 shrink-0"
                          >
                            <MessageCircle className="h-4 w-4" />
                            <span className="text-xs">WhatsApp</span>
                          </Button>
                        </a>
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
            <DialogTitle>Recordar cuotas pendientes — {monthLabel}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <p className="text-sm font-medium">Mensaje (editable)</p>
              <p className="text-xs text-muted-foreground">
                Usá <code className="bg-muted px-1 rounded">[nombre]</code> y{' '}
                <code className="bg-muted px-1 rounded">[mes]</code> como variables.
              </p>
              <Textarea
                value={reminderMsg}
                onChange={(e) => setReminderMsg(e.target.value)}
                rows={3}
                className="resize-none text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium">
                {pendingStudents.length} pendientes · {partialStudents.length} parciales
              </p>
              <ul className="divide-y rounded-lg border max-h-60 overflow-y-auto">
                {allStudentsToRemind.map(({ student, status }) => (
                  <li
                    key={student.id}
                    className="flex items-center justify-between px-3 py-2"
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-sm font-medium truncate">
                        {student.first_name} {student.last_name}
                      </span>
                      {status === 'partial' && (
                        <Badge className="text-[10px] bg-yellow-500 hover:bg-yellow-600 shrink-0">Parcial</Badge>
                      )}
                      {student.phone && (
                        <span className="text-xs text-muted-foreground shrink-0">{student.phone}</span>
                      )}
                    </div>
                    {student.phone ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-green-600 hover:text-green-700 shrink-0"
                        onClick={(e) => { e.stopPropagation(); handleSendReminder(student); }}
                      >
                        <MessageCircle className="h-4 w-4" />
                        <span className="text-xs">Abrir</span>
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground shrink-0">Sin teléfono</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>

            <div className="flex items-center justify-between gap-3 pt-1">
              <p className="text-xs text-muted-foreground">
                El browser puede bloquear popups al abrir todos a la vez.
              </p>
              <Button
                className="gap-2 shrink-0"
                onClick={handleOpenAll}
                disabled={allStudentsToRemind.filter(({ student }) => student.phone).length === 0}
              >
                <MessageCircle className="h-4 w-4" />
                Abrir todos
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
