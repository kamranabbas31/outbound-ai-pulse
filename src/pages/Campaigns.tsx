
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Play, Pause, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useRealtimeLeads } from "@/hooks/useRealtimeLeads";
import { useToast } from "@/hooks/use-toast";

interface Campaign {
  id: string;
  created_at: string;
  name: string;
  leads_count: number;
  status: string;
  cost: number;
  duration: number;
  completed: number;
  failed: number;
  in_progress: number;
  remaining: number;
}

export default function Campaigns() {
  const [newCampaignName, setNewCampaignName] = useState("");
  const navigate = useNavigate();
  const { toast } = useToast();

  // Enable real-time updates for all campaigns
  useRealtimeLeads();

  const { data: campaigns, isLoading, error, refetch } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("campaigns")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) {
        console.error("Error fetching campaigns:", error);
        throw error;
      }
      return data || [];
    }
  });

  const handleCreateCampaign = async () => {
    if (newCampaignName.trim() === "") {
      toast.custom({
        title: "Error",
        description: "Campaign name cannot be empty.",
        variant: "destructive",
      });
      return;
    }

    const { data, error } = await supabase
      .from("campaigns")
      .insert([{ name: newCampaignName }])
      .select()
      .single();

    if (error) {
      console.error("Error creating campaign:", error);
      toast.custom({
        title: "Error",
        description: "Failed to create campaign.",
        variant: "destructive",
      });
    } else {
      toast.custom({
        title: "Success",
        description: "Campaign created successfully.",
      });
      setNewCampaignName("");
      refetch();
      navigate(`/campaigns?campaignId=${data.id}`);
    }
  };

  const handleCampaignClick = (campaignId: string) => {
    navigate(`/campaigns?campaignId=${campaignId}`);
  };

  if (isLoading) return <p>Loading campaigns...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Campaigns</CardTitle>
          <CardDescription>Manage your calling campaigns.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="flex items-center space-x-2">
              <Input
                type="text"
                placeholder="New campaign name"
                value={newCampaignName}
                onChange={(e) => setNewCampaignName(e.target.value)}
              />
              <Button onClick={handleCreateCampaign}>
                <Plus className="mr-2 h-4 w-4" />
                Create Campaign
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Leads</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Cost</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Completed</TableHead>
                  <TableHead>Failed</TableHead>
                  <TableHead>In Progress</TableHead>
                  <TableHead>Remaining</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {campaigns?.map((campaign) => (
                  <TableRow key={campaign.id}>
                    <TableCell>{campaign.name}</TableCell>
                    <TableCell>{campaign.leads_count}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{campaign.status}</Badge>
                    </TableCell>
                    <TableCell>{campaign.cost}</TableCell>
                    <TableCell>{campaign.duration}</TableCell>
                    <TableCell>{campaign.completed}</TableCell>
                    <TableCell>{campaign.failed}</TableCell>
                    <TableCell>{campaign.in_progress}</TableCell>
                    <TableCell>{campaign.remaining}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCampaignClick(campaign.id)}
                      >
                        <BarChart3 className="mr-2 h-4 w-4" />
                        View Stats
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
