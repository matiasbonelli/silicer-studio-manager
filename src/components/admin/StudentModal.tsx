import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Student, Payment, PaymentStatus, Schedule, Categoria, DAY_NAMES, MONTH_NAMES } from '@/types/database';
import { formatDate } from '@/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Trash2, ExternalLink, Check, Loader2, MessageCircle } from 'lucide-react';

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
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);

  // Cuota del mes actual
  const currentMonth = getCurrentMonth();
  const [currentPayment, setCurrentPayment] = useState<Payment | null>(null);
  const [editingPayment, setEditingPayment] = useState(false);
  const [paymentType, setPaymentType] = useState<'total' | 'partial' | 'pending'>('pending');
  const [partialAmount, setPartialAmount] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);

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
      loadPayments(student.id, student.categoria ?? 'adulto');
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
        .select('*')
        .order('day_of_week')
        .order('start_time');
      if (data) setSchedules(data as Schedule[]);
    };
    fetchSchedules();
  }, []);

  /** Carga el pago del mes actual y el historial en secuencia para evitar race conditions */
  const loadPayments = async (studentId: string, categoria: Categoria = 'adulto') => {
    // 1. Pago del mes actual
    const { data: current } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      .eq('month', currentMonth)
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
          (p) => p.amount && p.amount > 0 && p.month !== currentMonth
        );
        // Prioridad: cuota base configurada > último pago del alumno
        if (cuotaBase) {
          setPartialAmount(cuotaBase);
        } else if (lastWithAmount?.amount) {
          setPartialAmount(lastWithAmount.amount.toString());
          localStorage.setItem(getCuotaKey(categoria), lastWithAmount.amount.toString());
        }
      }
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
      if (paidAmount && paidAmount > 0) {
        localStorage.setItem(getCuotaKey(formData.categoria), paidAmount.toString());
      }
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
          month: currentMonth,
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
      await loadPayments(student.id);
      onSave(); // propaga refreshTrigger → actualiza ScheduleGrid, StudentsList y Dashboard
    }
    setSavingPayment(false);
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
              <a
                href={`https://wa.me/54${student.phone.replace(/\D/g, '')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button type="button" variant="outline" size="sm" className="gap-1.5 text-green-600 hover:text-green-700">
                  <MessageCircle className="w-4 h-4" />
                  WhatsApp
                </Button>
              </a>
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
                {schedules.map(schedule => (
                  <SelectItem key={schedule.id} value={schedule.id}>
                    {DAY_NAMES[schedule.day_of_week]} {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                  </SelectItem>
                ))}
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

          {/* ── Cuota del mes actual — solo al editar ── */}
          {!isNew && (
            <div className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label>Cuota de {formatMonth(currentMonth)}</Label>
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
                  <div className="flex items-center gap-2">
                    {paymentStatusBadge(currentPayment)}
                    {currentPayment?.payment_date && (
                      <span className="text-xs text-muted-foreground">
                        {formatDate(currentPayment.payment_date)}
                      </span>
                    )}
                  </div>
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

          {/* Historial de pagos — solo al editar */}
          {!isNew && (
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
