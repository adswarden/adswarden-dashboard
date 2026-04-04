import { NextRequest, NextResponse } from 'next/server';
import { deleteEnduserSessionByToken, getBearerFromRequest } from '@/lib/enduser-auth';

export async function POST(request: NextRequest) {
  const token = getBearerFromRequest(request);
  if (!token) {
    return NextResponse.json({ error: 'Authorization Bearer token required' }, { status: 401 });
  }
  await deleteEnduserSessionByToken(token);
  return NextResponse.json({ ok: true });
}
