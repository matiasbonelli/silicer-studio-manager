import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { DAY_NAMES } from '@/types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { Search, Loader2, MessageCircle, UserPlus, DollarSign, Eye, Trash2, FileText, ExternalLink, Pencil, Plus } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

const getSignedReceiptUrl = async (filePath: string): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from('receipts')
    .createSignedUrl(filePath, 3600);
  if (error || !data) return null;
  return data.signedUrl;
};

interface Schedule {
  id: string;
  day_of_week: string;
  start_time: string;
  end_time: string;
  max_capacity: number;
}

interface Enrollment {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  birthday: string | null;
  schedule_id: string;
  message: string | null;
  status: string;
  payment_status: string;
  payment_amount: number | null;
  payment_date: string | null;
  payment_notes: string | null;
  payment_receipt_url: string | null;
  converted_to_student_id: string | null;
  created_at: string;
  schedule?: Schedule;
}

const ENROLLMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Pendiente',
  contacted: 'Contactado',
  confirmed: 'Confirmado',
  cancelled: 'Cancelado',
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: 'Sin pago',
  deposit: 'Señado',
  paid: 'Pagado',
};

const PAYMENT_STATUS_COLORS: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'destructive',
  deposit: 'secondary',
  paid: 'default',
};

interface EnrollmentsManagerProps {
  onStudentCreated?: () => void;
}

