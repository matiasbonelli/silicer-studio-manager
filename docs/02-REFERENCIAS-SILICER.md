# 02 · Referencias — Landing Silicer (taller de cerámica)

> De cada web tomo **una cosa concreta** y digo qué **no**. Mezclarlas por una cosa cada una es lo que da
> algo propio en vez de un clon.

---

## Cómo mirar estas referencias (instrucción para la IA)
- Baja el **HTML/CSS real** de cada URL antes de construir; varias son webs de Framer/Next y el contenido
  y los estilos se pueden leer directamente. No trabajes de memoria.
- Extrae valores concretos (tipografías, tamaños, colores, cómo está montada la interacción) y enséñamelos
  antes de confirmar que estamos mirando lo mismo.
- Toma de cada una **solo** lo que digo; ignora el resto de su estética.

---

## Referencia 0 — silicer.com.ar (sitio actual)
Landing actual del taller, hecha con Claude Code. Es el punto de partida a superar: sirve como referencia
de contenido/negocio (qué se dice hoy del taller), no de estilo. La vamos a rehacer desde cero con más
identidad propia.

## Referencia 1 — https://andreigorskikh.digital/contact-me
- **Qué tomar:** la sección de contacto con formulario — **titular grande, fondo limpio**, sin nada que le
  compita al formulario. La **jerarquía y el contraste** entre el título y el resto del contenido.
- **Qué NO tomar:** el resto del sitio (es un portfolio personal de UI, muy alejado del tono de Silicer).

## Referencia 2 — https://unikorns.work/#contact
- **Qué tomar:** el **formulario con imagen de fondo** — esa imagen tiene su propia textura y un
  degradado que está resuelto *dentro de la imagen*, no como efecto CSS aparte. Los **bordes redondeados
  del contenedor**. Que el bloque tenga **título y subtítulo** antes del formulario.
- **Qué NO tomar:** el resto (es una landing corporativa de agencia, con logos de clientes, testimonios en
  cadena, FAQ — todo lo que el brief de Silicer marca como "no-go").

## Referencia 3 — https://clonix.framer.website/
- **Qué tomar:** el **"ruido"/textura del fondo**, sutil, como capa de personalidad.
- **Qué NO tomar:** todo lo demás del sitio (plantilla genérica de agencia).

## Referencia 4 — https://vandslab.com/
- **Qué tomar:** el **hero con los titulares como protagonistas absolutos** — tipografía enorme, el texto
  *es* el diseño del hero, sin necesitar imagen para sostenerlo.
- **Qué NO tomar:** el resto (es una agencia de desarrollo/IA, tono y contenido nada que ver).

## Referencia 5 — https://monolithstudio.com/
- **Qué tomar:** la **diagramación de los textos alternando izquierda/derecha** a medida que se baja en el
  scroll — esa cadencia se podría usar para los párrafos/bloques de contenido de Silicer (por ejemplo, en
  la sección "sobre el taller" o en la descripción de las clases).
- **Qué NO tomar:** el resto de la estética (es un estudio de tatuajes, tono oscuro y urbano).

## Referencia 6 — https://soil-net.jp/
- **Qué tomar:** la estructura del apartado **"About"** — el bloque de texto institucional acompañado de
  una imagen — encaja bien como formato para contar qué es Silicer y su historia.
- **Qué NO tomar:** el resto (es una red de artes escénicas japonesa, contenido y estética sin relación).

## Referencia 7 — https://www.mosaicist.com/
- **Qué tomar:** varias cosas de este es uno de los favoritos — la diagramación general del sitio; el
  párrafo de texto del "About"; las secciones tipo **Outdoor / Living / Art** presentadas dentro de
  **rectángulos** como unidad visual; y el **overlay del logo** que se mantiene visible durante todo el
  scroll de la página.
- **Qué NO tomar:** nada puntual a excluir — es la referencia más cercana en espíritu; hay que revisarla
  igual con cuidado para no terminar pareciéndose demasiado.

## Referencia 8 — https://www.chdartmaker.com/
- **Qué tomar:** la **micro-interacción entre las palabras "Conception" y "Réalisation"** (se intercambian
  o se resaltan alternadamente) — un recurso de detalle para reforzar dos conceptos enfrentados sin
  necesitar más elementos.
- **Qué NO tomar:** el resto (estudio de fabricación de obras de arte, tono institucional francés).

## Referencia 9 — "Unique Clay" (imagen adjunta)
- **Qué tomar:** el **titular protagonista** ("UNIQUE CLAY") apoyado por **objetos/ilustraciones** justo
  después del hero — el titular como pieza gráfica, no solo texto. Y los **recuadros con foto + texto**
  que arman el resto del contenido (tipo tarjetas contenedoras, como en "Preimushchestva"/ventajas).
- **Qué NO tomar:** la paleta (es azul/lavanda saturado, Silicer usa **#5c329e** y **#7f8bd3** sobre hueso)
  ni el estilo de ilustración de línea/huella digital — eso es de esta referencia puntual, no del brief.

---

## Síntesis
La mezcla es: **hero con titular protagonista** (vandslab + Unique Clay), un **"About" con texto e
imagen** en formato editorial (soil-net) diagramado con **cadencia izquierda/derecha** (monolith studio),
contenido en **rectángulos/tarjetas foto+texto** (mosaicist + Unique Clay), un **logo overlay persistente**
(mosaicist) y un **cierre de contacto** con **formulario protagonista sobre imagen con textura propia**
(unikorns) — bordes redondeados del contenedor, título y subtítulo antes del formulario. Un **ruido sutil
de fondo** (clonix) y alguna
**micro-interacción de palabras enfrentadas** (chd art maker) como detalles de carácter, no de relleno.

**Efectos que NO quiero:** carruseles genéricos, testimonios de relleno, muros de logos de clientes,
scroll-jacking agresivo. Movimiento sí, pero elegante y que respete `reduced-motion`.
