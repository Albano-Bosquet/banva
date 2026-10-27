# Análisis de Canva — Informe técnico #1 (capa pública)

Fecha: 2026-10-27 · Alcance: página pública `https://www.canva.com/es_ar/` **sin sesión iniciada**.
El editor (`/design/...`) requiere cuenta y **todavía no fue analizado**.

Convención: **[H]** = hecho observado (con herramienta y evidencia) · **[I]** = hipótesis/inferencia técnica.

---

## 1. Herramientas usadas

| Herramienta | Estado | Uso |
|---|---|---|
| REA (Reverse Engineer Anything) | **No instalado** (ver §6) | — |
| Navegador integrado (Chromium, pane de Claude) | OK | DOM, JS en página, red, recursos |
| `performance.getEntriesByType('resource')` | OK | inventario de recursos |
| Análisis estático de bundles públicos (fetch + regex) | OK | detección de librerías |
| Node 24.21 / npm 11.19 / Python 3.14 / git | OK | entorno de desarrollo |
| PostgreSQL, Docker | **No instalados** | necesarios para Fase 4 (backend) |

---

## 2. Arquitectura frontend observada

### Hechos
- **[H]** SPA en **React 19.2.3**: `#root` tiene la clave `__reactContainer$…`; los nodos tienen `__reactFiber$…`; la cadena de versión `"19.2.3"` aparece en `7c2ca258f6cd071d.s4le6a.vendor.js`.
- **[H]** **MobX** como gestor de estado: globales `__mobxGlobals`, `__mobxInstanceCount`, y referencias a mobx en el vendor y en el bundle principal.
- **[H]** **Webpack** con chunks: global `webpackChunk_canva_web` (88 chunks cargados en la home), `runtime.js` separado, `__canva_public_path__ = "https://static.canva.com/web/"`.
- **[H]** Bundles con nombre por hash de contenido (`<hash16>.<nombre>.js`), divididos en: `runtime`, varios `vendor`, `strings` (i18n), un archivo por locale (`es-AR.js`), y un bundle de página (~963 KB).
- **[H]** CSS atómico tipo **StyleX** (clases `x6brqfx`, `x1yowkxt`…, y la cadena `stylex` en un vendor).
- **[H]** **Sentry** para errores (`__SENTRY__`, `sentry_browser.js`, `o13855.ingest.sentry.io`).
- **[H]** Variables de carga: `__batch_chunks__`, `__page_load_id__`, `__exposeTestIds__`.
- **[H]** Regiones de accesibilidad `#canva-a11y-fallback-polite` / `-assertive` (live regions ARIA).
- **[H]** Sin Service Worker activo en la home.
- **[H]** Cloudflare delante del sitio (`/cdn-cgi/challenge-platform/…`, `/cdn-cgi/rum`, `cloudflareinsights`).

### Dominios observados (recursos cargados)
| Host | Recursos | Rol (inferido salvo indicación) |
|---|---|---|
| `static.canva.com` | 33 | JS/CSS estáticos **[H]** |
| `content-management-files.canva.com` | 20 | imágenes del CMS de marketing **[I]** |
| `www.canva.com` | 11 | HTML + API `/_ajax/*` **[H]** |
| `chunk-composing.canva.com` | 4 | composición de chunks en servidor **[I]** |
| `telemetry.canva.com` | 1 | telemetría **[I]** |
| `accounts.google.com` | 2 | Google One Tap / login **[H]** |

### Hipótesis
- **[I]** La combinación React + MobX sugiere stores observables por dominio (documento, selección, UI) con componentes reactivos. Para nuestra implementación, Zustand cubre el mismo rol con menos magia.
- **[I]** `chunk-composing` + `__batch_chunks__` sugiere que el servidor agrupa chunks webpack en respuestas combinadas para reducir peticiones.

---

## 3. Comunicación frontend ↔ backend (home, sin sesión)

