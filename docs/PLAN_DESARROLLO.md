# Plan de desarrollo

| Etapa | Contenido | Estado |
|---|---|---|
| 0 | Entorno + informe #1 (capa pública) | ✅ |
| 1 | Informe #2: editor con sesión (lienzo, red, guardado, export) | ✅ (quedan pendientes guías y descarga real en Canva) |
| 2 | Scaffold: monorepo npm workspaces (shared, web, api), Vitest, Playwright | ✅ |
| 3 | Interfaz principal: barra superior, riel, panel lateral, lienzo, barra inferior | ✅ |
| 4 | Lienzo interactivo: zoom, selección (clic, Shift, recuadro), Transformer | ✅ |
| 5 | Objetos: texto, formas, imágenes | ✅ |
| 6 | Panel de propiedades contextual | ✅ |
| 7 | Capas: orden Z, reordenar arrastrando, bloqueo, visibilidad | ✅ |
| 8 | Deshacer/rehacer con parches de Immer | ✅ |
| 9 | Guardado/carga: Fastify + PostgreSQL/archivos, autoguardado | ✅ (PostgreSQL sin probar en vivo) |
| 10 | Exportación PNG/JPG/PDF | ✅ |
| 11 | Avanzado: guías magnéticas, multipágina, colaboración WS, plantillas, modo local | ✅ |
| 12 | Panel Elementos: 14 categorías (formas, ilustraciones, animaciones, fotos, videos, audio, gráficos, formularios, hojas de cálculo, tablas, marcos, cuadrículas, mockups, 3D) + modo Presentar | ✅ |
| 13 | Galería de plantillas por categoría (24 formatos, 43 plantillas originales) y panel Plantillas en el editor | ✅ |
| 14 | Tipos de diseño: Doc, Correo, Hoja de cálculo, Pizarra, Sitio web, Video (WebM) y Editar foto; barra y diálogo Crear un diseño | ✅ |
| 15 | Siguiente: grupos, cursores remotos, OT/CRDT, cuentas, carga diferida de editores (el bundle principal pesa 927 KB) | 🔲 |

## Prioridades sugeridas para la etapa 15

1. **Grupos**: requiere un nuevo tipo `group` con hijos y transformaciones anidadas.
2. **Cursores remotos**: el protocolo ya está; solo falta la capa de dibujo.
3. **Validar PostgreSQL** con una instancia real (`DATABASE_URL`) y agregar pruebas de `PgRepo`.
4. **Resolución de conflictos**: rebase de operaciones pendientes del cliente sobre las remotas, o pasar a Yjs.
5. **Efectos de texto y exportación animada (GIF/MP4).**
