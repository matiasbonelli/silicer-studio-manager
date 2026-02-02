import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Student } from '@/types/database';
import ScheduleGrid from '@/components/admin/ScheduleGrid';
import StudentsList from '@/components/admin/StudentsList';
import StudentModal from '@/components/admin/StudentModal';
import InventoryManager from '@/components/admin/InventoryManager';
import SalesModule from '@/components/admin/SalesModule';
import BirthdayModal from '@/components/admin/BirthdayModal';
import EnrollmentsManager from '@/components/admin/EnrollmentsManager';
import { LogOut, Plus, Calendar, Users, Package, ShoppingCart, Loader2, ClipboardList } from 'lucide-react';

export default function Admin() {
  const { user, loading, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isNewStudent, setIsNewStudent] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState('schedule');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  const handleStudentClick = (student: Student) => {
    setSelectedStudent(student);
    setIsNewStudent(false);
    setIsStudentModalOpen(true);
  };

  const handleAddStudent = () => {
    setSelectedStudent(null);
    setIsNewStudent(true);
    setIsStudentModalOpen(true);
  };

  const handleStudentSave = () => {
    setRefreshTrigger(prev => prev + 1);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-primary text-primary-foreground shadow-lg">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Silicer Admin</h1>
          <div className="flex items-center gap-4">
            <span className="text-sm opacity-80 hidden md:inline">{user.email}</span>
            <Button variant="secondary" size="sm" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-2" /> Salir
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <TabsList className="grid w-full sm:w-auto grid-cols-5 gap-1">
              <TabsTrigger value="schedule" className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4" />
                <span className="hidden sm:inline">Horarios</span>
              </TabsTrigger>
              <TabsTrigger value="enrollments" className="flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4" />
                <span className="hidden sm:inline">Inscripciones</span>
              </TabsTrigger>
              <TabsTrigger value="students" className="flex items-center gap-1.5">
                <Users className="w-4 h-4" />
                <span className="hidden sm:inline">Alumnos</span>
              </TabsTrigger>
              <TabsTrigger value="inventory" className="flex items-center gap-1.5">
                <Package className="w-4 h-4" />
                <span className="hidden sm:inline">Inventario</span>
              </TabsTrigger>
              <TabsTrigger value="sales" className="flex items-center gap-1.5">
                <ShoppingCart className="w-4 h-4" />
                <span className="hidden sm:inline">Ventas</span>
              </TabsTrigger>
            </TabsList>

            {(activeTab === 'schedule' || activeTab === 'students') && (
              <Button onClick={handleAddStudent}>
                <Plus className="w-4 h-4 mr-2" /> Agregar Alumno
              </Button>
            )}
          </div>

          <TabsContent value="schedule" className="mt-6">
            <ScheduleGrid onStudentClick={handleStudentClick} refreshTrigger={refreshTrigger} />
          </TabsContent>

          <TabsContent value="enrollments" className="mt-6">
            <EnrollmentsManager onStudentCreated={() => setRefreshTrigger(prev => prev + 1)} />
          </TabsContent>

          <TabsContent value="students" className="mt-6">
            <StudentsList onStudentClick={handleStudentClick} refreshTrigger={refreshTrigger} />
          </TabsContent>

          <TabsContent value="inventory" className="mt-6">
            <InventoryManager />
          </TabsContent>

          <TabsContent value="sales" className="mt-6">
            <SalesModule />
          </TabsContent>
        </Tabs>
      </main>

      {/* Student Modal */}
      <StudentModal
        student={selectedStudent}
        isOpen={isStudentModalOpen}
        onClose={() => setIsStudentModalOpen(false)}
        onSave={handleStudentSave}
        isNew={isNewStudent}
      />

      {/* Birthday Modal */}
      <BirthdayModal />
    </div>
  );
}
