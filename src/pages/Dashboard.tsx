
import { useState } from "react";
import Layout from "@/components/Layout";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Phone, Upload, Play, FileSpreadsheet } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { useRealtimeLeads } from "@/hooks/useRealtimeLeads";
import { useToast } from "@/components/ui/use-toast";
import { parseCSV } from "@/utils/csvParser";
import { generateCampaignReport } from "@/utils/excelExporter";

interface Lead {
  id: string;
  created_at: string;
  name: string;
  phone_number: string;
  status: string;
  disposition: string | null;
  duration: number | null;
  cost: number | null;
}

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

export default function Dashboard() {
  const [searchParams] = useSearchParams();
  const campaignId = searchParams.get('campaignId');
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  // Enable real-time updates for leads
  useRealtimeLeads(campaignId || undefined);

  const { data: leads, isLoading: isLoadingLeads, refetch: refetchLeads } = useQuery({
    queryKey: ['leads', campaignId],
    queryFn: async () => {
      if (campaignId) {
        const { data: campaignLeads, error: campaignLeadsError } = await supabase
          .from('campaign_leads')
          .select('lead_id')
          .eq('campaign_id', campaignId);

        if (campaignLeadsError) {
          toast({
            title: "Error!",
            description: "Failed to fetch campaign leads. " + campaignLeadsError.message,
            variant: "destructive",
          });
          return [];
        }

        const leadIds = campaignLeads.map(cl => cl.lead_id);
        
        if (leadIds.length === 0) {
          return [];
        }

        const { data, error } = await supabase
          .from('leads')
          .select('*')
          .in('id', leadIds);

        if (error) {
          toast({
            title: "Error!",
            description: "Failed to fetch leads. " + error.message,
            variant: "destructive",
          });
          return [];
        }
        return data as Lead[];
      } else {
        const { data, error } = await supabase
          .from('leads')
          .select('*');
        if (error) {
          toast({
            title: "Error!",
            description: "Failed to fetch leads. " + error.message,
            variant: "destructive",
          });
          return [];
        }
        return data as Lead[];
      }
    },
  });

  const { data: campaign, isLoading: isLoadingCampaign, refetch: refetchCampaign } = useQuery({
    queryKey: ['campaign', campaignId],
    queryFn: async () => {
      if (campaignId) {
        const { data, error } = await supabase
          .from('campaigns')
          .select('*')
          .eq('id', campaignId)
          .single();
        if (error) {
          toast({
            title: "Error!",
            description: "Failed to fetch campaign. " + error.message,
            variant: "destructive",
          });
          return null;
        }
        return data as Campaign;
      } else {
        return null;
      }
    },
  });

  const { mutate: uploadLeads, isPending: isMutatingUpload } = useMutation({
    mutationFn: async (file: File) => {
      setIsUploading(true);
      const csvData = await file.text();
      const parsedData = parseCSV(csvData);

      if (!campaignId) {
        toast({
          title: "Error!",
          description: "Please select a campaign to upload leads to.",
          variant: "destructive",
        });
        return;
      }

      // Upload the leads to Supabase
      const { data, error } = await supabase.functions.invoke('upload-leads', {
        body: {
          leads: parsedData,
          campaignId: campaignId
        }
      });

      if (error) {
        toast({
          title: "Error!",
          description: "Failed to upload leads. " + error.message,
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Success!",
        description: "Leads uploaded successfully.",
      });

      refetchLeads();
      refetchCampaign();
      setIsUploading(false);
      return data;
    },
  });

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadLeads(file);
    }
  };

  const handleExportToExcel = async () => {
    if (!leads) {
      toast({
        title: "Error!",
        description: "No leads to export.",
        variant: "destructive",
      });
      return;
    }

    if (!campaign) {
      toast({
        title: "Error!",
        description: "No campaign to export.",
        variant: "destructive",
      });
      return;
    }

    try {
      await generateCampaignReport(campaign.id, campaign.name);
      toast({
        title: "Success!",
        description: "Report exported successfully.",
      });
    } catch (error) {
      toast({
        title: "Error!",
        description: "Failed to export report.",
        variant: "destructive",
      });
    }
  };

  const handleCallLead = async (leadId: string) => {
    const { data, error } = await supabase.functions.invoke('trigger-call', {
      body: {
        leadId: leadId
      }
    });

    if (error) {
      toast({
        title: "Error!",
        description: "Failed to trigger call. " + error.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Success!",
      description: "Call triggered successfully.",
    });

    refetchLeads();
  };

  return (
    <Layout>
      <div className="flex flex-col gap-4">
        {campaign && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard
              title="Total Leads"
              value={campaign?.leads_count || 0}
              description="Total leads in campaign"
              icon={<FileSpreadsheet className="h-6 w-6" />}
            />
            <StatCard
              title="Completed"
              value={campaign?.completed || 0}
              description="Calls completed"
              icon={<Phone className="h-6 w-6" />}
            />
            <StatCard
              title="Failed"
              value={campaign?.failed || 0}
              description="Failed calls"
              icon={<Phone className="h-6 w-6" />}
            />
            <StatCard
              title="Remaining"
              value={campaign?.remaining || 0}
              description="Leads remaining"
              icon={<Phone className="h-6 w-6" />}
            />
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Leads</CardTitle>
            <CardDescription>Manage your leads and upload new ones.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Input type="file" id="upload" className="hidden" onChange={handleFileUpload} />
                <Button asChild disabled={isUploading}>
                  <label htmlFor="upload" className="flex items-center gap-2">
                    <Upload className="h-4 w-4" />
                    Upload Leads
                  </label>
                </Button>
                <Button variant="outline" className="ml-2" onClick={handleExportToExcel}>
                  <FileSpreadsheet className="h-4 w-4 mr-2" />
                  Export to Excel
                </Button>
              </div>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Disposition</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoadingLeads ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      Loading...
                    </TableCell>
                  </TableRow>
                ) : leads?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center">
                      No leads found.
                    </TableCell>
                  </TableRow>
                ) : (
                  leads?.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>{lead.name}</TableCell>
                      <TableCell>{lead.phone_number}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{lead.status}</Badge>
                      </TableCell>
                      <TableCell>{lead.disposition}</TableCell>
                      <TableCell>
                        <Button size="sm" onClick={() => handleCallLead(lead.id)}>
                          <Phone className="h-4 w-4 mr-2" />
                          Call
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}
