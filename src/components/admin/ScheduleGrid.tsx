import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { supabase } from '@/integrations/supabase/client';
import { Schedule, Student, DAY_NAMES, PAYMENT_STATUS_LABELS } from '@/types/database';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Loader2, User } from 'lucide-react';

interface ScheduleGridProps {
  onStudentClick: (student: Student) => void;
  refreshTrigger: number;
}

export default function ScheduleGrid({ onStudentClick, refreshTrigger }: ScheduleGridProps) {
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    setLoading(true);
    
    const [schedulesRes, studentsRes] = await Promise.all([
      supabase.from('schedules').select('*').order('day_of_week').order('start_time'),
      supabase.from('students').select('*, schedule:schedules(*)'),
    ]);

    if (schedulesRes.data) {
      setSchedules(schedulesRes.data as Schedule[]);
    }
    if (studentsRes.data) {
      setStudents(studentsRes.data as Student[]);
    }
    
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

  const groupedSchedules = schedules.reduce((acc, schedule) => {
    if (!acc[schedule.day_of_week]) {
      acc[schedule.day_of_week] = [];
    }
    acc[schedule.day_of_week].push(schedule);
    return acc;
  }, {} as Record<string, Schedule[]>);

  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <DragDropContext onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {dayOrder.map(day => (
          <div key={day} className="space-y-3">
            <h3 className="font-bold text-lg text-primary text-center">{DAY_NAMES[day]}</h3>
            {groupedSchedules[day]?.map(schedule => {
              const scheduleStudents = students.filter(s => s.schedule_id === schedule.id);
              const isFull = scheduleStudents.length >= schedule.max_capacity;

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
                            {scheduleStudents.length}/{schedule.max_capacity}
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
                                <Badge 
                                  variant={student.payment_status === 'paid' ? 'default' : 'destructive'}
                                  className="text-[10px] ml-auto"
                                >
                                  {student.payment_status === 'paid' ? '✓' : '$'}
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
  );
}
