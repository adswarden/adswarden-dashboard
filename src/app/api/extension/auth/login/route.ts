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
import { parseJsonBody } from '@/lib/parse-json-request';

const bodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(1).max(128),
});

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody(request, bodySchema);
    if (!body.ok) {
      return body.response;
    }

    const { email, password } = body.data;
    const normalizedEmail = email.toLowerCase();

    const [user] = await db
      .select()
      .from(endUsers)
      .where(eq(endUsers.email, normalizedEmail))
      .limit(1);

    if (
      !user ||
      !user.passwordHash ||
      !verifyEnduserPassword(password, user.passwordHash)
    ) {
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    if (user.status !== 'active') {
      return NextResponse.json(
        { error: 'Account is not active', status: user.status },
        { status: 403 }
      );
    }

    const { token, expiresAt } = await createEnduserSession({
      endUserId: user.id,
      request,
    });

    return NextResponse.json({
      token,
      expiresAt: expiresAt.toISOString(),
      user: endUserPublicPayload(user),
    });
  } catch (error) {
    console.error('[extension/auth/login]', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
