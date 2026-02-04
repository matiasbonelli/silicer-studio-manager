import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Student, DAY_NAMES, PAYMENT_STATUS_LABELS, PaymentStatus, MONTH_NAMES } from '@/types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Search, Loader2, MessageCircle, FileText, Trash2, DollarSign, Calendar } from 'lucide-react';

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

// Helper para formatear fecha
const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

export default function StudentsList({ onStudentClick, refreshTrigger, onStudentDeleted }: StudentsListProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [studentToDelete, setStudentToDelete] = useState<Student | null>(null);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [studentToPayment, setStudentToPayment] = useState<Student | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentType, setPaymentType] = useState<'total' | 'partial' | 'pending'>('total');
  const [partialAmount, setPartialAmount] = useState<string>('');
  const { toast } = useToast();

  const fetchStudents = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('students')
      .select('*, schedule:schedules(*)')
      .order('last_name')
      .order('first_name');

    if (data) {
      setStudents(data as Student[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchStudents();
  }, [refreshTrigger]);

  const openPaymentModal = (student: Student) => {
    setStudentToPayment(student);
    // Mapear el estado actual al tipo de pago correcto
    if (student.payment_status === 'paid') {
      setPaymentType('total');
    } else if (student.payment_status === 'partial') {
      setPaymentType('partial');
    } else {
      setPaymentType('pending');
    }
    setPartialAmount(student.paid_amount?.toString() || '');
    setIsPaymentModalOpen(true);
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

    // Solo actualizar fecha si se está pagando (total o parcial)
    const paymentDate = (paymentType === 'total' || paymentType === 'partial')
      ? new Date().toISOString()
      : null;

    const { error } = await supabase
      .from('students')
      .update({
        payment_status: newStatus,
        paid_amount: paidAmount,
        payment_date: paymentDate,
        payment_month: selectedMonth,
      })
      .eq('id', studentToPayment.id);

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
      fetchStudents();
    }
  };

  const getPaymentBadge = (student: Student) => {
    switch (student.payment_status) {
      case 'paid':
        return <Badge className="bg-green-500 hover:bg-green-600">Pagado</Badge>;
      case 'partial':
        return (
          <div className="text-center">
            <Badge className="bg-yellow-500 hover:bg-yellow-600">Parcial</Badge>
            {student.paid_amount && (
              <p className="text-xs text-muted-foreground mt-1">${student.paid_amount.toLocaleString()}</p>
            )}
          </div>
        );
      case 'pending':
      default:
        return <Badge variant="destructive">Pendiente</Badge>;
    }
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

  const filteredStudents = students.filter(student => {
    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
    const matchesSearch = fullName.includes(search.toLowerCase());
    const matchesMonth = !selectedMonth || selectedMonth === 'all' || student.payment_month === selectedMonth || !student.payment_month;
    return matchesSearch && matchesMonth;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

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
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
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
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Horario</TableHead>
              <TableHead className="text-center">Mes Cuota</TableHead>
              <TableHead className="text-center">Fecha Pago</TableHead>
              <TableHead className="text-center">WhatsApp</TableHead>
              <TableHead className="text-center">Estado</TableHead>
              <TableHead className="text-center">Comprobante</TableHead>
              <TableHead className="text-center">Pago</TableHead>
              <TableHead className="text-center">Eliminar</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStudents.map(student => (
              <TableRow 
                key={student.id} 
                className="cursor-pointer hover:bg-accent"
                onClick={() => onStudentClick(student)}
              >
                <TableCell className="font-medium">
                  {student.first_name} {student.last_name}
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
                  {formatMonth(student.payment_month)}
                </TableCell>
                <TableCell className="text-center text-sm">
                  {formatDate(student.payment_date)}
                </TableCell>
                <TableCell className="text-center">
                  {student.phone ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 hover:text-green-700"
                      onClick={(e) => {
                        e.stopPropagation();
                        const phone = student.phone?.replace(/\D/g, '');
                        window.open(`https://wa.me/54${phone}`, '_blank');
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
                  {student.payment_receipt_url ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(student.payment_receipt_url!, '_blank');
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
            ))}
            {filteredStudents.length === 0 && (
              <TableRow>
                <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                  No se encontraron alumnos
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

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
        if (!open) setStudentToPayment(null);
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
