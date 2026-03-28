import { NextRequest, NextResponse } from 'next/server';
import { utf8CsvDownloadResponse } from '@/lib/admin-csv-response';
import { getSessionWithRole } from '@/lib/dal';
import {
  endEventsAccessWhere,
  eventsToCsvLines,
  listEventsForExport,
  parseEventsDashboardFilters,
} from '@/lib/events-dashboard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const filters = parseEventsDashboardFilters(searchParams);
  const accessWhere = endEventsAccessWhere(sessionWithRole.role, sessionWithRole.user.id);

  const rows = await listEventsForExport(accessWhere, filters);
  const lines = eventsToCsvLines(rows);
  return utf8CsvDownloadResponse(lines, 'events');
}
