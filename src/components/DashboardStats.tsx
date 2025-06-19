
import StatCard from "@/components/StatCard";
import { FileSpreadsheet, Phone } from "lucide-react";

interface Campaign {
  id: string;
  created_at: string;
  name: string;
  leads_count: number;
  status: string;
  completed: number;
  failed: number;
  in_progress: number;
  remaining: number;
  cost: number;
  duration: number;
}

interface DashboardStatsProps {
  campaign: Campaign | null;
}

export default function DashboardStats({ campaign }: DashboardStatsProps) {
  if (!campaign) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <StatCard
        title="Total Leads"
        value={campaign.leads_count || 0}
        description="Total leads in campaign"
        icon={<FileSpreadsheet className="h-6 w-6" />}
      />
      <StatCard
        title="Completed"
        value={campaign.completed || 0}
        description="Calls completed"
        icon={<Phone className="h-6 w-6" />}
      />
      <StatCard
        title="Failed"
        value={campaign.failed || 0}
        description="Failed calls"
        icon={<Phone className="h-6 w-6" />}
      />
      <StatCard
        title="Remaining"
        value={campaign.remaining || 0}
        description="Leads remaining"
        icon={<Phone className="h-6 w-6" />}
      />
    </div>
  );
}
