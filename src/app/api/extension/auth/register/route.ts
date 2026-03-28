import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers } from '@/db/schema';
import {
  allocateUniqueShortId,
  createEnduserSession,
  endUserPublicPayload,
  getBearerFromRequest,
  hashEnduserPassword,
  resolveEndUserFromToken,
} from '@/lib/enduser-auth';
import { parseJsonBody } from '@/lib/parse-json-request';

const bodySchema = z.object({
  email: z.string().trim().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().trim().max(255).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody(request, bodySchema);
    if (!body.ok) {
      return body.response;
    }

    const { email, password, name } = body.data;
    const normalizedEmail = email.toLowerCase();
    const passwordHash = hashEnduserPassword(password);

    const bearer = getBearerFromRequest(request);
    const resolved = bearer ? await resolveEndUserFromToken(bearer) : null;

    if (resolved) {
      const anon = resolved.endUser;
      if (anon.email) {
        return NextResponse.json(
          { error: 'Account already registered; sign in instead' },
          { status: 400 }
        );
      }

      const [emailOwner] = await db
        .select({ id: endUsers.id })
        .from(endUsers)
        .where(eq(endUsers.email, normalizedEmail))
        .limit(1);
      if (emailOwner && emailOwner.id !== anon.id) {
        return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
      }

      const [updated] = await db
        .update(endUsers)
        .set({
          email: normalizedEmail,
          passwordHash,
          name: name?.length ? name : anon.name,
          updatedAt: new Date(),
        })
        .where(eq(endUsers.id, anon.id))
        .returning();

      if (!updated) {
        return NextResponse.json({ error: 'Failed to update account' }, { status: 500 });
      }

      const { token, expiresAt } = await createEnduserSession({
        endUserId: updated.id,
        request,
      });

      return NextResponse.json({
        token,
        expiresAt: expiresAt.toISOString(),
        user: endUserPublicPayload(updated),
      });
    }

    const existing = await db
      .select({ id: endUsers.id })
      .from(endUsers)
      .where(eq(endUsers.email, normalizedEmail))
      .limit(1);
    if (existing.length > 0) {
      return NextResponse.json({ error: 'Email already registered' }, { status: 409 });
    }

    const shortId = await allocateUniqueShortId();
    const [inserted] = await db
      .insert(endUsers)
      .values({
        email: normalizedEmail,
        passwordHash,
        shortId,
        name: name?.length ? name : null,
      })
      .returning();

    if (!inserted) {
      return NextResponse.json({ error: 'Failed to create account' }, { status: 500 });
    }

    const { token, expiresAt } = await createEnduserSession({
      endUserId: inserted.id,
      request,
    });

    return NextResponse.json({
      token,
      expiresAt: expiresAt.toISOString(),
      user: endUserPublicPayload(inserted),
    });
  } catch (error) {
    console.error('[extension/auth/register]', error);
    return NextResponse.json({ error: 'Registration failed' }, { status: 500 });
  }
}
