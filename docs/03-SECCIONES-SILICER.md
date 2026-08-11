# 03 · Secciones — Landing Silicer (taller de cerámica)

> Partimos del sitio actual (silicer.com.ar) como base de contenido, pero lo reestructuramos: sumamos lo
> que falta (presencia de alumnos, contexto institucional, ubicación) y sacamos lo que choca con el brief
> (emojis, logo en texto). Los bloques marcados **[pendiente asset]** están definidos en contenido pero
> esperan las fotos/isotipo que vas a sumar después.

---

## Decisiones ya tomadas
- **Público:** mujeres mayores de 24 años. No se menciona la modalidad de sábados para niños en esta
  landing — si en algún momento se necesita, va en otro canal, no acá.
- **Precio:** no se muestra. El monto varía y se resuelve por contacto directo una vez que la persona se
  preinscribe.
- **Galería/fotos de alumnos:** la sección queda definida en estructura y copy, a la espera de las fotos
  reales que vas a aportar. No se usa stock como relleno mientras tanto — mejor mostrar menos que mostrar
  algo genérico.

---

## 0. Header
- **Logo:** isotipo de marca de Silicer **[pendiente asset]**, fijo/sticky arriba.
- Sin menú de navegación cargado de ítems — es landing de una sola acción. Como mucho, un ancla directa al
  formulario ("Preinscribirme") siempre visible, discreta, no un botonazo.

## 1. Hero
- **Qué mantener del sitio actual:** la estructura de titular + bajada + foto real de manos trabajando la
  cerámica. Esa foto ya transmite oficio, es del estilo que pide el brief.
- **Qué cambiar:** el titular como pieza gráfica más protagonista (referencia vandslab/Unique Clay), no
  solo texto chico arriba de una foto ovalada. Menos "plantilla", más impacto tipográfico.
- **Copy base (ajustar tono):** algo en la línea de "Descubrí el arte de la cerámica" / "Un espacio para
  crear, aprender y conectar con tus manos" — mantiene la esencia, se puede pulir en la etapa de copy.
- **CTA único primario:** "Preinscribirme" (sacamos el CTA secundario "Conocer más" — todo el sitio empuja
  a la misma acción, no hace falta un botón que compita).

## 2. Sobre el taller (nuevo — hoy no existe)
Bloque institucional que hoy falta por completo. Formato tipo referencia soil-net (texto + imagen), con
cadencia de texto alternando izquierda/derecha si el contenido se extiende (referencia monolith studio).
- Qué es Silicer, desde cuándo existe, quién enseña.
- Por qué existe (la idea de "no es solo cerámica, es comunidad" del sitio actual es un buen punto de
  partida — se puede desarrollar acá en vez de dejarlo como una tarjeta suelta).
- Foto del espacio o de la persona a cargo. **[pendiente asset]**

## 3. Qué vas a aprender
- **Qué mantener:** el contenido de las 3 tarjetas actuales (técnicas en todos los estados, sin límites de
  pieza salvo el horno, la impronta de comunidad/mate).
- **Qué cambiar:** sacar los emojis (🚀🧉✨) y reemplazarlos por **iconos SVG propios**, en línea con el
  resto de la identidad — nada de íconos de sistema por defecto.
- Mantener el tono cálido de esas frases ("¡siempre que el horno nos dé espacio!"), es justo el aire de
  espontaneidad que pide el brief; solo se pule el copy, no el espíritu.

## 4. Presencia de alumnos (nuevo — el punto más importante que falta)
Esta es la sección que hoy no existe y que el brief pide como algo central: dejar en claro que es un taller
con mucha vida y gente participando, no un curso vacío.
- **Formato:** recuadros foto + texto breve (referencia mosaicist / Unique Clay) — fotos reales de alumnos
  en clase y piezas terminadas, con alguna línea corta al pie de cada una (qué se hizo, qué técnica).
- **[pendiente asset]** — la estructura queda lista (grilla de recuadros), se completa cuando tengas el
  material fotográfico.
- Si en algún momento hay Instagram con contenido del taller, se puede evaluar sumar contenido desde ahí
  en vez de fotos estáticas — pero **no es algo automático ni gratis por defecto**. En 2026 Meta cerró la
  API vieja (Basic Display) que permitía embeber feeds simples de cuentas personales; para tener un feed
  que se actualice solo hay dos caminos: (a) pasar la cuenta de Silicer a **Business/Creator** y usar la
  API oficial de Meta (Graph API) autenticada, algo técnico y que requiere mantenimiento; o (b) usar un
  **widget de terceros** (tipo EmbedSocial, Juicer, SnapWidget) que se conecta a esa misma API en tu
  nombre — más simple de instalar, pero casi siempre de pago y depende de un servicio externo.
  Para esta primera versión de la landing, lo más simple y confiable sigue siendo la **galería con fotos
  curadas a mano** (sección 4) en vez de un feed en vivo. Se puede evaluar un embed de Instagram más
  adelante, como mejora, no como parte de este lanzamiento.

## 5. Info práctica
- **Qué mantener:** las 3 tarjetas actuales (2 Horas / Cupos limitados / Experiencia) — son datos
  concretos y útiles, formato claro.
- **Qué agregar:** un dato que hoy no está en ningún lado — **ubicación**: Amadeo Mozart 169, Río Cuarto,
  Córdoba (dirección exacta + opcionalmente un mapa embebido). Siendo presencial, es información que puede
  definir si alguien se anota o no.
- Se puede sumar también los **días disponibles** como dato informativo (lunes a viernes), sin listar
  horarios exactos si eso se resuelve recién en el formulario/contacto.

## 6. Preinscripción (formulario)
- **Formato:** formulario sobre imagen con textura propia, contenedor de bordes redondeados, título y
  subtítulo antes de los campos (referencia unikorns) — la decisión que ya cerramos en `02-REFERENCIAS`.
- **Qué mantener del formulario actual:** los campos ya están bien pensados y son los necesarios — Nombre,
  Apellido, Email, Teléfono, Fecha de nacimiento, Día preferido, Horario, Mensaje opcional. No hace falta
  agregar ni sacar campos.
- **Qué cambiar:** quitar la opción "Sábado (sólo niños)" del selector de día, ya que esta landing no
  apunta a ese público.
- Copy de apoyo: "Completá el formulario y te contactamos para confirmar tu lugar" — se mantiene, es claro
  y a la vez no promete algo que no se cumple (no es inscripción automática, es preinscripción real).

## 7. Footer / contacto directo
- **Qué mantener:** los botones de WhatsApp e Instagram para quien prefiere no completar el formulario.
- **Qué agregar:** este es el lugar natural para el **cierre-statement** que definimos en las referencias
  (dumeme + máscara giratoria) — una frase fuerte de cierre en vez de terminar en un simple "contactanos".
  También puede ir acá la ubicación si no se puso antes en la sección de info práctica.

---

## Estructura final (orden de scroll)
1. Header (logo)
2. Hero (titular + foto + CTA único)
3. Sobre el taller
4. Qué vas a aprender
5. Presencia de alumnos (galería)
6. Info práctica (duración / cupos / experiencia / ubicación / días)
7. Preinscripción (formulario)
8. Footer (contacto directo + cierre)
