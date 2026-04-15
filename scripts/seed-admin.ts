/**
 * Seed default admin user in development when the auth user table is empty.
 * Override credentials with ADMIN_EMAIL / ADMIN_PASSWORD in .env.local.
 * Run: pnpm db:seed-admin (or automatically on next dev server start via instrumentation).
 */
import { config } from 'dotenv';
config({ path: '.env.local' });

const DEFAULT_ADMIN_EMAIL = 'admin@admin.com';
const DEFAULT_ADMIN_PASSWORD = 'admin@admin.com';

export async function seedAdmin(): Promise<void> {
  if (process.env.NODE_ENV !== 'development') {
    return;
  }

  // Dynamic import to avoid loading server-only during script init
  const authModule = await import('../src/lib/auth');
  const auth = authModule.auth;
  const dbModule = await import('../src/db');
  const db = dbModule.database;
  const schemaModule = await import('../src/db/schema');
  const { user } = schemaModule;
  const { eq, count } = await import('drizzle-orm');

  const [row] = await db.select({ n: count() }).from(user);
  if (row && row.n > 0) {
    return;
  }

  const email = process.env.ADMIN_EMAIL || DEFAULT_ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD || DEFAULT_ADMIN_PASSWORD;

  console.log('[seed-admin] No users yet; creating initial admin');
  console.log('[seed-admin] ADMIN_EMAIL', email);
  console.log('[seed-admin] NODE_ENV', process.env.NODE_ENV);

  const result = await auth.api.signUpEmail({
    body: {
      email,
      password,
      name: 'Admin',
    },
  });

  if ('error' in result && result.error) {
    const err = result.error as { message?: string };
    throw new Error(err.message ?? String(err));
  }

  if ('user' in result && result.user) {
    await db.update(user).set({ role: 'admin' }).where(eq(user.id, result.user.id));
    console.log(`[seed-admin] Admin user created: ${email}`);
  }
}

// Run when executed directly (pnpm db:seed-admin), not when imported by instrumentation
if (process.argv[1]?.includes('seed-admin')) {
  if (!process.env.NODE_ENV) {
    process.env.NODE_ENV = 'development';
  }
  seedAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Seed failed:', err);
      process.exit(1);
    });
}
