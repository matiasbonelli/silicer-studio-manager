import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Schedule, DAY_NAMES } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { MessageCircle, Instagram, Send, Loader2, Users, Palette, Heart, Sparkles } from 'lucide-react';

const enrollmentSchema = z.object({
  first_name: z.string().trim().min(1, 'El nombre es requerido').max(100),
  last_name: z.string().trim().min(1, 'El apellido es requerido').max(100),
  email: z.string().trim().email('Email inválido').max(255),
  phone: z.string().trim().max(50).optional(),
  schedule_id: z.string().min(1, 'Selecciona un horario'),
  message: z.string().trim().max(500).optional(),
});

export default function Index() {
  const [schedules, setSchedules] = useState<(Schedule & { current_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    schedule_id: '',
    message: '',
  });
  const { toast } = useToast();

  useEffect(() => {
    const fetchSchedules = async () => {
      // Get schedules
      const { data: schedulesData } = await supabase
        .from('schedules')
        .select('*')
        .order('day_of_week')
        .order('start_time');

      // Get student counts per schedule
      const { data: studentsData } = await supabase
        .from('students')
        .select('schedule_id');

      if (schedulesData) {
        const counts = (studentsData || []).reduce((acc, s) => {
          if (s.schedule_id) {
            acc[s.schedule_id] = (acc[s.schedule_id] || 0) + 1;
          }
          return acc;
        }, {} as Record<string, number>);

        setSchedules(
          (schedulesData as Schedule[]).map(s => ({
            ...s,
            current_count: counts[s.id] || 0,
          }))
        );
      }

      setLoading(false);
    };

    fetchSchedules();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const validation = enrollmentSchema.safeParse(formData);
    if (!validation.success) {
      toast({
        title: 'Error de validación',
        description: validation.error.errors[0].message,
        variant: 'destructive',
      });
      setSubmitting(false);
      return;
    }

    // Check availability
    const selectedSchedule = schedules.find(s => s.id === formData.schedule_id);
    if (selectedSchedule && selectedSchedule.current_count >= selectedSchedule.max_capacity) {
      toast({
        title: 'Horario sin cupos',
        description: 'Este horario ya no tiene lugares disponibles',
        variant: 'destructive',
      });
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.from('enrollments').insert({
      first_name: formData.first_name.trim(),
      last_name: formData.last_name.trim(),
      email: formData.email.trim(),
      phone: formData.phone?.trim() || null,
      schedule_id: formData.schedule_id,
      message: formData.message?.trim() || null,
    });

    if (error) {
      toast({
        title: 'Error',
        description: 'No se pudo enviar la inscripción. Intenta de nuevo.',
        variant: 'destructive',
      });
    } else {
      toast({
        title: '¡Inscripción enviada!',
        description: 'Nos pondremos en contacto pronto.',
      });
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        schedule_id: '',
        message: '',
      });
    }

    setSubmitting(false);
  };

  const availableSchedules = schedules.filter(s => s.current_count < s.max_capacity);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-card shadow-sm py-4">
        <div className="container mx-auto px-4 flex justify-center">
          <div className="text-center">
            <h1 className="text-4xl font-bold text-primary tracking-tight">Silicer</h1>
            <p className="text-muted-foreground text-sm">Taller de Cerámica</p>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 md:py-24 bg-gradient-to-b from-accent to-background">
        <div className="container mx-auto px-4 text-center">
          <Sparkles className="w-12 h-12 mx-auto mb-6 text-primary" />
          <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Descubrí el arte de la cerámica
          </h2>
          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Un espacio para crear, aprender y conectar con tus manos. 
            Clases grupales en un ambiente cálido y creativo.
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Users className="w-5 h-5 text-primary" />
              <span>Grupos reducidos</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Palette className="w-5 h-5 text-primary" />
              <span>Materiales incluidos</span>
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Heart className="w-5 h-5 text-primary" />
              <span>Todos los niveles</span>
            </div>
          </div>
        </div>
      </section>

      {/* Enrollment Form */}
      <section className="py-16 bg-background" id="inscripcion">
        <div className="container mx-auto px-4 max-w-xl">
          <Card className="shadow-xl border-2">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-primary">¡Inscribite!</CardTitle>
              <CardDescription>
                Completá el formulario y te contactaremos para confirmar tu lugar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="first_name">Nombre *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name">Apellido *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="schedule">Horario Preferido *</Label>
                  <Select
                    value={formData.schedule_id}
                    onValueChange={(value) => setFormData(prev => ({ ...prev, schedule_id: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={loading ? 'Cargando...' : 'Seleccionar horario'} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableSchedules.map(schedule => (
                        <SelectItem key={schedule.id} value={schedule.id}>
                          {DAY_NAMES[schedule.day_of_week]} {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                          <span className="text-muted-foreground ml-2">
                            ({schedule.max_capacity - schedule.current_count} cupos)
                          </span>
                        </SelectItem>
                      ))}
                      {availableSchedules.length === 0 && !loading && (
                        <SelectItem value="none" disabled>
                          No hay horarios disponibles
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="message">Mensaje (opcional)</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="¿Tenés alguna consulta o comentario?"
                    rows={3}
                  />
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={submitting || loading}>
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Enviando...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" /> Enviar Inscripción
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-primary text-primary-foreground py-12">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold mb-4">¿Tenés dudas? ¡Contactanos!</h3>
          <div className="flex justify-center gap-4 flex-wrap">
            <Button
              variant="secondary"
              size="lg"
              asChild
            >
              <a
                href="https://wa.me/5493584010584?text=Hola!%20Quiero%20consultar%20por%20las%20clases%20de%20ceramica"
                target="_blank"
                rel="noopener noreferrer"
              >
                <MessageCircle className="w-5 h-5 mr-2" /> WhatsApp
              </a>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              asChild
            >
              <a
                href="https://www.instagram.com/silicerespacio/"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Instagram className="w-5 h-5 mr-2" /> Instagram
              </a>
            </Button>
          </div>
          <div className="mt-8 pt-8 border-t border-primary-foreground/20">
            <Link to="/auth" className="text-sm opacity-70 hover:opacity-100 transition-opacity">
              Acceso Administrador
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
