import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { buildApp } from './app';
import { createRepo } from './repo';
import { Updater } from './updater';

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

const port = Number(process.env.PORT ?? 4000);
const repo = await createRepo({ databaseUrl: process.env.DATABASE_URL, dataDir: process.env.DATA_DIR ?? here('../data') });
const webDist = here('../../web/dist');
const app = await buildApp({
  repo,
  uploadsDir: process.env.UPLOADS_DIR ?? here('../uploads'),
  webDist: process.env.SERVE_WEB === '1' && existsSync(webDist) ? webDist : undefined,
  updater: process.env.DISABLE_UPDATES === '1' ? undefined : new Updater(here('../../..')),
  logger: true,
});

await app.listen({ port, host: process.env.HOST ?? '127.0.0.1' });
app.log.info(`Banva API en http://localhost:${port} (almacenamiento: ${repo.kind})`);

const shutdown = async () => {
  await app.close();
  await repo.close();
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
