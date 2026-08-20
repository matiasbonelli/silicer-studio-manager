import { useState, useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { useGSAP } from '@gsap/react';
import '@/styles/landing.css';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother, useGSAP);
import { supabase } from '@/integrations/supabase/client';
import { Schedule, DAY_NAMES } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { z } from 'zod';
import { Send, Loader2, CheckCircle2, X } from 'lucide-react';
import { InstagramIcon } from '@/components/landing/icons';
import CustomCursor from '@/components/landing/CustomCursor';
import Noise from '@/components/landing/Noise';
import Header from '@/components/landing/Header';
import Hero from '@/components/landing/Hero';
import About from '@/components/landing/About';
import Learn from '@/components/landing/Learn';
import PracticalInfo from '@/components/landing/PracticalInfo';
import AnimatedContent from '@/components/landing/AnimatedContent';
import { landingContent } from '@/content/landing';

const fieldClass =
  'border-[var(--landing-border)] bg-[var(--landing-bg)] text-[var(--landing-ink)] placeholder:text-[var(--landing-muted)] focus-visible:ring-[var(--landing-primary)] focus-visible:border-[var(--landing-primary)] rounded-[var(--landing-radius-sm)]';
const fieldLabelClass = 'text-[var(--landing-ink)] font-[var(--landing-font-body)]';
const fields = landingContent.enrollment.form.fields;

const WHATSAPP_NUMBER = '5493585737156';
const WHATSAPP_PREFILLED_MESSAGE = 'Hola! Ya me preinscribí, ¿me pasarías más información?';

// El campo de fecha de nacimiento es un input de texto libre (dd/mm/aaaa) en
// vez de <input type="date"> — Safari/iOS renderiza el date picker nativo
// más ancho que su contenedor sin forma de acotarlo por CSS. Acá se convierte
// al formato ISO que espera la RPC de Supabase; si no matchea el patrón se
// omite en vez de romper el envío (el campo es opcional).
function birthdayToISO(value: string): string | undefined {
  const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  return `${year}-${month}-${day}`;
}

