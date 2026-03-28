import 'server-only';

import { database as db } from '@/db';
import { campaigns } from '@/db/schema';
import { and, eq } from 'drizzle-orm';
import type { SessionWithRole } from '@/lib/dal';

export type CampaignRow = typeof campaigns.$inferSelect;

/** Full row or null if missing or caller is not allowed (use 404 for both to avoid IDOR). */
export async function getAccessibleCampaignById(
  session: NonNullable<SessionWithRole>,
  campaignId: string
): Promise<CampaignRow | null> {
  const condition =
    session.role === 'admin'
      ? eq(campaigns.id, campaignId)
      : and(eq(campaigns.id, campaignId), eq(campaigns.createdBy, session.user.id));

  const [row] = await db.select().from(campaigns).where(condition!).limit(1);
  return row ?? null;
}

export function formatCampaignResponse(c: CampaignRow) {
  return {
    ...c,
    platformIds: [...(c.platformIds ?? [])],
    countryCodes: [...(c.countryCodes ?? [])],
    adId: c.adId ?? null,
    notificationId: c.notificationId ?? null,
    redirectId: c.redirectId ?? null,
  };
}
