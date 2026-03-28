import { NextRequest, NextResponse } from 'next/server';
import { utf8CsvDownloadResponse } from '@/lib/admin-csv-response';
import { getSessionWithRole } from '@/lib/dal';
import {
  parsePaymentsDashboardFilters,
  paymentsToCsvLines,
  runPaymentsExportQuery,
} from '@/lib/payments-dashboard';

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
  const filters = parsePaymentsDashboardFilters(searchParams);

  const rows = await runPaymentsExportQuery(filters);
  const lines = paymentsToCsvLines(rows);
  return utf8CsvDownloadResponse(lines, 'payments');
}
