import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers } from '@/db/schema';
import {
  createEnduserSession,
  endUserPublicPayload,
  verifyEnduserPassword,
} from '@/lib/enduser-auth';

export const dynamic = 'force-dynamic';

const loginSchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  try {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const email = parsed.data.email.toLowerCase();
    const [row] = await db.select().from(endUsers).where(eq(endUsers.email, email)).limit(1);

    if (!row?.passwordHash) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (!verifyEnduserPassword(parsed.data.password, row.passwordHash)) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (row.banned) {
      return NextResponse.json({ error: 'Account is banned' }, { status: 403 });
    }

    const { token, expiresAt } = await createEnduserSession({
      endUserId: row.id,
      request,
    });

    return NextResponse.json({
      token,
      expiresAt: expiresAt.toISOString(),
      user: endUserPublicPayload(row),
    });
  } catch (error) {
    console.error('[api/extension/auth/login]', error);
    return NextResponse.json({ error: 'Failed to sign in' }, { status: 500 });
  }
}
