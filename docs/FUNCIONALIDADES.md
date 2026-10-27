# Funcionalidades

Leyenda: ✅ implementada y con prueba · ☑️ implementada, verificada a mano · 🔲 pendiente · 👁 observada en Canva (ver ANALISIS_CANVA.md)

| Funcionalidad | Canva | Trazo | Prueba |
|---|---|---|---|
| Crear diseño con tamaño preestablecido o personalizado | 👁 §7 | ✅ | E2E `crear diseño…` |
| Galería de plantillas: 43 originales en 24 categorías con los tamaños observados, búsqueda y filtros | 👁 §14 | ✅ | unit `catálogo` (una prueba por plantilla), E2E `templates.spec` |
| Panel Plantillas en el editor: "Este formato", aplicar en la página vacía o a continuación, escalado a otro tamaño | 👁 §14 | ✅ | unit `aplicar plantillas`, E2E |
| Inicio con lista de diseños, miniaturas, duplicar, eliminar | 👁 | ✅ | API `crea, lista…`, `miniaturas` |
| Insertar texto (centrado, en edición, 3 estilos + combinaciones) | 👁 §9 | ✅ | E2E texto |
| Edición de texto en el lugar (doble clic / Enter) | 👁 §8 | ✅ | E2E texto |
| Formas: rectángulo, redondeado, círculo, triángulo, estrella, línea, contorno | 👁 §9 | ✅ | E2E formas |
| Inserción centrada con el 30 % del lado | 👁 §8 | ✅ | unit `factory` |
| Imágenes: subir (botón, arrastrar y soltar, pegar), galería de subidas | pendiente de observar | ✅ | API `subidas`, ☑️ UI |
| Mover (arrastre y flechas), selección múltiple, recuadro | 👁 §9 | ✅ | E2E arrastre, unit `nudge` |
| Redimensionar (8 tiradores; texto: esquinas escalan la letra) y rotar (ajuste cada 45°) | 👁 §8 | ☑️ | verificado en el navegador |
| Guías magnéticas: bordes y centro de la página y de otros elementos | no observado | ✅ | unit `computeSnap`, E2E arrastre |
| Barra contextual por tipo (tipografía, tamaño, color, B/I/U, alineación, interlineado, espaciado, relleno, borde, esquinas, opacidad) | 👁 §8 | ☑️ | unit `updateElements` |
| Panel Posición: orden Z, alinear a la página o entre elementos, X/Y/W/H/rotación | 👁 §9 | ✅ | unit capas, E2E Posición |
| Panel Capas: reordenar arrastrando, ocultar, bloquear; fondo fijo | 👁 §9 | ✅ | unit `moveLayer`, E2E |
| Bloqueo (impide mover, transformar y eliminar) | 👁 §8 | ✅ | unit, E2E |
| Varias páginas apiladas con título; agregar, duplicar, mover, eliminar | 👁 §9 | ✅ | unit páginas, E2E páginas |
| Fondo de página | 👁 | ☑️ | |
| Deshacer/rehacer con fusión de cambios continuos; se sincroniza como operación nueva | 👁 §10 | ✅ | unit historial |
| Título automático desde el primer texto | 👁 §9 | ✅ | unit |
| Autoguardado + indicador de estado | 👁 §10 | ✅ | E2E `save-status` |
| Guardado por deltas (parches) vía WebSocket, snapshot HTTP como respaldo | 👁 §10 | ✅ | API WS |
| Colaboración en tiempo real + presencia (avatares) | inferido §10 | ✅ | API WS, E2E dos pestañas |
| Modo local sin servidor (localStorage) | — | ✅ | unit `backend.test` |
| Redimensionar el diseño (con o sin escalar el contenido) | 👁 (Redimensionar) | ✅ | unit `resizeDesign` |
| Zoom: deslizador, Ctrl+rueda, ajustar a la ventana | 👁 §9 | ☑️ | |
| Exportar PNG (fondo transparente opcional), JPG, PDF multipágina; escala ×0,5–×3; todas o una página | 👁 §9 | ✅ | E2E descarga; tamaños verificados (1080×1080) |
| Persistencia PostgreSQL | — | 🔲 sin verificar | Implementada (`PgRepo`); no hay PostgreSQL instalado en esta máquina |

## Panel Elementos (informe #3, ANALISIS_CANVA.md §13)

