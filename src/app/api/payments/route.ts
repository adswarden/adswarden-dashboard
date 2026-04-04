import { NextRequest, NextResponse } from 'next/server';
import { getSessionWithRole } from '@/lib/dal';
import {
  countPaymentsListQuery,
  getPaymentsSummary,
  parsePaymentsDashboardFilters,
  runPaymentsListQuery,
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

  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
  const pageSizeRaw = parseInt(searchParams.get('pageSize') ?? '25', 10);
  const pageSize = Math.min(100, Math.max(1, pageSizeRaw));
  const offset = (page - 1) * pageSize;

  const [data, total, summary] = await Promise.all([
    runPaymentsListQuery(filters, { limit: pageSize, offset }),
    countPaymentsListQuery(filters),
    getPaymentsSummary(),
  ]);

  return NextResponse.json({
    data,
    total,
    page,
    pageSize,
    summary: {
      totalThisMonth: summary.totalThisMonthCents,
      totalPriorMonth: summary.totalPriorMonthCents,
      totalEver: summary.totalEverCents,
      paidUsersCount: summary.paidUsersCount,
      completedPaymentsThisMonth: summary.completedPaymentsThisMonthCount,
      completedPaymentsAllTime: summary.completedPaymentsAllTimeCount,
      distinctPayersThisMonth: summary.distinctPayersThisMonthCount,
    },
  });
}
