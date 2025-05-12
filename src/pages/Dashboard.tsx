import { FC, useState, useEffect } from "react";
import { Check, Clock, Phone, AlertCircle, Clock3, DollarSign, FileUp, Play, Pause } from "lucide-react";
import { toast } from "sonner";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { parseCSV } from "@/utils/csvParser";
import { supabase } from "@/integrations/supabase/client";

interface Lead {
  id: string;
  name: string;
  phone_number: string;
  phone_id: string | null;
  status: string;
  disposition: string | null;
  duration: number;
  cost: number;
}

const Dashboard: FC = () => {
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
  // Changed from number to NodeJS.Timeout | null to match setTimeout return type
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null);

  // Fetch leads on component mount
  useEffect(() => {
    fetchLeads();
  }, []);

  // Cleanup interval on unmount
  useEffect(() => {
    return () => {
      if (intervalId !== null) {
        clearInterval(intervalId);
      }
    };
  }, [intervalId]);

  const fetchLeads = async () => {
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
    
    // Update stats
    const completed = data?.filter(lead => lead.status === 'Completed').length || 0;
    const inProgress = data?.filter(lead => lead.status === 'In Progress').length || 0;
    const failed = data?.filter(lead => lead.status === 'Failed').length || 0;
    const remaining = data?.filter(lead => lead.status === 'Pending').length || 0;
    const totalDuration = data?.reduce((sum, lead) => sum + (lead.duration || 0), 0) || 0;
    const totalCost = data?.reduce((sum, lead) => sum + (lead.cost || 0), 0) || 0;
    
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
          
          // Get available phone IDs for these leads
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
                phone_id: phoneId,  // This might be null if no phone IDs are available
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
      const response = await supabase.functions.invoke('trigger-call', {
        body: { leadId }
      });
      
      if (response.error) {
        toast.error(`Failed to initiate call: ${response.error.message}`);
        console.error("Error initiating call:", response.error);
      } else if (response.data.success) {
        toast.success("Call initiated successfully");
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
    
    // Start the interval to process leads based on pacing
    const id = setInterval(() => {
      setCurrentLeadIndex(prevIndex => {
        if (prevIndex >= pendingLeads.length - 1) {
          // We've processed all leads, stop the interval
          if (intervalId !== null) {
            clearInterval(intervalId);
            setIntervalId(null);
            setIsExecuting(false);
            toast.success("Finished processing all leads");
          }
          return -1;
        }
        
        // Trigger the call for the current lead
        if (!isCallInProgress) {
          triggerCall(pendingLeads[prevIndex].id);
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

  return (
    <div className="space-y-8">
      <div className="flex flex-col space-y-2">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-primary">Call Manager</h1>
            <h2 className="text-2xl font-bold text-gray-800 mt-4">Dashboard</h2>
            <p className="text-muted-foreground">Manage and monitor your AI outbound calling campaigns.</p>
          </div>
          <Button className="bg-primary">+ New Campaign</Button>
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

      <div className="bg-white shadow-sm rounded-lg border overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Call Log</h3>
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
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.length > 0 ? (
                  leads.map((lead) => (
                    <TableRow key={lead.id}>
                      <TableCell>{lead.name}</TableCell>
                      <TableCell>{lead.phone_number}</TableCell>
                      <TableCell>{lead.status}</TableCell>
                      <TableCell>{lead.disposition || '-'}</TableCell>
                      <TableCell>{lead.duration?.toFixed(1) || '0.0'}</TableCell>
                      <TableCell>${lead.cost?.toFixed(2) || '0.00'}</TableCell>
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
                    </TableRow>
                  ))
                ) : (
                  <TableRow className="h-[100px]">
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No leads found. Upload a CSV file to get started.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
