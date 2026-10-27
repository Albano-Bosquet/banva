import { app, BrowserWindow, shell, type WebContents } from 'electron';
import { createServer } from 'node:net';
import { join } from 'node:path';
import { buildApp } from '../../api/src/app';
import { createRepo } from '../../api/src/repo';
import { Updater } from '../../api/src/updater';
import { ReleaseUpdater } from './releaseUpdater';

/**
 * Banva de escritorio: la misma API (Fastify) corre dentro del proceso principal y sirve
 * el frontend ya compilado; la ventana es un navegador apuntando a ese servidor local.
 * Los diseños y archivos subidos se guardan en %APPDATA%\Banva.
 */

/** Puerto fijo: el origen (y con él el localStorage del navegador) no cambia entre sesiones. */
const PREFERRED_PORT = 47821;
const GITHUB = { owner: 'Albano-Bosquet', repo: 'banva' };

if (!app.requestSingleInstanceLock()) app.quit();

let win: BrowserWindow | null = null;
let origin = '';
let stop: (() => Promise<void>) | null = null;

function portFree(port: number) {
  return new Promise<boolean>((ok) => {
    const s = createServer()
      .once('error', () => ok(false))
      .once('listening', () => s.close(() => ok(true)))
      .listen(port, '127.0.0.1');
  });
}

async function startServer() {
  const userData = app.getPath('userData');
  const repo = await createRepo({ databaseUrl: process.env.DATABASE_URL, dataDir: join(userData, 'data') });
  const server = await buildApp({
    repo,
    uploadsDir: join(userData, 'uploads'),
    webDist: app.isPackaged ? join(process.resourcesPath, 'web') : join(__dirname, '../../web/dist'),
    // Instalado: versiones nuevas desde GitHub Releases. Desde el código fuente: git, como `npm run dev`.
    updater: app.isPackaged ? new ReleaseUpdater(GITHUB) : new Updater(join(__dirname, '../../..')),
  });
  const port = (await portFree(PREFERRED_PORT)) ? PREFERRED_PORT : 0;
  await server.listen({ port, host: '127.0.0.1' });
  const addr = server.server.address();
  origin = `http://127.0.0.1:${typeof addr === 'object' && addr ? addr.port : port}`;
  stop = async () => {
    await server.close();
    await repo.close();
  };
}

const isOwn = (url: string) => url.startsWith(`${origin}/`) || url === origin || url.startsWith('blob:');

/** Enlaces externos (atribuciones, ayuda) se abren en el navegador del sistema. */
function guard(contents: WebContents) {
  contents.setWindowOpenHandler(({ url }) => {
    if (isOwn(url)) return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true, icon: iconPath() } };
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
  contents.on('will-navigate', (e, url) => {
    if (isOwn(url)) return;
    e.preventDefault();
    if (/^https?:/.test(url)) void shell.openExternal(url);
  });
}

const iconPath = () => join(__dirname, '../build/icon.png');

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'Banva',
    icon: iconPath(),
    backgroundColor: '#f2f6f1',
    autoHideMenuBar: true,
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  win.maximize();
  win.once('ready-to-show', () => win?.show());
  win.on('closed', () => (win = null));
  void win.loadURL(`${origin}/#/`);
}

app.on('web-contents-created', (_e, contents) => guard(contents));

app.on('second-instance', () => {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.focus();
});

app.whenReady().then(async () => {
  await startServer();
  createWindow();
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow());
});

app.on('window-all-closed', () => app.quit());

let stopping = false;
app.on('before-quit', (e) => {
  if (stopping || !stop) return;
  // Se cierra el servidor (y se guardan las salas de colaboración abiertas) antes de salir.
  e.preventDefault();
  stopping = true;
  void stop().finally(() => app.quit());
});
