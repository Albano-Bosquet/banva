# Progreso

## 2026-10-27 — Fase 1 y análisis inicial
- Entorno verificado: Node 24.21, npm 11.19, Python 3.14, git. Faltan PostgreSQL y Docker.
- REA no está instalado; los paquetes `rea` de npm/PyPI no tienen relación. Se usa el navegador integrado como alternativa (ver ANALISIS_CANVA.md §6).
- Informe #1 (capa pública) en `ANALISIS_CANVA.md`: React 19.2.3, MobX, Webpack, StyleX, Sentry, Cloudflare, API RPC `/_ajax/*` con claves compactas.

## 2026-10-27 — Informe #2 (editor)
- Con la sesión de la cuenta de prueba: diseño de 1080×1080 creado; texto, rectángulo y segunda página agregados; deshacer y rehacer probados; menú de exportación inspeccionado sin descargar.
- Hallazgos: render DOM+SVG escalado por CSS; guardado por deltas vía WebSocket `/_stream` (JSON compacto en frames binarios); deshacer se envía como operación nueva; documento incrustado en el HTML inicial.
- Se escribieron `ARQUITECTURA.md` y `FUNCIONALIDADES.md`.

### Problemas / limitaciones
- La red del navegador integrado no muestra frames de WebSocket. Se resolvió parcheando `WebSocket.prototype.send` en la página (solo tamaños y nombres de claves).
- El arrastre del agente es atómico, así que no se pudieron observar las guías intermedias.
- Exportación real pendiente: requiere autorización para descargar.

## 2026-10-27 — Etapas 2 a 11: editor "Trazo"
Pedido: avanzar con todas las etapas de forma autónoma.

**Implementado:** monorepo con `packages/shared` (modelo Zod), `apps/web` (React 19, Zustand + Immer, Konva, pdf-lib) y `apps/api` (Fastify 5, WebSocket, PostgreSQL o archivos). Detalle en `FUNCIONALIDADES.md`.

**Decisiones tomadas a partir del análisis:**
- Coordenadas en px de diseño y zoom como escala del stage (igual que Canva, §8).
- Historial con parches de Immer. Deshacer se emite como una operación nueva hacia adelante (§10), así el mismo canal sirve para persistir y colaborar.
- Guardado por deltas vía WebSocket `/ws`, con un snapshot HTTP `PUT` de respaldo si el socket cae.
- Inserciones centradas con el 30 % del lado y título automático desde el primer texto (§8–9).

**Verificación:**
- 5 pruebas en `shared`, 31 en `web` (store, geometría, plantillas, modo local) y 9 en `api` (CRUD, validación, subidas, miniaturas, colaboración WS con dos clientes, resync, diseño inexistente).
- 8 pruebas E2E en Playwright con el Chrome del sistema: texto + persistencia al recargar, atajos y deshacer/rehacer, arrastre con ajuste magnético al centro, panel Posición, páginas, descarga PNG/PDF, colaboración entre dos pestañas y plantilla.
- Verificado a mano en el navegador integrado:
  - Exportación a 1080×1080 exactos con zoom al 54 %.
  - PDF de 2 páginas de 1080×1080 pt.
  - Subida de imagen desde la UI.
  - Rotación con ajuste a 90° y redimensión desde la esquina.
  - Miniaturas en el inicio.
- `tsc --noEmit` sin errores en los tres paquetes; `vite build` OK.

**Problemas encontrados y resueltos:**
- El título automático quedaba fijo en "Texto del párrafo". Ahora sigue al primer texto mientras el título siga siendo el derivado.
- Rehacer una inserción dejaba el elemento sin seleccionar. Ahora se selecciona lo que la operación vuelve a insertar (diferencia de ids entre el antes y el después).
- Los tiradores de selección eran invisibles sobre fondos coral. Se cambiaron a azul `#3d5afe`.
- La barra contextual y los campos numéricos desbordaban en pantallas angostas. Ahora hacen wrap.
- El bundle inicial pesaba 1,1 MB. pdf-lib se carga solo al exportar y el bundle inicial bajó a 701 KB.

**Limitaciones conocidas:**
- PostgreSQL no se probó en vivo porque no está instalado. `PgRepo` está implementado, pero solo el modo archivos tiene pruebas.
- La colaboración aplica los parches en orden de llegada, sin OT ni CRDT. Si un parche no aplica, se pide un `resync` del documento completo.
- No hay grupos, recorte de imágenes ni efectos de texto (ver la etapa 12 en `PLAN_DESARROLLO.md`).

