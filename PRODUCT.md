# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Existente: Vite + React + React Router + Tailwind CSS, hospedado en Vercel. La landing es la ruta `/` (`src/pages/Index.tsx`) dentro de una SPA más grande que también sirve `/auth` y `/admin` (Silicer Studio Manager, panel de gestión del taller). Decisión explícita del usuario: no migrar a Next.js pese a que el brief original lo mencionaba — el brief estaba desactualizado respecto al repo real. La landing se reconstruye en el lugar, sin tocar Admin/Auth.

## Users

Mujeres mayores de 24 años en Río Cuarto, Córdoba, evaluando si anotarse a clases de cerámica presenciales. Llegan a la landing decidiendo, no navegando por curiosidad: en pocos segundos necesitan sentir que es un taller real, con vida y gente aprendiendo ahí, no una promesa vacía ni un curso online genérico.

## Product Purpose

Landing de preinscripción al taller de cerámica de Silicer (presencial, Río Cuarto). Existe una única acción que importa: que la persona complete el formulario de preinscripción. Cada sección del sitio existe para acercar a esa acción — mostrar el taller, generar confianza, dejar clara la info práctica, y facilitar el formulario. Silicer también vende insumos de cerámica al público, pero esa venta no compite por espacio en esta página.

## Positioning

El diferenciador no es un método propietario ni una credencial — es la experiencia real del taller: presencia genuina de alumnos, ambiente de comunidad ("no es solo cerámica, es comunidad"), hecho a mano y con onda, en contraste directo con la genericidad de un curso online o una landing corporativa de agencia. La landing tiene que transmitir eso mismo (vida, gente, oficio) en vez de solo describirlo.

## Operating Context

- Taller presencial en Amadeo Mozart 169, Río Cuarto, Córdoba.
- Días disponibles: lunes a viernes (sin horarios exactos publicados; se resuelven en el contacto post-preinscripción).
- Duración de clase: 2 horas. Cupos limitados.
- Precio no se muestra en la landing — se resuelve por contacto directo tras la preinscripción.
- Es preinscripción, no inscripción automática: alguien del taller contacta después para confirmar el lugar.
- El sitio convive con un panel de administración (`/admin`) y autenticación (`/auth`) del mismo proyecto — comparten dependencias de build pero no deben compartir tokens visuales (ver Constraints).

## Capabilities and Constraints

- Formulario de preinscripción con campos ya definidos y cerrados: Nombre, Apellido, Email, Teléfono, Fecha de nacimiento, Día preferido, Horario, Mensaje opcional. Se quita la opción "Sábado (sólo niños)" del selector de día — esta landing no apunta a ese público.
- Los tokens de diseño de la landing (color, tipografía, espaciado) deben vivir en un namespace propio, separado de los tokens globales (`--background`, `--primary`, etc. en `src/index.css`) que usa el panel Admin — para no alterar la apariencia del Admin al rediseñar la landing.
- Sin emojis en la interfaz; iconografía siempre en SVG propio.
- Sin fondos de partículas ni gradientes decorativos "de plantilla".
- Sin stock genérico: donde falte una foto real (espacio, alumnos), se reserva el espacio en vez de rellenar con una imagen genérica.
- Debe funcionar y entenderse sin JavaScript decorativo, con navegación por teclado completa, y contraste AA.
- Debe respetar `prefers-reduced-motion`.

## Brand Commitments

- Nombre e identidad: Silicer, taller de cerámica.
- Logo/isotipo de marca en `docs/logo.svg` (no el logo de texto ni un monograma alternativo) — reemplaza al `public/logo.svg` desactualizado que hay en el repo hoy.
- Colores de marca: primario `#5c329e`, secundario `#7f8bd3`, fondo hueso (no blanco puro).
- Tipografía: titulares en Restora, cuerpo en Helvetica Neue LT Pro.
- Texto a un solo color siempre — nunca un titular a dos colores.
- Idioma de toda la interfaz: español.
- Tono de marca: sereno pero no sobrio, rozando lo artístico, espontáneo, hecho a mano — nunca corporativo/institucional ni genérico de curso online.

## Evidence on Hand

- Logo/isotipo real: `docs/logo.svg`.
- Fuentes: `docs/fonts/Restora.otf`, `RestoraItalic.otf`, `RestoraBoldItalic.otf` (sin Bold recto); `HelveticaNeue-Light.otf`, `HelveticaNeueBold.ttf` (sin Regular/Roman). Decisión del usuario: usar Restora Regular para titulares y Helvetica Neue Light para cuerpo hasta que sumen los pesos faltantes.
- Foto de hero real: `public/hero-ceramica.jpg` (manos pintando una pieza de cerámica en clase) — confirmada, no es stock.
- Fondo del bloque de preinscripción: `docs/hero-background.jpg` (paisaje con degradado natural atardecer→noche) — decisión explícita del usuario, resuelve la referencia de "imagen de fondo con degradado propio" del formulario.
- Pendientes (reservar espacio, no rellenar con placeholder genérico): foto del espacio o de la persona a cargo (sección "Sobre el taller"); fotos reales de alumnos en clase y piezas terminadas (sección "Presencia de alumnos").
- Copy base y estructura de secciones ya cerrados en `docs/03-SECCIONES-SILICER.md` (contenido heredado y ajustado del sitio actual silicer.com.ar).
- Referencias visuales con valores CSS reales ya extraídos y confirmados por el usuario en `docs/02-REFERENCIAS-SILICER.md` (ver también el resumen de la conversación de diseño).

## Product Principles

1. La preinscripción es la única meta — cualquier sección o elemento que no acerque a eso, sobra.
2. Presencia real por sobre promesa genérica: fotos reales o espacio reservado, nunca stock de relleno.
3. Densidad baja, mucho aire — el contenido respira, no compite por atención simultánea.
4. Movimiento sutil y con propósito ("premia explorar"), nunca decorativo ni agresivo.
5. La landing y el Admin comparten código pero no identidad visual — la landing no puede romper ni heredar look del panel de gestión.

## Accessibility & Inclusion

Contraste AA como requisito (no opcional), navegación completa por teclado, contenido comprensible sin JavaScript de adorno, y respeto a `prefers-reduced-motion` en toda animación.
