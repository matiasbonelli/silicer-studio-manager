import { useState, useEffect, useRef } from 'react';
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
import { MessageCircle, Instagram, Send, Loader2, Clock, Users, Sparkles, Settings } from 'lucide-react';

const enrollmentSchema = z.object({
  first_name: z.string().trim().min(1, 'El nombre es requerido').max(100),
  last_name: z.string().trim().min(1, 'El apellido es requerido').max(100),
  email: z.string().trim().email('Email inválido').max(255),
  phone: z.string().trim().max(50).optional(),
  birthday: z.string().optional(),
  schedule_id: z.string().min(1, 'Selecciona un horario'),
  message: z.string().trim().max(500).optional(),
});

export default function Index() {
  const [schedules, setSchedules] = useState<(Schedule & { current_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDay, setSelectedDay] = useState('');
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birthday: '',
    schedule_id: '',
    message: '',
  });
  const { toast } = useToast();

  const infoSectionRef = useRef<HTMLElement>(null);
  const formSectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const fetchSchedules = async () => {
      const { data: schedulesData } = await supabase
        .from('schedules')
        .select('*')
        .order('day_of_week')
        .order('start_time');

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
      birthday: formData.birthday || null,
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
        title: '¡Preinscripción enviada!',
        description: 'Nos pondremos en contacto pronto.',
      });
      setSelectedDay('');
      setFormData({
        first_name: '',
        last_name: '',
        email: '',
        phone: '',
        birthday: '',
        schedule_id: '',
        message: '',
      });
    }

    setSubmitting(false);
  };

  const scrollToSection = (ref: React.RefObject<HTMLElement>) => {
    ref.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const availableSchedules = schedules.filter(s => s.current_count < s.max_capacity);
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];
  const availableDays = [...new Set(availableSchedules.map(s => s.day_of_week))]
    .sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
  const schedulesForSelectedDay = selectedDay
    ? availableSchedules.filter(s => s.day_of_week === selectedDay)
    : [];

  return (
    <div className="min-h-screen">
      {/* Admin Link */}
      <Link
        to="/auth"
        className="fixed top-4 right-4 z-50 p-2 text-[#d4b89c]/50 hover:text-[#d4b89c] transition-colors"
        title="Acceso Administrador"
      >
        <Settings className="w-5 h-5" />
      </Link>

      {/* Hero Section - Dark Background */}
      <section className="min-h-screen flex flex-col items-center justify-center px-4 bg-gradient-to-b from-[#1a1512] via-[#2a2118] to-[#1a1512] relative overflow-hidden">
        {/* Decorative gradient overlay */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(139,90,43,0.15)_0%,_transparent_50%)]" />

        {/* Logo placeholder - replace with SVG when provided */}
        <div className="mb-8 relative z-10">
          {/* Placeholder for logo - will be replaced with actual SVG */}
          <div className="w-24 h-24 rounded-full bg-[#d4b89c]/10 flex items-center justify-center">
            <span className="text-4xl font-serif text-[#d4b89c]">S</span>
          </div>
        </div>

        {/* Title */}
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif text-[#f5ebe0] text-center mb-6 relative z-10 tracking-wide">
          Descubrí el arte de la cerámica
        </h1>

        {/* Subtitle */}
        <p className="text-lg md:text-xl text-[#a89888] text-center max-w-2xl mb-12 relative z-10 leading-relaxed">
          Un espacio para crear, aprender, conectar con tus manos y pasar un momento super lindo.
          Clases grupales en un ambiente cálido y creativo.
        </p>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 relative z-10">
          <Button
            size="lg"
            className="bg-[#c4956a] hover:bg-[#b38559] text-white px-8 py-6 text-lg rounded-full"
            onClick={() => scrollToSection(formSectionRef)}
          >
            Inscribirme
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-[#6b5c4c] text-[#d4b89c] hover:bg-[#6b5c4c]/20 px-8 py-6 text-lg rounded-full bg-transparent"
            onClick={() => scrollToSection(infoSectionRef)}
          >
            Conocer más
          </Button>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
          <div className="w-6 h-10 border-2 border-[#6b5c4c] rounded-full flex justify-center pt-2">
            <div className="w-1 h-2 bg-[#6b5c4c] rounded-full" />
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section ref={infoSectionRef} className="py-20 px-4 bg-[#f8f5f1]">
        <div className="container mx-auto max-w-4xl">
          {/* Main Info Card */}
          <Card className="border-none shadow-xl bg-white mb-12">
            <CardContent className="p-8 md:p-12">
              <h2 className="text-3xl md:text-4xl font-serif text-primary text-center mb-8">
                ¡Sumate a nuestro taller este año!
              </h2>

              <div className="space-y-6 text-lg text-muted-foreground">
                <p className="text-center">
                  En Silicer tenemos todo listo para que aprendas cerámica en serio.
                </p>

                <div className="flex items-start gap-4 p-4 bg-accent/50 rounded-lg">
                  <Sparkles className="w-6 h-6 text-primary shrink-0 mt-1" />
                  <div>
                    <strong className="text-foreground">¿Qué vas a aprender?</strong>
                    <p>Técnicas de construcción y decoración en todos los estados (cuero, crudo, bizcocho y sobre esmalte).</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-accent/50 rounded-lg">
                  <span className="text-2xl shrink-0">🚀</span>
                  <div>
                    <strong className="text-foreground">¿Límites?</strong>
                    <p>Ninguno. Hacé las piezas que quieras del tamaño que quieras (¡siempre que el horno nos dé espacio :) !).</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-accent/50 rounded-lg">
                  <span className="text-2xl shrink-0">🧉</span>
                  <div>
                    <strong className="text-foreground">El plus:</strong>
                    <p>No es solo cerámica, es comunidad. Vení a encontrarte, a compartir y a tomarte unos mates con peperina con nosotros.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Three Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-lg bg-white text-center">
              <CardContent className="p-6">
                <Clock className="w-10 h-10 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-2">2 Horas</h3>
                <p className="text-muted-foreground">
                  Cada turno son de 2 horas, 1 vez por semana
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-white text-center">
              <CardContent className="p-6">
                <Users className="w-10 h-10 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-2">Cupos limitados</h3>
                <p className="text-muted-foreground">
                  10 personas por turno, te recomendamos preinscribirte con antelación
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-white text-center">
              <CardContent className="p-6">
                <Sparkles className="w-10 h-10 text-primary mx-auto mb-4" />
                <h3 className="text-xl font-bold text-foreground mb-2">Experiencia</h3>
                <p className="text-muted-foreground">
                  No importa si no tenés experiencia, todos aprendemos juntos!
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CTA Button */}
          <div className="text-center mt-12">
            <Button
              size="lg"
              className="bg-primary hover:bg-primary/90 px-10 py-6 text-lg rounded-full"
              onClick={() => scrollToSection(formSectionRef)}
            >
              Quiero inscribirme
            </Button>
          </div>
        </div>
      </section>

      {/* Enrollment Form */}
      <section ref={formSectionRef} className="py-20 bg-background" id="inscripcion">
        <div className="container mx-auto px-4 max-w-xl">
          <Card className="shadow-xl border-2">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-primary">¡Preinscribite!</CardTitle>
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

                <div className="grid grid-cols-2 gap-3">
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
                    <Label htmlFor="birthday">Fecha de Nacimiento</Label>
                    <Input
                      id="birthday"
                      type="date"
                      value={formData.birthday}
                      onChange={(e) => setFormData(prev => ({ ...prev, birthday: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="day">Día *</Label>
                    <Select
                      value={selectedDay}
                      onValueChange={(value) => {
                        setSelectedDay(value);
                        setFormData(prev => ({ ...prev, schedule_id: '' }));
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={loading ? 'Cargando...' : 'Seleccionar día'} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableDays.map(day => (
                          <SelectItem key={day} value={day}>
                            {DAY_NAMES[day]}
                          </SelectItem>
                        ))}
                        {availableDays.length === 0 && !loading && (
                          <SelectItem value="none" disabled>
                            No hay días disponibles
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="schedule">Horario *</Label>
                    <Select
                      value={formData.schedule_id}
                      onValueChange={(value) => setFormData(prev => ({ ...prev, schedule_id: value }))}
                      disabled={!selectedDay}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={!selectedDay ? 'Elegí un día' : 'Seleccionar horario'} />
                      </SelectTrigger>
                      <SelectContent>
                        {schedulesForSelectedDay.map(schedule => (
                          <SelectItem key={schedule.id} value={schedule.id}>
                            {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
                            <span className="text-muted-foreground ml-2">
                              ({schedule.max_capacity - schedule.current_count} cupos)
                            </span>
                          </SelectItem>
                        ))}
                        {schedulesForSelectedDay.length === 0 && selectedDay && (
                          <SelectItem value="none" disabled>
                            No hay horarios disponibles
                          </SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
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
                      <Send className="w-4 h-4 mr-2" /> Enviar preinscripción
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
        </div>
      </footer>
    </div>
  );
}