// Inserta las barras automáticamente a medida que se tipean los dígitos,
// para no forzarle el formato al usuario a mano.
function formatBirthdayInput(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);
  let result = day;
  if (month) result += `/${month}`;
  if (year) result += `/${year}`;
  return result;
}

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
  const [headerHeight, setHeaderHeight] = useState(0);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    email: '',
    phone: '',
    birthday: '',
    schedule_id: '',
    message: '',
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const { toast } = useToast();

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (formErrors[field]) {
      setFormErrors(prev => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  };

  const formSectionRef = useRef<HTMLElement>(null);
  const smootherRef = useRef<ScrollSmoother | null>(null);

  useEffect(() => {
    // Radix (Select, Dialog) bloquea el scroll del body al abrirse, lo que
    // hace desaparecer la scrollbar nativa y angosta/ensancha la página unos
    // px — visible como un salto de layout en toda la landing. Reservamos la
    // scrollbar siempre para que ese toggle no mueva nada.
    const html = document.documentElement;
    const prevOverflowY = html.style.overflowY;
    html.style.overflowY = 'scroll';
    return () => {
      html.style.overflowY = prevOverflowY;
    };
  }, []);

  useEffect(() => {
    // El rebote elástico de Safari/Chrome mobile al final del scroll deja
    // ver el fondo real de html/body — blanco por defecto, ya que el fondo
    // de la landing vive en .landing-page (un div hijo), no ahí. Lo pisamos
    // mientras la landing está montada para que el rebote muestre el mismo
    // crema en vez de una franja blanca.
    const { style: htmlStyle } = document.documentElement;
    const { style: bodyStyle } = document.body;
    const prevHtmlBg = htmlStyle.backgroundColor;
    const prevBodyBg = bodyStyle.backgroundColor;
    htmlStyle.backgroundColor = '#f4efe4';
    bodyStyle.backgroundColor = '#f4efe4';
    return () => {
      htmlStyle.backgroundColor = prevHtmlBg;
      bodyStyle.backgroundColor = prevBodyBg;
    };
  }, []);

  useEffect(() => {
    const smoother = ScrollSmoother.create({
      wrapper: '#smooth-wrapper',
      content: '#smooth-content',
      smooth: 1.2,
      effects: false,
    });
    smootherRef.current = smoother;

    // Los ScrollTrigger de las secciones hijas (Hero, About, Learn, etc.) se
    // crean en su propio useGSAP, que corre ANTES que este efecto del padre
    // — es decir, miden sus puntos de disparo contra el scroll nativo, sin
    // el smoother todavía activo. Sin este refresh quedan calculados con
    // coordenadas viejas y pueden dispararse antes de tiempo.
    ScrollTrigger.refresh();

    return () => {
      smoother.kill();
      smootherRef.current = null;
    };
  }, []);

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
      const fieldErrors = validation.error.flatten().fieldErrors;
      const errorMap: Record<string, string> = {};
      for (const [key, messages] of Object.entries(fieldErrors)) {
        if (messages && messages.length > 0) {
          errorMap[key] = messages[0];
        }
      }
      setFormErrors(errorMap);
      setSubmitting(false);
      return;
    }
    setFormErrors({});

    // Se abre en blanco en el mismo tick del submit (no después del await) porque
    // iOS Safari bloquea window.open si no ocurre sincrónicamente sobre el gesto del usuario.
    // Se completa con la URL de WhatsApp si el envío tiene éxito, o se cierra si falla.
    const whatsappWindow = window.open('', '_blank');

    const { data: rpcResult, error } = await supabase.rpc('submit_enrollment', {
      p_first_name: formData.first_name,
      p_last_name: formData.last_name,
      p_email: formData.email || undefined,
      p_phone: formData.phone,
      p_birthday: birthdayToISO(formData.birthday),
      p_schedule_id: formData.schedule_id,
      p_message: formData.message || undefined,
    });

    const result = rpcResult as { success: boolean; message: string } | null;

    if (error || !result?.success) {
      whatsappWindow?.close();
      toast({
        title: 'Error',
        description: result?.message || 'No se pudo enviar la inscripción. Intenta de nuevo.',
        variant: 'destructive',
      });
    } else {
      const whatsappUrl = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(WHATSAPP_PREFILLED_MESSAGE)}`;
      if (whatsappWindow) {
        whatsappWindow.location.href = whatsappUrl;
      } else {
        window.open(whatsappUrl, '_blank');
      }

      // Show success modal instead of toast
      setFormErrors({});
      setShowSuccessModal(true);
      setSchedules(prev =>
        prev.map(s =>
          s.id === formData.schedule_id
            ? { ...s, current_count: s.current_count + 1 }
            : s
        )
      );
      setFormErrors({});
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

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Con ScrollSmoother activo hay que pedirle a él que scrollee (maneja el
    // scroll real internamente); si todavía no se creó, caemos al scrollTo
    // nativo para no perder el click.
    if (smootherRef.current) {
      smootherRef.current.scrollTo(element, !prefersReducedMotion, 'top top');
      return;
    }

    element.scrollIntoView({ behavior: prefersReducedMotion ? 'auto' : 'smooth', block: 'start' });
  };

  const availableSchedules = schedules.filter(s => s.current_count < s.max_capacity);
  const dayOrder = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  const availableDays = [...new Set(schedules.map(s => s.day_of_week))]
    .sort((a, b) => dayOrder.indexOf(a) - dayOrder.indexOf(b));
  const schedulesForSelectedDay = selectedDay
    ? schedules.filter(s => s.day_of_week === selectedDay)
    : [];

  return (
    <div className="landing-page">
      <CustomCursor />
      <Noise patternAlpha={10} />
      <Header onCtaClick={() => scrollToSection(formSectionRef)} onHeightChange={setHeaderHeight} />
      <div id="smooth-wrapper">
        <div id="smooth-content">
      <div aria-hidden="true" style={{ height: headerHeight, backgroundColor: 'var(--landing-bg)' }} />
      <Hero onCtaClick={() => scrollToSection(formSectionRef)} />
      <About />
      <Learn />
      <PracticalInfo />

      {/* Preinscripción — formulario sobre imagen con textura propia,
          contenedor de bordes redondeados (referencia unikorns) */}
      <section
        ref={formSectionRef}
        id="inscripcion"
        style={{
          position: 'relative',
          paddingBlock: 'var(--landing-space-7)',
          backgroundImage: 'url(/hero-background.jpg)',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        <div className="landing-container" style={{ display: 'flex', justifyContent: 'center' }}>
          <AnimatedContent
            style={{
              width: '100%',
              maxWidth: 620,
              backgroundColor: 'var(--landing-surface)',
              borderRadius: 'var(--landing-radius-form)',
              padding: 'var(--landing-space-5) var(--landing-space-4)',
              boxShadow: '0 40px 90px -35px rgba(20, 14, 30, 0.55)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 'var(--landing-space-4)' }}>
              <h2
                style={{
                  fontFamily: 'var(--landing-font-display)',
                  fontWeight: 400,
                  fontSize: 'var(--landing-text-h2)',
                  color: 'var(--landing-ink)',
                  margin: '0 0 0.5rem',
                }}
              >
                {landingContent.enrollment.title}
              </h2>
              <p
                style={{
                  fontFamily: 'var(--landing-font-body)',
                  fontWeight: 300,
                  fontSize: 'var(--landing-text-body)',
                  color: 'var(--landing-muted)',
                  margin: 0,
                }}
              >
                {landingContent.enrollment.subtitle}
              </p>
            </div>

            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="first_name" className={fieldLabelClass}>{fields.firstName.label} *</Label>
                  <Input
                    id="first_name"
                    placeholder={fields.firstName.placeholder}
                    value={formData.first_name}
                    onChange={(e) => updateField('first_name', e.target.value)}
                    className={fieldClass}
                  />
                  {formErrors.first_name && (
                    <p className="text-sm text-destructive mt-1">{formErrors.first_name}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name" className={fieldLabelClass}>{fields.lastName.label} *</Label>
                  <Input
                    id="last_name"
                    placeholder={fields.lastName.placeholder}
                    value={formData.last_name}
                    onChange={(e) => updateField('last_name', e.target.value)}
                    className={fieldClass}
                  />
                  {formErrors.last_name && (
                    <p className="text-sm text-destructive mt-1">{formErrors.last_name}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="email" className={fieldLabelClass}>{fields.email.label}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={fields.email.placeholder}
                  value={formData.email}
                  onChange={(e) => updateField('email', e.target.value)}
                  className={fieldClass}
                />
                {formErrors.email && (
                  <p className="text-sm text-destructive mt-1">{formErrors.email}</p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2 min-w-0">
                  <Label htmlFor="phone" className={fieldLabelClass}>{fields.phone.label} *</Label>
                  <Input
                    id="phone"
                    type="tel"
                    placeholder={fields.phone.placeholder}
                    value={formData.phone}
                    onChange={(e) => updateField('phone', e.target.value)}
                    className={fieldClass}
                  />
                  {formErrors.phone && (
                    <p className="text-sm text-destructive mt-1">{formErrors.phone}</p>
                  )}
                </div>
                <div className="space-y-2 min-w-0">
                  <Label htmlFor="birthday" className={fieldLabelClass}>{fields.birthday.label}</Label>
                  <Input
                    id="birthday"
                    type="text"
                    placeholder="dd/mm/aaaa"
                    maxLength={10}
                    value={formData.birthday}
                    onChange={(e) => updateField('birthday', formatBirthdayInput(e.target.value))}
                    className={`${fieldClass} sm:max-w-[200px]`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="day" className={fieldLabelClass}>{fields.day.label} *</Label>
                  <Select
                    value={selectedDay}
                    onValueChange={(value) => {
                      setSelectedDay(value);
                      updateField('schedule_id', '');
                    }}
                  >
                    <SelectTrigger className={fieldClass}>
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
                  <Label htmlFor="schedule" className={fieldLabelClass}>{fields.schedule.label} *</Label>
                  <Select
                    value={formData.schedule_id}
                    onValueChange={(value) => updateField('schedule_id', value)}
                    disabled={!selectedDay || loading}
                  >
                    <SelectTrigger className={fieldClass}>
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
                  {formErrors.schedule_id && (
                    <p className="text-sm text-destructive mt-1">{formErrors.schedule_id}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="message" className={fieldLabelClass}>{fields.message.label}</Label>
                <Textarea
                  id="message"
                  placeholder={fields.message.placeholder}
                  value={formData.message}
                  onChange={(e) => updateField('message', e.target.value)}
                  className={fieldClass}
                  rows={3}
                />
                {formErrors.message && (
                  <p className="text-sm text-destructive mt-1">{formErrors.message}</p>
                )}
              </div>

              <button
                type="submit"
                disabled={submitting || loading}
                className="landing-form-submit"
                style={{
                  width: '100%',
                  fontFamily: 'var(--landing-font-body)',
                  fontWeight: 700,
                  fontSize: 'var(--landing-text-body)',
                  color: 'var(--landing-primary-foreground)',
                  backgroundColor: 'var(--landing-primary)',
                  border: 'none',
                  borderRadius: 'var(--landing-radius-md)',
                  padding: '0.9rem',
                  cursor: submitting || loading ? 'not-allowed' : 'pointer',
                  opacity: submitting || loading ? 0.7 : 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.5rem',
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> {landingContent.enrollment.form.submittingLabel}
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> {landingContent.enrollment.form.submitLabel}
                  </>
                )}
              </button>
            </form>
          </AnimatedContent>
        </div>

        <style>{`
          .landing-form-submit {
            transition: background-color 0.3s ease;
          }
          .landing-form-submit:not(:disabled):hover {
            background-color: var(--landing-secondary) !important;
          }
        `}</style>
      </section>

      {/* Footer — cierre-statement protagonista + contacto directo */}
      <footer style={{ backgroundColor: 'var(--landing-bg-alt)', paddingBlock: 'var(--landing-space-7)' }}>
        <div className="landing-container" style={{ textAlign: 'center' }}>
          <AnimatedContent as="p" style={{
              fontFamily: 'var(--landing-font-display)',
              fontWeight: 400,
              fontSize: 'var(--landing-text-h2)',
              lineHeight: 'var(--landing-leading-heading)',
              color: 'var(--landing-ink)',
              maxWidth: '24ch',
              marginInline: 'auto',
              marginBlock: '0 var(--landing-space-5)',
            }}
          >
            {landingContent.footer.closingStatement}
          </AnimatedContent>

          <AnimatedContent
            delay={150}
            style={{ display: 'flex', justifyContent: 'center', gap: 'var(--landing-space-2)', flexWrap: 'wrap' }}
          >
            <a
              href="https://wa.me/5493585737156?text=Hola!%20Quiero%20consultar%20por%20las%20clases%20de%20ceramica"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-footer-link"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontFamily: 'var(--landing-font-body)',
                fontWeight: 700,
                fontSize: 'var(--landing-text-body)',
                color: 'var(--landing-primary)',
                border: '1px solid var(--landing-primary)',
                borderRadius: 'var(--landing-radius-md)',
                padding: '0.7rem 1.4rem',
                textDecoration: 'none',
              }}
            >
              <WhatsAppIcon className="w-5 h-5" /> {landingContent.footer.contact.whatsappLabel}
            </a>
            <a
              href="https://www.instagram.com/silicerespacio/"
              target="_blank"
              rel="noopener noreferrer"
              className="landing-footer-link"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                fontFamily: 'var(--landing-font-body)',
                fontWeight: 700,
                fontSize: 'var(--landing-text-body)',
                color: 'var(--landing-primary)',
                border: '1px solid var(--landing-primary)',
                borderRadius: 'var(--landing-radius-md)',
                padding: '0.7rem 1.4rem',
                textDecoration: 'none',
              }}
            >
              <InstagramIcon className="w-5 h-5" /> {landingContent.footer.contact.instagramLabel}
            </a>
          </AnimatedContent>

          <p
            style={{
              fontFamily: 'var(--landing-font-body)',
              fontWeight: 300,
              fontSize: 'var(--landing-text-small)',
              color: 'var(--landing-muted)',
              marginTop: 'var(--landing-space-5)',
            }}
          >
            {landingContent.footer.copyright}
          </p>

          <style>{`
            .landing-footer-link:hover {
              background-color: color-mix(in srgb, var(--landing-primary) 8%, transparent);
            }
          `}</style>
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
            <h2 className="text-2xl text-[var(--landing-ink)] mb-3">
              ¡Listo! Te llevamos a WhatsApp
            </h2>
            <p className="text-[var(--landing-muted)] leading-relaxed max-w-sm">
              Agilizá tu preinscripción enviando el mensaje que te dejamos precargado en WhatsApp.
            </p>
            <Button
              onClick={() => setShowSuccessModal(false)}
              className="mt-6 bg-[var(--landing-primary)] hover:bg-[var(--landing-primary-hover)] text-[var(--landing-primary-foreground)] rounded-[var(--landing-radius-md)] px-8"
            >
              Entendido
            </Button>
          </div>
        </DialogContent>
      </Dialog>
        </div>
      </div>
    </div>
  );
}
