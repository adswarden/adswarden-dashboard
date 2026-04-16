import { redirectSourceMatchesVisit } from '@/lib/domain-utils';

export type PlatformDomainRow = { domain: string | null };
export type RedirectRuleRow = {
  sourceDomain: string;
  includeSubdomains: boolean;
};

/** First platform hostname matched by the redirect rule, if any. */
export function findPlatformDomainConflictForRedirect(
  sourceDomain: string,
  includeSubdomains: boolean,
  platformList: PlatformDomainRow[]
): string | undefined {
  for (const p of platformList) {
    const d = (p.domain ?? '').trim();
    if (!d) continue;
    if (redirectSourceMatchesVisit(d, sourceDomain, includeSubdomains)) {
      return d;
    }
  }
  return undefined;
}

/** First redirect rule that matches the platform hostname, if any. */
export function findRedirectConflictForPlatform(
  platformDomain: string,
  redirectList: RedirectRuleRow[]
): RedirectRuleRow | undefined {
  const host = platformDomain.trim();
  if (!host) return undefined;
  for (const r of redirectList) {
    if (redirectSourceMatchesVisit(host, r.sourceDomain, r.includeSubdomains)) {
      return r;
    }
  }
  return undefined;
}
