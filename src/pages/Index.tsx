import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Schedule, DAY_NAMES } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Instagram, Send, Loader2, Clock, Users, Sparkles, CheckCircle2, X } from 'lucide-react';

const WhatsAppIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
  </svg>
);


const enrollmentSchema = z.object({
  first_name: z.string().trim().min(1, 'El nombre es requerido').max(100),
  last_name: z.string().trim().min(1, 'El apellido es requerido').max(100),
  email: z.string().trim().max(255).optional().refine(val => !val || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val), 'Email inválido'),
  phone: z.string().trim().min(1, 'El teléfono es requerido').max(50),
  birthday: z.string().optional(),
  schedule_id: z.string().min(1, 'Selecciona un horario'),
  message: z.string().trim().max(500).optional(),
});

export default function Index() {
  const [schedules, setSchedules] = useState<(Schedule & { current_count: number })[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [selectedDay, setSelectedDay] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState(false);
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
      setLoading(true);
      const { data, error } = await supabase.rpc('get_public_schedule_availability');

      if (error) {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar los horarios disponibles.',
          variant: 'destructive',
        });
        setSchedules([]);
      } else if (data) {
        setSchedules(
          data.map((s) => ({
            id: s.id,
            day_of_week: s.day_of_week,
            start_time: s.start_time,
            end_time: s.end_time,
            max_capacity: s.max_capacity,
            created_at: s.created_at,
            current_count: Number(s.current_count),
          }))
        );
      }

      setLoading(false);
    };

    fetchSchedules();
  }, [toast]);

  // Auto-close success modal after 15 seconds
  useEffect(() => {
    if (showSuccessModal) {
      const timer = setTimeout(() => {
        setShowSuccessModal(false);
      }, 15000);
      return () => clearTimeout(timer);
    }
  }, [showSuccessModal]);

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

    const { data: rpcResult, error } = await supabase.rpc('submit_enrollment', {
      p_first_name: formData.first_name,
      p_last_name: formData.last_name,
      p_email: formData.email || null,
      p_phone: formData.phone,
      p_birthday: formData.birthday || null,
      p_schedule_id: formData.schedule_id,
      p_message: formData.message || null,
    });

    const result = rpcResult as { success: boolean; message: string } | null;

    if (error || !result?.success) {
      toast({
        title: 'Error',
        description: result?.message || 'No se pudo enviar la inscripción. Intenta de nuevo.',
        variant: 'destructive',
      });
    } else {
      // Show success modal instead of toast
      setShowSuccessModal(true);
      setSchedules(prev =>
        prev.map(s =>
          s.id === formData.schedule_id
            ? { ...s, current_count: s.current_count + 1 }
            : s
        )
      );
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
    const element = ref.current;
    if (!element) return;

    const targetPosition = element.getBoundingClientRect().top + window.scrollY;
    const startPosition = window.scrollY;
    const distance = targetPosition - startPosition;
    const duration = 1200;
    let startTime: number | null = null;

    const easeInOutCubic = (t: number) =>
      t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    const animation = (currentTime: number) => {
      if (!startTime) startTime = currentTime;
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);

      window.scrollTo(0, startPosition + distance * eased);

      if (progress < 1) {
        requestAnimationFrame(animation);
      }
    };

    requestAnimationFrame(animation);
  };

  const availableSchedules = schedules.filter(s => s.current_count < s.max_capacity);
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const availableDays = [...new Set(schedules.map(s => s.day_of_week))]
    .sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
  const schedulesForSelectedDay = selectedDay
    ? schedules.filter(s => s.day_of_week === selectedDay)
    : [];
const age = formData.birthday
  ? Math.floor(
      (new Date().getTime() - new Date(formData.birthday).getTime()) /
      (365.25 * 24 * 60 * 60 * 1000)
    )
  : null;

const validAge = age !== null && age >= 0 && age < 14;

