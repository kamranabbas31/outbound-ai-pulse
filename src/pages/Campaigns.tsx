
import { FC, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { fetchCampaigns } from "@/services/campaignService";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Download, RefreshCw } from "lucide-react";
import { generateCampaignReport } from "@/utils/excelExporter";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface Campaign {
  id: string;
  name: string;
  file_name: string | null;
  status: string;
  leads_count: number;
  completed: number;
  in_progress: number;
  remaining: number;
  failed: number;
  duration: number;
  cost: number;
  created_at: string;
}

const Campaigns: FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingCampaigns, setDownloadingCampaigns] = useState<Set<string>>(new Set());
  const navigate = useNavigate();

  useEffect(() => {
    loadCampaigns();
  }, []);

  const loadCampaigns = async () => {
    setIsLoading(true);
    try {
      const data = await fetchCampaigns();
      console.log("Loaded campaigns:", data);
      setCampaigns(data);
    } catch (error) {
      console.error("Error loading campaigns:", error);
      toast.error("Failed to load campaigns");
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in-progress":
        return <Badge className="bg-blue-500 hover:bg-blue-600">In Progress</Badge>;
      case "completed":
        return <Badge className="bg-green-500 hover:bg-green-600">Completed</Badge>;
      case "stopped":
        return <Badge variant="outline" className="text-gray-500 border-gray-300">Stopped</Badge>;
      case "paused":
        return <Badge variant="outline" className="text-amber-500 border-amber-300">Paused</Badge>;
      case "pending":
        return <Badge variant="outline" className="text-purple-500 border-purple-300">Pending</Badge>;
      case "partial":
        return <Badge className="bg-amber-500 hover:bg-amber-600">Partial</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleCampaignClick = (campaignId: string) => {
    navigate(`/?campaignId=${campaignId}`);
  };

  const handleRefresh = () => {
    loadCampaigns();
    toast.success("Campaigns refreshed");
  };

  const handleDownloadReport = async (campaign: Campaign, event: React.MouseEvent) => {
    event.stopPropagation(); // Prevent row click
    
    if (campaign.leads_count === 0) {
      toast.error("No leads found in this campaign to export");
      return;
    }
    
    setDownloadingCampaigns(prev => new Set(prev).add(campaign.id));
    
    try {
      await generateCampaignReport(campaign.id, campaign.name);
      toast.success(`Campaign report downloaded successfully`);
    } catch (error) {
      console.error("Error downloading campaign report:", error);
      toast.error("Failed to download campaign report");
    } finally {
      setDownloadingCampaigns(prev => {
        const newSet = new Set(prev);
        newSet.delete(campaign.id);
        return newSet;
      });
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <div className="flex flex-col space-y-2">
          <h2 className="text-2xl font-bold">Campaigns</h2>
          <p className="text-muted-foreground">View and manage your calling campaigns</p>
        </div>
        <Button onClick={handleRefresh} variant="outline" className="ml-auto">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      <div className="bg-white shadow-sm rounded-lg border overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Campaign History</h3>
          <p className="text-sm text-muted-foreground">List of all your uploaded campaign files and their statuses</p>
        </div>
        <div className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Campaign Name</TableHead>
                <TableHead>File Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Leads</TableHead>
                <TableHead>Completed</TableHead>
                <TableHead>In Progress</TableHead>
                <TableHead>Remaining</TableHead>
                <TableHead>Failed</TableHead>
                <TableHead>Duration (min)</TableHead>
                <TableHead>Cost ($)</TableHead>
                <TableHead>Date Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={12} className="h-[100px] text-center text-muted-foreground">
                    Loading campaigns...
                  </TableCell>
                </TableRow>
              ) : campaigns.length > 0 ? (
                campaigns.map((campaign) => (
                  <TableRow 
                    key={campaign.id} 
                    className="cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => handleCampaignClick(campaign.id)}
                  >
                    <TableCell>{campaign.name}</TableCell>
                    <TableCell>{campaign.file_name || '-'}</TableCell>
                    <TableCell>{getStatusBadge(campaign.status)}</TableCell>
                    <TableCell>{campaign.leads_count}</TableCell>
                    <TableCell>{campaign.completed}</TableCell>
                    <TableCell>{campaign.in_progress}</TableCell>
                    <TableCell>{campaign.remaining}</TableCell>
                    <TableCell>{campaign.failed}</TableCell>
                    <TableCell>{campaign.duration.toFixed(1)}</TableCell>
                    <TableCell>${campaign.cost.toFixed(2)}</TableCell>
                    <TableCell>{formatDate(campaign.created_at)}</TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => handleDownloadReport(campaign, e)}
                        disabled={downloadingCampaigns.has(campaign.id) || campaign.leads_count === 0}
                        className="flex items-center gap-2"
                      >
                        <Download className="w-4 h-4" />
                        {downloadingCampaigns.has(campaign.id) ? 'Downloading...' : 'Export'}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={12} className="h-[100px] text-center text-muted-foreground">
                    No campaigns found. Create a new campaign to get started.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
