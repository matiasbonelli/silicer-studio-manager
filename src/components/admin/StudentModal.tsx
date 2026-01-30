import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Student, Schedule, PaymentStatus, DAY_NAMES } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Upload, FileText, Image, ExternalLink } from 'lucide-react';

interface StudentModalProps {
  student: Student | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  isNew?: boolean;
}

export default function StudentModal({ student, isOpen, onClose, onSave, isNew = false }: StudentModalProps) {
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birthday: '',
    schedule_id: '',
    payment_status: 'pending' as PaymentStatus,
    payment_receipt_url: '',
    notes: '',
  });
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
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
        payment_status: student.payment_status,
        payment_receipt_url: student.payment_receipt_url || '',
        notes: student.notes || '',
      });
    } else {
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        birthday: '',
        schedule_id: '',
        payment_status: 'pending',
        payment_receipt_url: '',
        notes: '',
      });
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const dataToSave = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      email: formData.email || null,
      phone: formData.phone || null,
      birthday: formData.birthday || null,
      schedule_id: formData.schedule_id || null,
      payment_status: formData.payment_status,
      payment_receipt_url: formData.payment_receipt_url || null,
      notes: formData.notes || null,
    };

    let error;

    if (isNew) {
      const result = await supabase.from('students').insert(dataToSave);
      error = result.error;
    } else if (student) {
      const result = await supabase.from('students').update(dataToSave).eq('id', student.id);
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
    const { error } = await supabase.from('students').delete().eq('id', student.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar el alumno',
        variant: 'destructive',
      });
    } else {
      toast({
        title: 'Alumno eliminado',
      });
      onSave();
      onClose();
    }

    setLoading(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
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
            <Label htmlFor="payment_status">Estado de Cuota</Label>
            <Select
              value={formData.payment_status}
              onValueChange={(value: PaymentStatus) => setFormData(prev => ({ ...prev, payment_status: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="paid">Pagado</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Comprobante de Pago</Label>
            <div className="flex items-center gap-2">
              <Input
                placeholder="URL del comprobante (imagen o PDF)"
                value={formData.payment_receipt_url}
                onChange={(e) => setFormData(prev => ({ ...prev, payment_receipt_url: e.target.value }))}
                className="flex-1"
              />
              {formData.payment_receipt_url && (
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  onClick={() => window.open(formData.payment_receipt_url, '_blank')}
                >
                  <ExternalLink className="w-4 h-4" />
                </Button>
              )}
            </div>
            {formData.payment_receipt_url && (
              <p className="text-xs text-muted-foreground">
                Comprobante cargado. Hacé clic en el botón para ver.
              </p>
            )}
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
