
import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Phone, Upload, FileSpreadsheet } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
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
  name: string;
}

interface LeadsTableProps {
  leads: Lead[] | undefined;
  campaign: Campaign | null;
  campaignId: string | null;
  isLoadingLeads: boolean;
  refetchLeads: () => void;
  refetchCampaign: () => void;
}

export default function LeadsTable({ 
  leads, 
  campaign, 
  campaignId, 
  isLoadingLeads, 
  refetchLeads, 
  refetchCampaign 
}: LeadsTableProps) {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const { mutate: uploadLeads } = useMutation({
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
  );
}
