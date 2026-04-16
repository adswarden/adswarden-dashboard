/** Serializable dashboard snapshot for `/users/[id]` (lifetime aggregates). */
export type EndUserDashboardSnapshot = {
  payments: {
    completedCount: number;
    completedSumAmount: number;
    currency: string;
    lastPaymentAt: string | null;
  };
  sessions: {
    total: number;
    active: number;
  };
  events: {
    total: number;
    firstAt: string | null;
    lastAt: string | null;
    distinctDomains: number;
    distinctCampaignsWithEvents: number;
  };
  campaigns: Array<{
    campaignId: string;
    campaignName: string;
    eventCount: number;
  }>;
  /** ISO2 codes from extension events for this user, most events first. */
  eventCountries: Array<{
    code: string;
    eventCount: number;
  }>;
};
