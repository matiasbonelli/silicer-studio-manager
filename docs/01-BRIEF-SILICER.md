# 01 · Brief general — Landing Silicer (taller de cerámica)

> Documento vivo. Vamos completando y ajustando sección por sección junto con Matías.
> Los puntos marcados **[a confirmar]** son supuestos razonables que tomé para no frenar el avance;
> hay que revisarlos antes de pasar a diseño.

---

## 1. Qué es y para quién
Landing de **preinscripción al taller de cerámica de Silicer**, en **Río Cuarto, presencial**. Silicer
también vende insumos de cerámica al público, pero esta página es exclusivamente para el **taller y sus clases** —
la venta de insumos no compite por espacio acá.

Lo visitan principalmente **mujeres mayores de 24 años** que están evaluando anotarse. En pocos segundos
tienen que sentir: "esto es un taller real, con onda, con gente aprendiendo ahí — quiero ser parte". Tiene
que transmitir **presencia de alumnos**: no es un curso online genérico ni una promesa vacía, es un lugar
con vida, con manos en la arcilla, con grupo.

## 2. Objetivo (la única acción importante)
**Que se preinscriban.** Un formulario de preinscripción a las clases. Todo el sitio existe para llevar
ahí: mostrar el taller, generar confianza, dejar clara la info (qué es, cuándo, dónde) y facilitar
completar el formulario. Si una sección no acerca a eso, sobra.

## 3. Tono y personalidad
**Sereno, pero no sobrio.** Antimodelo. Rozando lo artístico, con aires de espontaneidad — que se sienta
hecho a mano, no corporativo ni institucional. Cálido y humano, sin caer en la solemnidad de un "estudio
de diseño" ni en la genericidad de una landing de curso online.

## 4. Decisiones de estilo (mi criterio)
- **Color: colores de marca.** Fondo claro tipo **hueso** (nada de blanco puro). Color principal / "con
  vida": **#5c329e**. Color complementario o secundario: **#7f8bd3**.
- **Tipografía:** titulares en **Restora**; párrafos y oraciones de cuerpo en **Helvetica Neue LT Pro**.
  Archivos de fuente, logo e imágenes se suman aparte en una carpeta de assets.
- **Densidad: baja.** Mucho aire, pocas cosas por pantalla. Micro-interacciones que **premien explorar**,
  nunca decorativas.
- **Movimiento: sutil y elegante**, tipo revista. Micro-interacciones que **premien explorar**, nunca
  decorativas.

## 5. Mis manías (dilo ya, ahórrate iteraciones)
- **Sin emojis** en la interfaz. Los iconos, siempre en **SVG**.
- **Nada de fondos de partículas** ni gradientes ruidosos: me parecen cutres, de plantilla vieja.
- **Copy con resultado, no con adjetivos.** "+62% de activación" convence; "experiencias memorables", no.
- **Texto a un solo color.** Titulares a dos colores me quedan fatal.
- Idioma de toda la interfaz: **español**.
- El logo del header es el **isotipo/logo de marca de Silicer** (Matías lo adjunta aparte, en carpeta de assets), no el nombre escrito ni un monograma alternativo.

## 6. Must-haves y no-goes
El contenido y las secciones concretas de la página se definen en detalle en **03-SECCIONES.md**. A nivel
de principios generales: formulario de preinscripción con fricción mínima y bien visible; presencia real
de alumnos (nada de stock); que cargue rápido y funcione con teclado.

## 7. Stack / restricciones
- **Next.js + React + Tailwind**, hospedado en Vercel (mismo stack que ya se usó con Claude Code).
- Rendimiento y accesibilidad como requisito, no como extra: carga rápida, contraste AA, navegable con
  teclado, y que sin JavaScript de adorno el sitio se siga entendiendo.
