import 'server-only';

import { database as db } from '@/db';
import { createBetterAuth } from '@/lib/better-auth-factory';
import { env } from '@/lib/config/env';

export const auth = createBetterAuth({
  db,
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_BASE_URL ?? env.BETTER_AUTH_URL ?? undefined,
});
