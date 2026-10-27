import { defineConfig } from '@playwright/test';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// Servidores propios para las pruebas (puertos y datos aislados del entorno de desarrollo).
const dataDir = mkdtempSync(join(tmpdir(), 'trazo-e2e-'));
const API_PORT = Number(process.env.E2E_API_PORT ?? 4100);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5174);

export default defineConfig({
  testDir: './e2e',
  timeout: 30_000,
  fullyParallel: false,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    // Usa el Chrome instalado en el sistema (sin descargar navegadores).
    channel: process.env.PW_CHANNEL ?? 'chrome',
    viewport: { width: 1400, height: 900 },
    acceptDownloads: true,
  },
  webServer: [
    {
      command: 'npx tsx ../api/src/main.ts',
      port: API_PORT,
      env: { PORT: String(API_PORT), DATA_DIR: join(dataDir, 'data'), UPLOADS_DIR: join(dataDir, 'uploads') },
      reuseExistingServer: false,
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      port: WEB_PORT,
      env: { TRAZO_API: `http://localhost:${API_PORT}` },
      reuseExistingServer: false,
    },
  ],
});
