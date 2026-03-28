import { NextRequest, NextResponse } from 'next/server';
import { utf8CsvDownloadResponse } from '@/lib/admin-csv-response';
import { getSessionWithRole } from '@/lib/dal';
import {
  parseEndUsersDashboardFilters,
  runEndUsersListQuery,
  endUsersToCsvLines,
} from '@/lib/end-users-dashboard';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (sessionWithRole.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filters = parseEndUsersDashboardFilters(searchParams);

  const rows = await runEndUsersListQuery(filters);
  const lines = endUsersToCsvLines(rows);
  return utf8CsvDownloadResponse(lines, 'users');
}
