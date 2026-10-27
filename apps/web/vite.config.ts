import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const API = process.env.TRAZO_API ?? 'http://localhost:4000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': API,
      '/uploads': API,
      '/ws': { target: API.replace(/^http/, 'ws'), ws: true },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    // La versión de Konva para Node necesita el módulo nativo "canvas"; en jsdom alcanza la de navegador.
    alias: [{ find: /^konva$/, replacement: 'konva/lib/index.js' }],
    server: { deps: { inline: ['react-konva'] } },
  },
});
