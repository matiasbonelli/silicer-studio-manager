import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Student, Payment, ClassPayment, PaymentStatus, Schedule, Categoria, DAY_NAMES, DAY_ORDER, MONTH_NAMES } from '@/types/database';
import { formatDate } from '@/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { getChatwootLink } from '@/lib/whatsapp';
import { Trash2, ExternalLink, Check, Loader2, MessageCircle, ShoppingCart } from 'lucide-react';

interface StudentModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  isNew?: boolean;
}

const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonth = (monthStr: string | null) => {
  if (!monthStr) return '-';
  const [year, month] = monthStr.split('-');
  return `${MONTH_NAMES[month]} ${year}`;
};

const getNextMonth = (monthStr: string): string => {
  const [year, month] = monthStr.split('-').map(Number);
  // El mes es 1-indexado en monthStr; pasarlo tal cual como parámetro 0-indexado
  // de Date ya da el mes siguiente (y hace rollover de año automático).
  const d = new Date(year, month, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

// Evita el corrimiento de un día que da `new Date('YYYY-MM-DD')` en zonas UTC-N
const formatDateOnly = (dateStr: string) => {
  const [year, month, day] = dateStr.split('-');
  return `${day}/${month}/${year}`;
};

export default function StudentModal({ student, isOpen, onClose, onSave, isNew = false }: StudentModalProps) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birthday: '',
    schedule_id: '',
    notes: '',
    start_date: '',
    categoria: 'adulto' as Categoria,
  });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [scheduleOccupancy, setScheduleOccupancy] = useState<Record<string, number>>({});
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  // Cuota del mes actual
  const currentMonth = getCurrentMonth();
  const nextMonth = getNextMonth(currentMonth);
  const [currentPayment, setCurrentPayment] = useState<Payment | null>(null);
  const [editingPayment, setEditingPayment] = useState(false);
  const [paymentType, setPaymentType] = useState<'total' | 'partial' | 'pending'>('pending');
  const [partialAmount, setPartialAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [isException, setIsException] = useState(false);
  const [savingException, setSavingException] = useState(false);

  // Alumno que paga por clase (no cuota mensual)
  const [isClass, setIsClass] = useState(false);
  const [savingClassToggle, setSavingClassToggle] = useState(false);
  const [classPayments, setClassPayments] = useState<ClassPayment[]>([]);
  const [newClassDate, setNewClassDate] = useState('');
  const [newClassAmount, setNewClassAmount] = useState('');
  const [newClassNotes, setNewClassNotes] = useState('');
  const [savingClassPayment, setSavingClassPayment] = useState(false);
  const [chatwootUrl, setChatwootUrl] = useState<string | null>(null);
  const [chatwootUrlLoading, setChatwootUrlLoading] = useState(false);

  // Reserva de cupo: pagó seña, se salta la cuota de currentMonth y empieza el mes siguiente
  const [reservedMonth, setReservedMonth] = useState<string | null>(null);
  const [savingReserve, setSavingReserve] = useState(false);
  const isReservedThisMonth = reservedMonth === currentMonth;
  // Si reservó el cupo, la cuota que corresponde gestionar es la del mes que viene
  // (no debe nada este mes) — la seña se registra contra ese mes, no el actual.
  const effectiveCuotaMonth = isReservedThisMonth ? nextMonth : currentMonth;
  const [editingSena, setEditingSena] = useState(false);
  const [senaAmount, setSenaAmount] = useState('');
  const [savingSena, setSavingSena] = useState(false);

  const CUOTA_KEY_ADULTO = 'silicer_cuota_adulto';
  const CUOTA_KEY_NINO   = 'silicer_cuota_niño';
  const getCuotaKey = (cat: Categoria) => cat === 'niño' ? CUOTA_KEY_NINO : CUOTA_KEY_ADULTO;
  const getSuggestedAmount = (cat: Categoria): string =>
    localStorage.getItem(getCuotaKey(cat)) ?? '';

  const { toast } = useToast();

  useEffect(() => {
    if (student && !isNew) {
      setFormData({
        first_name: student.first_name,
        last_name: student.last_name,
        email: student.email || '',
        phone: student.phone || '',
        birthday: student.birthday || '',
        schedule_id: student.schedule_id || '',
        notes: student.notes || '',
        start_date: student.start_date || '',
        categoria: student.categoria ?? 'adulto',
      });
      setIsException(student.is_exception ?? false);
      setIsClass(student.pays_per_class ?? false);
      setReservedMonth(student.reserved_month ?? null);
      // No usar el estado `reservedMonth`/`isReservedThisMonth` acá: todavía tienen el
      // valor del alumno anterior (el setState de arriba recién se aplica el próximo
      // render). Se calcula directo desde la prop `student` para no cargar el mes que no es.
      loadPayments(
        student.id,
        student.categoria ?? 'adulto',
        student.reserved_month === currentMonth ? nextMonth : currentMonth,
      );
      loadClassPayments(student.id);
      setChatwootUrl(null);
      if (student.phone) {
        setChatwootUrlLoading(true);
        getChatwootLink(student.phone, `${student.first_name} ${student.last_name}`)
          .then(setChatwootUrl)
          .finally(() => setChatwootUrlLoading(false));
      }
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        birthday: '',
        schedule_id: '',
        notes: '',
        start_date: '',
        categoria: 'adulto' as Categoria,
      });
      setPaymentHistory([]);
      setCurrentPayment(null);
      setEditingPayment(false);
    }
  }, [student, isNew]);

  useEffect(() => {
    const fetchSchedules = async () => {
      const { data } = await supabase
        .from('schedules')
        .select('*');
      if (data) {
        const sorted = [...(data as Schedule[])].sort((a, b) => {
          const dayDiff = (DAY_ORDER[a.day_of_week] ?? 99) - (DAY_ORDER[b.day_of_week] ?? 99);
          return dayDiff !== 0 ? dayDiff : a.start_time.localeCompare(b.start_time);
        });
        setSchedules(sorted);
      }
    };
    fetchSchedules();

    const fetchOccupancy = async () => {
      const { data } = await supabase.from('students').select('schedule_id');
      if (data) {
        const counts: Record<string, number> = {};
        for (const s of data) {
          if (!s.schedule_id) continue;
          counts[s.schedule_id] = (counts[s.schedule_id] ?? 0) + 1;
        }
        setScheduleOccupancy(counts);
      }
    };
    fetchOccupancy();
  }, []);

  /** Carga el pago del mes objetivo (el actual, o el que viene si reservó cupo) y el
   * historial, en secuencia para evitar race conditions. */
  const loadPayments = async (studentId: string, categoria: Categoria = 'adulto', targetMonth: string = currentMonth) => {
    // 1. Pago del mes objetivo
    const { data: current } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      .eq('month', targetMonth)
      .maybeSingle();

    if (current) {
      setCurrentPayment(current as Payment);
      setPaymentNotes(current.notes || '');
      if (current.status === 'paid') {
        setPaymentType('total');
        setPartialAmount(current.amount?.toString() || '');
      } else if (current.status === 'partial') {
        setPaymentType('partial');
        setPartialAmount(current.amount?.toString() || '');
      } else {
        setPaymentType('pending');
        setPartialAmount('');
      }
    } else {
      setCurrentPayment(null);
      setPaymentType('pending');
      setPaymentNotes('');
    }

    // 2. Historial completo
    const { data: history } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      .order('month', { ascending: false });

    if (history) {
      setPaymentHistory(history as Payment[]);

      // Solo sugerir monto si NO hay pago registrado este mes
      if (!current) {
        // El precio base del Dashboard (seteado manualmente) siempre tiene prioridad
        const cuotaBase = getSuggestedAmount(categoria);
        const lastWithAmount = (history as Payment[]).find(
          (p) => p.amount && p.amount > 0 && p.month !== targetMonth
        );
        // Prioridad: cuota base configurada > último pago del alumno
        if (cuotaBase) {
          setPartialAmount(cuotaBase);
        } else if (lastWithAmount?.amount) {
          setPartialAmount(lastWithAmount.amount.toString());
        }
      }
    }
  };

  const loadClassPayments = async (studentId: string) => {
    const { data } = await supabase
      .from('class_payments')
      .select('*')
      .eq('student_id', studentId)
      .order('class_date', { ascending: false });
    if (data) setClassPayments(data as ClassPayment[]);
  };

  const handleToggleClass = async () => {
    if (!student) return;
    const newIsClass = !isClass;

    setSavingClassToggle(true);
    const { error } = await supabase
      .from('students')
      .update({ pays_per_class: newIsClass })
      .eq('id', student.id);

    if (error) {
      toast({ title: 'Error al guardar', variant: 'destructive' });
    } else {
      setIsClass(newIsClass);
      toast({
        title: newIsClass ? 'Alumno marcado como "por clase"' : 'Alumno vuelve a cuota mensual',
      });
      onSave();
    }
    setSavingClassToggle(false);
  };

  const handleToggleReserve = async () => {
    if (!student) return;
    const newReservedMonth = isReservedThisMonth ? null : currentMonth;

    setSavingReserve(true);
    const { error } = await supabase
      .from('students')
      .update({ reserved_month: newReservedMonth })
      .eq('id', student.id);

    if (error) {
      toast({ title: 'Error al guardar', variant: 'destructive' });
    } else {
      setReservedMonth(newReservedMonth);
      toast({
        title: newReservedMonth
          ? 'Cupo reservado — se salta la cuota de este mes'
          : 'Reserva de cupo quitada',
      });
      // La cuota a gestionar pasa a ser la del mes que corresponda con la nueva reserva.
      await loadPayments(student.id, student.categoria ?? 'adulto', newReservedMonth ? nextMonth : currentMonth);
      onSave();
    }
    setSavingReserve(false);
  };

  const handleSaveSena = async () => {
    if (!student) return;
    const amount = parseFloat(senaAmount);
    if (!amount || amount <= 0) {
      toast({ title: 'El monto debe ser mayor a 0', variant: 'destructive' });
      return;
    }

    setSavingSena(true);
    const { error } = await supabase
      .from('payments')
      .upsert(
        {
          student_id: student.id,
          month: effectiveCuotaMonth,
          status: 'partial',
          amount,
          payment_date: new Date().toISOString(),
        },
        { onConflict: 'student_id,month' }
      );

    if (error) {
      toast({ title: 'Error al guardar la seña', variant: 'destructive' });
    } else {
      toast({ title: 'Seña registrada' });
      setEditingSena(false);
      await loadPayments(student.id, student.categoria ?? 'adulto', effectiveCuotaMonth);
      onSave();
    }
    setSavingSena(false);
  };

  const handleAddClassPayment = async () => {
    if (!student) return;
    const amount = parseFloat(newClassAmount);
    if (!newClassDate) {
      toast({ title: 'Elegí la fecha de la clase', variant: 'destructive' });
      return;
    }
    if (!amount || amount <= 0) {
      toast({ title: 'El monto debe ser mayor a 0', variant: 'destructive' });
      return;
    }

    setSavingClassPayment(true);
    const { error } = await supabase.from('class_payments').insert({
      student_id: student.id,
      class_date: newClassDate,
      amount,
      notes: newClassNotes || null,
    });

    if (error) {
      toast({ title: 'Error al registrar la clase', variant: 'destructive' });
    } else {
      toast({ title: 'Clase registrada' });
      setNewClassDate('');
      setNewClassAmount('');
      setNewClassNotes('');
      await loadClassPayments(student.id);
    }
    setSavingClassPayment(false);
  };

  const handleDeleteClassPayment = async (id: string) => {
    if (!student) return;
    if (!confirm('¿Eliminar este registro de clase?')) return;

    const { error } = await supabase.from('class_payments').delete().eq('id', id);
    if (error) {
      toast({ title: 'Error al eliminar', variant: 'destructive' });
    } else {
      await loadClassPayments(student.id);
    }
  };

  const handleViewReceipt = async (path: string) => {
    const filePath = path.startsWith('receipts/') ? path.replace('receipts/', '') : path;
    const { data } = await supabase.storage.from('receipts').createSignedUrl(filePath, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleSavePayment = async () => {
    if (!student) return;

    let newStatus: PaymentStatus;
    let paidAmount: number | null = null;

    if (paymentType === 'total') {
      newStatus = 'paid';
      paidAmount = parseFloat(partialAmount) || null;
    } else if (paymentType === 'partial') {
      newStatus = 'partial';
      paidAmount = parseFloat(partialAmount) || 0;
      if (paidAmount <= 0) {
        toast({ title: 'El monto parcial debe ser mayor a 0', variant: 'destructive' });
        return;
      }
    } else {
      newStatus = 'pending';
    }

    const paymentDate = paymentType !== 'pending' ? new Date().toISOString() : null;

    setSavingPayment(true);
    const { error } = await supabase
      .from('payments')
      .upsert(
        {
          student_id: student.id,
          month: effectiveCuotaMonth,
          status: newStatus,
          amount: paidAmount,
          payment_date: paymentDate,
          notes: paymentNotes || null,
        },
        { onConflict: 'student_id,month' }
      );

    if (error) {
      toast({ title: 'Error al guardar cuota', variant: 'destructive' });
    } else {
      toast({
        title:
          newStatus === 'paid'
            ? 'Cuota marcada como pagada'
            : newStatus === 'partial'
            ? `Pago parcial de $${paidAmount?.toLocaleString()} registrado`
            : 'Cuota marcada como pendiente',
      });
      setEditingPayment(false);
      await loadPayments(student.id, student.categoria ?? 'adulto', effectiveCuotaMonth);
      onSave(); // propaga refreshTrigger → actualiza ScheduleGrid, StudentsList y Dashboard
    }
    setSavingPayment(false);
  };

  const handleToggleException = async () => {
    if (!student) return;
    const newException = !isException;

    setSavingException(true);
    const { error } = await supabase
      .from('students')
      .update({ is_exception: newException })
      .eq('id', student.id);

    if (error) {
      toast({ title: 'Error al guardar excepción', variant: 'destructive' });
    } else {
      setIsException(newException);
      toast({
        title: newException
          ? 'Alumno marcado como excepción de cuota'
          : 'Excepción quitada',
      });
      onSave();
    }
    setSavingException(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const baseData = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email || null,
      phone: formData.phone || null,
      birthday: formData.birthday || null,
      schedule_id: formData.schedule_id || null,
      notes: formData.notes || null,
      start_date: formData.start_date || null,
      categoria: formData.categoria,
    };

    let error;

    if (isNew) {
      const result = await supabase.from('students').insert({
        ...baseData,
        payment_status: 'pending',
      });
      error = result.error;
    } else if (student) {
      const result = await supabase.from('students').update(baseData).eq('id', student.id);
      error = result.error;
    }

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar el alumno',
        variant: 'destructive',
      });
    } else {
      toast({
        title: isNew ? 'Alumno creado' : 'Alumno actualizado',
        description: 'Los cambios se guardaron correctamente',
      });
      onSave();
      onClose();
    }

    setLoading(false);
  };

  const handleDelete = async () => {
    if (!student || isNew) return;

    if (!confirm('¿Estás seguro de eliminar este alumno?')) return;

    setLoading(true);

    const { error } = await supabase.rpc('delete_student_cascade', { student_uuid: student.id });

    if (error) {
      toast({
        title: 'Error al eliminar',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Alumno eliminado' });
      onSave();
      onClose();
    }

    setLoading(false);
  };

  // Helper para mostrar badge de estado de cuota
  const paymentStatusBadge = (p: Payment | null) => {
    if (!p || p.status === 'pending') return <Badge variant="destructive">Pendiente</Badge>;
    if (p.status === 'partial')
      return (
        <Badge className="bg-yellow-500 hover:bg-yellow-600">
          Parcial{p.amount ? ` — $${p.amount.toLocaleString()}` : ''}
        </Badge>
      );
    return <Badge className="bg-green-500 hover:bg-green-600">Pagada</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle>{isNew ? 'Agregar Alumno' : 'Editar Alumno'}</DialogTitle>
            {!isNew && student?.phone && (
              chatwootUrl ? (
                <a href={chatwootUrl} target="_blank" rel="noopener noreferrer">
                  <Button type="button" variant="outline" size="sm" className="gap-1.5 text-green-600 hover:text-green-700">
                    <MessageCircle className="w-4 h-4" />
                    Abrir en Chatwoot
                  </Button>
                </a>
              ) : (
                <Button type="button" variant="outline" size="sm" className="gap-1.5 text-muted-foreground" disabled>
                  {chatwootUrlLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <MessageCircle className="w-4 h-4" />}
                  {chatwootUrlLoading ? 'Buscando...' : 'No disponible'}
                </Button>
              )
            )}
          </div>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="first_name">Nombre</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Apellido</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="phone">Teléfono</Label>
              <Input
                id="phone"
                type="tel"
                placeholder="Ej: 1123456789"
                value={formData.phone}
                onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="start_date">Fecha de inicio</Label>
            <Input
              id="start_date"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData(prev => ({ ...prev, start_date: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label>Categoría</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={formData.categoria === 'adulto' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, categoria: 'adulto' }))}
              >
                Adulto
              </Button>
              <Button
                type="button"
                variant={formData.categoria === 'niño' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setFormData(prev => ({ ...prev, categoria: 'niño' }))}
              >
                Niño
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="birthday">Fecha de Cumpleaños</Label>
            <Input
              id="birthday"
              type="date"
              value={formData.birthday}
              onChange={(e) => setFormData(prev => ({ ...prev, birthday: e.target.value }))}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="schedule">Día / Horario</Label>
            <Select
              value={formData.schedule_id}
              onValueChange={(value) => setFormData(prev => ({ ...prev, schedule_id: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar horario" />
              </SelectTrigger>
              <SelectContent>
                {schedules.map(schedule => {
                  const occupied = scheduleOccupancy[schedule.id] ?? 0;
                  const isFull = occupied >= schedule.max_capacity && schedule.id !== student?.schedule_id;
                  return (
                    <SelectItem key={schedule.id} value={schedule.id} disabled={isFull}>
                      {DAY_NAMES[schedule.day_of_week]} {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                      {' '}({occupied}/{schedule.max_capacity}{isFull ? ' · sin cupo' : ''})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notas</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              rows={2}
            />
          </div>

          {/* ── Modalidad de pago — solo al editar ── */}
          {!isNew && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Modalidad de pago: {isClass ? 'Por clase' : 'Cuota mensual'}</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs border-2 border-muted-foreground/40"
                disabled={savingClassToggle}
                onClick={handleToggleClass}
              >
                {savingClassToggle
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : isClass ? 'Volver a cuota mensual' : '+ Marcar como "por clase"'}
              </Button>
            </div>
          )}

          {/* ── Reserva de cupo — solo al editar, solo si paga cuota mensual ── */}
          {!isNew && !isClass && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">
                  {isReservedThisMonth ? `Reservó el cupo de ${formatMonth(currentMonth)}` : 'Reserva de cupo'}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className={`h-7 text-xs border-2 ${isReservedThisMonth ? 'border-purple-500 text-purple-600' : 'border-muted-foreground/40'}`}
                  disabled={savingReserve}
                  onClick={handleToggleReserve}
                >
                  {savingReserve
                    ? <Loader2 className="w-3 h-3 animate-spin" />
                    : isReservedThisMonth ? 'Quitar reserva' : '+ Reservar cupo'}
                </Button>
              </div>
              {isReservedThisMonth && (
                <p className="text-xs text-muted-foreground">
                  No se le va a pedir ni recordar la cuota de {formatMonth(currentMonth)}. Se desactiva sola el mes que viene.
                </p>
              )}
            </div>
          )}

          {/* ── Clases del mes — alumno "por clase" ── */}
          {!isNew && isClass && (
            <div className="space-y-3 rounded-lg border p-3">
              <Label>Clases de {formatMonth(currentMonth)}</Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={newClassDate}
                  onChange={(e) => setNewClassDate(e.target.value)}
                />
                <Input
                  type="number"
                  placeholder="Monto"
                  value={newClassAmount}
                  onChange={(e) => setNewClassAmount(e.target.value)}
                />
              </div>
              <Input
                placeholder="Nota (opcional)"
                value={newClassNotes}
                onChange={(e) => setNewClassNotes(e.target.value)}
              />
              <Button
                type="button"
                size="sm"
                className="w-full"
                onClick={handleAddClassPayment}
                disabled={savingClassPayment}
              >
                {savingClassPayment
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <><Check className="w-4 h-4 mr-1" /> Agregar clase</>
                }
              </Button>
            </div>
          )}

          {/* ── Seña de reserva — reemplaza la cuota normal mientras está reservado ── */}
          {!isNew && !isClass && isReservedThisMonth && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label>Seña para {formatMonth(effectiveCuotaMonth)}</Label>
                {!editingSena && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      setSenaAmount(currentPayment?.amount?.toString() ?? '');
                      setEditingSena(true);
                    }}
                  >
                    {currentPayment?.amount ? 'Editar' : 'Anotar'}
                  </Button>
                )}
              </div>

              {!editingSena ? (
                <div className="pt-1">
                  {currentPayment?.amount ? (
                    <p className="text-sm flex items-center gap-2 flex-wrap">
                      <Badge className="bg-yellow-500 hover:bg-yellow-600">
                        ${currentPayment.amount.toLocaleString()}
                      </Badge>
                      {currentPayment.payment_date && (
                        <span className="text-xs text-muted-foreground">
                          {formatDate(currentPayment.payment_date)}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground">Todavía no anotaste el monto de la seña.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-2 pt-1">
                  <Input
                    type="number"
                    placeholder="Monto de la seña"
                    value={senaAmount}
                    onChange={(e) => setSenaAmount(e.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setEditingSena(false)}
                      disabled={savingSena}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1"
                      onClick={handleSaveSena}
                      disabled={savingSena}
                    >
                      {savingSena
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><Check className="w-4 h-4 mr-1" /> Guardar</>
                      }
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Cuota del mes actual — alumno mensual, no reservado ── */}
          {!isNew && !isClass && !isReservedThisMonth && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label>Cuota de {formatMonth(effectiveCuotaMonth)}</Label>
                {!editingPayment && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setEditingPayment(true)}
                  >
                    Editar
                  </Button>
                )}
              </div>

              {!editingPayment ? (
                <div className="space-y-1.5 pt-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {paymentStatusBadge(currentPayment)}
                    {currentPayment?.payment_date && (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(currentPayment.payment_date)}
                      </span>
                    )}
                    {isException ? (
                      <Badge
                        variant="outline"
                        className="cursor-pointer border-amber-500 text-amber-500 hover:bg-amber-500/10"
                        onClick={savingException ? undefined : handleToggleException}
                      >
                        {savingException ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Excepción ✕'}
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-6 text-xs text-muted-foreground"
                        disabled={savingException}
                        onClick={handleToggleException}
                      >
                        {savingException ? <Loader2 className="w-3 h-3 animate-spin" /> : '+ Marcar excepción'}
                      </Button>
                    )}
                  </div>
                  {isException && (
                    <p className="text-xs text-muted-foreground">
                      No se le va a recordar la cuota ni aplicar mora hasta que se quite la excepción.
                    </p>
                  )}
                  {paymentNotes && (
                    <p className="text-xs text-muted-foreground italic">"{paymentNotes}"</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 pt-1">
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      type="button"
                      variant={paymentType === 'total' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setPaymentType('total'); setPartialAmount(''); }}
                    >
                      Total
                    </Button>
                    <Button
                      type="button"
                      variant={paymentType === 'partial' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setPaymentType('partial'); setPartialAmount(''); }}
                    >
                      Parcial
                    </Button>
                    <Button
                      type="button"
                      variant={paymentType === 'pending' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => { setPaymentType('pending'); setPartialAmount(''); }}
                    >
                      Pendiente
                    </Button>
                  </div>

                  {(paymentType === 'total' || paymentType === 'partial') && (
                    <Input
                      type="number"
                      placeholder={paymentType === 'partial' ? 'Monto parcial' : 'Monto total (opcional)'}
                      value={partialAmount}
                      onChange={(e) => setPartialAmount(e.target.value)}
                    />
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Nota de pago</Label>
                    <Textarea
                      placeholder="Ej: paga semana próxima, acordado para el viernes..."
                      value={paymentNotes}
                      onChange={(e) => setPaymentNotes(e.target.value)}
                      rows={2}
                    />
                  </div>

                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setEditingPayment(false)}
                      disabled={savingPayment}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      className="flex-1"
                      onClick={handleSavePayment}
                      disabled={savingPayment}
                    >
                      {savingPayment
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><Check className="w-4 h-4 mr-1" /> Guardar</>
                      }
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Historial de clases — alumno "por clase" */}
          {!isNew && isClass && (
            <div className="space-y-2">
              <Label>Historial de clases</Label>
              {classPayments.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Sin clases registradas.</p>
              ) : (
                <div className="max-h-44 overflow-y-auto rounded-lg border divide-y">
                  {classPayments.map((cp) => (
                    <div key={cp.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-medium">{formatDateOnly(cp.class_date)}</span>
                      <div className="flex items-center gap-2">
                        <Badge className="bg-green-500 hover:bg-green-600">
                          ${cp.amount.toLocaleString()}
                        </Badge>
                        {cp.notes && (
                          <span className="text-muted-foreground text-xs italic">"{cp.notes}"</span>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-destructive"
                          onClick={() => handleDeleteClassPayment(cp.id)}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Historial de pagos — alumno mensual */}
          {!isNew && !isClass && (
            <div className="space-y-2">
              <Label>Historial de pagos</Label>
              {paymentHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Sin registros de pago.</p>
              ) : (
                <div className="max-h-44 overflow-y-auto rounded-lg border divide-y">
                  {paymentHistory.map((p) => (
                    <div key={p.id} className="flex items-center justify-between px-3 py-2 text-sm">
                      <span className="font-medium">{formatMonth(p.month)}</span>
                      <div className="flex items-center gap-2">
                        {p.status === 'paid' && (
                          <Badge className="bg-green-500 hover:bg-green-600">Pagado</Badge>
                        )}
                        {p.status === 'partial' && (
                          <Badge className="bg-yellow-500 hover:bg-yellow-600">
                            Parcial{p.amount ? ` $${p.amount.toLocaleString()}` : ''}
                          </Badge>
                        )}
                        {p.status === 'pending' && (
                          <Badge variant="destructive">Pendiente</Badge>
                        )}
                        {p.sale_id && (
                          <Badge variant="outline" className="text-xs gap-1">
                            <ShoppingCart className="w-3 h-3" /> Ventas
                          </Badge>
                        )}
                        {p.payment_date && (
                          <span className="text-muted-foreground text-xs">
                            {formatDate(p.payment_date)}
                          </span>
                        )}
                        {p.receipt_url && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2"
                            onClick={() => handleViewReceipt(p.receipt_url!)}
                          >
                            <ExternalLink className="w-3 h-3" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            {!isNew && (
              <Button type="button" variant="destructive" onClick={handleDelete} disabled={loading}>
                <Trash2 className="w-4 h-4 mr-1" /> Eliminar
              </Button>
            )}
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Guardando...' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
