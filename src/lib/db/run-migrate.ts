/**
 * Runs Drizzle migrations programmatically. Used on app startup and in Docker.
 * Does not import server-only so it can run in instrumentation and standalone.
 */
import { existsSync, readFileSync } from 'fs';
import path from 'path';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';
import { normalizeDatabaseUrl } from './connection-url';

export function resolveMigrationsFolder(): string {
  const envDir = process.env.DRIZZLE_MIGRATIONS_DIR;
  if (envDir) {
    const resolved = path.resolve(envDir);
    if (existsSync(resolved)) {
      return resolved;
    }
    console.warn('[migrate] DRIZZLE_MIGRATIONS_DIR is set but not found:', resolved);
  }

  const candidates = [
    path.join(process.cwd(), 'drizzle', 'migrations'),
    path.join(process.cwd(), 'admin_dashboard', 'drizzle', 'migrations'),
  ];

  for (const dir of candidates) {
    if (existsSync(path.join(dir, 'meta', '_journal.json'))) {
      return dir;
    }
  }

  const fallback = path.join(process.cwd(), 'drizzle', 'migrations');
  if (!existsSync(fallback)) {
    console.warn(
      '[migrate] No migrations folder found. Tried:',
      candidates.join(', '),
      '- using',
      fallback
    );
  }
  return fallback;
}

async function tableExists(client: postgres.Sql, name: string): Promise<boolean> {
  const rows = await client<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ${name}
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

async function endUsersColumnExists(
  client: postgres.Sql,
  columnName: string
): Promise<boolean> {
  const rows = await client<{ exists: boolean }[]>`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'end_users'
        AND column_name = ${columnName}
    ) AS "exists"
  `;
  return Boolean(rows[0]?.exists);
}

/**
 * Idempotent SQL from `0002_end_users_identifier_banned.sql`.
 * Runs when `migrate()` did not apply it (journal/hash drift, DB cloned from another line, etc.).
 */
async function applyEndUsersIdentifierBannedPatch(client: postgres.Sql): Promise<void> {
  if (!(await tableExists(client, 'end_users'))) {
    return;
  }
  if (await endUsersColumnExists(client, 'identifier')) {
    return;
  }
  const migrationsFolder = resolveMigrationsFolder();
  const patchPath = path.join(migrationsFolder, '0002_end_users_identifier_banned.sql');
  if (!existsSync(patchPath)) {
    console.warn('[migrate] end_users identifier patch not found:', patchPath);
    return;
  }
  const raw = readFileSync(patchPath, 'utf8');
  const segments = raw
    .split('--> statement-breakpoint')
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  for (const segment of segments) {
    await client.unsafe(segment);
  }
  console.log('[migrate] end_users identifier + banned column patch applied (idempotent)');
}

/** Warn if migrations were not applied (no bundled repair SQL in MVP). */
export async function ensureRedirectsTables(client: postgres.Sql): Promise<void> {
  if (await tableExists(client, 'redirects')) {
    return;
  }
  console.warn(
    '[migrate] Table public.redirects is missing. Run pnpm db:migrate or pnpm db:migrate:app.'
  );
}

let redirectsSchemaEnsurePromise: Promise<void> | null = null;

/**
 * Best-effort check after login that core schema exists (migrations normally run in instrumentation).
 */
export function ensureRedirectsSchemaOnce(): Promise<void> {
  if (redirectsSchemaEnsurePromise) {
    return redirectsSchemaEnsurePromise;
  }
  redirectsSchemaEnsurePromise = (async () => {
    try {
      const rawUrl = process.env.DATABASE_URL;
      if (!rawUrl) {
        return;
      }
      const url = normalizeDatabaseUrl(rawUrl);
      const client = postgres(url, { max: 1 });
      try {
        await ensureRedirectsTables(client);
      } finally {
        await client.end();
      }
    } catch (err) {
      redirectsSchemaEnsurePromise = null;
      throw err;
    }
  })();
  return redirectsSchemaEnsurePromise;
}

export async function runMigrations(): Promise<void> {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    console.warn('[migrate] DATABASE_URL not set, skipping migrations');
    return;
  }
  const url = normalizeDatabaseUrl(rawUrl);

  const migrationsFolder = resolveMigrationsFolder();
  console.log('[migrate] Using migrations folder:', migrationsFolder);

  const client = postgres(url, { max: 1 });
  const db = drizzle(client);

  try {
    await migrate(db, { migrationsFolder });
    console.log('[migrate] Drizzle migrate() finished');
    await applyEndUsersIdentifierBannedPatch(client);
  } finally {
    await client.end();
  }
}
