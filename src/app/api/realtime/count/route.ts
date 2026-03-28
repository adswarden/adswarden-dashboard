import { NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/dal';
import { getConnectionCount } from '@/lib/redis';

/**
 * GET /api/realtime/count
 * Returns the current number of extension users connected to the live SSE channel.
 * Admin-only (requires valid session).
 */
export async function GET() {
  const session = await getSessionWithRole();
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (session.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const count = await getConnectionCount();
  return NextResponse.json({ count });
}
