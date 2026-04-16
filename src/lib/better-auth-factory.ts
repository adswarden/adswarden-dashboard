/**
 * Better Auth instance factory — safe for CLI scripts (no `server-only`).
 * The app entrypoint re-exports a singleton from {@link ./auth}.
 */
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { count, eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import * as schema from '@/db/schema';
import { account, session, user, verification } from '@/db/schema';

export function createBetterAuth(params: {
  db: PostgresJsDatabase<typeof schema>;
  secret: string;
  baseURL: string | undefined;
}) {
  const { db, secret, baseURL } = params;

  return betterAuth({
    plugins: [admin()],
    session: {
      freshAge: 60 * 60 * 24 * 7,
    },
    database: drizzleAdapter(db, {
      provider: 'pg',
      schema: {
        user,
        session,
        account,
        verification,
      },
    }),
    emailAndPassword: {
      enabled: true,
    },
    user: {
      additionalFields: {
        role: {
          type: ['user', 'admin'],
          required: false,
          defaultValue: 'user',
          input: false,
        },
      },
    },
    databaseHooks: {
      user: {
        create: {
          after: async (createdUser) => {
            const [row] = await db.select({ n: count() }).from(user);
            if (row?.n === 1) {
              await db.update(user).set({ role: 'admin' }).where(eq(user.id, createdUser.id));
            }
          },
        },
      },
    },
    secret,
    basePath: '/api/auth',
    baseURL: baseURL ?? (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined),
  });
}
