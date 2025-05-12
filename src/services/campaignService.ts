
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/**
 * Creates a new campaign from current leads data
 */
export const createCampaign = async (fileName: string | null = null) => {
  try {
    // Get current leads stats
    const { data: leads, error: leadsError } = await supabase
      .from('leads')
      .select('*');
      
    if (leadsError) {
      console.error("Error fetching leads:", leadsError);
      throw new Error("Failed to fetch leads");
    }
    
    if (!leads || leads.length === 0) {
      toast.error("No leads to save as a campaign");
      return null;
    }
    
    // Calculate campaign statistics
    const completed = leads.filter(lead => lead.status === 'Completed').length || 0;
    const inProgress = leads.filter(lead => lead.status === 'In Progress').length || 0;
    const failed = leads.filter(lead => lead.status === 'Failed').length || 0;
    const remaining = leads.filter(lead => lead.status === 'Pending').length || 0;
    const totalDuration = leads.reduce((sum, lead) => sum + (lead.duration || 0), 0) || 0;
    const totalCost = leads.reduce((sum, lead) => sum + (lead.cost || 0), 0) || 0;
    
    // Generate campaign name based on file name or date
    const campaignName = fileName 
      ? fileName.replace('.csv', '')
      : `Campaign ${new Date().toLocaleDateString()}`;
    
    const status = inProgress > 0 ? 'in-progress' : 
                   completed > 0 ? 'completed' : 
                   failed > 0 ? 'partial' : 'pending';
    
    // Insert new campaign
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert({
        name: campaignName,
        file_name: fileName,
        status: status,
        leads_count: leads.length,
        completed,
        in_progress: inProgress,
        remaining,
        failed,
        duration: totalDuration,
        cost: totalCost
      })
      .select()
      .single();
      
    if (campaignError) {
      console.error("Error creating campaign:", campaignError);
      throw new Error("Failed to create campaign");
    }
    
    // Link leads to the campaign
    const campaignLeads = leads.map(lead => ({
      campaign_id: campaign.id,
      lead_id: lead.id
    }));
    
    const { error: linkError } = await supabase
      .from('campaign_leads')
      .insert(campaignLeads);
      
    if (linkError) {
      console.error("Error linking leads to campaign:", linkError);
      toast.error("Campaign created but some leads could not be linked");
    }
    
    return campaign;
  } catch (err) {
    console.error("Error in createCampaign:", err);
    toast.error("Failed to create campaign");
    return null;
  }
};

/**
 * Fetches all campaigns
 */
export const fetchCampaigns = async () => {
  try {
    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error("Error fetching campaigns:", error);
      throw new Error("Failed to fetch campaigns");
    }
    
    return data || [];
  } catch (err) {
    console.error("Error in fetchCampaigns:", err);
    toast.error("Failed to fetch campaigns");
    return [];
  }
};

/**
 * Resets the leads table by deleting all leads
 */
export const resetLeads = async () => {
  try {
    // Delete all leads
    const { error } = await supabase
      .from('leads')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // This condition ensures all rows are deleted
      
    if (error) {
      console.error("Error resetting leads:", error);
      throw new Error("Failed to reset leads");
    }
    
    return true;
  } catch (err) {
    console.error("Error in resetLeads:", err);
    toast.error("Failed to reset leads table");
    return false;
  }
};
