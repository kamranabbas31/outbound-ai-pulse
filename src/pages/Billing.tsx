
import { FC, useState, useEffect } from "react";
import { Calendar, Phone, DollarSign, Clock3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/StatCard";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface BillingStats {
  totalCalls: number;
  totalMinutes: number;
  totalCost: number;
}

const Billing: FC = () => {
  const [startDate, setStartDate] = useState<string>(() => {
    const date = new Date();
    date.setMonth(date.getMonth() - 1);
    return date.toISOString().split('T')[0];
  });
  
  const [endDate, setEndDate] = useState<string>(() => {
    const date = new Date();
    return date.toISOString().split('T')[0];
  });
  
  const [stats, setStats] = useState<BillingStats>({
    totalCalls: 0,
    totalMinutes: 0,
    totalCost: 0
  });
  
  const [isLoading, setIsLoading] = useState<boolean>(false);

  // Format dates for display
  const formatDisplayDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Fetch billing data from campaigns
  const fetchBillingData = async () => {
    setIsLoading(true);
    try {
      // Query campaigns created between start and end dates
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('*')
        .gte('created_at', startDate)
        .lte('created_at', endDate + 'T23:59:59');
        
      if (error) {
        throw error;
      }
      
      if (campaigns) {
        // Calculate total calls and cost
        const totalCalls = campaigns.reduce((sum, campaign) => sum + (campaign.completed || 0), 0);
        const totalMinutes = campaigns.reduce((sum, campaign) => sum + (campaign.duration || 0), 0);
        const totalCost = campaigns.reduce((sum, campaign) => sum + (campaign.cost || 0), 0);
        
        setStats({
          totalCalls,
          totalMinutes: parseFloat(totalMinutes.toFixed(2)),
          totalCost: parseFloat(totalCost.toFixed(2))
        });
      }
    } catch (error) {
      console.error("Error fetching billing data:", error);
      toast.error("Failed to fetch billing data");
    } finally {
      setIsLoading(false);
    }
  };

  // Initial fetch on component mount
  useEffect(() => {
    fetchBillingData();
  }, [startDate, endDate]);

  const handleDateChange = (type: 'start' | 'end', value: string) => {
    if (type === 'start') {
      setStartDate(value);
    } else {
      setEndDate(value);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col space-y-2">
        <h2 className="text-2xl font-bold">Billing Dashboard</h2>
        <p className="text-muted-foreground">Track your usage and expenses</p>
      </div>

      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold">Usage Summary</h3>
          <span className="text-sm text-muted-foreground">
            {formatDisplayDate(startDate)} — {formatDisplayDate(endDate)}
          </span>
        </div>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center space-x-2">
            <label htmlFor="start-date" className="text-sm">Start:</label>
            <input
              id="start-date"
              type="date"
              value={startDate}
              onChange={(e) => handleDateChange('start', e.target.value)}
              className="border rounded p-2 text-sm"
            />
          </div>
          <div className="flex items-center space-x-2">
            <label htmlFor="end-date" className="text-sm">End:</label>
            <input
              id="end-date"
              type="date"
              value={endDate}
              onChange={(e) => handleDateChange('end', e.target.value)}
              className="border rounded p-2 text-sm"
            />
          </div>
          <Button 
            variant="outline" 
            onClick={fetchBillingData}
            disabled={isLoading}
            className="flex items-center space-x-2"
          >
            {isLoading ? "Loading..." : "Refresh Data"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Calls"
          value={stats.totalCalls.toString()}
          description="Calls completed across all campaigns"
          icon={<Phone className="h-5 w-5 text-blue-500" />}
          variant="info"
        />
        <StatCard
          title="Total Minutes"
          value={stats.totalMinutes.toFixed(2)}
          description="Total duration of all calls"
          icon={<Clock3 className="h-5 w-5 text-purple-500" />}
          variant="purple"
        />
        <StatCard
          title="Total Cost"
          value={`$${stats.totalCost.toFixed(2)}`}
          description="Cost at $0.99 per minute"
          icon={<DollarSign className="h-5 w-5 text-orange-500" />}
          variant="orange"
        />
      </div>
    </div>
  );
};

export default Billing;
