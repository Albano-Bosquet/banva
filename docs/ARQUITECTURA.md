# Arquitectura propuesta

Basada en los hallazgos de `ANALISIS_CANVA.md`. Código e identidad visual 100 % propios.

## Decisiones clave

| Tema | Lo observado en Canva | Nuestra decisión | Motivo |
|---|---|---|---|
| Render | DOM + SVG escalado por CSS (§8) | **Konva.js** (canvas 2D) | Hit-testing, Transformer y export a PNG/JPG integrados; menos trabajo para un MVP. El costo es la edición de texto, que se resuelve con un `<textarea>` superpuesto durante la edición. |
| Coordenadas | Unidades de diseño (px de la página) + `scale()` para el zoom | Igual: el modelo guarda px de diseño y el `Stage` aplica la escala | Exportación y precisión independientes del zoom |
| Estado | MobX | **Zustand + Immer** (`produceWithPatches`) | Los parches de Immer resuelven a la vez el historial y la sincronización |
| Cambios | Deltas por operación vía WS; deshacer = nueva operación (§10) | Cada acción produce `patches` + `inversePatches`; deshacer aplica los inversos como una operación nueva | Mismo modelo para la persistencia y la colaboración futura |
| Persistencia | WS `/_stream` + documento incrustado en el HTML | **Fase 1:** REST `PUT /api/designs/:id` con debounce (snapshot). **Fase 2:** WS con log de operaciones y revisión | Empezar simple y llegar al modelo delta |
| Backend | RPC `/_ajax/<svc>/<método>` | **Fastify + Zod** (contratos compartidos en `packages/shared`) | Validación tipada en ambos extremos |
| BD | — (no observable) | **PostgreSQL**: `designs(id, title, width, height, doc jsonb, revision, updated_at)` + `design_ops(design_id, rev, ops jsonb)` | `jsonb` para el snapshot y una tabla de operaciones para la fase 2 |
| Export | Servidor (inferido), muchos formatos | Cliente: `stage.toDataURL` para PNG/JPG; **pdf-lib** para PDF (una página por hoja) | Sin infraestructura de render en el servidor |

## Modelo de documento

```ts
type Design = { id: string; title: string; width: number; height: number; pages: Page[]; revision: number };
type Page   = { id: string; title?: string; background: string; elements: Element[] }; // orden = z (0 = fondo)
type Base   = { id: string; x: number; y: number; width: number; height: number; rotation: number;
                opacity: number; locked: boolean; visible: boolean; name?: string };
type Element =
  | Base & { type: 'text';  text: string; fontFamily: string; fontSize: number; fill: string; align: 'left'|'center'|'right'; fontStyle: string; lineHeight: number }
  | Base & { type: 'rect' | 'ellipse' | 'triangle' | 'line'; fill: string; stroke: string; strokeWidth: number; cornerRadius?: number }
  | Base & { type: 'image'; src: string; crop?: { x: number; y: number; width: number; height: number } };
```

## Implementación real (2026-10-27)

Diferencias respecto del plan inicial y detalles concretos:

- **Modelo** (`packages/shared/src/schema.ts`): los elementos son `text | shape (rect, ellipse, triangle, star, line) | image`. El orden en `page.elements` es el orden Z (índice 0 = fondo).
- **Store** (`apps/web/src/store/editorStore.ts`):
  - `commit(label, recipe, { mergeKey, skipHistory })` produce `patches` e `inversePatches`.
  - Las entradas con la misma `mergeKey` en menos de 800 ms se fusionan (flechas, sliders, campos numéricos).
  - `onDocChange` publica cada cambio con su origen (`local | undo | redo | remote`).
- **Altura del texto**: el lienzo registra un medidor (`setTextMeasurer`) basado en `Konva.Text`. Cada commit recalcula la altura guardada para que alineación, guías y exportación coincidan con lo dibujado.
- **Lienzo**:
  - Un `Stage` por página, apiladas en vertical.
  - Cada elemento es un `Group` en (x, y) con rotación. El `Transformer` escala el grupo y al soltar la escala se convierte en width/height; en el texto, las esquinas escalan la tipografía.
  - Las guías magnéticas se calculan en `lib/geometry.ts` (`computeSnap`, umbral de 6 px de pantalla).
- **Sincronización** (`apps/web/src/sync/session.ts`) usa `/ws`:
  - `join` → `welcome`.
  - `patch` → `ack` para el emisor y `patch` para los demás.
  - `resync` cuando un parche no aplica o hubo un `PUT` externo.
  - Si el socket cae, se guarda un snapshot con `PUT /api/designs/:id`.
  - Sin API, `backend.ts` usa localStorage.
- **Servidor** (`apps/api/src/collab.ts`): una sala por diseño con el documento en memoria. Persiste con un debounce de 400 ms y registra cada operación en `design_ops` (PostgreSQL).
- **Exportación** (`apps/web/src/export/exporter.ts`): `stage.toDataURL` con `pixelRatio = escala / zoom`, ocultando la capa de interfaz. El PDF lleva una hoja por página, con la imagen PNG incrustada mediante pdf-lib (que se carga de forma diferida).
- **API REST**: `GET/POST /api/designs`, `GET/PUT/DELETE /api/designs/:id`, `POST /api/designs/:id/duplicate`, `GET/PUT /api/designs/:id/thumbnail`, `GET/POST /api/uploads`, `GET /api/health`, y el WebSocket en `/ws`.

## Estructura del repositorio

```
apps/web      React 19 + Vite + TS + Zustand + Konva (react-konva)
apps/api      Fastify + Zod + pg
packages/shared  tipos y esquemas Zod del documento
docs/         estos documentos
```

## Componentes del frontend

`EditorShell` (barra superior · rail lateral · panel lateral · lienzo · barra inferior) → `CanvasStage` (Stage, una `Layer` por página, `Transformer`, guías) → `PropertiesBar` contextual → `PositionPanel` (Organizar/Capas) → `PagesStrip`.

Los atajos de teclado, el portapapeles y el historial viven en el store, no en los componentes.
