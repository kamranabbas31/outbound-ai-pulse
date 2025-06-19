
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

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

export const useDashboardData = (campaignId: string | null) => {
  const { toast } = useToast();

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

  return {
    leads,
    campaign,
    isLoadingLeads,
    isLoadingCampaign,
    refetchLeads,
    refetchCampaign
  };
};
