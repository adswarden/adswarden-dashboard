import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { z } from 'zod';

export async function parseJsonBody<T extends z.ZodType>(
  request: NextRequest,
  schema: T
): Promise<{ ok: true; data: z.infer<T> } | { ok: false; response: NextResponse }> {
  const contentType = request.headers.get('content-type');
  if (!contentType?.includes('application/json')) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Content-Type must be application/json' }, { status: 400 }),
    };
  }

  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }),
    };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten() },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: parsed.data };
}