| Acción | Método / ruta | Respuesta observada | Notas |
|---|---|---|---|
| Carga de página | `GET /es_ar/` | 200 HTML | redirección por locale **[H]** |
| Heartbeat de conectividad | `GET /_online?<timestamp>` | 200 | ~4 llamadas al cargar **[H]**; detección offline **[I]** |
| Consentimiento | `GET /_ajax/privacypreference/trackingconsent/check` | 200 | **[H]** |
| Diálogo de login | `POST /_ajax/authnflow/auth-dialog-content` | 200 | **[H]** |
| Sincronización de reloj | `GET /_ajax/ae/time` | `{"A":1793073244669}` | **[H]** timestamp ms en campo `A` |
| Eventos analíticos | `POST /_ajax/ae/v2/createBatch` | `{}` | **[H]** envío por lotes |

- **[H]** Las respuestas JSON usan **claves de una letra** (`"A"`).
- **[I]** Las claves cortas indican serialización generada desde un esquema (tipo protobuf → JSON compacto) para reducir payload. Para nuestro sistema: JSON legible + validación con Zod; optimizar después si hace falta.
- **[I]** Patrón general de API: RPC sobre HTTP bajo `/_ajax/<servicio>/<método>`, no REST por recurso.

No se extrajeron cookies, tokens ni cuerpos de petición con datos de usuario.

---

## 4. Lo que NO se pudo observar todavía

Todo el editor: lienzo, capas, selección/transformación, guías, páginas, historial, autoguardado, import/export, y su tráfico. Requiere una sesión con la **cuenta de prueba autorizada** del usuario (no se crean cuentas ni se ingresan credenciales desde el agente).

Plan para el informe #2 (con sesión iniciada por el usuario en el navegador integrado):
1. Crear un diseño en blanco y registrar las peticiones de creación.
2. Inspeccionar el DOM del lienzo: ¿`<canvas>`, SVG o DOM posicionado? ¿WebGL?
3. Insertar texto, forma e imagen; mover/rotar/escalar; observar peticiones de guardado (frecuencia, debounce, formato de delta vs documento completo).
4. Deshacer/rehacer: ¿genera tráfico o es local?
5. Agregar páginas, reordenar capas, alinear con guías.
6. Exportar PNG/PDF (gratis) y registrar el flujo asíncrono.
7. Buscar WebSocket/long-polling para colaboración.

---

## 5. Implicancias iniciales para nuestro diseño

| Observación | Decisión propuesta |
|---|---|
| React + store observable | React 19 + TypeScript + Zustand |
| CSS atómico | Tailwind o CSS Modules (sin copiar estilos ni identidad visual) |
| RPC `/_ajax/*` | API propia `/api/*` (Fastify), contratos en Zod compartidos |
| Heartbeat `/_online` | Indicador de conexión + cola de guardado offline |
| Telemetría por lotes | Fuera de alcance inicial |

---

## 6. Sobre REA

- **[H]** No hay ningún binario `rea` en el PATH, ni plugin/skill de ese nombre en Claude Code.
- **[H]** Los paquetes `rea` de npm ("wrapper over connect.router") y PyPI (0.1.1) **no tienen relación** con ingeniería inversa; no se instalaron.
- **[H]** En el directorio de plugins de Claude existe un plugin comunitario "Reverse Engineering" (no instalado). No está confirmado que sea "REA".
- Alternativa usada: navegador integrado + JS en página + inspección de red + análisis estático de bundles públicos. Cubre lo que REA aportaría en una app web (no puede recuperar código de servidor en ningún caso).

---
---

# Informe técnico #2 — Editor (con sesión de la cuenta de prueba)

Fecha: 2026-10-27 · Diseño de prueba creado: 1080×1080 px. Herramientas: navegador integrado. Para medir sin leer contenido sensible instrumenté en la página `fetch`, `XMLHttpRequest` y `WebSocket.prototype.send`. Solo registré método, ruta (con IDs enmascarados), tamaño y **nombres de claves**, nunca valores. No se copiaron IDs, tokens ni cookies a este documento.

## 7. Apertura de un diseño

