// Empaqueta el proceso principal (Electron + API + dependencias) en un solo archivo CommonJS.
import { build } from 'esbuild';
import { cpSync } from 'node:fs';

await build({
  entryPoints: ['src/main.ts'],
  outfile: 'dist/main.cjs',
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node22',
  sourcemap: 'linked',
  // pg-native es opcional en pg; electron lo provee el runtime.
  external: ['electron', 'pg-native'],
  // repo.ts ubica el esquema SQL con import.meta.url, que en CommonJS no existe.
  define: { 'import.meta.url': 'importMetaUrl' },
  banner: { js: "const importMetaUrl = require('node:url').pathToFileURL(__filename).href;" },
  logLevel: 'info',
});

// El esquema de PostgreSQL queda junto al bundle (dist/../sql), como en apps/api.
cpSync('../api/sql', 'sql', { recursive: true });
