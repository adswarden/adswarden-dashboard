import { getSessionWithRole } from '@/lib/dal';
import { redirect, notFound } from 'next/navigation';
import { CampaignForm } from '../../campaign-form';
import { CampaignFormShell } from '../../campaign-form-shell';
import {
  getCampaignFormOptionLists,
  getCampaignByIdOrUndefined,
  campaignRowToFormInitial,
} from '../../campaign-form-data';

export const dynamic = 'force-dynamic';

export default async function EditCampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const sessionWithRole = await getSessionWithRole();
  if (!sessionWithRole) redirect('/login');
  if (sessionWithRole.role !== 'admin') redirect('/campaigns');

  const { id } = await params;

  const [c, lists] = await Promise.all([getCampaignByIdOrUndefined(id), getCampaignFormOptionLists()]);
  if (!c) notFound();

  const campaign = campaignRowToFormInitial(c);

  return (
    <CampaignFormShell
      title="Edit campaign"
      description="Update targeting, schedule, and delivery rules for this campaign."
    >
      <CampaignForm campaign={campaign} {...lists} mode="edit" />
    </CampaignFormShell>
  );
}
