import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Student } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Cake, X } from 'lucide-react';

export default function BirthdayModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [birthdayStudents, setBirthdayStudents] = useState<Student[]>([]);

  useEffect(() => {
    const checkBirthdays = async () => {
      // Check if already dismissed today
      const today = new Date().toISOString().split('T')[0];
      const dismissedDate = localStorage.getItem('birthdayModalDismissed');

      if (dismissedDate === today) {
        return;
      }

      // Get today's month and day
      const now = new Date();
      const todayMonth = String(now.getMonth() + 1).padStart(2, '0');
      const todayDay = String(now.getDate()).padStart(2, '0');

      // Fetch students with birthdays today
      const { data } = await supabase
        .from('students')
        .select('*')
        .not('birthday', 'is', null);

      if (data) {
        const todayBirthdays = data.filter(student => {
          if (!student.birthday) return false;
          const birthday = new Date(student.birthday);
          const birthMonth = String(birthday.getMonth() + 1).padStart(2, '0');
          const birthDay = String(birthday.getDate()).padStart(2, '0');
          return birthMonth === todayMonth && birthDay === todayDay;
        });

        if (todayBirthdays.length > 0) {
          setBirthdayStudents(todayBirthdays as Student[]);
          setIsOpen(true);
        }
      }
    };

    checkBirthdays();
  }, []);

  const handleDismiss = () => {
    const today = new Date().toISOString().split('T')[0];
    localStorage.setItem('birthdayModalDismissed', today);
    setIsOpen(false);
  };

  if (birthdayStudents.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader className="text-center">
          <DialogTitle className="flex items-center justify-center gap-2 text-2xl">
            <Cake className="w-6 h-6 text-primary" />
            Cumpleaños de Hoy
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="text-6xl text-center">🎂</div>

          <div className="space-y-3">
            {birthdayStudents.map(student => (
              <div
                key={student.id}
                className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20 text-center"
              >
                <p className="text-lg font-semibold">
                  {student.first_name} {student.last_name}
                </p>
                {student.phone && (
                  <a
                    href={`https://wa.me/54${student.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-primary hover:underline"
                  >
                    {student.phone}
                  </a>
                )}
              </div>
            ))}
          </div>

          <p className="text-center text-muted-foreground">
            ¡No te olvides de saludar!
          </p>
        </div>

        <DialogFooter className="flex justify-center sm:justify-center">
          <Button variant="outline" onClick={handleDismiss}>
            <X className="w-4 h-4 mr-2" /> No mostrar más hoy
          </Button>
          <Button onClick={() => setIsOpen(false)}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
