import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { Schedule, Student, DAY_NAMES, MONTH_NAMES } from '@/types/database';
import { isNewStudent } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const formatMonth = (monthStr: string): string => {
  const [year, month] = monthStr.split('-');
  return `${MONTH_NAMES[month]} ${year}`;
};

interface ScheduleGridProps {
  onStudentClick: (student: Student) => void;
  refreshTrigger: number;
}

export default function ScheduleGrid({ onStudentClick, refreshTrigger }: ScheduleGridProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [paymentMap, setPaymentMap] = useState<Record<string, string>>({});
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    const month = getCurrentMonth();
    setCurrentMonth(month);

    const [schedulesRes, studentsRes, paymentsRes] = await Promise.all([
      supabase.from('schedules').select('*').order('day_of_week').order('start_time'),
      supabase.from('students').select('*, schedule:schedules(*)'),
      supabase.from('payments').select('student_id, status').eq('month', month),
    ]);

    if (schedulesRes.data) setSchedules(schedulesRes.data as Schedule[]);
    if (studentsRes.data) setStudents(studentsRes.data as Student[]);

    const map: Record<string, string> = {};
    if (paymentsRes.data) {
      for (const p of paymentsRes.data) {
        map[p.student_id] = p.status;
      }
    }
    setPaymentMap(map);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [refreshTrigger]);

  const handleDragEnd = async (result: DropResult) => {
    if (!result.destination) return;

    const studentId = result.draggableId;
    const newScheduleId = result.destination.droppableId;

    // Check capacity
    const schedule = schedules.find(s => s.id === newScheduleId);
    const currentCount = students.filter(s => s.schedule_id === newScheduleId).length;
    
    if (schedule && currentCount >= schedule.max_capacity) {
      toast({
        title: 'Cupo lleno',
        description: 'Este horario ya alcanzó el máximo de alumnos',
        variant: 'destructive',
      });
      return;
    }

    // Update locally first for responsiveness
    setStudents(prev => prev.map(s => 
      s.id === studentId ? { ...s, schedule_id: newScheduleId } : s
    ));

    const { error } = await supabase
      .from('students')
      .update({ schedule_id: newScheduleId })
      .eq('id', studentId);

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo mover el alumno',
        variant: 'destructive',
      });
      fetchData();
    } else {
      toast({
        title: 'Alumno movido',
        description: 'El horario se actualizó correctamente',
      });
    }
  };

  // Filter students based on search
  const filteredStudents = students.filter(student => {
    if (!search) return true;
    const fullName = `${student.first_name} ${student.last_name}`.toLowerCase();
    const searchDigits = search.replace(/\D/g, '');
    const matchesName = fullName.includes(search.toLowerCase());
    const matchesPhone = searchDigits.length > 0 && student.phone != null &&
      student.phone.replace(/\D/g, '').includes(searchDigits);
    return matchesName || matchesPhone;
  });

  const groupedSchedules = schedules.reduce((acc, schedule) => {
    if (!acc[schedule.day_of_week]) {
      acc[schedule.day_of_week] = [];
    }
    acc[schedule.day_of_week].push(schedule);
    return acc;
  }, {} as Record<string, Schedule[]>);

  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Buscar por nombre o teléfono..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <p className="text-sm text-muted-foreground shrink-0">
          Cuotas de <span className="font-medium text-foreground">{formatMonth(currentMonth)}</span>
        </p>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {dayOrder.map(day => (
            <div key={day} className="space-y-3">
              <h3 className="font-bold text-lg text-primary text-center">{DAY_NAMES[day]}</h3>
              {groupedSchedules[day]?.map(schedule => {
                // For capacity count, use all students
                const allScheduleStudents = students.filter(s => s.schedule_id === schedule.id);
                // For display, use filtered students
                const scheduleStudents = filteredStudents.filter(s => s.schedule_id === schedule.id);
                const isFull = allScheduleStudents.length >= schedule.max_capacity;

              return (
                <Droppable key={schedule.id} droppableId={schedule.id}>
                  {(provided, snapshot) => (
                    <Card 
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[120px] transition-colors ${
                        snapshot.isDraggingOver ? 'bg-accent border-primary' : ''
                      } ${isFull ? 'border-warning/50' : ''}`}
                    >
                      <CardHeader className="py-2 px-3">
                        <CardTitle className="text-sm flex justify-between items-center">
                          <span>{schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}</span>
                          <Badge variant={isFull ? 'destructive' : 'secondary'} className="text-xs">
                            {allScheduleStudents.length}/{schedule.max_capacity}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="py-1 px-3 space-y-1">
                        {scheduleStudents.map((student, index) => (
                          <Draggable key={student.id} draggableId={student.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                onClick={() => onStudentClick(student)}
                                className={`p-2 rounded-md cursor-pointer flex items-center gap-2 text-sm transition-all ${
                                  snapshot.isDragging 
                                    ? 'bg-primary text-primary-foreground shadow-lg' 
                                    : 'bg-muted hover:bg-accent'
                                }`}
                              >
                                <User className="w-3 h-3 flex-shrink-0" />
                                <span className="truncate">{student.first_name} {student.last_name}</span>
                                {isNewStudent(student) && (
                                  <Badge className="text-[10px] bg-orange-500 hover:bg-orange-600 text-white border-transparent flex-shrink-0">
                                    Nuevo
                                  </Badge>
                                )}
                                <Badge
                                  variant={
                                    paymentMap[student.id] === 'paid'
                                      ? 'default'
                                      : paymentMap[student.id] === 'partial'
                                      ? 'secondary'
                                      : 'destructive'
                                  }
                                  className={`text-[10px] ml-auto ${paymentMap[student.id] === 'partial' ? 'bg-yellow-500 hover:bg-yellow-600 text-white' : ''}`}
                                >
                                  {paymentMap[student.id] === 'paid'
                                    ? '✓'
                                    : paymentMap[student.id] === 'partial'
                                    ? '½'
                                    : '$'}
                                </Badge>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </CardContent>
                    </Card>
                  )}
                </Droppable>
              );
            })}
          </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  );
}
