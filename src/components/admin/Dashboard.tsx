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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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

const buildWhatsAppUrl = (phone: string): string => {
  const clean = phone.replace(/\D/g, '');
  return `https://wa.me/54${clean}`;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MethodBreakdown {
  method: PaymentMethod;
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
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const currentMonth = getCurrentMonth();

      const [salesRes, studentsRes, inventoryRes, paymentsRes] = await Promise.all([
        supabase.from('sales').select('*').gte('created_at', startOfMonth),
        supabase.from('students').select('*'),
        supabase.from('inventory').select('*'),
        supabase.from('payments').select('student_id, status').eq('month', currentMonth),
      ]);

      if (salesRes.error) throw salesRes.error;
      if (studentsRes.error) throw studentsRes.error;
      if (inventoryRes.error) throw inventoryRes.error;

      const sales = (salesRes.data ?? []) as Sale[];
      const students = (studentsRes.data ?? []) as Student[];
      const inventory = (inventoryRes.data ?? []) as InventoryItem[];

      // Mapa student_id → status de pago del mes actual
      const paymentsMap: Record<string, string> = {};
      if (paymentsRes.data) {
        for (const p of paymentsRes.data) {
          paymentsMap[p.student_id] = p.status;
        }
      }

      // Cuotas
      const cuotasPaid = students.filter((s) => paymentsMap[s.id] === 'paid').length;
      const cuotasPartial = students.filter((s) => paymentsMap[s.id] === 'partial').length;
      const cuotasPending = students.filter(
        (s) => !paymentsMap[s.id] || paymentsMap[s.id] === 'pending'
      ).length;
      const pendingStudents = students.filter(
        (s) => !paymentsMap[s.id] || paymentsMap[s.id] === 'pending'
      );

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

      setData({
        currentMonth,
        cuotasPaid,
        cuotasPartial,
        cuotasPending,
        totalStudents: students.length,
        pendingStudents,
        totalRevenue,
        paidRevenue,
        pendingRevenue,
        transactionCount,
        pendingTransactionCount,
        methodBreakdown,
        lowStockItems,
        birthdayStudents,
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
  }, [fetchData]);

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
    totalRevenue,
    paidRevenue,
    pendingRevenue,
    transactionCount,
    pendingTransactionCount,
    methodBreakdown,
    lowStockItems,
    birthdayStudents,
  } = data;

  const paidProgress =
    totalStudents > 0 ? Math.round((cuotasPaid / totalStudents) * 100) : 0;

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">
          Resumen — {formatMonth(currentMonth)}
        </h1>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Actualizar
        </Button>
      </div>

      {/* ── Row 1: KPI Cards ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

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

        {/* Card 3: Cobros pendientes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Cobros pendientes
            </CardTitle>
            <Clock className="h-5 w-5 text-amber-500" />
          </CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-bold text-amber-600">
              {formatCurrency(pendingRevenue)}
            </p>
            <p className="text-xs text-muted-foreground">
              {pendingTransactionCount}{' '}
              {pendingTransactionCount === 1 ? 'venta' : 'ventas'} sin cobrar
            </p>
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
      </div>

      {/* ── Row 2: Cuotas pendientes + Ventas por método ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Cuotas pendientes */}
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Cuotas pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            {pendingStudents.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-6 text-center text-muted-foreground">
                <CheckCircle className="h-8 w-8 text-green-500" />
                <p className="text-sm font-medium">¡Todos al día!</p>
              </div>
            ) : (
              <ul className="divide-y">
                {pendingStudents.map((student) => (
                  <li
                    key={student.id}
                    className="flex items-center justify-between py-2"
                  >
                    <span className="text-sm font-medium">
                      {student.first_name} {student.last_name}
                    </span>
                    {student.phone && (
                      <a
                        href={buildWhatsAppUrl(student.phone)}
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
                        href={buildWhatsAppUrl(student.phone)}
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
    </div>
  );
}