### Bloqueos
- Ninguno para seguir. Para validar PostgreSQL hay que instalarlo (o Docker) y definir `DATABASE_URL`.

## 2026-10-27 — Etapa 12: panel Elementos completo
Pedido: entrar a cada categoría del panel Elementos de Canva y replicarla.

**Observación** (informe #3 en `ANALISIS_CANVA.md` §13): se recorrieron las 14 categorías con la cuenta de prueba; se insertaron y borraron un gráfico, una tabla y una ilustración para ver sus controles. No se descargó ningún recurso de Canva.

**Implementado** (todo con recursos propios):
- Modelo: tipos `graphic`, `chart`, `table`, `frame`, `grid`, `solid`, `video`, `form`; formas como biblioteca de trazados; `animation` en todos los elementos; pistas de audio en el documento.
- Motor de fórmulas en `packages/shared/src/formula.ts`.
- API: banco de medios (`/api/media/search`, `/api/media/import`) con Openverse y respaldo en Wikimedia Commons, subida de video y audio, respuestas de formularios (`/api/designs/:id/forms/:formId/responses`, archivos o tabla `form_responses`).
- Web: panel Elementos con categorías y búsqueda, paneles de datos de gráfico y formulario, controles contextuales por tipo, edición de celdas, relleno de marcos y cuadrículas (soltando o con el marco seleccionado), modo Presentar.
- `iniciar.bat` en la raíz para levantar todo y abrir el navegador.

**Verificación:**
- Unitarias: 14 en `shared` (fórmulas, fábricas, cuadrículas), 42 en `web` (formas, ilustraciones, escala de gráficos, CSV, celdas, relleno de marcos), 16 en `api` (medios simulados con respaldo, video/audio, formularios).
- E2E: 15 (8 anteriores + 7 nuevas por categoría).
- En el navegador: cada categoría insertada y revisada; animaciones medidas en Konva; video reproduciéndose en el lienzo y en Presentar; formulario enviado desde Presentar; exportación de 9 páginas a 1080×1080 sin errores de canvas.

**Problemas encontrados y resueltos:**
- Los objetos 3D salían casi negros: el signo de la luz difusa estaba invertido.
- El eje de los gráficos cortaba las etiquetas ("18,75") y usaba pasos poco legibles: ahora escala 1-2-2,5-5 sin cortes.
- El panel de Audio entraba en un bucle de renderizado: el selector creaba un `[]` nuevo en cada lectura.
- El ícono de "play" del video no desaparecía al reproducir.
- En Presentar, las flechas dejaban de funcionar después de tocar el formulario.
- Openverse sin credenciales limita a 20 resultados por página y a menudo no responde a consultas nuevas: se agregó caché, tiempo de espera de 5 s y respaldo en Wikimedia Commons; la importación reutiliza los datos de la búsqueda.
- Cada mockup volvía a subir la misma imagen de página: ahora se cachea por versión de la página.

**Limitaciones:**
- Fotos y audio dependen de servicios externos (Openverse/Commons) y no funcionan en modo local sin servidor.
- Las animaciones y el video no se exportan como GIF/MP4; la exportación a imagen toma un cuadro estático.
- La edición de celdas no aplica estilos por celda (el estilo es por tabla).

## 2026-10-27 — Etapa 13: galería de plantillas
Pedido: entrar a cada categoría de la sección Plantillas y "copiar" plantillas.

**Alcance acordado:** se replican la organización y los formatos de la galería. Los diseños de Canva son obras protegidas, así que no se copian: cada categoría recibe plantillas originales.

**Observación** (informe #4 en `ANALISIS_CANVA.md` §14): 23 categorías públicas. El tamaño y la orientación se leyeron de los atributos `Dimensions` y `Orientation` de 3 plantillas por categoría, sin abrir su contenido.

**Implementado:**
- `templates/kit.ts`: constructores con posiciones relativas a la página y tamaños en "u".
- `templates/catalog.ts`: 24 categorías con su tamaño (las medidas en papel se convierten a 96 ppp) y 43 plantillas originales. Usan los elementos nuevos: marcos para fotos, cuadrículas, gráficos, tablas con fórmulas (factura y calendario), formularios, objetos 3D y animaciones.
- `templates/TemplateGallery.tsx`: galería con búsqueda sin tildes, filtros por categoría y miniaturas que se dibujan solo al entrar en pantalla.
- Inicio usa la galería. El editor tiene **Plantillas** en el riel, que abre en "Este formato".
- `applyTemplate` en el store: reemplaza la página vacía o agrega las páginas a continuación, escala con proporción y centra las de otro tamaño. Se deshace en un paso.
- Nuevas tipografías libres: Montserrat, Bebas Neue y DM Serif Display.

**Verificación:**
- Unitarias web: 87, entre ellas una por plantilla (documento válido e ids únicos), tamaño por categoría, búsqueda, total de la factura (951.060) y aplicación con escalado.
- E2E: 17, con 2 nuevas para la galería y el panel.
- En el navegador: se recorrió el catálogo completo, se aplicaron plantillas del mismo tamaño y de otro.

**Problemas encontrados y resueltos:**
- Las miniaturas usaban una fuente de reemplazo: el navegador no descarga fuentes web pedidas solo desde canvas. Ahora se precargan y los lienzos se redibujan al terminar (`canvas/fonts.ts`).
- Las plantillas con formulario daban NaN: el contexto del kit no exponía `width` y `height` a las fábricas.
- En la remera ilustrada el texto se superponía con la ilustración.

## 2026-10-27 — Etapa 14: tipos de diseño
Pedido: replicar los accesos de "¿Qué vamos a diseñar hoy?" (por ejemplo, Doc como un editor tipo Word) analizando y copiando uno a uno.

**Observación** (informe #5 en `ANALISIS_CANVA.md` §15): con la cuenta de prueba se abrió cada tipo, se probó el menú "/" del Doc, la tabla, la nota adhesiva y su "+", fórmulas en la hoja, el diálogo Crear un diseño y la línea de tiempo del video. No se publicó, envió ni descargó nada de Canva. Las cookies no esenciales se rechazaron.

**Implementado:**
- Modelo: `kind` en el documento, `blocks` (Doc y Correo), `sheet`, duración de escena, elementos `sticky` y `draw`, filtros de imagen y `published`.
- Fábricas por tipo en `packages/shared/src/kinds.ts`. El título automático también usa bloques, celdas y notas.
- Inicio: barra de 12 accesos y diálogo "Crear un diseño".
- Editores:
  - `docs/` (Doc y Correo, con saneador de HTML y exportaciones).
  - `sheets/` (hoja de cálculo).
  - `whiteboard/` (pizarra).
  - `video/` (línea de tiempo y grabación).
  - `SiteView` (sitio publicado).
  - `editor/PhotoPanel` (Editar foto).
- La API crea por tipo y lista el tipo.

**Verificación:**
- Unitarias: 18 en `shared`, 100 en `web` y 18 en `api`.
- E2E: 22, con 5 nuevas para Doc, Hoja, Pizarra, Sitio web y tamaño en mm.
- En el navegador: cada tipo creado y usado.
  - Doc: escritura, listas, "/" y tabla.
  - Correo: HTML de 600 px.
  - Hoja: fórmulas, #CICLO, rango y moneda.
  - Pizarra: notas, "+" y dibujo.
  - Sitio: publicación y visor.
  - Video: reproducción automática y WebM con las 3 escenas, comprobado por color de píxel.
  - Foto: filtro Vintage.

**Problemas encontrados y resueltos:**
- Hoja: se perdían las teclas al empezar a escribir rápido (el campo se montaba tarde). Ahora hay un campo único siempre enfocado.
- Hoja: los encabezados de columna salían en diagonal por un `position: sticky` mal combinado.
- Pizarra: el texto de una nota recién creada se perdía porque el mousedown le quitaba el foco al editor.
- Video: el WebM salía vacío; una pista de audio muda dejaba al grabador esperando.
- Video: después salía en negro porque la referencia de React no era el stage de Konva.
- Video: la grabación se congelaba con la pestaña en segundo plano. Ahora usa un temporizador.
- Exportación: viñetas y lista de control se fusionaban en una sola lista.
- Identificador de prueba duplicado en "Personalizar".
- Puertos de E2E configurables (`E2E_API_PORT`, `E2E_WEB_PORT`) para no chocar con otro `npm run dev`.

**Limitaciones:**
- Diseño interactivo y Capas Mágicas (IA) quedaron fuera.
- El Doc no tiene paginación visual (es continuo, como "Doc digital"). El salto de página aplica al imprimir.
- La hoja no tiene relleno automático, filtros por columna ni varias hojas.
- El video se exporta en WebM, no en MP4.
