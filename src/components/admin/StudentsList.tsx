import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Student, Payment, Schedule, DAY_NAMES, PAYMENT_STATUS_LABELS, PaymentStatus, MONTH_NAMES } from '@/types/database';
import { isNewStudent } from '@/lib/utils';
import { formatDate } from '@/lib/format';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Search, Loader2, MessageCircle, FileText, Trash2, DollarSign, Calendar, Users, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, ExternalLink, Download } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface StudentsListProps {
  onStudentClick: (student: Student) => void;
  refreshTrigger: number;
  onStudentDeleted?: () => void;
}

// Helper para obtener el mes actual en formato YYYY-MM
const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

// Helper para formatear mes para display
const formatMonth = (monthStr: string | null) => {
  if (!monthStr) return '-';
  const [year, month] = monthStr.split('-');
  return `${MONTH_NAMES[month]} ${year}`;
};

export default function StudentsList({ onStudentClick, refreshTrigger, onStudentDeleted }: StudentsListProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [payments, setPayments] = useState<Record<string, Payment>>({});
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [scheduleFilter, setScheduleFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<'name' | 'payment_status' | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 20;
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [studentToPayment, setStudentToPayment] = useState<Student | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'total' | 'partial' | 'pending'>('total');
  const [partialAmount, setPartialAmount] = useState<string>('');
  const [receiptUrl, setReceiptUrl] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const fetchStudents = async () => {
    setLoading(true);
    const [studentsRes, schedulesRes] = await Promise.all([
      supabase.from('students').select('*, schedule:schedules(*)').order('updated_at', { ascending: false }),
      supabase.from('schedules').select('*').order('day_of_week').order('start_time'),
    ]);
    if (studentsRes.data) setStudents(studentsRes.data as Student[]);
    if (schedulesRes.data) setSchedules(schedulesRes.data as Schedule[]);
    setLoading(false);
  };

  const fetchPayments = async (month: string) => {
    const query = supabase.from('payments').select('*').order('month', { ascending: false });
    const { data } = month === 'all' ? await query : await query.eq('month', month);

    const map: Record<string, Payment> = {};
    if (data) {
      for (const p of data as Payment[]) {
        // En modo 'all', guardar solo el pago más reciente por alumno
        if (!map[p.student_id]) map[p.student_id] = p;
      }
    }
    setPayments(map);
  };

  useEffect(() => {
    fetchStudents();
  }, [refreshTrigger]);

  useEffect(() => {
    fetchPayments(selectedMonth);
  }, [selectedMonth, refreshTrigger]);

  // Polling cada 5 min: solo recarga si hubo un cambio en students
  useEffect(() => {
    let lastUpdatedAt: string | null = null;

    const checkForChanges = async () => {
      const { data } = await supabase
        .from('students')
        .select('updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!data) return;
      if (lastUpdatedAt === null) {
        lastUpdatedAt = data.updated_at;
        return;
      }
      if (data.updated_at !== lastUpdatedAt) {
        lastUpdatedAt = data.updated_at;
        fetchStudents();
        fetchPayments(selectedMonth);
      }
    };

    const interval = setInterval(checkForChanges, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedMonth]);

  const openPaymentModal = (student: Student) => {
    setStudentToPayment(student);
    const payment = payments[student.id];
    if (payment) {
      if (payment.status === 'paid') setPaymentType('total');
      else if (payment.status === 'partial') setPaymentType('partial');
      else setPaymentType('pending');
      setPartialAmount(payment.amount?.toString() || '');
      setReceiptUrl(payment.receipt_url || '');
      setPaymentNotes(payment.notes || '');
    } else {
      setPaymentType('total');
      setPartialAmount('');
      setReceiptUrl('');
      setPaymentNotes('');
    }
    setIsPaymentModalOpen(true);
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      toast({ title: 'Tipo no permitido', description: 'Solo JPG, PNG, WEBP o PDF', variant: 'destructive' });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Archivo muy grande', description: 'Máximo 5MB', variant: 'destructive' });
      return;
    }

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

    const { error } = await supabase.storage.from('receipts').upload(fileName, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: false,
    });

    if (error) {
      toast({ title: 'Error al subir', description: 'No se pudo subir el comprobante', variant: 'destructive' });
    } else {
      setReceiptUrl(`receipts/${fileName}`);
      toast({ title: 'Comprobante cargado' });
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleViewReceipt = async (path: string) => {
    const filePath = path.startsWith('receipts/') ? path.replace('receipts/', '') : path;
    const { data } = await supabase.storage.from('receipts').createSignedUrl(filePath, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handlePaymentSubmit = async () => {
    if (!studentToPayment) return;

    let newStatus: PaymentStatus;
    let paidAmount: number | null = null;

    if (paymentType === 'total') {
      newStatus = 'paid';
      paidAmount = null;
    } else if (paymentType === 'partial') {
      newStatus = 'partial';
      paidAmount = parseFloat(partialAmount) || 0;
      if (paidAmount <= 0) {
        toast({
          title: 'Error',
          description: 'El monto parcial debe ser mayor a 0',
          variant: 'destructive',
        });
        return;
      }
    } else {
      newStatus = 'pending';
      paidAmount = null;
    }

    const paymentDate = (paymentType === 'total' || paymentType === 'partial')
      ? new Date().toISOString()
      : null;

    const targetMonth = selectedMonth !== 'all' ? selectedMonth : getCurrentMonth();

    const { error } = await supabase
      .from('payments')
      .upsert({
        student_id: studentToPayment.id,
        month: targetMonth,
        status: newStatus,
        amount: paidAmount,
        payment_date: paymentDate,
        receipt_url: receiptUrl || null,
        notes: paymentNotes || null,
      }, { onConflict: 'student_id,month' });

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado de pago',
        variant: 'destructive',
      });
    } else {
      toast({
        title: newStatus === 'paid'
          ? 'Cuota marcada como pagada'
          : newStatus === 'partial'
            ? `Pago parcial de $${paidAmount?.toLocaleString()} registrado`
            : 'Cuota marcada como pendiente',
      });
      setIsPaymentModalOpen(false);
      setStudentToPayment(null);
      setReceiptUrl('');
      setPaymentNotes('');
      fetchPayments(targetMonth);
    }
  };

  type ComputedStatus = PaymentStatus;

  const getComputedStatus = (student: Student): { status: ComputedStatus; contextLabel: string | null } => {
    const payment = payments[student.id];
    if (!payment) return { status: 'pending', contextLabel: null };
    const contextLabel = selectedMonth === 'all' ? `${formatMonth(payment.month)}` : null;
    return { status: payment.status as ComputedStatus, contextLabel };
  };

  const getPaymentBadge = (student: Student) => {
    const { status, contextLabel } = getComputedStatus(student);
    const payment = payments[student.id];
    let badge: React.ReactNode;
    switch (status) {
      case 'paid':
        badge = <Badge className="bg-green-500 hover:bg-green-600">Total</Badge>;
        break;
      case 'partial':
        badge = (
          <div className="text-center">
            <Badge className="bg-yellow-500 hover:bg-yellow-600">Parcial</Badge>
            {payment?.amount && (
              <p className="text-xs text-muted-foreground mt-1">${payment.amount.toLocaleString()}</p>
            )}
          </div>
        );
        break;
      case 'pending':
      default:
        badge = <Badge variant="destructive">Pendiente</Badge>;
        break;
    }
    if (contextLabel) {
      return (
        <div className="text-center">
          {badge}
          <p className="text-xs text-muted-foreground mt-1">{contextLabel}</p>
        </div>
      );
    }
    return badge;
  };

  const handleDeleteStudent = async () => {
    if (!studentToDelete) return;

    setIsDeleting(true);

    // First, nullify references in enrollments
    await supabase
      .from('enrollments')
      .update({ converted_to_student_id: null })
      .eq('converted_to_student_id', studentToDelete.id);

    // Nullify references in sales
    await supabase
      .from('sales')
      .update({ student_id: null })
      .eq('student_id', studentToDelete.id);

    // Now delete the student
    const { error } = await supabase
      .from('students')
      .delete()
      .eq('id', studentToDelete.id);

    setIsDeleting(false);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el alumno',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Alumno eliminado correctamente' });
      setIsDeleteModalOpen(false);
      setStudentToDelete(null);
      fetchStudents();
      onStudentDeleted?.();
    }
  };

  const exportCSV = () => {
    const rows: string[][] = [
      ['Nombre', 'Teléfono', 'Horario', 'Estado cuota', 'Monto pagado', 'Fecha de pago'],
    ];

    sortedStudents.forEach((student) => {
      const payment = payments[student.id];
      const fullName = `${student.first_name} ${student.last_name}`;
      const phone = student.phone ?? '';
      const schedule = student.schedule
        ? `${DAY_NAMES[student.schedule.day_of_week]} ${student.schedule.start_time.slice(0, 5)}`
        : '';
      const statusLabel = payment
        ? PAYMENT_STATUS_LABELS[payment.status as PaymentStatus] ?? payment.status
        : 'Pendiente';
      const amount = payment?.amount != null ? String(payment.amount) : '';
      const paymentDate = payment?.payment_date
        ? new Date(payment.payment_date).toLocaleDateString('es-AR')
        : '';

      rows.push([fullName, phone, schedule, statusLabel, amount, paymentDate]);
    });

    const csv = rows
      .map((row) =>
        row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')
      )
      .join('\r\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const monthLabel =
      selectedMonth !== 'all' ? selectedMonth : 'todos';
    a.href = url;
    a.download = `alumnos-${monthLabel}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filteredStudents = students.filter(student => {
    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(search.toLowerCase());
    const matchesSchedule = scheduleFilter === 'all' || student.schedule_id === scheduleFilter;
    return matchesSearch && matchesSchedule;
  });

  const PAYMENT_STATUS_ORDER: Record<string, number> = { pending: 0, partial: 1, paid: 2 };

  const sortedStudents = [...filteredStudents].sort((a, b) => {
    if (!sortField) return 0;
    let cmp = 0;
    if (sortField === 'name') {
      const nameA = `${a.first_name} ${a.last_name}`.toLowerCase();
      const nameB = `${b.first_name} ${b.last_name}`.toLowerCase();
      cmp = nameA.localeCompare(nameB, 'es');
    } else if (sortField === 'payment_status') {
      const statusA = getComputedStatus(a).status;
      const statusB = getComputedStatus(b).status;
      cmp = (PAYMENT_STATUS_ORDER[statusA] ?? 0) - (PAYMENT_STATUS_ORDER[statusB] ?? 0);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const totalPages = Math.ceil(sortedStudents.length / PAGE_SIZE);
  const paginatedStudents = sortedStudents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const toggleSort = (field: 'name' | 'payment_status') => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('asc');
    }
    setPage(0);
  };

  const SortIcon = ({ field }: { field: 'name' | 'payment_status' }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />;
  };

  // Generar opciones de meses (últimos 12 meses + próximos 3)
  const generateMonthOptions = () => {
    const options: { value: string; label: string }[] = [];
    const now = new Date();

    for (let i = -12; i <= 3; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = `${MONTH_NAMES[String(date.getMonth() + 1).padStart(2, '0')]} ${date.getFullYear()}`;
      options.push({ value, label });
    }

    return options.reverse();
  };

  const monthOptions = generateMonthOptions();

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar alumno..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-48">
          <Select value={scheduleFilter} onValueChange={(v) => { setScheduleFilter(v); setPage(0); }}>
            <SelectTrigger>
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filtrar por horario" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los horarios</SelectItem>
              {schedules.map(s => (
                <SelectItem key={s.id} value={s.id}>
                  {DAY_NAMES[s.day_of_week]} {s.start_time.slice(0, 5)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-48">
          <Select value={selectedMonth} onValueChange={(v) => { setSelectedMonth(v); setPage(0); }}>
            <SelectTrigger>
              <Calendar className="w-4 h-4 mr-2" />
              <SelectValue placeholder="Filtrar por mes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los meses</SelectItem>
              {monthOptions.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={exportCSV}
          disabled={loading || sortedStudents.length === 0}
          className="shrink-0"
        >
          <Download className="w-4 h-4 mr-2" />
          Exportar
        </Button>
      </div>

      {selectedMonth !== 'all' && !loading && (
        <div className="flex flex-wrap gap-3 text-sm">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
            {sortedStudents.filter(s => getComputedStatus(s).status === 'paid').length} pagados
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" />
            {sortedStudents.filter(s => getComputedStatus(s).status === 'partial').length} parciales
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
            {sortedStudents.filter(s => getComputedStatus(s).status === 'pending').length} pendientes
          </span>
        </div>
      )}

      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table className="min-w-[800px]">
          <TableHeader>
            <TableRow>
              <TableHead>
                <button
                  className="flex items-center hover:text-foreground transition-colors"
                  onClick={() => toggleSort('name')}
                >
                  Nombre <SortIcon field="name" />
                </button>
              </TableHead>
              <TableHead>Horario</TableHead>
              <TableHead className="text-center">Mes Cuota</TableHead>
              <TableHead className="text-center">Fecha Pago</TableHead>
              <TableHead className="text-center">WhatsApp</TableHead>
              <TableHead className="text-center">
                <button
                  className="flex items-center mx-auto hover:text-foreground transition-colors"
                  onClick={() => toggleSort('payment_status')}
                >
                  Estado <SortIcon field="payment_status" />
                </button>
              </TableHead>
              <TableHead className="text-center">Comprobante</TableHead>
              <TableHead className="text-center">Pago</TableHead>
              <TableHead className="text-center">Eliminar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-4 w-20 mx-auto" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto rounded" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto rounded" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto rounded" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-8 w-8 mx-auto rounded" /></TableCell>
                </TableRow>
              ))
            ) : sortedStudents.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="py-16">
                  <div className="flex flex-col items-center gap-3 text-muted-foreground">
                    <Users className="h-10 w-10 opacity-30" />
                    {search ? (
                      <>
                        <p className="font-medium">No se encontraron alumnos</p>
                        <p className="text-sm">Intentá con otro nombre o limpiá la búsqueda.</p>
                      </>
                    ) : (
                      <>
                        <p className="font-medium">Todavía no hay alumnos registrados</p>
                        <p className="text-sm">Los alumnos aparecerán aquí una vez que se inscriban.</p>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : paginatedStudents.map(student => {
              const payment = payments[student.id];
              const paymentMonth = payment?.month ?? null;
              const paymentDate = payment?.payment_date ?? null;
              const receiptUrl = payment?.receipt_url ?? null;
              return (
                <TableRow
                  key={student.id}
                  className="cursor-pointer hover:bg-accent"
                  onClick={() => onStudentClick(student)}
                >
                  <TableCell className="font-medium">
                    <span className="inline-flex items-center gap-2">
                      {student.first_name} {student.last_name}
                      {isNewStudent(student) && (
                        <Badge className="text-[10px] bg-orange-500 hover:bg-orange-600 text-white border-transparent">
                          Nuevo
                        </Badge>
                      )}
                    </span>
                  </TableCell>
                  <TableCell>
                    {student.schedule ? (
                      <span className="text-sm">
                        {DAY_NAMES[student.schedule.day_of_week]} {student.schedule.start_time.slice(0, 5)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-sm">Sin asignar</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {payment ? formatMonth(paymentMonth) : '-'}
                  </TableCell>
                  <TableCell className="text-center text-sm">
                    {formatDate(paymentDate)}
                  </TableCell>
                  <TableCell className="text-center">
                    {student.phone ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600 hover:text-green-700"
                        aria-label="Abrir WhatsApp"
                        onClick={(e) => {
                          e.stopPropagation();
                          const phone = student.phone?.replace(/\D/g, '');
                          const isPending = !payment || payment.status === 'pending';
                          const monthLabel = formatMonth(selectedMonth !== 'all' ? selectedMonth : getCurrentMonth());
                          const msg = isPending
                            ? `Hola ${student.first_name}, te recordamos que tenés la cuota de ${monthLabel} pendiente en Silicer Studio. ¡Cualquier consulta escribinos!`
                            : '';
                          const url = msg
                            ? `https://wa.me/54${phone}?text=${encodeURIComponent(msg)}`
                            : `https://wa.me/54${phone}`;
                          window.open(url, '_blank', 'noopener,noreferrer');
                        }}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {getPaymentBadge(student)}
                  </TableCell>
                  <TableCell className="text-center">
                    {receiptUrl ? (
                      <Button
                        size="sm"
                        variant="outline"
                        aria-label="Ver comprobante de pago"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewReceipt(receiptUrl);
                        }}
                      >
                        <FileText className="w-4 h-4" />
                      </Button>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="outline"
                      aria-label="Registrar pago"
                      onClick={(e) => {
                        e.stopPropagation();
                        openPaymentModal(student);
                      }}
                    >
                      <DollarSign className="w-4 h-4" />
                    </Button>
                  </TableCell>
                  <TableCell className="text-center">
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      aria-label="Eliminar alumno"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStudentToDelete(student);
                        setIsDeleteModalOpen(true);
                      }}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>
            {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, sortedStudents.length)} de {sortedStudents.length} alumnos
          </span>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p - 1)}
              disabled={page === 0}
            >
              <ChevronLeft className="w-4 h-4" />
              Anterior
            </Button>
            <span className="px-2">Página {page + 1} de {totalPages}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage(p => p + 1)}
              disabled={page >= totalPages - 1}
            >
              Siguiente
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Alumno</DialogTitle>
          </DialogHeader>
          {studentToDelete && (
            <p>
              ¿Estás seguro de eliminar a <strong>{studentToDelete.first_name} {studentToDelete.last_name}</strong>?
              Esta acción no se puede deshacer.
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleDeleteStudent} disabled={isDeleting}>
              {isDeleting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Trash2 className="w-4 h-4 mr-2" />}
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={(open) => {
        setIsPaymentModalOpen(open);
        if (!open) { setStudentToPayment(null); setReceiptUrl(''); setPaymentNotes(''); }
      }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Estado de Pago de Cuota</DialogTitle>
          </DialogHeader>
          {studentToPayment && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Alumno: <strong>{studentToPayment.first_name} {studentToPayment.last_name}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Cuota de: <strong>{formatMonth(selectedMonth !== 'all' ? selectedMonth : getCurrentMonth())}</strong>
              </p>

              <div className="space-y-3">
                <Label>Tipo de Pago</Label>
                <div className="grid grid-cols-3 gap-2">
                  <Button
                    variant={paymentType === 'total' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPaymentType('total')}
                  >
                    Total
                  </Button>
                  <Button
                    variant={paymentType === 'partial' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPaymentType('partial')}
                  >
                    Parcial
                  </Button>
                  <Button
                    variant={paymentType === 'pending' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setPaymentType('pending')}
                  >
                    Pendiente
                  </Button>
                </div>

                {paymentType === 'partial' && (
                  <div className="space-y-2">
                    <Label htmlFor="partialAmount">Monto del pago parcial</Label>
                    <Input
                      id="partialAmount"
                      type="number"
                      placeholder="Ej: 5000"
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                    />
                  </div>
                )}
              </div>

              {paymentType !== 'pending' && (
                <div className="space-y-2">
                  <Label>Comprobante</Label>
                  {receiptUrl ? (
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      <span className="flex-1 text-sm truncate">Comprobante cargado</span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewReceipt(receiptUrl)}
                      >
                        <ExternalLink className="w-4 h-4 mr-1" /> Ver
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        onClick={() => setReceiptUrl('')}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,application/pdf"
                        onChange={handleReceiptUpload}
                        disabled={uploading}
                        className="flex-1"
                      />
                      {uploading && <Loader2 className="w-4 h-4 animate-spin shrink-0" />}
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground">JPG, PNG, WEBP o PDF · máx. 5MB</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="paymentNotes">Notas</Label>
                <Textarea
                  id="paymentNotes"
                  placeholder="Ej: pagó en dos partes, acordado para el 10..."
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handlePaymentSubmit}>
              <Check className="w-4 h-4 mr-2" /> Guardar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