- **[H]** URL de creación: `/design?create&width=W&height=H&units=px`. Redirige a `/design/<docId>/<token>/edit`: un ID de documento y un segundo segmento opaco.
- **[H]** El HTML inicial del editor (~325 KB descomprimido, 57 KB transferido) **ya contiene el contenido del documento**: el texto del diseño aparece en el HTML al recargar. No se observó ninguna petición XHR o fetch que descargue el documento.
- **[H]** Al cargar se piden muchos servicios en paralelo vía `/_ajax/*`: `designspec`, `doctypes2`, `livedesign/collaborators`, `reaction`, `brandkit`, `quota`, `fonts/*`, `search/templates`, `publish/v3/options`, `websitehosting/deployments`, entre otros.
- **[H]** Los chunks JS se sirven agrupados: `chunk-composing.canva.com/chunk-batch/<hash1>.js+<hash2>.js+…`. En la carga del editor hubo 81 batches.
- **[H]** Se cargan un web worker dedicado (`/_web_worker/worker.<hash>.js`) y un módulo **WebAssembly** (`static.canva.com/web/wasm/<hash>.wasm`).
- **[I]** Patrón "documento incrustado en el HTML + servicios auxiliares en paralelo": el lienzo pinta sin esperar una segunda petición.

## 8. Render del lienzo

- **[H]** **No usa `<canvas>` para la página**: hay 0 canvas dentro de la página y solo un canvas de 80×80 en toda la UI. La página es **DOM + SVG**.
- **[H]** Estructura observada:
  - Contenedor `div[data-page-id]` con el tamaño en pantalla (por ejemplo 671×671).
  - Dentro, un `div` de **1080×1080 (unidades de diseño)** con `transform: scale(0.621296)`. El zoom se aplica escalando por CSS toda la página.
  - Cada elemento es un `div` absoluto con `width/height` en unidades de diseño y `transform: translate(x, y)` (más `rotate(…)` en la capa de selección).
  - **Rectángulo**: `<svg>` con `<defs><clipPath>` y un `<path d>`.
  - **Texto**: `div[role=textbox][contenteditable]` → `<p>` con estilos inline (`font-family` por ID de fuente, `line-height`, alineación por clase).
- **[H]** Al insertar con la tecla `R`, el rectángulo tiene **324×324 en (378, 378)**: 30 % del lado y centrado en una página de 1080.
- **[H]** El texto nuevo tiene `font-size` CSS 40px, pero la barra muestra **30**. **[I]** La UI muestra el tamaño en puntos (px × 0,75).
- **[H]** La capa de selección/transformación es independiente de la página. Tiene:
  - 4 tiradores de esquina y 4 laterales.
  - Un tirador de rotación debajo del elemento; en el texto también aparece uno de "mover".
  - Una mini barra flotante encima del elemento (comentar, bloquear, más).
  - Una barra contextual superior que cambia según el tipo de elemento.

## 9. Herramientas observadas

| Herramienta | Comportamiento observado **[H]** |
|---|---|
| Agregar caja de texto | Inserta "Texto del párrafo" centrado, en modo edición y con el texto seleccionado. |
| Título del diseño | Pasó solo de "Diseño sin título" a "Hola editor", tomando el primer texto. |
| Rectángulo (tecla `R`) | Inserta un cuadrado negro centrado. La barra muestra color, borde, radio de esquina y tipografía (las formas admiten texto). |
| Mover con flechas | Cada pulsación genera un cambio sincronizado. |
| Arrastre | Un solo cambio sincronizado por arrastre (al soltar), no uno por cada movimiento. |
| Panel "Posición › Organizar" | Delante, Detrás, Al frente, Al fondo. Alinear a la página (6 opciones). Campos numéricos de ancho, alto, bloqueo de proporción, X, Y y rotación en px de diseño. |
| Panel "Posición › Capas" | Lista con asa de arrastre (⠿), del frente al fondo. El fondo de la página es una capa fija. Filtro "Todo / Superposición". |
| Páginas | "Agregar una página" apila páginas en vertical, cada una con un título editable ("Página N - Agregar título de página"). Contador "N de M". |
| Zoom | Deslizador y porcentaje en la barra inferior. Al recargar el valor cambió de 53 % a 62 %: **[I]** zoom de ajuste a la ventana. |
| Exportar (Compartir › Descargar) | Formatos: JPG, PNG, PDF, SVG (Pro), MP4, GIF, PPTX, WEBP. Opciones: tamaño (×1, el escalado es Pro), calidad, fondo transparente (Pro) y selección de páginas. **No se ejecutó la descarga** (requiere autorización). |