export default function EnrollmentsManager({ onStudentCreated }: EnrollmentsManagerProps) {
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [scheduleCounts, setScheduleCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const { toast } = useToast();

  // Modal states
  const [selectedEnrollment, setSelectedEnrollment] = useState<Enrollment | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isConvertModalOpen, setIsConvertModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Edit form (sin status - se maneja automáticamente por pago)
  const [editForm, setEditForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    schedule_id: '',
    message: '',
  });

  // Create form
  const [createForm, setCreateForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    schedule_id: '',
    message: '',
  });

  // Payment form
  const [paymentForm, setPaymentForm] = useState({
    status: 'deposit',
    amount: '',
    notes: '',
  });

  // Convert form
  const [convertScheduleId, setConvertScheduleId] = useState<string>('');

  const fetchEnrollments = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('enrollments')
      .select('*, schedule:schedules(*)')
      .order('created_at', { ascending: false });

    if (data) {
      setEnrollments(data as unknown as Enrollment[]);
    }
    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudieron cargar las pre-inscripciones',
        variant: 'destructive',
      });
    }
    setLoading(false);
  };

  const fetchSchedules = async () => {
    const { data } = await supabase
      .from('schedules')
      .select('*')
      .order('day_of_week')
      .order('start_time');
    if (data) setSchedules(data);

    // Fetch student counts per schedule for availability
    const { data: studentsData } = await supabase
      .from('students')
      .select('schedule_id');
    if (studentsData) {
      const counts = studentsData.reduce((acc, s) => {
        if (s.schedule_id) {
          acc[s.schedule_id] = (acc[s.schedule_id] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);
      setScheduleCounts(counts);
    }
  };

  useEffect(() => {
    fetchEnrollments();
    fetchSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openPaymentModal = (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment);
    setPaymentForm({
      status: enrollment.payment_status || 'deposit',
      amount: enrollment.payment_amount?.toString() || '',
      notes: enrollment.payment_notes || '',
    });
    setIsPaymentModalOpen(true);
  };

  const handlePaymentSubmit = async () => {
    if (!selectedEnrollment) return;

    const updateData: Record<string, unknown> = {
      payment_status: paymentForm.status,
      payment_amount: paymentForm.amount ? parseFloat(paymentForm.amount) : null,
      payment_notes: paymentForm.notes || null,
      payment_date: new Date().toISOString(),
    };

    // Sin pago (pending) → Revertir: eliminar alumno creado y resetear estado
    if (paymentForm.status === 'pending' && selectedEnrollment.converted_to_student_id) {
      // Nullify references in sales before deleting
      await supabase
        .from('sales')
        .update({ student_id: null })
        .eq('student_id', selectedEnrollment.converted_to_student_id);

      // Delete the auto-created student
      await supabase
        .from('students')
        .delete()
        .eq('id', selectedEnrollment.converted_to_student_id);

      updateData.converted_to_student_id = null;
      updateData.status = 'pending';
    }

    // Señado o Pagado → Confirmar y crear alumno
    if (paymentForm.status === 'deposit' || paymentForm.status === 'paid') {
      if (!selectedEnrollment.converted_to_student_id) {
        // Crear el alumno con el estado de pago correspondiente
        // deposit → partial, paid → paid
        const studentPaymentStatus = paymentForm.status === 'paid' ? 'paid' : 'partial';

        const { data: newStudent, error: studentError } = await supabase
          .from('students')
          .insert({
            first_name: selectedEnrollment.first_name,
            last_name: selectedEnrollment.last_name,
            email: selectedEnrollment.email,
            phone: selectedEnrollment.phone,
            birthday: selectedEnrollment.birthday,
            schedule_id: selectedEnrollment.schedule_id,
            payment_status: studentPaymentStatus,
            paid_amount: paymentForm.amount ? parseFloat(paymentForm.amount) : null,
            payment_date: new Date().toISOString(),
            notes: selectedEnrollment.message,
          })
          .select()
          .single();

        if (studentError) {
          toast({
            title: 'Error',
            description: 'No se pudo crear el alumno',
            variant: 'destructive',
          });
          return;
        }

        updateData.status = 'confirmed';
        updateData.converted_to_student_id = newStudent.id;

        toast({
          title: 'Inscripción confirmada',
          description: `Alumno creado con pago ${paymentForm.status === 'paid' ? 'completo' : 'parcial'}`
        });
      } else {
        // Ya tiene alumno, solo actualizar estado
        updateData.status = 'confirmed';

        // Actualizar también el payment_status del alumno existente
        const studentPaymentStatus = paymentForm.status === 'paid' ? 'paid' : 'partial';
        await supabase
          .from('students')
          .update({
            payment_status: studentPaymentStatus,
            paid_amount: paymentForm.amount ? parseFloat(paymentForm.amount) : null,
          })
          .eq('id', selectedEnrollment.converted_to_student_id);
      }
    }

    const { error } = await supabase
      .from('enrollments')
      .update(updateData)
      .eq('id', selectedEnrollment.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo registrar el pago',
        variant: 'destructive',
      });
    } else {
      if (paymentForm.status === 'pending') {
        toast({ title: 'Estado de pago actualizado' });
        onStudentCreated?.();
      } else if (selectedEnrollment.converted_to_student_id) {
        toast({ title: 'Pago actualizado en inscripción y alumno' });
      }
      setIsPaymentModalOpen(false);
      fetchEnrollments();
      if ((paymentForm.status === 'deposit' || paymentForm.status === 'paid') && !selectedEnrollment.converted_to_student_id) {
        onStudentCreated?.();
      }
    }
  };

  const openConvertModal = (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment);
    setConvertScheduleId(enrollment.schedule_id);
    setIsConvertModalOpen(true);
  };

  const handleConvertToStudent = async () => {
    if (!selectedEnrollment) return;

    // Mapear payment_status de inscripción a alumno: deposit → partial, paid → paid, pending → pending
    const studentPaymentStatus = selectedEnrollment.payment_status === 'paid'
      ? 'paid'
      : selectedEnrollment.payment_status === 'deposit'
        ? 'partial'
        : 'pending';

    // Create the student
    const { data: newStudent, error: studentError } = await supabase
      .from('students')
      .insert({
        first_name: selectedEnrollment.first_name,
        last_name: selectedEnrollment.last_name,
        email: selectedEnrollment.email,
        phone: selectedEnrollment.phone,
        birthday: selectedEnrollment.birthday,
        schedule_id: convertScheduleId,
        payment_status: studentPaymentStatus,
        notes: selectedEnrollment.message,
      })
      .select()
      .single();

    if (studentError) {
      toast({
        title: 'Error',
        description: 'No se pudo crear el alumno',
        variant: 'destructive',
      });
      return;
    }

    // Update enrollment to mark as converted
    const { error: updateError } = await supabase
      .from('enrollments')
      .update({
        status: 'confirmed',
        converted_to_student_id: newStudent.id,
      })
      .eq('id', selectedEnrollment.id);

    if (updateError) {
      toast({
        title: 'Advertencia',
        description: 'Alumno creado pero no se pudo actualizar la pre-inscripción',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Pre-inscripción convertida a alumno activo' });
    }

    setIsConvertModalOpen(false);
    fetchEnrollments();
    onStudentCreated?.();
  };

  const openDeleteModal = (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment);
    setIsDeleteModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedEnrollment) return;

    const { error } = await supabase
      .from('enrollments')
      .delete()
      .eq('id', selectedEnrollment.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo eliminar la pre-inscripción',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Pre-inscripción eliminada' });
      setIsDeleteModalOpen(false);
      fetchEnrollments();
    }
  };

  const openEditModal = (enrollment: Enrollment) => {
    setSelectedEnrollment(enrollment);
    setEditForm({
      first_name: enrollment.first_name,
      last_name: enrollment.last_name,
      email: enrollment.email,
      phone: enrollment.phone || '',
      schedule_id: enrollment.schedule_id,
      message: enrollment.message || '',
    });
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async () => {
    if (!selectedEnrollment) return;

    // Solo actualizar datos básicos - el estado se maneja por pago
    const { error } = await supabase
      .from('enrollments')
      .update({
        first_name: editForm.first_name,
        last_name: editForm.last_name,
        email: editForm.email,
        phone: editForm.phone || null,
        schedule_id: editForm.schedule_id,
        message: editForm.message || null,
      })
      .eq('id', selectedEnrollment.id);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar la inscripción',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Inscripción actualizada' });
      setIsEditModalOpen(false);
      fetchEnrollments();
    }
  };

  const openCreateModal = () => {
    setCreateForm({
      first_name: '',
      last_name: '',
      email: '',
      phone: '',
      schedule_id: '',
      message: '',
    });
    setIsCreateModalOpen(true);
  };

  const handleCreateSubmit = async () => {
    if (!createForm.first_name || !createForm.last_name || !createForm.email || !createForm.schedule_id) {
      toast({
        title: 'Error',
        description: 'Nombre, apellido, email y horario son requeridos',
        variant: 'destructive',
      });
      return;
    }

    const { error } = await supabase
      .from('enrollments')
      .insert({
        first_name: createForm.first_name,
        last_name: createForm.last_name,
        email: createForm.email,
        phone: createForm.phone || null,
        schedule_id: createForm.schedule_id,
        message: createForm.message || null,
        status: 'pending',
        payment_status: 'pending',
      });

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo crear la inscripción',
        variant: 'destructive',
      });
    } else {
      toast({ title: 'Inscripción creada' });
      setIsCreateModalOpen(false);
      fetchEnrollments();
    }
  };

  const filteredEnrollments = enrollments.filter(enrollment => {
    const fullName = `${enrollment.first_name} ${enrollment.last_name}`.toLowerCase();
    const phone = (enrollment.phone || '').toLowerCase();
    const matchesSearch = fullName.includes(search.toLowerCase()) ||
                          phone.includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || enrollment.status === statusFilter;
    const matchesPayment = paymentFilter === 'all' || enrollment.payment_status === paymentFilter;
    return matchesSearch && matchesStatus && matchesPayment;
  });

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="pending">Pendiente</SelectItem>
            <SelectItem value="contacted">Contactado</SelectItem>
            <SelectItem value="confirmed">Confirmado</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-full sm:w-[180px]">
            <SelectValue placeholder="Pago" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los pagos</SelectItem>
            <SelectItem value="pending">Sin pago</SelectItem>
            <SelectItem value="deposit">Señado</SelectItem>
            <SelectItem value="paid">Pagado</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={openCreateModal}>
          <Plus className="w-4 h-4 mr-2" /> Agregar Inscripción
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Total</p>
          <p className="text-2xl font-bold">{enrollments.length}</p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Pendientes</p>
          <p className="text-2xl font-bold text-orange-500">
            {enrollments.filter(e => e.status === 'pending').length}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Señados</p>
          <p className="text-2xl font-bold text-blue-500">
            {enrollments.filter(e => e.payment_status === 'deposit').length}
          </p>
        </div>
        <div className="bg-card border rounded-lg p-4">
          <p className="text-sm text-muted-foreground">Pagados</p>
          <p className="text-2xl font-bold text-green-500">
            {enrollments.filter(e => e.payment_status === 'paid').length}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Fecha</TableHead>
              <TableHead>Nombre</TableHead>
              <TableHead>Horario Solicitado</TableHead>
              <TableHead className="text-center">Disponible</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-center">Pago</TableHead>
              <TableHead className="text-center">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                  <TableCell><div className="space-y-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-3 w-40" /></div></TableCell>
                  <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-5 w-10 mx-auto rounded-full" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-5 w-20 mx-auto rounded-full" /></TableCell>
                  <TableCell className="text-center"><Skeleton className="h-5 w-16 mx-auto rounded-full" /></TableCell>
                  <TableCell><div className="flex justify-center gap-1"><Skeleton className="h-8 w-8 rounded" /><Skeleton className="h-8 w-8 rounded" /><Skeleton className="h-8 w-8 rounded" /></div></TableCell>
                </TableRow>
              ))
            ) : filteredEnrollments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  No se encontraron pre-inscripciones
                </TableCell>
              </TableRow>
            ) : filteredEnrollments.map(enrollment => (
              <TableRow
                key={enrollment.id}
                className={enrollment.converted_to_student_id ? 'opacity-50 bg-muted/30' : ''}
              >
                <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                  {format(new Date(enrollment.created_at), 'dd/MM/yy', { locale: es })}
                </TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{enrollment.first_name} {enrollment.last_name}</p>
                    <p className="text-sm text-muted-foreground">{enrollment.email}</p>
                  </div>
                </TableCell>
                <TableCell>
                  {enrollment.schedule ? (
                    <span className="text-sm">
                      {DAY_NAMES[enrollment.schedule.day_of_week]} {enrollment.schedule.start_time.slice(0, 5)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {enrollment.schedule ? (
                    (scheduleCounts[enrollment.schedule_id] || 0) < enrollment.schedule.max_capacity ? (
                      <Badge className="bg-green-500 hover:bg-green-600">Sí</Badge>
                    ) : (
                      <Badge variant="destructive">No</Badge>
                    )
                  ) : (
                    <span className="text-muted-foreground text-sm">-</span>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={
                    enrollment.status === 'confirmed' ? 'default' :
                    enrollment.status === 'contacted' ? 'secondary' :
                    enrollment.status === 'cancelled' ? 'destructive' : 'outline'
                  }>
                    {ENROLLMENT_STATUS_LABELS[enrollment.status] || enrollment.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Badge variant={PAYMENT_STATUS_COLORS[enrollment.payment_status] || 'destructive'}>
                    {PAYMENT_STATUS_LABELS[enrollment.payment_status] || 'Sin pago'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center justify-center gap-1">
                    {/* View details */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setSelectedEnrollment(enrollment);
                        setIsDetailModalOpen(true);
                      }}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>

                    {/* Edit */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEditModal(enrollment)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>

                    {/* WhatsApp - siempre visible si tiene teléfono */}
                    {enrollment.phone && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-green-600 hover:text-green-700"
                        onClick={async () => {
                          const phone = enrollment.phone?.replace(/\D/g, '');
                          const day = enrollment.schedule ? DAY_NAMES[enrollment.schedule.day_of_week] : '[Completar día]';
                          const time = enrollment.schedule
                            ? `${enrollment.schedule.start_time.slice(0, 5)} a ${enrollment.schedule.end_time.slice(0, 5)} hs`
                            : '[Completar hora]';
                          const message = encodeURIComponent(
                            `Hola de nuevo!\n\nTe escribimos para confirmar tu turno:\n\nDia: ${day}\nHorario: ${time}\n\nMuchas gracias, te esperamos!`
                          );
                          window.open(`https://wa.me/54${phone}?text=${message}`, '_blank', 'noopener,noreferrer');
                          // Actualizar estado a "contacted" si está pendiente y no convertido
                          if (enrollment.status === 'pending' && !enrollment.converted_to_student_id) {
                            await supabase
                              .from('enrollments')
                              .update({ status: 'contacted' })
                              .eq('id', enrollment.id);
                            fetchEnrollments();
                          }
                        }}
                      >
                        <MessageCircle className="w-4 h-4" />
                      </Button>
                    )}

                    {/* Register payment - siempre visible para poder editar */}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openPaymentModal(enrollment)}
                    >
                      <DollarSign className="w-4 h-4" />
                    </Button>

                    {/* Convert to student */}
                    {!enrollment.converted_to_student_id && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-primary"
                        onClick={() => openConvertModal(enrollment)}
                      >
                        <UserPlus className="w-4 h-4" />
                      </Button>
                    )}

                    {/* Delete */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="text-destructive hover:text-destructive"
                      onClick={() => openDeleteModal(enrollment)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Detalle de Pre-inscripción</DialogTitle>
          </DialogHeader>
          {selectedEnrollment && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">Nombre</Label>
                  <p className="font-medium">{selectedEnrollment.first_name} {selectedEnrollment.last_name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Email</Label>
                  <p>{selectedEnrollment.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Teléfono</Label>
                  <p>{selectedEnrollment.phone || '-'}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Fecha inscripción</Label>
                  <p>{format(new Date(selectedEnrollment.created_at), 'dd/MM/yyyy HH:mm', { locale: es })}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Horario solicitado</Label>
                  <p>
                    {selectedEnrollment.schedule 
                      ? `${DAY_NAMES[selectedEnrollment.schedule.day_of_week]} ${selectedEnrollment.schedule.start_time.slice(0, 5)}`
                      : '-'}
                  </p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Estado de pago</Label>
                  <p>
                    <Badge variant={PAYMENT_STATUS_COLORS[selectedEnrollment.payment_status] || 'destructive'}>
                      {PAYMENT_STATUS_LABELS[selectedEnrollment.payment_status] || 'Sin pago'}
                    </Badge>
                  </p>
                </div>
                {selectedEnrollment.payment_amount && (
                  <div>
                    <Label className="text-muted-foreground">Monto pagado</Label>
                    <p>${selectedEnrollment.payment_amount.toLocaleString()}</p>
                  </div>
                )}
                {selectedEnrollment.payment_date && (
                  <div>
                    <Label className="text-muted-foreground">Fecha de pago</Label>
                    <p>{format(new Date(selectedEnrollment.payment_date), 'dd/MM/yyyy', { locale: es })}</p>
                  </div>
                )}
              </div>
              {selectedEnrollment.message && (
                <div>
                  <Label className="text-muted-foreground">Mensaje</Label>
                  <p className="mt-1 p-3 bg-muted rounded-md text-sm">{selectedEnrollment.message}</p>
                </div>
              )}
              {selectedEnrollment.payment_notes && (
                <div>
                  <Label className="text-muted-foreground">Notas de pago</Label>
                  <p className="mt-1 p-3 bg-muted rounded-md text-sm">{selectedEnrollment.payment_notes}</p>
                </div>
              )}
              {selectedEnrollment.payment_receipt_url && (
                <div>
                  <Label className="text-muted-foreground">Comprobante de pago</Label>
                  <Button
                    variant="outline"
                    className="mt-2 w-full"
                    onClick={async () => {
                      const url = await getSignedReceiptUrl(selectedEnrollment.payment_receipt_url!);
                      if (url) window.open(url, '_blank', 'noopener,noreferrer');
                    }}
                  >
                    <FileText className="w-4 h-4 mr-2" />
                    Ver comprobante
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Modal */}
      <Dialog open={isPaymentModalOpen} onOpenChange={setIsPaymentModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pago</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Estado de Pago</Label>
              <Select value={paymentForm.status} onValueChange={(v) => setPaymentForm(p => ({ ...p, status: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending">Sin pago</SelectItem>
                  <SelectItem value="deposit">Señado</SelectItem>
                  <SelectItem value="paid">Pagado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Monto</Label>
              <Input
                type="number"
                placeholder="Ej: 5000"
                value={paymentForm.amount}
                onChange={(e) => setPaymentForm(p => ({ ...p, amount: e.target.value }))}
              />
            </div>
            <div>
              <Label>Notas</Label>
              <Textarea
                placeholder="Notas sobre el pago..."
                value={paymentForm.notes}
                onChange={(e) => setPaymentForm(p => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPaymentModalOpen(false)}>Cancelar</Button>
            <Button onClick={handlePaymentSubmit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert Modal */}
      <Dialog open={isConvertModalOpen} onOpenChange={setIsConvertModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convertir a Alumno Activo</DialogTitle>
          </DialogHeader>
          {selectedEnrollment && (
            <div className="space-y-4">
              <p>
                ¿Convertir a <strong>{selectedEnrollment.first_name} {selectedEnrollment.last_name}</strong> en alumno activo?
              </p>
              <div>
                <Label>Asignar a horario</Label>
                <Select value={convertScheduleId} onValueChange={setConvertScheduleId}>
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
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsConvertModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleConvertToStudent} disabled={!convertScheduleId}>
              <UserPlus className="w-4 h-4 mr-2" /> Convertir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={isDeleteModalOpen} onOpenChange={setIsDeleteModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Eliminar Pre-inscripción</DialogTitle>
          </DialogHeader>
          {selectedEnrollment && (
            <p>
              ¿Estás seguro de eliminar la pre-inscripción de <strong>{selectedEnrollment.first_name} {selectedEnrollment.last_name}</strong>?
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteModalOpen(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 mr-2" /> Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Inscripción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre</Label>
                <Input
                  value={editForm.first_name}
                  onChange={(e) => setEditForm(p => ({ ...p, first_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Apellido</Label>
                <Input
                  value={editForm.last_name}
                  onChange={(e) => setEditForm(p => ({ ...p, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Email</Label>
              <Input
                type="email"
                value={editForm.email}
                onChange={(e) => setEditForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                type="tel"
                value={editForm.phone}
                onChange={(e) => setEditForm(p => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Horario</Label>
              <Select value={editForm.schedule_id} onValueChange={(v) => setEditForm(p => ({ ...p, schedule_id: v }))}>
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
            <div>
              <Label>Mensaje / Notas</Label>
              <Textarea
                value={editForm.message}
                onChange={(e) => setEditForm(p => ({ ...p, message: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleEditSubmit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create Modal */}
      <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Inscripción</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nombre *</Label>
                <Input
                  value={createForm.first_name}
                  onChange={(e) => setCreateForm(p => ({ ...p, first_name: e.target.value }))}
                />
              </div>
              <div>
                <Label>Apellido *</Label>
                <Input
                  value={createForm.last_name}
                  onChange={(e) => setCreateForm(p => ({ ...p, last_name: e.target.value }))}
                />
              </div>
            </div>
            <div>
              <Label>Email *</Label>
              <Input
                type="email"
                value={createForm.email}
                onChange={(e) => setCreateForm(p => ({ ...p, email: e.target.value }))}
              />
            </div>
            <div>
              <Label>Teléfono</Label>
              <Input
                type="tel"
                value={createForm.phone}
                onChange={(e) => setCreateForm(p => ({ ...p, phone: e.target.value }))}
              />
            </div>
            <div>
              <Label>Horario *</Label>
              <Select value={createForm.schedule_id} onValueChange={(v) => setCreateForm(p => ({ ...p, schedule_id: v }))}>
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
            <div>
              <Label>Mensaje / Notas</Label>
              <Textarea
                value={createForm.message}
                onChange={(e) => setCreateForm(p => ({ ...p, message: e.target.value }))}
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
            <Button onClick={handleCreateSubmit}>
              <Plus className="w-4 h-4 mr-2" /> Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
