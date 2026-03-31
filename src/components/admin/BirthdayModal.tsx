import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Student } from '@/types/database';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { MessageCircle } from 'lucide-react';

export default function BirthdayModal() {
  const [isOpen, setIsOpen] = useState(false);
  const [birthdayStudents, setBirthdayStudents] = useState<Student[]>([]);

  useEffect(() => {
    const dismissedKey = `birthday-modal-dismissed-${new Date().toISOString().slice(0, 10)}`;
    if (localStorage.getItem(dismissedKey)) return;

    const checkBirthdays = async () => {
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
          // Compare month-day strings directly to avoid timezone issues
          const parts = student.birthday.split('-');
          if (parts.length < 3) return false;
          return parts[1] === todayMonth && parts[2] === todayDay;
        });

        if (todayBirthdays.length > 0) {
          setBirthdayStudents(todayBirthdays as Student[]);
          setIsOpen(true);
        }
      }
    };

    checkBirthdays();
  }, []);

  const handleClose = () => {
    const dismissedKey = `birthday-modal-dismissed-${new Date().toISOString().slice(0, 10)}`;
    localStorage.setItem(dismissedKey, '1');
    setIsOpen(false);
  };

  const buildWhatsAppUrl = (student: Student) => {
    const name = student.first_name;
    const message = `Muy feliz cumple años ${name} 🥳, esperemos que disfrutes en tu hermoso día💫. Te saluda Caro y todo el equipo de Silicer🩷`;
    const phone = student.phone ? `54${student.phone.replace(/\D/g, '')}` : '';
    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
  };

  if (birthdayStudents.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-md">
        <div className="text-6xl text-center pt-2">🎂</div>

        <DialogHeader className="text-center">
          <DialogTitle className="text-2xl text-center">
            Cumpleaños de Hoy
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">

          <div className="space-y-3">
            {birthdayStudents.map(student => (
              <div
                key={student.id}
                className="p-4 bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg border border-primary/20 text-center space-y-2"
              >
                <p className="text-lg font-semibold">
                  {student.first_name} {student.last_name}
                </p>
                {student.phone && (
                  <p className="text-sm text-muted-foreground">
                    {student.phone}
                  </p>
                )}
                {student.phone && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-1"
                    onClick={() => window.open(buildWhatsAppUrl(student), '_blank', 'noopener,noreferrer')}
                  >
                    <MessageCircle className="w-4 h-4 mr-2" /> Enviar mensaje
                  </Button>
                )}
              </div>
            ))}
          </div>

          <p className="text-center text-muted-foreground">
            ¡No te olvides de saludar!
          </p>
        </div>

        <DialogFooter className="flex justify-center sm:justify-center">
          <Button onClick={handleClose}>
            Entendido
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
