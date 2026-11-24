/** `npm run db:migrate`: applies the SQL migrations in ./drizzle to DATABASE_URL (or the embedded database). */
import { loadConfig, loadEnvFile } from '../config.js';
import { createDatabase } from './client.js';

loadEnvFile();
const config = loadConfig();
const database = createDatabase({ url: config.DATABASE_URL, pgliteDir: config.PGLITE_DIR });
await database.migrate();
await database.close();
console.log(`Migrations applied (${database.kind}).`);
