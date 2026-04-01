import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Student, Payment, Schedule, DAY_NAMES, MONTH_NAMES } from '@/types/database';
import { formatDate } from '@/lib/format';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Trash2 } from 'lucide-react';

interface StudentModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  isNew?: boolean;
}

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
  });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [paymentHistory, setPaymentHistory] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(false);
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
      });
      fetchPaymentHistory(student.id);
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        birthday: '',
        schedule_id: '',
        notes: '',
      });
      setPaymentHistory([]);
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

  const fetchPaymentHistory = async (studentId: string) => {
    const { data } = await supabase
      .from('payments')
      .select('*')
      .eq('student_id', studentId)
      .order('month', { ascending: false });
    if (data) setPaymentHistory(data as Payment[]);
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

    const { error: unlinkError } = await supabase
      .from('enrollments')
      .update({ converted_to_student_id: null })
      .eq('converted_to_student_id', student.id);

    if (unlinkError) {
      toast({
        title: 'Error',
        description: 'No se pudo desvincular el alumno de las inscripciones',
        variant: 'destructive',
      });
      setLoading(false);
      return;
    }

    const { error } = await supabase.from('students').delete().eq('id', student.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el alumno',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Alumno eliminado' });
      onSave();
      onClose();
    }

    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isNew ? 'Agregar Alumno' : 'Editar Alumno'}</DialogTitle>
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
