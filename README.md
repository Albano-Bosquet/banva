<p align="center">
  <img src="apps/web/public/banva-logo.png" alt="Banva" width="120" />
</p>

# Banva

**Banva es una alternativa gratis y open source a Canva.** Diseñá presentaciones, posts para redes, videos, documentos, pizarras, hojas de cálculo, sitios web y correos desde el navegador, sin cuentas ni suscripciones, y con tus datos en tu propio servidor.

Está inspirado en las capacidades de Canva (ver `docs/ANALISIS_CANVA.md`), pero el código, los iconos, la paleta y las plantillas son originales: no se usa código ni recursos de Canva. Banva no está afiliado a Canva.

Publicado bajo la [licencia MIT](LICENSE).

## Descargar

Para usar Banva no hace falta instalar nada más: bajá **`Banva-Setup-<versión>.exe`** de la [última versión](https://github.com/Albano-Bosquet/banva/releases/latest), ejecutalo y listo. Se instala para tu usuario (sin permisos de administrador), crea accesos directos y abre Banva.

- Tus diseños y archivos se guardan en `%APPDATA%\Banva`.
- El botón **Actualizar** del Inicio avisa cuando hay una versión nueva, muestra qué cambió y la instala sola.
- Windows puede mostrar "Windows protegió su PC" porque el instalador no está firmado: tocá **Más información → Ejecutar de todas formas**.

## Desarrollo

### Requisitos

- Node.js 20+ (probado con 24.21)
- Opcional: PostgreSQL 14+ (sin él, la API guarda en archivos JSON en `apps/api/data/`)
- Opcional para E2E: Google Chrome instalado (Playwright usa `channel: 'chrome'`)

## Uso

En Windows: doble clic en `iniciar.bat` (instala dependencias la primera vez, levanta API y web y abre el navegador).

O desde una terminal:

```bash
npm install
npm run dev
```

- Web: http://localhost:5173 (Vite, con proxy de `/api`, `/uploads` y `/ws` hacia la API)
- API: http://localhost:4000 (Fastify)

Si la API no está corriendo, la web pasa sola a **modo local**: guarda los diseños en `localStorage` y no tiene colaboración, banco de fotos/audio ni respuestas de formularios en el servidor.

- **Tipos de diseño** (barra del Inicio): Presentación, Redes, Video, Imprimir, **Doc** (editor tipo Word con menú "/", exporta PDF/Word/HTML/Markdown), **Pizarra**, **Hoja de cálculo**, **Sitio web** (publicación en `#/w/<id>`), **Correo** (HTML para Gmail/Mailchimp), **Editar foto**, Personalizar (px/mm/cm/in) y Subir.
- **Plantillas**: 43 plantillas originales en 24 formatos (posts, historias, presentaciones, flyers, carteles, logos, currículums, facturas, invitaciones, certificados, calendarios, sitios web y más), en Inicio y en el panel del editor.
- **Elementos**: formas, ilustraciones, animaciones, fotos, videos, audio, gráficos, formularios, hojas de cálculo, tablas, marcos, cuadrículas, mockups y 3D.
- **Presentar** (`#/v/<id>`): pantalla completa con animaciones, video, audio y formularios que guardan respuestas.
- Fotos y audio se buscan en Openverse (con respaldo en Wikimedia Commons) y se guardan en el servidor con su atribución.

### Actualizar desde GitHub

En el Inicio, el botón **Actualizar** revisa cada 10 segundos si hay commits nuevos en GitHub. Cuando los hay, se habilita y muestra los cambios (mensajes de los commits y archivos nuevos, modificados o eliminados). Al tocarlo, la API hace `git merge --ff-only` con la rama remota. Si cambiaron `package.json` o `package-lock.json`, corre `npm install`, y después la página se recarga con el código nuevo.

- Nunca pisa trabajo local: si tus cambios chocan con los de GitHub, la actualización se cancela y lo avisa.
- Solo funciona desde la computadora donde corre Banva (pedidos desde `127.0.0.1`). Para desactivarlo: `DISABLE_UPDATES=1`.

En la app de escritorio, el mismo botón busca en [GitHub Releases](https://github.com/Albano-Bosquet/banva/releases): si hay una versión más nueva, muestra los commits y archivos entre las dos versiones, descarga el instalador y reinicia Banva para instalarlo.

### App de escritorio (Electron)

`apps/desktop` empaqueta todo en un `.exe`: la API corre dentro de la app y sirve la web ya compilada en `http://127.0.0.1:47821`.

```bash
npm run desktop        # compila la web y abre la app de escritorio
npm run desktop:dist   # genera apps/desktop/release/Banva-Setup-<versión>.exe y latest.yml
```

Para publicar una versión nueva: subí `version` en `apps/desktop/package.json`, generá el instalador y creá un release `v<versión>` en GitHub con `Banva-Setup-<versión>.exe`, su `.blockmap` y `latest.yml`. Las apps instaladas lo detectan desde el botón **Actualizar**.

### Con PostgreSQL

```bash
DATABASE_URL=postgres://usuario:clave@localhost:5432/trazo npm run dev:api
```

El esquema (`apps/api/sql/001_init.sql`) se aplica al arrancar.

### Producción

```bash
npm run build
SERVE_WEB=1 npm run start -w @trazo/api   # sirve apps/web/dist y la API en el puerto 4000
```

## Pruebas

```bash
npm test          # unitarias: modelo, store, geometría, plantillas, modo local, API + WebSocket
npm run test:e2e  # Playwright: levanta API (4100) y web (5174) con datos temporales
                  # (otros puertos: E2E_API_PORT=4110 E2E_WEB_PORT=5184 npm run test:e2e)
npm run typecheck
```

## Estructura

```
packages/shared   modelo del documento (Zod), fábricas de elementos, protocolo WS
apps/web          React 19 + Vite + Zustand/Immer + Konva (react-konva) + pdf-lib
apps/api          Fastify 5 + WebSocket + PostgreSQL/archivos
apps/desktop      Electron + electron-builder (instalador NSIS) + electron-updater
docs/             análisis, arquitectura, funcionalidades, plan y progreso
```

## Atajos

| Atajo | Acción |
|---|---|
| T / R / C / L | Texto / rectángulo / círculo / línea |
| Doble clic o Enter | Editar texto |
| Supr / Retroceso | Eliminar |
| Ctrl+Z / Ctrl+Y (Ctrl+Shift+Z) | Deshacer / rehacer |
| Ctrl+C / X / V / D | Copiar / cortar / pegar / duplicar |
| Ctrl+A | Seleccionar todo en la página |
| Flechas (Shift = ×10) | Mover 1 px (10 px) |
| Ctrl+B / I / U | Negrita / cursiva / subrayado |
| Ctrl + rueda, Ctrl + / − | Zoom |
| Shift/Ctrl + clic, arrastre en el fondo | Selección múltiple |
