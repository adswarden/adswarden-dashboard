import { NextRequest, NextResponse } from 'next/server';
import { utf8CsvDownloadResponse } from '@/lib/admin-csv-response';
import { getAccessibleCampaignById } from '@/lib/campaign-access';
import { listCampaignLogsForExport } from '@/lib/campaign-logs-export';
import { eventsToCsvLines } from '@/lib/events-dashboard';
import { getSessionWithRole } from '@/lib/dal';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const sessionWithRole = await getSessionWithRole();
    if (!sessionWithRole) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const accessible = await getAccessibleCampaignById(sessionWithRole, id);
    if (!accessible) {
      return NextResponse.json({ error: 'Campaign not found' }, { status: 404 });
    }

    const rows = await listCampaignLogsForExport(id);
    const lines = eventsToCsvLines(rows);
    return utf8CsvDownloadResponse(lines, `campaign-${id}-logs`);
  } catch (error) {
    console.error('Error exporting campaign logs:', error);
    return NextResponse.json(
      { error: 'Failed to export campaign logs' },
      { status: 500 }
    );
  }
}
