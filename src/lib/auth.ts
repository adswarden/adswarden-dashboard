import 'server-only';
import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { admin } from 'better-auth/plugins';
import { database as db } from '@/db';
import { user, session, account, verification } from '@/db/schema';
import { env } from '@/lib/config/env';
import { eq, count } from 'drizzle-orm';

export const auth = betterAuth({
  plugins: [admin()],
  session: {
    // Seconds; sensitive routes (revoke session, change password) require a "fresh" session.
    // Default is 24h — extend so weekend idle users are not blocked from account security actions.
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
  secret: env.BETTER_AUTH_SECRET,
  basePath: '/api/auth',
  baseURL: env.BETTER_AUTH_BASE_URL ?? env.BETTER_AUTH_URL ?? (process.env.NODE_ENV === 'development' ? 'http://localhost:3000' : undefined),
});
