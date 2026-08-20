/**
 * Contenido único de la landing de Silicer. Toda la copy vive acá — ningún
 * componente de sección hardcodea texto. Fuente: docs/03-SECCIONES-SILICER.md
 * (decisiones ya cerradas con el usuario). Los campos marcados `pendingAsset`
 * señalan bloques que esperan fotos reales — no se rellenan con stock.
 */

export const landingContent = {
  header: {
    logoAlt: 'Silicer',
    ctaLabel: 'Preinscribirme',
  },

  hero: {
    eyebrow: 'Taller de cerámica en Río Cuarto',
    title: 'Descubrí el arte de la cerámica',
    subtitle: 'Un espacio para crear, aprender y conectar con tus manos.',
    ctaLabel: 'Preinscribirme',
    image: {
      src: '/hero-ceramica.jpg',
      alt: 'Manos pintando una pieza de cerámica en el taller de Silicer',
    },
  },

  about: {
    eyebrow: 'Sobre el taller',
    title: 'No es solo cerámica, es comunidad',
    paragraphs: [
      'Silicer es un taller de cerámica presencial en Río Cuarto, pensado como un lugar con vida propia: manos en la arcilla, grupo, mate de por medio.',
      'Aprendemos muchísimas técnicas, pero lo que sostiene el taller clase a clase es el grupo que se arma alrededor de la mesa.',
    ],
    image: {
      src: '/about-taller.jpg',
      alt: 'Alumnas trabajando la cerámica en el taller de Silicer',
      pendingAsset: false,
    },
  },

  learn: {
    eyebrow: 'Qué vas a aprender',
    title: 'Técnicas reales, a tu ritmo',
    cards: [
      {
        icon: 'hands',
        title: 'Técnicas en todos los estados',
        description: 'Trabajás la arcilla cruda, en cuero y bizcochada, aprendés el proceso completo, no solo una etapa.',
      },
      {
        icon: 'spiral',
        title: 'Sin límites de pieza',
        description: 'Hacés las piezas que quieras, ¡siempre que el horno nos dé espacio!',
      },
      {
        icon: 'mate',
        title: 'Grupo y comunidad',
        description: 'Se aprende en grupo, con mate de por medio, esa es la impronta del taller.',
      },
    ],
  },

  students: {
    eyebrow: 'Presencia de alumnos',
    title: 'Gente real, aprendiendo acá',
    subtitle: 'Alumnas del taller en clase y piezas que hicieron con sus manos.',
    items: [] as { src: string; alt: string; caption?: string }[],
    pendingAsset: true,
    minItemsReserved: 6,
  },

  practicalInfo: {
    eyebrow: 'Info práctica',
    title: 'Lo que necesitás saber',
    cards: [
      {
        icon: 'clock',
        label: '',
        value: 'Turnos de 2 horas de duración',
      },
      {
        icon: 'users',
        label: '',
        value: 'Cupos limitados',
      },
      {
        icon: 'sparkles',
        label: '',
        value: 'No hace falta experiencia previa',
      },
    ],
    schedule: {
      label: 'Días disponibles',
      value: 'Lunes a viernes, sábados (solo niños)',
    },
    location: {
      label: 'Ubicación',
      address: 'Amadeo Mozart 169, Río Cuarto, Córdoba',
    },
  },

  enrollment: {
    eyebrow: 'Preinscripción',
    title: 'Reservá tu lugar',
    subtitle: 'Completá el formulario para preinscribirte.',
    backgroundImage: {
      src: '/hero-background.jpg',
      alt: '',
    },
    form: {
      fields: {
        firstName: { label: 'Nombre', placeholder: 'Tu nombre' },
        lastName: { label: 'Apellido', placeholder: 'Tu apellido' },
        email: { label: 'Email', placeholder: 'tu@email.com' },
        phone: { label: 'Teléfono', placeholder: 'Tu teléfono' },
        birthday: { label: 'Fecha de nacimiento' },
        day: { label: 'Día preferido' },
        schedule: { label: 'Horario' },
        message: { label: 'Mensaje (opcional)', placeholder: '¿Algo que quieras contarnos?' },
      },
      submitLabel: 'Quiero preinscribirme',
      submittingLabel: 'Enviando…',
    },
  },

  footer: {
    closingStatement: 'La cerámica se aprende con las manos. Empezá cuando quieras.',
    contact: {
      whatsappLabel: 'Escribinos por WhatsApp',
      instagramLabel: 'Seguinos en Instagram',
    },
    location: {
      label: 'Ubicación',
      address: 'Amadeo Mozart 169, Río Cuarto, Córdoba',
    },
    copyright: 'Todos los derechos reservados a Silicer © 2026.',
  },
} as const;

export type LandingContent = typeof landingContent;
