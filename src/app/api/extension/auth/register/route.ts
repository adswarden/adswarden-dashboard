import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { database as db } from '@/db';
import { endUsers } from '@/db/schema';
import {
  createEnduserSession,
  endUserPublicPayload,
  hashEnduserPassword,
} from '@/lib/enduser-auth';
import { computeTrialEndDateFromNow } from '@/lib/extension-user-subscription';

export const dynamic = 'force-dynamic';

const identifierSchema = z
  .string()
  .trim()
  .min(8)
  .max(255)
  .regex(/^[a-zA-Z0-9_-]+$/);

const registerSchema = z
  .object({
    email: z.string().trim().email().max(255).optional(),
    password: z.string().min(8).max(128).optional(),
    identifier: identifierSchema.optional(),
    name: z.string().trim().max(255).nullable().optional(),
    plan: z.enum(['trial', 'paid']).optional(),
  })
  .superRefine((data, ctx) => {
    const hasEmail = Boolean(data.email?.length);
    const hasIdentifier = Boolean(data.identifier?.length);
    if (!hasEmail && !hasIdentifier) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide email (with password) or identifier for an anonymous user',
      });
    }
    if (hasEmail && !data.password?.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password is required when email is set',
        path: ['password'],
      });
    }
  });

export async function POST(request: NextRequest) {
  try {
    let raw: unknown;
    try {
      raw = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const parsed = registerSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const p = parsed.data;

    if (p.email?.length) {
      const normalizedEmail = p.email.toLowerCase();
      const [created] = await db
        .insert(endUsers)
        .values({
          email: normalizedEmail,
          passwordHash: hashEnduserPassword(p.password!),
          identifier: p.identifier ?? null,
          name: p.name ?? null,
          plan: p.plan ?? 'trial',
          banned: false,
        })
        .returning();

      if (!created) {
        return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
      }

      const { token, expiresAt } = await createEnduserSession({
        endUserId: created.id,
        request,
      });

      return NextResponse.json(
        {
          token,
          expiresAt: expiresAt.toISOString(),
          user: endUserPublicPayload(created),
        },
        { status: 201 }
      );
    }

    const trialEnd = computeTrialEndDateFromNow();
    const [created] = await db
      .insert(endUsers)
      .values({
        identifier: p.identifier!,
        email: null,
        passwordHash: null,
        name: p.name ?? null,
        plan: p.plan ?? 'trial',
        banned: false,
        endDate: trialEnd,
      })
      .returning();

    if (!created) {
      return NextResponse.json({ error: 'Insert failed' }, { status: 500 });
    }

    const { token, expiresAt } = await createEnduserSession({
      endUserId: created.id,
      request,
    });

    return NextResponse.json(
      {
        token,
        expiresAt: expiresAt.toISOString(),
        user: endUserPublicPayload(created),
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    if (msg.includes('unique') || msg.includes('duplicate')) {
      return NextResponse.json(
        { error: 'Email or identifier already in use' },
        { status: 409 }
      );
    }
    console.error('[api/extension/auth/register]', error);
    return NextResponse.json({ error: 'Failed to register' }, { status: 500 });
  }
}