**No observado:** guías inteligentes y ajuste durante el arrastre. La herramienta de arrastre del agente es atómica (presionar → soltar), así que no se ven los estados intermedios. Queda pendiente con otra técnica: eventos de puntero sintéticos o grabación manual del usuario.

## 10. Persistencia y sincronización

| Acción | Canal | Datos | Respuesta / UI |
|---|---|---|---|
| Escribir texto, mover, insertar, deshacer, rehacer, agregar página | **WebSocket `wss://www.canva.com/_stream`** (`binaryType = arraybuffer`) | Frame binario: cabecera de 6 bytes (`00 00 00 03 28 20`) seguida de **JSON con claves de una letra** | El indicador muestra "Se guardaron todos los cambios" |
| Tras editar texto | `POST /_ajax/ripple/<docId>/source/state` | Petición de 94 B con claves `A,B,C,D` | Respuesta `{"A?":"B","K":"<ms>-<n>","L":2}` |

Tamaño de los frames medidos al enviar:

| Operación | Bytes |
|---|---|
| Mover (arrastre) | 215 |
| Mover con flecha | 214 |
| Deshacer | 215 |
| Rehacer | 215 |
| Insertar rectángulo | 615 |
| Agregar página | 193 |

- **[H]** Se envía **un frame por operación** y el tamaño es proporcional al cambio, **no al documento**: los cambios se guardan como deltas.
- **[H]** Estructura de claves de un frame de movimiento:
  `{A:{"A?":tipo, A:{A:{A:{A:[ {"A?":tipo, A:{"A?":tipo, E:{A:[{"A?":tipo, A:{…}}]}}} ]}}}, B:number}`.
  Uniones discriminadas con la clave `"A?"`, una lista de operaciones y un número `B`.
- **[I]** `B` es un contador de secuencia o revisión del cliente. Las rutas anidadas apuntan a página → elemento → propiedad.
- **[H]** **Deshacer y rehacer se envían como cambios nuevos**, con la misma forma que una edición.
- **[I]** El historial es local, y cada deshacer genera la operación inversa como un cambio hacia adelante. Encaja con un modelo de operaciones sincronizadas apto para colaboración.
- **[H]** La recarga confirmó la persistencia: texto, posición y elementos se conservaron.
- **[H]** No se halló `wss://` literal en los bundles. La URL se arma en tiempo de ejecución, y el cliente WS admite un `wsCreator` inyectable y estados de conexión (`CONNECTING`…).
- **[H]** Los bundles contienen `new EventSource(` y `SharedWorker("braze-dust-worker")`. **[I]** Pertenecen al SDK de mensajería de marketing (Braze), no al editor.
- **[I]** El formato `K = "<epoch-ms>-<n>"` de `ripple/source/state` recuerda a IDs de stream (al estilo de Redis Streams).

## 11. Señales en los bundles (análisis estático)

Se analizaron 125 scripts cargados en el editor. Se contaron coincidencias de patrones; no se extrajo código.

| Patrón | Archivos | Interpretación |
|---|---|---|
| `getContext("2d")` | 14 | canvas auxiliares (miniaturas, medición, export) **[I]** |
| `getContext("webgl")` | 4 | efectos o video **[I]** |
| `OffscreenCanvas` | 5 | render en el worker **[I]** |
| `WebAssembly.instantiate*` | 3 | decodificación o procesamiento de medios **[I]** |
| `ResizeObserver` | 17 | layout reactivo de los paneles |
| `contentEditable` | 2 | edición de texto en el DOM **[H]** |
| `indexedDB.open` | 1 | caché local **[I]** |

## 12. Pendiente de observar

