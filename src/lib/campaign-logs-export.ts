import 'server-only';

import { database as db } from '@/db';
import { endUsers, enduserEvents } from '@/db/schema';
import { desc, eq } from 'drizzle-orm';
import { type EventLogRow } from '@/lib/events-dashboard';

/**
 * All extension events for a campaign, newest first. Caller must enforce access (campaign ACL).
 */
export async function listCampaignLogsForExport(campaignId: string): Promise<EventLogRow[]> {
  const rows = await db
    .select({
      id: enduserEvents.id,
      userIdentifier: enduserEvents.userIdentifier,
      endUserUuid: endUsers.id,
      email: endUsers.email,
      plan: endUsers.plan,
      campaignId: enduserEvents.campaignId,
      domain: enduserEvents.domain,
      type: enduserEvents.type,
      country: enduserEvents.country,
      userAgent: enduserEvents.userAgent,
      createdAt: enduserEvents.createdAt,
    })
    .from(enduserEvents)
    .leftJoin(endUsers, eq(endUsers.identifier, enduserEvents.userIdentifier))
    .where(eq(enduserEvents.campaignId, campaignId))
    .orderBy(desc(enduserEvents.createdAt));

  return rows as EventLogRow[];
}
