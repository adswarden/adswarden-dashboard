import 'server-only';

import { sql } from 'drizzle-orm';
import { database as db } from '@/db';
import { platforms, redirects } from '@/db/schema';
import { normalizeDomainForMatch } from '@/lib/domain-utils';
import type { RedirectRuleRow } from '@/lib/redirect-platform-conflict';

/**
 * DB-direct check: returns the first conflicting redirect rule for a given platform domain,
 * using a targeted SQL query instead of loading the full redirects table.
 * Stored domains are already normalized hostnames; matching mirrors redirectSourceMatchesVisit.
 */
export async function queryRedirectConflictForPlatform(
  platformDomain: string
): Promise<RedirectRuleRow | undefined> {
  const host = normalizeDomainForMatch(platformDomain);
  if (!host) return undefined;

  const [row] = await db
    .select({ sourceDomain: redirects.sourceDomain, includeSubdomains: redirects.includeSubdomains })
    .from(redirects)
    .where(
      sql`lower(trim(${redirects.sourceDomain})) = ${host}
        OR (${redirects.includeSubdomains} = true AND ${host} LIKE '%.' || lower(trim(${redirects.sourceDomain})))`
    )
    .limit(1);

  return row;
}

/**
 * DB-direct check: returns the first conflicting platform domain for a given redirect rule,
 * using a targeted SQL query instead of loading the full platforms table.
 */
export async function queryPlatformConflictForRedirect(
  sourceDomain: string,
  includeSubdomains: boolean
): Promise<string | undefined> {
  const source = normalizeDomainForMatch(sourceDomain);
  if (!source) return undefined;

  const [row] = await db
    .select({ domain: platforms.domain })
    .from(platforms)
    .where(
      includeSubdomains
        ? sql`lower(trim(${platforms.domain})) = ${source} OR lower(trim(${platforms.domain})) LIKE '%.' || ${source}`
        : sql`lower(trim(${platforms.domain})) = ${source}`
    )
    .limit(1);

  return row?.domain ?? undefined;
}
