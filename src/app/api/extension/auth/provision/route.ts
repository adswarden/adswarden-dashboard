import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { database as db } from '@/db';
import { endUsers } from '@/db/schema';
import {
  allocateUniqueShortId,
  createEnduserSession,
  endUserPublicPayload,
} from '@/lib/enduser-auth';
import { computeTrialEndDateFromNow } from '@/lib/extension-user-subscription';
import { parseJsonBody } from '@/lib/parse-json-request';

const bodySchema = z.object({
  installationId: z
    .string()
    .trim()
    .min(8, 'installationId must be at least 8 characters')
    .max(255)
    .regex(/^[a-zA-Z0-9_-]+$/, 'installationId must be alphanumeric, underscore, or hyphen'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await parseJsonBody(request, bodySchema);
    if (!body.ok) {
      return body.response;
    }

    const installationId = body.data.installationId;
    const now = new Date();
    const trialEnd = computeTrialEndDateFromNow(now);

    const [existing] = await db
      .select()
      .from(endUsers)
      .where(eq(endUsers.installationId, installationId))
      .limit(1);

    if (existing) {
      if (existing.status !== 'active') {
        return NextResponse.json(
          { error: 'Account is not active', status: existing.status },
          { status: 403 }
        );
      }

      const { token, expiresAt } = await createEnduserSession({
        endUserId: existing.id,
        request,
      });

      const [fresh] = await db.select().from(endUsers).where(eq(endUsers.id, existing.id)).limit(1);
      return NextResponse.json({
        token,
        expiresAt: expiresAt.toISOString(),
        user: endUserPublicPayload(fresh ?? existing),
      });
    }

    const shortId = await allocateUniqueShortId();
    const [inserted] = await db
      .insert(endUsers)
      .values({
        installationId,
        shortId,
        plan: 'trial',
        status: 'active',
        endDate: trialEnd,
        email: null,
        passwordHash: null,
      })
      .returning();

    if (!inserted) {
      return NextResponse.json({ error: 'Failed to create anonymous user' }, { status: 500 });
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
    console.error('[extension/auth/provision]', error);
    return NextResponse.json({ error: 'Provision failed' }, { status: 500 });
  }
}
