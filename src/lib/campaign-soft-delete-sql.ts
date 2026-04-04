import 'server-only';

import { sql } from 'drizzle-orm';
import { campaigns } from '@/db/schema';

/**
 * Use in WHERE clauses to hide soft-deleted campaigns.
 * Compares `status::text` so legacy databases missing the `deleted` enum label
 * still evaluate this filter without error.
 */
export const campaignRowNotSoftDeleted = sql`${campaigns.status}::text <> 'deleted'`;