- Guías, ajuste a cuadrícula y espaciado durante el arrastre.
- Peticiones de exportación: probablemente un job asíncrono en servidor que devuelve una URL **[I]**. Requiere tu autorización para descargar.
- Subida de imágenes (`Subidos`).
- Agrupar, duplicar, copiar y pegar, y selección múltiple.
- Frames entrantes del WebSocket en colaboración: requiere un segundo usuario.

## 13. Panel Elementos: categorías (informe #3)

Recorrido de las 14 categorías del panel **Elementos** con la cuenta de prueba. Se insertaron un gráfico, una tabla y un elemento gráfico para ver sus controles, y después se eliminaron. No se descargó ningún recurso.

| Categoría | Qué muestra el panel **[H]** | Controles al insertar **[H]** | Interpretación **[I]** |
|---|---|---|---|
| Formas | Secciones con "Ver todo": líneas (sólida, guiones, puntos, con flecha), básicas, polígonos, estrellas, flechas, diagrama de flujo, globos de diálogo, nubes, corazones, banners, gotas, engranajes, asteriscos, orgánicas, abstractas | Relleno, borde, esquinas (visto en el informe #2) | Biblioteca de trazados vectoriales escalables con relleno editable |
| Elementos gráficos | Recomendaciones, destacados, degradados, animaciones, redes sociales, íconos; se agrega "Usado recién" | Editar, Reemplazar, Quitafondos (premium), Borrador, **una muestra por cada color del SVG**, borde, esquinas | Ilustraciones SVG con colores recoloreables |
| Animaciones | Stickers animados por temas (flechas, palabras, comida, formas, emoji) | — | Gráficos con animación en bucle |
| Fotos | Grilla de fotos (tendencias); algunas con corona (premium) | — | Banco de imágenes con búsqueda |
| Videos | Miniaturas con duración (p. ej. "10.0s") por temas | — | Banco de video; el elemento se reproduce en el lienzo |
| Audio | "Generar una voz con IA", pistas con título, autor y duración | — | Pistas a nivel de diseño, no elementos visuales |
| Gráficos | "Crear con mis datos"; barras (vertical, horizontal, apiladas), líneas, torta y anillos, área, dispersión | Panel **Gráfico**: selector de tipo; pestaña **Datos** con una grilla editable (columna de etiquetas + series), "Importar datos", trasponer; pestaña **Personalizar**: leyenda, etiquetas de datos, título, subtítulo, fuente, ejes X/Y | Elemento de datos que se dibuja a partir de una tabla |
| Formularios | Bloques por tema: newsletter, contacto, quiz, RSVP, valoración con estrellas | — | Bloques interactivos que recogen respuestas al publicar |
| Hojas de cálculo | Plantillas: inicio vacío, lista de contactos, inventario, presupuesto, gastos, Gantt, planificador, horario | — | Tablas con fórmulas (presupuesto con totales) |
| Tablas | 15 estilos: 5 colores × (solo bordes, encabezado relleno, encabezado + filas en bandas) | Color de celda, bordes, espaciado, tipografía, tamaño, color, negrita, cursiva, alineación, lista, alineación vertical. Inserta 3×4 | Elemento grilla con celdas de texto |
| Marcos | Formas básicas, película y foto, dispositivos (teléfono, monitor, tablet), papel, flores, blobs; con una imagen de relleno de paisaje | — | Máscara con forma donde se suelta una imagen que la rellena |
| Cuadrículas | Más de 20 distribuciones de 1 a 9 celdas | — | Distribución de marcos a página completa con separación |
| Mockups | Video, marcos, smartphones, impresos, ropa, computadoras | — | Composición de una imagen sobre un objeto |
| 3D | Íconos, estilo de vida, formas, personajes, animales, educación, con distintivo "3D" | — | Renders 3D usados como stickers |

**Decisión para Trazo.** Se replican las **funciones**, con recursos propios:
- Formas, gráficos, íconos, stickers animados, marcos, mockups y objetos 3D: dibujados en código, originales.
- Fotos y audio: búsqueda en Openverse (contenido con licencia Creative Commons y atribución).
- Videos: solo los que sube el usuario.

No se copian imágenes, ilustraciones, plantillas ni textos de Canva.

## 14. Galería de plantillas (informe #4)

Se revisaron la galería pública (`canva.com/templates/`) y la sección **Plantillas** de la cuenta, que el usuario mostró en una captura. No se abrió ni se copió el contenido de ninguna plantilla.

**Hechos [H]**
- La galería pública agrupa las plantillas en 23 categorías con "See all". Cada categoría muestra unas 10 plantillas; en las de varias páginas aparece "1 of N / N slides".
- La sección de la cuenta muestra accesos rápidos: Post de Instagram, Post de Facebook, Portada de Facebook, Banner, Flyer, Cartel, Tu historia, Video para dispositivos, Presentación, Logo, Enlace en la biografía y Documento. Además tiene filtros (Negocios, Video, Redes sociales) y un buscador.
- Los nombres de las plantillas siguen el patrón *colores + estilo + tema + formato*, por ejemplo "Beige Minimalist Collage Instagram Post". Los estilos que más se repiten son minimalista, moderno, audaz, ilustrado y de collage de fotos.
- Cada página de plantilla declara sus atributos `Dimensions` y `Orientation`. Se leyeron 3 plantillas por categoría y las 3 coincidieron en todos los casos:

| Categoría | Tamaño | Orientación |
|---|---|---|
| Presentations | 1920 × 1080 px | horizontal |
| Instagram Posts | 1080 × 1350 px | vertical |
| Instagram Stories | 1080 × 1920 px | vertical |
| Facebook Posts | 940 × 788 px | horizontal |
| Flyers | 210 × 297 mm | vertical |
| Posters | 42 × 59,4 cm | vertical |
| Logos | 2000 × 2000 px | cuadrado |
| Resumes, Invoices, Newsletters, Worksheets | 21 × 29,7 cm | vertical |
| Invitations | 105 × 148 mm | vertical |
| Business Cards | 3,5 × 2 in | horizontal |
| Certificates, Brochures | 297 × 210 mm | horizontal |
| Infographics | 800 × 2000 px | vertical |
| Calendars, Desktop Wallpapers, videos | 1920 × 1080 px | horizontal |
| Websites | 1366 × 768 px | horizontal |
| T-Shirts | 14 × 18 in | vertical |
| Docs, Whiteboard | sin límite | — |

- Medidas que publican las páginas "crear": portada de Facebook de 820 × 312 px, miniatura de YouTube de 1280 × 720 px y banner de X de 1500 × 500 px.

**Decisión para Trazo [I]**
- Se reproduce la organización: categorías, formato por categoría, búsqueda y aplicación desde el editor.
- Cada categoría tiene plantillas propias con textos, paletas y composiciones originales. No se copia ningún diseño de Canva.
- Las medidas en papel se convierten a 96 px por pulgada, la misma conversión que Trazo usa para A4: 794 × 1123 px.
- Docs y Whiteboard se dejan afuera porque necesitan un lienzo sin límite, que Trazo no tiene.

## 15. Tipos de diseño del Inicio (informe #5)

Se recorrieron los accesos de la barra "¿Qué vamos a diseñar hoy?" con la cuenta de prueba. Para cada tipo se creó un diseño vacío de prueba. No se publicó, no se envió y no se descargó nada. Tampoco se registraron datos de la cuenta.

**Hechos [H]**
- **Cómo se abren.** Cada acceso es un enlace `/design/editor/shell?create&type=<id>&category=<id>`, que abre el editor en una pestaña nueva. Redes, Video, Fotos y Personalizar no abren un editor: abren el diálogo **Crear un diseño**.
- **El diálogo Crear un diseño.** Tiene una columna izquierda con Para vos, Presentaciones, Redes sociales, Fotos, Videos, Docs, Pizarras online, Hojas de cálculo, Diseño interactivo, Sitios web, Correos, **Elegir el tamaño** y Subir.
  - Elegir el tamaño pide ancho, alto y unidades (px, …) y ofrece layouts populares: A4, A3 y US Letter, en vertical y horizontal.
  - Redes agrupa por red (Facebook, Instagram, LinkedIn, Pinterest, TikTok, Twitter, WhatsApp, YouTube) e incluye "Enlace en la biografía".
  - Video ofrece: horizontal, móvil, TikTok, YouTube, Shorts, Facebook, Reel y cuadrado.
  - Fotos ofrece acciones rápidas (Pro: quitafondos, borrador mágico, captura de texto…) y "Editá tu foto".
- **Doc** (título "Doc (digital)").
  - Es una página continua donde cada bloque es un `contenteditable` propio.
  - Muestra "empezá a escribir o presioná /". El menú "/" ofrece: Título, Subtítulo, Encabezado y Cuerpo (Ctrl+Alt+1/2/3/0); Tabla; Hoja de cálculo; Divisor; Salto de página (Ctrl+Entrar); listas de control, con viñetas y numeradas; 2, 3 o 4 columnas; bloques destacados; citas; mención; fecha; menú desplegable; gráficos de torta, barras y líneas; emoji; temporizador; botón; formulario; encuesta; cuestionario; y firma.
  - La tabla se elige en una grilla de 8 × 8.
  - Barra superior: estilo de bloque (H1…), tipografía, tamaño, color, resaltado, negrita, cursiva, alineación y listas.
  - Barra inferior: Notas, Esquema, zoom y Páginas.
- **Pizarra** ("Pizarra online").
  - Lienzo con fondo de puntos.
  - Herramientas: Seleccionar, Sección, Dibujo, Formas, Líneas, Notas adhesivas (6 colores), Texto, Firma y Tablas.
  - La nota adhesiva muestra el nombre de su autor y tiene un "+" en cada lado que crea una nota contigua, alineada y sin conector.
  - Barra de la nota: Ordenar, color, tipografía, tamaño, B/I/U/S, mayúsculas, alineación, lista, espaciado, transparencia, Efectos y Posición.
- **Hoja de cálculo.**
  - Barra de fórmulas `f(x)`, columnas A, B, C…, filas numeradas y una selección con controlador de relleno.
  - Barra: Acciones, gráfico, filtro, formato numérico (123), decimales, color, bordes y tipografía.
  - Acepta funciones en español (`=SUMA(A1:A2)`) y resalta el rango en la barra de fórmulas.
  - Una referencia circular se marca con un ícono rojo en la celda.
- **Correo.**
  - Muestra una bienvenida: "Envialo con Gmail o Mailchimp, o descargá el código HTML", "exportala a HTML en un clic".
  - Botón "Enviar un correo de prueba".
  - Usa el mismo editor por bloques y el mismo menú "/" que Doc, sin formularios, encuestas ni cuestionarios.
- **Sitio web.** Se arma con secciones ("Agregar una sección") y tiene "Vista previa" y "Publicar el sitio web".
- **Diseño interactivo.** "Decile a Canva IA lo que querés diseñar": genera el contenido con IA. Tiene "Vista previa" y "Publicar el sitio web".
- **Video.**
  - Escenas con reproducción (0:00 / 0:05 por defecto).
  - Línea de tiempo con "Agregar elementos multimedia o una escena en blanco" y "Agregar un audio".
  - Vista de cuadrícula, zoom y Vista previa.
- **Capas Mágicas.** Convierte una imagen plana en capas editables con IA; solo admite imágenes.

**Interpretación [I]**
- Doc y Correo comparten un modelo de bloques: lista ordenada de párrafos, títulos, listas, tablas y otros, con formato de texto en línea.
- La hoja de cálculo es un tipo de diseño con su propia grilla, y no una tabla dentro de una página.
- La pizarra es una página sin límites de tamaño.

**Decisión para Trazo**
- Se replican Doc, Correo (con exportación a HTML), Hoja de cálculo, Pizarra, Sitio web (secciones, vista previa y publicación interna), Video (escenas, duración, audio y exportación WebM) y un editor de fotos con ajustes y filtros.
- Diseño interactivo y Capas Mágicas dependen de IA generativa y quedan fuera de alcance.
- "Enviar un correo de prueba" queda fuera: necesitaría un servidor de correo. Se reemplaza por copiar y descargar el HTML.
