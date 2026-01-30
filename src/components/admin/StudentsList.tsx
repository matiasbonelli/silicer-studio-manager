import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Student, DAY_NAMES, PAYMENT_STATUS_LABELS } from '@/types/database';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { Check, X, Search, Loader2 } from 'lucide-react';

interface StudentsListProps {
  onStudentClick: (student: Student) => void;
  refreshTrigger: number;
}

export default function StudentsList({ onStudentClick, refreshTrigger }: StudentsListProps) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
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

  const togglePayment = async (student: Student) => {
    const newStatus = student.payment_status === 'paid' ? 'pending' : 'paid';
    
    setStudents(prev => prev.map(s => 
      s.id === student.id ? { ...s, payment_status: newStatus } : s
    ));

    const { error } = await supabase
      .from('students')
      .update({ payment_status: newStatus })
      .eq('id', student.id);

    if (error) {
      fetchStudents();
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el estado',
        variant: 'destructive',
      });
    } else {
      toast({
        title: newStatus === 'paid' ? 'Cuota marcada como pagada' : 'Cuota marcada como pendiente',
      });
    }
  };

  const filteredStudents = students.filter(student => {
    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
    return fullName.includes(search.toLowerCase());
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
        <Input
          placeholder="Buscar alumno..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="rounded-lg border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Horario</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="text-center">Cuota</TableHead>
              <TableHead className="text-center">Acción</TableHead>
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
                <TableCell className="text-sm">{student.email || '-'}</TableCell>
                <TableCell className="text-center">
                  <Badge variant={student.payment_status === 'paid' ? 'default' : 'destructive'}>
                    {PAYMENT_STATUS_LABELS[student.payment_status]}
                  </Badge>
                </TableCell>
                <TableCell className="text-center">
                  <Button
                    size="sm"
                    variant={student.payment_status === 'paid' ? 'outline' : 'default'}
                    onClick={(e) => {
                      e.stopPropagation();
                      togglePayment(student);
                    }}
                  >
                    {student.payment_status === 'paid' ? (
                      <X className="w-4 h-4" />
                    ) : (
                      <Check className="w-4 h-4" />
                    )}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
            {filteredStudents.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                  No se encontraron alumnos
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
