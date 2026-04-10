import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Student } from '@/types/database';
import ScheduleGrid from '@/components/admin/ScheduleGrid';
import StudentsList from '@/components/admin/StudentsList';
import StudentModal from '@/components/admin/StudentModal';
import InventoryManager from '@/components/admin/InventoryManager';
import SalesModule from '@/components/admin/SalesModule';
import BirthdayModal from '@/components/admin/BirthdayModal';
import EnrollmentsManager from '@/components/admin/EnrollmentsManager';
import PricingCalculator from '@/components/admin/PricingCalculator';
import OrdersManager from '@/components/admin/OrdersManager';
import Dashboard from '@/components/admin/Dashboard';
import AttendanceManager from '@/components/admin/AttendanceManager';
import { LogOut, Plus, Calendar, Users, Package, ShoppingCart, Loader2, ClipboardList, ClipboardCheck, Calculator, Sun, Moon, LayoutDashboard, UserCheck } from 'lucide-react';

export default function Admin() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isStudentModalOpen, setIsStudentModalOpen] = useState(false);
  const [isNewStudent, setIsNewStudent] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [activeTab, setActiveTab] = useState('schedule');
  const [darkMode, setDarkMode] = useState(false);
  const [pendingEnrollments, setPendingEnrollments] = useState(0);

  const fetchPendingEnrollments = useCallback(async () => {
    if (!user) return;
    const { count } = await supabase
      .from('enrollments')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending');
    setPendingEnrollments(count ?? 0);
  }, [user]);

  // Polling cada 20s + refetch al volver al tab del browser
  useEffect(() => {
    fetchPendingEnrollments();
    const interval = setInterval(fetchPendingEnrollments, 20_000);
    const onVisible = () => { if (!document.hidden) fetchPendingEnrollments(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchPendingEnrollments]);

  // Refetch inmediato al salir del tab de inscripciones (el usuario acabó de hacer cambios)
  useEffect(() => {
    if (user && activeTab !== 'enrollments') fetchPendingEnrollments();
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }

    // Cleanup: remove dark class when leaving admin
    return () => {
      document.documentElement.classList.remove('dark');
    };
  }, [darkMode]);

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
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-primary-foreground/10 hover:bg-primary-foreground/20 transition-colors"
              title={darkMode ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-yellow-300" />
              ) : (
                <Moon className="w-4 h-4 text-primary-foreground" />
              )}
            </button>
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
            <TabsList className="flex w-full overflow-x-auto flex-nowrap h-auto gap-1 p-1 justify-start">
              <TabsTrigger value="schedule" className="flex items-center gap-1.5 shrink-0 px-3 py-1.5">
                <Calendar className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Horarios</span>
              </TabsTrigger>
              <TabsTrigger value="enrollments" className="relative flex items-center gap-1.5 shrink-0 px-3 py-1.5">
                <ClipboardList className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Inscripciones</span>
                {pendingEnrollments > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-yellow-400" />
                )}
              </TabsTrigger>
              <TabsTrigger value="students" className="flex items-center gap-1.5 shrink-0 px-3 py-1.5">
                <Users className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Alumnos</span>
              </TabsTrigger>
              <TabsTrigger value="attendance" className="flex items-center gap-1.5 shrink-0 px-3 py-1.5">
                <UserCheck className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Asistencia</span>
              </TabsTrigger>
              <TabsTrigger value="inventory" className="flex items-center gap-1.5 shrink-0 px-3 py-1.5">
                <Package className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Inventario</span>
              </TabsTrigger>
              <TabsTrigger value="sales" className="flex items-center gap-1.5 shrink-0 px-3 py-1.5">
                <ShoppingCart className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Ventas</span>
              </TabsTrigger>
              <TabsTrigger value="orders" className="flex items-center gap-1.5 shrink-0 px-3 py-1.5">
                <ClipboardCheck className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Pedidos</span>
              </TabsTrigger>
              <TabsTrigger value="pricing" className="flex items-center gap-1.5 shrink-0 px-3 py-1.5">
                <Calculator className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Calculadora de Costos</span>
              </TabsTrigger>
              <TabsTrigger value="dashboard" className="flex items-center gap-1.5 shrink-0 px-3 py-1.5">
                <LayoutDashboard className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Resumen</span>
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

          <TabsContent value="attendance" className="mt-6">
            <AttendanceManager />
          </TabsContent>

          <TabsContent value="inventory" className="mt-6">
            <InventoryManager />
          </TabsContent>

          <TabsContent value="sales" className="mt-6">
            <SalesModule />
          </TabsContent>

          <TabsContent value="orders" className="mt-6">
            <OrdersManager />
          </TabsContent>

          <TabsContent value="pricing" className="mt-6">
            <PricingCalculator />
          </TabsContent>

          <TabsContent value="dashboard" className="mt-6">
            <Dashboard />
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