| Categoría | Canva | Trazo | Prueba |
|---|---|---|---|
| Panel con 14 categorías y búsqueda | 👁 §13 | ✅ | E2E `14 categorías y busca` |
| Formas: 55 en 8 secciones (líneas de guiones/puntos/flechas, polígonos, estrellas, flechas, diagrama de flujo, globos, decorativas) | 👁 | ✅ | unit `biblioteca de formas`, E2E |
| Ilustraciones, degradados e íconos SVG propios con una muestra de color por cada color | 👁 | ✅ | unit `ilustraciones`, E2E `cambiar un color` |
| Animaciones: stickers animados + animación de cualquier elemento (entrada: aparecer, elevar, saltar, deslizar; bucle: latir, girar, rebotar, balancear) | 👁 | ✅ | E2E; ☑️ medido en Konva |
| Fotos: búsqueda en Openverse con respaldo en Wikimedia Commons; se importan al servidor con atribución | 👁 (banco propio) | ✅ | API `banco de medios` (simulado); ☑️ búsqueda real |
| Videos: subir MP4/WebM, reproducir en el lienzo, sonido/repetir, autoplay en Presentar | 👁 | ☑️ | API `acepta video y audio` |
| Audio: pistas del diseño (Openverse/Commons o subidas), volumen, reproducción en Presentar | 👁 | ☑️ | API |
| Gráficos: barras, horizontales, apiladas, líneas, área, torta, anillo; panel Datos (grilla, filas, series, pegar CSV) y Personalizar (leyenda, etiquetas, grilla, título, tipografía) | 👁 §13 | ✅ | unit `gráficos`, E2E `editar datos` |
| Tablas: 15 estilos, edición por celda con doble clic (Tab/Enter navegan), filas/columnas, encabezado, bandas, bordes | 👁 §13 | ✅ | E2E |
| Hojas de cálculo: 6 plantillas con fórmulas (=SUMA, PROMEDIO, MIN, MAX, CONTAR, REDONDEAR, referencias, rangos, + − × ÷ ^) | 👁 | ✅ | unit `fórmulas` (shared), E2E `recalcula` |
| Marcos: 15 máscaras + foto instantánea, película, póster y dispositivos; zoom y encuadre | 👁 | ✅ | unit `rellenar marcos`, E2E `marcos` |
| Cuadrículas: 15 distribuciones a página completa, separación, esquinas, imagen por celda | 👁 | ✅ | unit, E2E |
| Mockups: teléfono, tablet, laptop, monitor, remera, taza, póster, polaroid; se pueden rellenar con una página del diseño | 👁 | ✅ | E2E |
| 3D: cubo, pirámide, prisma, cilindro, cono, esfera, anillo, gema; color, giro, inclinación, giro animado | 👁 | ✅ | E2E |
| Formularios: boletín, contacto, confirmación, valoración, pregunta; edición de campos; respuestas guardadas en el servidor | 👁 | ✅ | API `formularios`, E2E |
| Modo Presentar (`#/v/<id>`): páginas a pantalla completa, entradas animadas, video, audio, formularios interactivos | inferido | ✅ | E2E `formularios` |

## Pendientes

| Funcionalidad | Notas |
|---|---|
| Agrupar / desagrupar | El modelo no tiene grupos aún |
| Recorte de imágenes, filtros, efectos de texto (sombra, contorno) | |
| Estilos por carácter dentro de un texto | Hoy el estilo es por elemento |
| Guías de espaciado equitativo, reglas y cuadrícula | |
| Cursores remotos | El protocolo ya tiene el mensaje `cursor`; falta dibujarlo |
| Resolución de conflictos (OT/CRDT) | Hoy el servidor aplica en orden de llegada y pide `resync` si un parche no aplica |
| Cuentas de usuario y permisos | Fuera de alcance del MVP |
| Exportar SVG, MP4/GIF, PPTX | Las animaciones y el video se ven en Presentar; la exportación a imagen toma un cuadro estático |
| Quitafondos, borrador, IA de voz | Observados en Canva; fuera de alcance |

## Tipos de diseño (informe #5, ANALISIS_CANVA.md §15)

| Tipo | Canva | Trazo | Prueba |
|---|---|---|---|
| Barra "¿Qué vas a diseñar hoy?" y diálogo Crear un diseño (redes, video, imprimir, tamaño en px/mm/cm/in) | 👁 §15 | ✅ | E2E `tamaño personalizado en milímetros` |
| **Doc**: bloques editables (títulos, cuerpo, listas con viñetas/numeradas/de control, cita, destacado, divisor, salto de página, tabla, 2 columnas, imagen, gráfico, botón), menú "/", atajos Markdown y Ctrl+Alt+0–3, formato en línea (negrita, cursiva, subrayado, tachado, color, resaltado, enlace), alineación, esquema, contador de palabras, zoom; descarga PDF, Word (.doc), HTML y Markdown | 👁 §15 | ✅ | unit `operaciones de bloques`, `exportación`, `saneador`; E2E `Doc` |
| **Correo**: el mismo editor a 600 px; exporta HTML con tablas y estilos en línea, copiar HTML y vista previa | 👁 §15 | ✅ | unit `exportación`; ☑️ navegador |
| **Hoja de cálculo**: grilla de 100 × 26 (ampliable), barra de fórmulas, funciones en español, referencia circular marcada, selección de rangos con suma, promedio y recuento, formato (negrita, cursiva, colores, alineación, número, moneda, porcentaje, decimales), ordenar, ancho de columnas, copiar y pegar con otras planillas, CSV | 👁 §15 | ✅ | unit `hoja de cálculo`; E2E `Hoja de cálculo` |
| **Pizarra**: superficie con fondo de puntos, paleta (seleccionar, sección, dibujo, rectángulo, círculo, flecha, nota adhesiva de 6 colores, texto, tabla), nota con autor, "+" para notas contiguas, dibujo a mano alzada | 👁 §15 | ✅ | unit `pizarra`; E2E `Pizarra` |
| **Sitio web**: secciones, vista previa y publicación interna (`#/w/<id>`), formularios y videos activos en el sitio | 👁 §15 | ✅ | E2E `Sitio web` |
| **Video**: escenas con duración (campo o arrastre), línea de tiempo, pista de audio, reproducción automática y exportación WebM (grabación con animaciones, video y audio) | 👁 §15 | ☑️ | verificado en navegador (WebM 1920 × 1080 con las 3 escenas) |
| **Editar foto**: filtros predefinidos, brillo, contraste, saturación, desenfoque, B/N, sepia, invertir y voltear (no destructivos) | 👁 §15 (Fotos) | ☑️ | verificado en navegador |
| Diseño interactivo, Capas Mágicas, voz con IA | 👁 (IA) | 🔲 | Fuera de alcance: dependen de IA generativa |
| Enviar correo de prueba, publicar en dominio propio | 👁 | 🔲 | Requieren servicios externos; se ofrece copiar/descargar HTML y enlace interno |
