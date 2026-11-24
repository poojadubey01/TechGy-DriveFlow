import { buildApp } from './app.js';
import { loadConfig, loadEnvFile } from './config.js';
import { createDatabase } from './db/client.js';
import { startAutoSync } from './services/autosync.js';

loadEnvFile();
const config = loadConfig();
const database = createDatabase({ url: config.DATABASE_URL, pgliteDir: config.PGLITE_DIR });
await database.migrate();

const app = await buildApp({ config, database });
if (config.DEV_MOCKS) app.log.warn('DEV_MOCKS is on: mock Google sign-in, sample Drive and /dev/outbox are enabled. Never use this in production.');
if (!config.DATABASE_URL) app.log.info(`Using the embedded database in ${config.PGLITE_DIR}`);

await app.listen({ host: config.HOST, port: config.PORT });
const stopAutoSync = startAutoSync(app.ctx, config.SYNC_INTERVAL_MINUTES, app.log);

const shutdown = async (signal: string) => {
  app.log.info(`${signal} received, shutting down`);
  stopAutoSync();
  await app.close();
  await database.close();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