useEffect(() => {
  if (!validAge) {
    setSelectedDay(null);
    setFormData(prev => ({ ...prev, schedule_id: "" }));
  }
}, [formData.birthday]);

  return (
    <div className="min-h-screen bg-[#EBEBEB] landing-page">
      {/* Hero Section - Living Clay Style */}
      <section className="min-h-screen relative flex flex-col items-center justify-start px-4 pt-8 pb-20 overflow-hidden">
        {/* Background abstract image */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: 'url(/hero-background.jpg)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.5,
          }}
        />
        {/* Fallback gradient if image doesn't load */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#d4c4b0]/20 via-transparent to-[#a08060]/10 pointer-events-none" />

        {/* Header with logo - more spacing */}
        <div className="w-full max-w-6xl mx-auto flex items-center justify-center mt-4 mb-20 relative z-10">
          {/* Logo - 50% smaller with more margin */}
          <img
            src="/logo.svg"
            alt="Silicer Logo"
            className="h-8 md:h-10"
          />
        </div>

        {/* Main content - Oval image with overlapping text */}
        <div className="relative flex flex-col items-center justify-center flex-1 w-full max-w-4xl mx-auto">
          {/* Oval image container */}
          <div className="relative">
            <img
              src="/hero-ceramica.jpg"
              alt="Cerámica artesanal"
              className="w-[320px] h-[420px] md:w-[400px] md:h-[520px] lg:w-[450px] lg:h-[580px] object-cover shadow-2xl"
              style={{
                borderRadius: '50%',
              }}
            />
          </div>

          {/* Title - separated from oval */}
          <h1
            className="mt-8 text-2xl md:text-3xl lg:text-4xl text-[#4a3f35] text-center tracking-[0.08em]"
          >
            Descubrí el arte de la cerámica
          </h1>

          {/* Subtitle - closer to title */}
          <p className="mt-3 text-lg md:text-xl text-[#4a3f35]/70 text-center max-w-xl leading-relaxed font-light">
            Un espacio para crear, aprender y conectar con tus manos
          </p>

          {/* CTA Buttons - closer to subtitle */}
          <div className="flex flex-col sm:flex-row gap-4 mt-6">
            <Button
              size="lg"
              className="bg-[#5C329E] hover:bg-[#4a2880] text-white px-10 py-6 text-base rounded-full tracking-wide"
              onClick={() => scrollToSection(formSectionRef)}
            >
              Preinscripción
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-[#5C329E]/30 text-[#5C329E] hover:bg-[#5C329E]/5 px-10 py-6 text-base rounded-full bg-transparent tracking-wide"
              onClick={() => scrollToSection(infoSectionRef)}
            >
              Conocer más
            </Button>
          </div>
        </div>

        {/* Scroll indicator - more space from buttons */}
        <div className="absolute bottom-4 left-0 right-0 flex justify-center">
          <div className="animate-bounce">
            <div className="w-5 h-8 border border-[#4a3f35]/30 rounded-full flex justify-center pt-1.5">
              <div className="w-0.5 h-1.5 bg-[#4a3f35]/40 rounded-full" />
            </div>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section ref={infoSectionRef} className="py-20 px-4 bg-white">
        <div className="container mx-auto max-w-4xl">
          {/* Main Info Card */}
          <Card className="border-none shadow-xl bg-[#faf9f7] mb-12">
            <CardContent className="p-8 md:p-12">
              <h2 className="text-3xl md:text-4xl font-serif text-[#4a3f35] text-center mb-8">
                ¡Sumate a nuestro taller este año!
              </h2>

              <div className="space-y-6 text-lg text-[#6b5c4c]">
                <p className="text-center">
                  En Silicer tenemos todo listo para que aprendas cerámica en serio.
                </p>

                <div className="flex items-start gap-4 p-4 bg-[#f5f1ec] rounded-lg">
                  <Sparkles className="w-6 h-6 text-[#4a3f35] shrink-0 mt-1" />
                  <div>
                    <strong className="text-[#4a3f35]">¿Qué vas a aprender?</strong>
                    <p>Técnicas de construcción y decoración en todos los estados (cuero, crudo, bizcocho y sobre esmalte).</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-[#f5f1ec] rounded-lg">
                  <span className="text-2xl shrink-0">🚀</span>
                  <div>
                    <strong className="text-[#4a3f35]">¿Límites?</strong>
                    <p>Ninguno. Hacé las piezas que quieras del tamaño que quieras (¡siempre que el horno nos dé espacio 😊!).</p>
                  </div>
                </div>

                <div className="flex items-start gap-4 p-4 bg-[#f5f1ec] rounded-lg">
                  <span className="text-2xl shrink-0">🧉</span>
                  <div>
                    <strong className="text-[#4a3f35]">El plus:</strong>
                    <p>No es solo cerámica, es comunidad. Vení a encontrarte, a compartir y a que tomemos juntos unos matecitos con peperina.</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Three Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="border-none shadow-lg bg-[#faf9f7] text-center">
              <CardContent className="p-6">
                <Clock className="w-10 h-10 text-[#4a3f35] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#4a3f35] mb-2">2 Horas</h3>
                <p className="text-[#6b5c4c]">
                  La cuota mensual contempla 1 clase por semana con duración de 2 horas cada una
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-[#faf9f7] text-center">
              <CardContent className="p-6">
                <Users className="w-10 h-10 text-[#4a3f35] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#4a3f35] mb-2">Cupos limitados</h3>
                <p className="text-[#6b5c4c]">
                  10 personas por turno, te recomendamos preinscribirte con antelación
                </p>
              </CardContent>
            </Card>

            <Card className="border-none shadow-lg bg-[#faf9f7] text-center">
              <CardContent className="p-6">
                <Sparkles className="w-10 h-10 text-[#4a3f35] mx-auto mb-4" />
                <h3 className="text-xl font-bold text-[#4a3f35] mb-2">Experiencia</h3>
                <p className="text-[#6b5c4c]">
                  No importa si no tenés experiencia, todos aprendemos juntos!
                </p>
              </CardContent>
            </Card>
          </div>

          {/* CTA Button */}
          <div className="text-center mt-12">
            <Button
              size="lg"
              className="bg-[#5C329E] hover:bg-[#4a2880] text-white px-10 py-6 text-lg rounded-full"
              onClick={() => scrollToSection(formSectionRef)}
            >
              Quiero preinscribirme
            </Button>
          </div>
        </div>
      </section>

      {/* Enrollment Form */}
      <section ref={formSectionRef} className="py-20 bg-[#EBEBEB]" id="inscripcion">
        <div className="container mx-auto px-4 max-w-xl">
          <Card className="shadow-xl border-none bg-white">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl text-[#4a3f35] font-serif">¡Preinscribite!</CardTitle>
              <CardDescription className="text-[#6b5c4c]">
                Completá el formulario y te contactaremos para confirmar tu lugar
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="first_name" className="text-[#4a3f35]">Nombre *</Label>
                    <Input
                      id="first_name"
                      value={formData.first_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, first_name: e.target.value }))}
                      className="border-[#d4c4b0] focus:border-[#4a3f35]"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="last_name" className="text-[#4a3f35]">Apellido *</Label>
                    <Input
                      id="last_name"
                      value={formData.last_name}
                      onChange={(e) => setFormData(prev => ({ ...prev, last_name: e.target.value }))}
                      className="border-[#d4c4b0] focus:border-[#4a3f35]"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-[#4a3f35]">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="border-[#d4c4b0] focus:border-[#4a3f35]"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="phone" className="text-[#4a3f35]">Teléfono *</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      className="border-[#d4c4b0] focus:border-[#4a3f35]"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="birthday" className="text-[#4a3f35]">Fecha de Nacimiento</Label>
                    <Input
                      id="birthday"
                      type="date"
                      value={formData.birthday}
                      onChange={(e) => setFormData(prev => ({ ...prev, birthday: e.target.value }))}
                      className="border-[#d4c4b0] focus:border-[#4a3f35] max-w-[200px]"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="day" className="text-[#4a3f35]">Día *</Label>
                    <Select
                      value={selectedDay}
                      onValueChange={(value) => {
                        setSelectedDay(value);
                        setFormData(prev => ({ ...prev, schedule_id: '' }));
                      }}
                    >
                      <SelectTrigger className="border-[#d4c4b0] focus:border-[#4a3f35]">
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
  <Label htmlFor="schedule" className="text-[#4a3f35]">Horario *</Label>
  <Select
    value={formData.schedule_id}
    onValueChange={(value) => setFormData(prev => ({ ...prev, schedule_id: value }))}
    disabled={!selectedDay  || loading || (!validAge && selectedDay === "saturday")}
  >
    <SelectTrigger className="border-[#d4c4b0] focus:border-[#4a3f35]">
      <SelectValue
        placeholder={!selectedDay ? 'Elegí un día' : 'Seleccionar horario'}
      />
    </SelectTrigger>
    <SelectContent>
      {schedulesForSelectedDay.map(schedule => (
        <SelectItem key={schedule.id} value={schedule.id} disabled={schedule.current_count >= schedule.max_capacity}>
          {schedule.start_time.slice(0, 5)} - {schedule.end_time.slice(0, 5)}
          <span className="text-muted-foreground ml-2">
           {schedule.current_count >= schedule.max_capacity ? 'Completo' : `${schedule.max_capacity - schedule.current_count} cupos`}
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
                  <Label htmlFor="message" className="text-[#4a3f35]">Mensaje (opcional)</Label>
                  <Textarea
                    id="message"
                    value={formData.message}
                    onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="¿Tenés alguna consulta o comentario?"
                    className="border-[#d4c4b0] focus:border-[#4a3f35]"
                    rows={3}
                  />
                </div>

                <Button
                  type="submit"
                  size="lg"
                  className="w-full bg-[#5C329E] hover:bg-[#4a2880] text-white rounded-full"
                  disabled={submitting || loading}
                >
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
      <footer className="bg-[#EBEBEB] py-12 border-t border-[#d4c4b0]/30">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl font-serif text-[#4a3f35] mb-4">¿Tenés dudas? ¡Contactanos!</h3>
          <div className="flex justify-center gap-4 flex-wrap">
            <Button
              variant="outline"
              size="lg"
              className="border-[#5C329E]/30 text-[#5C329E] hover:bg-[#5C329E]/5 bg-transparent rounded-full"
              asChild
            >
              <a
                href="https://wa.me/5493584010584?text=Hola!%20Quiero%20consultar%20por%20las%20clases%20de%20ceramica"
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon className="w-5 h-5 mr-2" /> WhatsApp
              </a>
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="border-[#5C329E]/30 text-[#5C329E] hover:bg-[#5C329E]/5 bg-transparent rounded-full"
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

      {/* Success Modal */}
      <Dialog open={showSuccessModal} onOpenChange={setShowSuccessModal}>
        <DialogContent className="sm:max-w-md landing-page">
          <button
            onClick={() => setShowSuccessModal(false)}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Cerrar</span>
          </button>
          <div className="flex flex-col items-center justify-center text-center py-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h2 className="text-2xl text-[#4a3f35] mb-3">
              ¡Preinscripción enviada!
            </h2>
            <p className="text-[#6b5c4c] leading-relaxed max-w-sm">
              La preinscripción no garantiza el cupo, nos pondremos en contacto pronto para confirmar tu lugar.
            </p>
            <Button
              onClick={() => setShowSuccessModal(false)}
              className="mt-6 bg-[#5C329E] hover:bg-[#4a2880] text-white rounded-full px-8"
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
