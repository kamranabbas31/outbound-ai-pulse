import { FC, useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Check, Clock, Phone, AlertCircle, Clock3, DollarSign, FileUp, Play, Pause, Search, X } from "lucide-react";
import { toast } from "sonner";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { parseCSV } from "@/utils/csvParser";
import { supabase } from "@/integrations/supabase/client";
import { 
  createCampaign, 
  resetLeads, 
  fetchCampaignById, 
  fetchCampaignLeads,
  createEmptyCampaign,
  addLeadsToCampaign
} from "@/services/campaignService";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

interface Lead {
  id: string;
  name: string;
  phone_number: string;
  phone_id: string | null;
  status: string;
  disposition: string | null;
  duration: number;
  cost: number;
  campaign_id?: string;
}

const Dashboard: FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const campaignId = searchParams.get('campaignId');
  
  const [selectedPacing, setSelectedPacing] = useState("1");
  const [isExecuting, setIsExecuting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isCallInProgress, setIsCallInProgress] = useState(false);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState({
    completed: 0,
    inProgress: 0,
    remaining: 0,
    failed: 0,
    totalDuration: 0,
    totalCost: 0,
  });
  const [currentLeadIndex, setCurrentLeadIndex] = useState(-1);
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);
  const [showNewCampaignDialog, setShowNewCampaignDialog] = useState(false);
  const [campaignName, setCampaignName] = useState("");
  const [lastUploadedFileName, setLastUploadedFileName] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [filteredLeads, setFilteredLeads] = useState<Lead[]>([]);
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [activeCampaign, setActiveCampaign] = useState<any>(null);
  const [isViewingCampaign, setIsViewingCampaign] = useState(false);
  const [showUploadDialog, setShowUploadDialog] = useState(false);
  const [currentCampaignId, setCurrentCampaignId] = useState<string | null>(null);

  // Load campaign data if campaignId is present in URL
  useEffect(() => {
    if (campaignId) {
      loadCampaignData(campaignId);
    } else {
      // Reset to normal dashboard mode if no campaignId
      setIsViewingCampaign(false);
      fetchLeads();
    }
    
    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [campaignId]);

  // Fetch leads on component mount and set up refresh interval
  useEffect(() => {
    if (!campaignId) {
      fetchLeads();
      
      // Set up a refresh interval to update leads every 5 seconds
      const interval = setInterval(() => {
        if (!isViewingCampaign) {
          fetchLeads();
        }
      }, 5000);
      
      setRefreshInterval(interval);
    }
  }, [isViewingCampaign, campaignId]);

  // Setup subscription to leads table changes
  useEffect(() => {
    if (!isViewingCampaign) {
      const subscription = supabase
        .channel('public:leads')
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'leads' 
        }, payload => {
          console.log('Change received:', payload);
          fetchLeads(); // Refresh leads when changes occur
        })
        .subscribe();
        
      return () => {
        supabase.removeChannel(subscription);
      };
    }
  }, [isViewingCampaign]);

  // Check if campaign is completed
  useEffect(() => {
    // Only run this check if we have leads and we're executing a campaign
    if (leads.length > 0 && isExecuting) {
      const pendingLeads = leads.filter(lead => lead.status === 'Pending' && lead.phone_id !== null);
      const inProgressLeads = leads.filter(lead => lead.status === 'In Progress');
      
      // If there are no pending or in-progress leads left, the campaign is finished
      if (pendingLeads.length === 0 && inProgressLeads.length === 0 && stats.completed > 0) {
        // Stop the execution
        stopExecution();
        
        // Show a toast notification
        toast.success("Campaign Finished!", {
          description: `Successfully completed ${stats.completed} calls with ${stats.failed} failures.`,
          duration: 5000,
        });
      }
    }
  }, [leads, isExecuting, stats.completed, stats.failed]);

  const loadCampaignData = async (id: string) => {
    try {
      setIsViewingCampaign(true);
      
      // Fetch campaign details
      const campaign = await fetchCampaignById(id);
      setActiveCampaign(campaign);
      
      // Update the stats from the campaign data
      setStats({
        completed: campaign.completed || 0,
        inProgress: campaign.in_progress || 0,
        remaining: campaign.remaining || 0,
        failed: campaign.failed || 0,
        totalDuration: campaign.duration || 0,
        totalCost: campaign.cost || 0,
      });
      
      // Fetch leads for this campaign
      const campaignLeads = await fetchCampaignLeads(id);
      // Make sure the data conforms to the Lead interface
      const formattedLeads: Lead[] = campaignLeads.map((lead: any) => ({
        id: lead.id,
        name: lead.name || 'Unknown',
        phone_number: lead.phone_number || '',
        phone_id: lead.phone_id,
        status: lead.status || 'Unknown',
        disposition: lead.disposition,
        duration: lead.duration || 0,
        cost: lead.cost || 0,
        campaign_id: lead.campaign_id
      }));

      setLeads(formattedLeads);
      setFilteredLeads(formattedLeads);
      
      // Set campaign name
      setCampaignName(campaign.name || "");
      
      // Update document title
      document.title = `${campaign.name || "Campaign"} - Call Manager`;
      
      toast.success(`Loaded campaign: ${campaign.name}`);
    } catch (error) {
      console.error("Error loading campaign data:", error);
      toast.error("Failed to load campaign data");
      
      // Go back to default dashboard view if there's an error
      clearCampaignView();
    }
  };

  const clearCampaignView = () => {
    // Clear the campaignId from URL without full page reload
    navigate('/', { replace: true });
    setIsViewingCampaign(false);
    setActiveCampaign(null);
    document.title = "Dashboard - Call Manager";
    fetchLeads();
  };

  const fetchLeads = async () => {
    // Skip if we're viewing a campaign, as we don't want to load the active leads
    if (isViewingCampaign) return;
    
    const { data, error } = await supabase
      .from('leads')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error("Error fetching leads:", error);
      toast.error("Failed to fetch leads");
      return;
    }
    
    setLeads(data || []);
    
    // Always update the stats regardless of search state
    updateStats(data || []);
    
    // Only update filteredLeads if there's no active search
    if (!isSearchActive) {
      setFilteredLeads(data || []);
    } else if (isSearchActive && searchTerm) {
      // If search is active, apply the filter to the new data
      // This ensures we have the latest data but maintain the filter
      const filtered = data?.filter(lead => 
        lead.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        lead.phone_number.includes(searchTerm) ||
        lead.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (lead.disposition && lead.disposition.toLowerCase().includes(searchTerm.toLowerCase()))
      );
      setFilteredLeads(filtered || []);
    }
  };

  const updateStats = (leadsData: Lead[]) => {
    const completed = leadsData.filter(lead => lead.status === 'Completed').length || 0;
    const inProgress = leadsData.filter(lead => lead.status === 'In Progress').length || 0;
    const failed = leadsData.filter(lead => lead.status === 'Failed').length || 0;
    const remaining = leadsData.filter(lead => lead.status === 'Pending').length || 0;
    const totalDuration = leadsData.reduce((sum, lead) => sum + (lead.duration || 0), 0) || 0;
    const totalCost = leadsData.reduce((sum, lead) => sum + (lead.cost || 0), 0) || 0;
    
    setStats({
      completed,
      inProgress,
      remaining,
      failed,
      totalDuration,
      totalCost,
    });
  };

  // Get an available phone ID from the pool
  const getAvailablePhoneId = async () => {
    const { data, error } = await supabase.rpc('get_available_phone_id');
    
    if (error) {
      console.error("Error getting available phone ID:", error);
      return null;
    }
    
    return data;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Store the file name
    setLastUploadedFileName(file.name);
    setIsUploading(true);
    
    try {
      // Read the file
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const content = event.target?.result as string;
          const parsedLeads = parseCSV(content);
          
          if (parsedLeads.length === 0) {
            toast.error("No valid leads found in the CSV");
            setIsUploading(false);
            return;
          }
          
          if (currentCampaignId) {
            // We're uploading leads to a specific campaign
            const formattedLeads = [];
            
            // Get available phone IDs for these leads
            for (const lead of parsedLeads) {
              // Try to get an available phone ID
              const phoneId = await getAvailablePhoneId();
              
              formattedLeads.push({
                name: lead.name,
                phone_number: lead.phoneNumber,
                phone_id: phoneId,
                status: phoneId ? 'Pending' : 'Failed',
                disposition: phoneId ? null : 'No available phone ID'
              });
            }
            
            // Add leads to the campaign
            const updatedCampaign = await addLeadsToCampaign(currentCampaignId, formattedLeads);
            
            if (updatedCampaign) {
              toast.success(`Successfully uploaded ${formattedLeads.length} leads to campaign`);
              
              // Load the campaign data to display stats directly
              await loadCampaignData(currentCampaignId);
              
              // Reset state
              setCurrentCampaignId(null);
              setShowUploadDialog(false);
            }
          } else {
            // Regular upload to the active leads table
            let successCount = 0;
            let errorCount = 0;
            
            // Insert leads into the database
            for (const lead of parsedLeads) {
              try {
                // Try to get an available phone ID
                const phoneId = await getAvailablePhoneId();
                
                // Insert the lead with the phone ID if available
                const { error } = await supabase.from('leads').insert({
                  name: lead.name,
                  phone_number: lead.phoneNumber,
                  phone_id: phoneId,
                  status: phoneId ? 'Pending' : 'Failed',
                  disposition: phoneId ? null : 'No available phone ID'
                });
                
                if (error) {
                  console.error("Error inserting lead:", error);
                  errorCount++;
                } else {
                  successCount++;
                }
              } catch (err) {
                console.error("Error processing lead:", err);
                errorCount++;
              }
            }
            
            if (successCount > 0) {
              toast.success(`Successfully uploaded ${successCount} leads`);
            }
            
            if (errorCount > 0) {
              toast.error(`Failed to upload ${errorCount} leads`);
            }
            
            fetchLeads(); // Refresh the leads list
          }
        } catch (err) {
          console.error("Error parsing CSV:", err);
          toast.error("Failed to parse CSV file. Make sure it has Name and Phone columns.");
        }
        
        setIsUploading(false);
      };
      
      reader.readAsText(file);
    } catch (err) {
      console.error("Error reading file:", err);
      toast.error("Failed to read file");
      setIsUploading(false);
    }
    
    // Reset the file input
    e.target.value = '';
  };

  const triggerCall = async (leadId: string) => {
    try {
      setIsCallInProgress(true);
      
      // Find the lead in the current leads array
      const leadToCall = leads.find(lead => lead.id === leadId);
      
      // Check if lead is eligible for calling
      if (leadToCall && leadToCall.status !== 'Pending') {
        toast.error(`Cannot call lead: ${leadToCall.name}. Lead status is ${leadToCall.status}`);
        setIsCallInProgress(false);
        return;
      }
      
      const response = await supabase.functions.invoke('trigger-call', {
        body: { leadId }
      });
      
      if (response.error) {
        toast.error(`Failed to initiate call: ${response.error.message}`);
        console.error("Error initiating call:", response.error);
      } else if (response.data.success) {
        toast.success("Call initiated successfully");
        
        // Update the lead status to "In Progress" and set disposition
        const { error: updateError } = await supabase
          .from('leads')
          .update({
            status: 'In Progress',
            disposition: 'Call initiated'
          })
          .eq('id', leadId);
          
        if (updateError) {
          console.error("Error updating lead status:", updateError);
        }
      } else {
        toast.error(response.data.message || "Failed to initiate call");
      }
      
      fetchLeads(); // Refresh leads to get updated status
    } catch (err) {
      console.error("Error triggering call:", err);
      toast.error("Failed to initiate call");
    } finally {
      setIsCallInProgress(false);
    }
  };

  const startExecution = () => {
    // Get only pending leads with valid phone IDs
    const pendingLeads = leads.filter(lead => lead.status === 'Pending' && lead.phone_id !== null);
    
    if (pendingLeads.length === 0) {
      toast.error("No pending leads to process");
      return;
    }
    
    setIsExecuting(true);
    toast.success(`Started processing ${pendingLeads.length} leads`);
    
    // Get pacing interval in milliseconds
    const pacingInterval = (1 / parseInt(selectedPacing, 10)) * 1000;
    setCurrentLeadIndex(0);
    
    // Create a set to track leads that have already been processed
    const processedLeadIds = new Set<string>();
    
    // Start the interval to process leads based on pacing
    const id = setInterval(() => {
      setCurrentLeadIndex(prevIndex => {
        // Safety check: make sure we have pending leads
        if (pendingLeads.length === 0) {
          if (intervalId !== null) {
            clearInterval(intervalId);
            setIntervalId(null);
            setIsExecuting(false);
            toast.error("No leads to process");
          }
          return -1;
        }
        
        if (prevIndex >= pendingLeads.length - 1) {
          // We've processed all leads, but don't stop the interval yet
          // as we want to let the actual calls complete
          return -1;
        }
        
        // Make sure we have a valid lead at this index
        const currentLead = pendingLeads[prevIndex];
        
        // Check if we already processed this lead
        if (currentLead && currentLead.id && !isCallInProgress && !processedLeadIds.has(currentLead.id)) {
          // Add the lead to the processed set
          processedLeadIds.add(currentLead.id);
          // Trigger the call
          triggerCall(currentLead.id);
        }
        
        // Move to the next lead
        return prevIndex + 1;
      });
    }, pacingInterval);
    
    setIntervalId(id);
  };

  const stopExecution = () => {
    if (intervalId !== null) {
      clearInterval(intervalId);
      setIntervalId(null);
    }
    setIsExecuting(false);
    toast.info("Stopped execution");
  };

  const toggleExecution = async () => {
    if (!isExecuting) {
      startExecution();
    } else {
      stopExecution();
    }
  };

  const triggerSingleCall = async (leadId: string) => {
    if (isCallInProgress) {
      toast.info("A call is already in progress, please wait");
      return;
    }
    
    await triggerCall(leadId);
    fetchLeads();
  };

  const handleNewCampaign = () => {
    // Show the dialog to name the campaign
    setShowNewCampaignDialog(true);
    
    // Set default campaign name
    setCampaignName(`Campaign ${new Date().toLocaleDateString()}`);
  };

  const handleCreateNewCampaign = async () => {
    try {
      // Validate campaign name
      if (!campaignName.trim()) {
        toast.error("Please enter a valid campaign name");
        return;
      }
      
      // Create an empty campaign with the provided name
      const campaign = await createEmptyCampaign(campaignName);
      
      if (campaign) {
        toast.success(`Campaign "${campaignName}" created successfully`);
        setShowNewCampaignDialog(false);
        
        // Show the upload leads dialog
        setCurrentCampaignId(campaign.id);
        setShowUploadDialog(true);
      } else {
        toast.error("Failed to create campaign");
      }
    } catch (error) {
      console.error("Error creating campaign:", error);
      toast.error("An error occurred while creating the campaign");
    }
  };

  // Apply search filter to leads
  const applySearchFilter = (leadsToFilter: Lead[], term: string) => {
    if (!term.trim()) {
      setFilteredLeads(leadsToFilter);
      return leadsToFilter;
    }
    
    const filtered = leadsToFilter.filter(lead => 
      lead.name.toLowerCase().includes(term.toLowerCase()) || 
      lead.phone_number.includes(term) ||
      lead.status.toLowerCase().includes(term.toLowerCase()) ||
      (lead.disposition && lead.disposition.toLowerCase().includes(term.toLowerCase()))
    );
    
    setFilteredLeads(filtered);
    return filtered;
  };

  // Search function
  const handleSearch = () => {
    // Only set search as active if there's actually a search term
    const hasSearchTerm = !!searchTerm.trim();
    setIsSearchActive(hasSearchTerm);
    
    if (hasSearchTerm) {
      const filtered = applySearchFilter(leads, searchTerm);
      
      if (filtered.length === 0) {
        toast.info("No matching leads found");
      } else {
        toast.success(`Found ${filtered.length} matching leads`);
      }
    } else {
      // If search term is empty, show all leads
      setFilteredLeads(leads);
      toast.info("Showing all leads");
    }
  };

  // Clear search
  const clearSearch = () => {
    setSearchTerm("");
    setIsSearchActive(false);
    setFilteredLeads(leads);
    toast.info("Search cleared");
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">Call Manager</h1>
            {isViewingCampaign && activeCampaign ? (
              <>
                <div className="flex items-center mt-4 space-x-2">
                  <h2 className="text-2xl font-bold text-gray-800">Campaign: {activeCampaign.name}</h2>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={clearCampaignView}
                  >
                    Back to Dashboard
                  </Button>
                </div>
                <p className="text-muted-foreground">
                  Viewing historical campaign data from {new Date(activeCampaign.created_at).toLocaleDateString()}
                </p>
              </>
            ) : (
              <>
                <h2 className="text-2xl font-bold text-gray-800 mt-4">Dashboard</h2>
                <p className="text-muted-foreground">Manage and monitor your AI outbound calling campaigns.</p>
              </>
            )}
          </div>
          <div className="flex items-center space-x-4">
            {!isViewingCampaign && (
              <>
                <Button variant="outline" onClick={fetchLeads}>
                  Refresh Data
                </Button>
                <Button className="bg-primary" onClick={handleNewCampaign}>+ New Campaign</Button>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Completed Calls"
          value={stats.completed.toString()}
          description="Successfully completed"
          icon={<Check className="h-5 w-5 text-green-500" />}
          variant="success"
        />
        <StatCard
          title="In Progress"
          value={stats.inProgress.toString()}
          description="Currently active"
          icon={<Clock className="h-5 w-5 text-blue-500" />}
          variant="info"
        />
        <StatCard
          title="Remaining Calls"
          value={stats.remaining.toString()}
          description="Waiting to be made"
          icon={<Phone className="h-5 w-5 text-gray-500" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Failed Calls"
          value={stats.failed.toString()}
          description="Failed attempts"
          icon={<AlertCircle className="h-5 w-5 text-red-500" />}
          variant="error"
        />
        <StatCard
          title="Total Duration"
          value={`${stats.totalDuration.toFixed(1)} min`}
          description="Call duration"
          icon={<Clock3 className="h-5 w-5 text-purple-500" />}
          variant="purple"
        />
        <StatCard
          title="Total Cost"
          value={`$${stats.totalCost.toFixed(2)}`}
          description="@ $0.99 per minute"
          icon={<DollarSign className="h-5 w-5 text-orange-500" />}
          variant="orange"
        />
      </div>

      {!isViewingCampaign && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="p-6 bg-white shadow-sm rounded-lg border">
            <h3 className="text-lg font-semibold mb-2">File Upload</h3>
            <p className="text-sm text-muted-foreground mb-4">Upload a CSV file with lead data</p>
            <div className="flex flex-col space-y-4">
              <Button 
                className="flex items-center space-x-2" 
                variant="outline" 
                onClick={() => document.getElementById('file-upload')?.click()}
                disabled={isUploading}
              >
                <FileUp className="h-4 w-4" />
                <span>{isUploading ? "Uploading..." : "Upload CSV"}</span>
              </Button>
              <input 
                id="file-upload" 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={handleFileUpload} 
                disabled={isUploading}
              />
              <p className="text-xs text-muted-foreground">CSV must include columns for Lead Name and Phone Number</p>
            </div>
          </div>

          <div className="p-6 bg-white shadow-sm rounded-lg border">
            <h3 className="text-lg font-semibold mb-2">Pacing Controls</h3>
            <p className="text-sm text-muted-foreground mb-4">Set the rate of outbound calls</p>
            <div className="flex flex-col space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Call Pacing (calls/sec)</label>
                <Select 
                  value={selectedPacing} 
                  onValueChange={setSelectedPacing}
                  disabled={isExecuting}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select pacing" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 call/sec</SelectItem>
                    <SelectItem value="2">2 calls/sec</SelectItem>
                    <SelectItem value="3">3 calls/sec</SelectItem>
                    <SelectItem value="5">5 calls/sec</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="p-6 bg-white shadow-sm rounded-lg border">
            <h3 className="text-lg font-semibold mb-2">Call Execution</h3>
            <p className="text-sm text-muted-foreground mb-4">Control the calling queue</p>
            <div className="flex flex-col space-y-4">
              <Button 
                className={`${isExecuting ? "bg-red-500 hover:bg-red-600" : "bg-green-500 hover:bg-green-600"} w-full`} 
                onClick={toggleExecution}
                disabled={isCallInProgress}
              >
                {isExecuting ? (
                  <>
                    <Pause className="h-4 w-4 mr-2" />
                    Stop Execution
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4 mr-2" />
                    Start Execution
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground">Upload a CSV file and click Start to begin calling</p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow-sm rounded-lg border overflow-hidden">
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">
              {isViewingCampaign ? 'Campaign Leads' : 'Call Log'}
            </h3>
            <div className="flex space-x-2">
              <div className="relative">
                <Input
                  placeholder="Search leads..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 pr-8"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleSearch();
                    }
                  }}
                />
                {isSearchActive && (
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="absolute right-0 top-0 h-full rounded-l-none"
                    onClick={clearSearch}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
              <Button 
                variant="outline" 
                onClick={handleSearch}
                className="flex items-center space-x-2"
              >
                <Search className="h-4 w-4" />
                <span>Search</span>
              </Button>
            </div>
          </div>
        </div>
        <div className="p-4">
          <div className="relative w-full overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead Name</TableHead>
                  <TableHead>Phone Number</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Disposition</TableHead>
                  <TableHead>Duration (min)</TableHead>
                  <TableHead>Cost</TableHead>
                  {!isViewingCampaign && (
                    <TableHead>Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLeads.length > 0 ? (
                  filteredLeads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>{lead.name}</TableCell>
                      <TableCell>{lead.phone_number}</TableCell>
                      <TableCell>{lead.status}</TableCell>
                      <TableCell>{lead.disposition || '-'}</TableCell>
                      <TableCell>{lead.duration?.toFixed(1) || '0.0'}</TableCell>
                      <TableCell>${lead.cost?.toFixed(2) || '0.00'}</TableCell>
                      {!isViewingCampaign && (
                        <TableCell>
                          {lead.status === 'Pending' && lead.phone_id && (
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => triggerSingleCall(lead.id)}
                              disabled={isCallInProgress}
                            >
                              <Phone className="h-4 w-4 mr-1" /> Call
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="h-[100px]">
                    <TableCell colSpan={isViewingCampaign ? 6 : 7} className="text-center text-muted-foreground">
                      {searchTerm && isSearchActive 
                        ? "No matching leads found." 
                        : isViewingCampaign 
                          ? "No leads found for this campaign." 
                          : "No leads found. Upload a CSV file to get started."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* New Campaign Dialog */}
      <Dialog open={showNewCampaignDialog} onOpenChange={setShowNewCampaignDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create New Campaign</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="campaign-name">Campaign Name</Label>
              <Input 
                id="campaign-name" 
                value={campaignName} 
                onChange={(e) => setCampaignName(e.target.value)}
                placeholder="Enter campaign name"
                autoFocus
              />
            </div>
            <p className="text-sm text-muted-foreground">
              This will create a new empty campaign. You'll be prompted to upload leads afterward.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewCampaignDialog(false)}>Cancel</Button>
            <Button onClick={handleCreateNewCampaign}>Create Campaign</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upload Leads Dialog */}
      <Dialog open={showUploadDialog} onOpenChange={setShowUploadDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload Leads</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <p>Upload a CSV file with leads for your new campaign.</p>
            <Button 
              className="flex items-center space-x-2 w-full" 
              variant="outline" 
              onClick={() => document.getElementById('campaign-file-upload')?.click()}
              disabled={isUploading}
            >
              <FileUp className="h-4 w-4" />
              <span>{isUploading ? "Uploading..." : "Select CSV File"}</span>
            </Button>
            <input 
              id="campaign-file-upload" 
              type="file" 
              accept=".csv" 
              className="hidden" 
              onChange={handleFileUpload} 
              disabled={isUploading}
            />
            <p className="text-xs text-muted-foreground">
              CSV must include columns for Lead Name and Phone Number
            </p>
          </div>
          <DialogFooter>
            <Button 
              variant="outline" 
              onClick={() => {
                setShowUploadDialog(false);
                setCurrentCampaignId(null);
              }}
            >
              Skip Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
