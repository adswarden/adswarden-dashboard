/** Shared shape for create vs edit campaign form (client-safe). */
export type CampaignFormInitial = {
  id: string;
  name: string;
  targetAudience: string;
  campaignType: string;
  frequencyType: string;
  frequencyCount: number | null;
  timeStart: string | null;
  timeEnd: string | null;
  status: string;
  startDate: string | null;
  endDate: string | null;
  platformIds: string[];
  countryCodes: string[];
  adId: string | null;
  notificationId: string | null;
  redirectId: string | null;
};

export type CampaignFormOptionLists = {
  platforms: { id: string; name: string; domain: string }[];
  adsList: { id: string; name: string; linkedCampaignCount: number }[];
  notificationsList: { id: string; title: string; linkedCampaignCount: number }[];
  redirectsList: { id: string; name: string; linkedCampaignCount: number }[];
};
