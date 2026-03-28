import { NextRequest, NextResponse } from 'next/server';
import { endUserPublicPayload, resolveEndUserFromRequest } from '@/lib/enduser-auth';

export async function GET(request: NextRequest) {
  const resolved = await resolveEndUserFromRequest(request);
  if (!resolved) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  return NextResponse.json({ user: endUserPublicPayload(resolved.endUser) });
}
