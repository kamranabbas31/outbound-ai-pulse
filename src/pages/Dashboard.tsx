
import { useSearchParams } from "react-router-dom";
import { useRealtimeLeads } from "@/hooks/useRealtimeLeads";
import { useDashboardData } from "@/hooks/useDashboardData";
import DashboardStats from "@/components/DashboardStats";
import LeadsTable from "@/components/LeadsTable";

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaignId');

  // Enable real-time updates for leads
  useRealtimeLeads(campaignId || undefined);

  const {
    leads,
    campaign,
    isLoadingLeads,
    refetchLeads,
    refetchCampaign
  } = useDashboardData(campaignId);

  return (
    <div className="flex flex-col gap-4">
      <DashboardStats campaign={campaign} />
      <LeadsTable 
        leads={leads}
        campaign={campaign}
        campaignId={campaignId}
        isLoadingLeads={isLoadingLeads}
        refetchLeads={refetchLeads}
        refetchCampaign={refetchCampaign}
      />
    </div>
  );
}
