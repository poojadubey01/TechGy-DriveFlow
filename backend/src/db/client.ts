import { mkdirSync } from 'node:fs';
import path from 'node:path';

import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzlePg, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { migrate as migratePg } from 'drizzle-orm/node-postgres/migrator';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { migrate as migratePglite } from 'drizzle-orm/pglite/migrator';
import pg from 'pg';

import { BACKEND_ROOT } from '../config.js';
import * as schema from './schema.js';

/** The query API is the same for real Postgres and the embedded one, so the app codes against one type. */
export type Db = NodePgDatabase<typeof schema>;

export type Database = {
  db: Db;
  /** 'postgres' (DATABASE_URL) or 'pglite' (embedded, local). */
  kind: 'postgres' | 'pglite';
  migrate: () => Promise<void>;
  close: () => Promise<void>;
};

const MIGRATIONS = path.join(BACKEND_ROOT, 'drizzle');

export function createDatabase(opts: { url?: string; pgliteDir?: string }): Database {
  if (opts.url) {
    const pool = new pg.Pool({ connectionString: opts.url, max: 10 });
    const db = drizzlePg(pool, { schema });
    return {
      db,
      kind: 'postgres',
      migrate: () => migratePg(db, { migrationsFolder: MIGRATIONS }),
      close: () => pool.end(),
    };
  }
  const dir = opts.pgliteDir ?? 'memory';
  if (dir !== 'memory') mkdirSync(dir, { recursive: true });
  const client = dir === 'memory' ? new PGlite() : new PGlite(dir);
  const pgliteDb = drizzlePglite(client, { schema });
  return {
    db: pgliteDb as unknown as Db,
    kind: 'pglite',
    migrate: () => migratePglite(pgliteDb, { migrationsFolder: MIGRATIONS }),
    close: () => client.close(),
  };
}
