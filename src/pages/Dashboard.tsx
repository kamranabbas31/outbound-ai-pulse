
import { FC, useState } from "react";
import { Check, Clock, Phone, AlertCircle, Clock3, DollarSign, FileUp, Play } from "lucide-react";
import StatCard from "@/components/StatCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const Dashboard: FC = () => {
  const [selectedPacing, setSelectedPacing] = useState("1");
  const [isExecuting, setIsExecuting] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    // This will be implemented in the backend
    console.log("File uploaded:", e.target.files?.[0]);
  };

  const toggleExecution = () => {
    setIsExecuting(!isExecuting);
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
          value="0"
          description="Successfully completed"
          icon={<Check className="h-5 w-5 text-green-500" />}
          variant="success"
        />
        <StatCard
          title="In Progress"
          value="0"
          description="Currently active"
          icon={<Clock className="h-5 w-5 text-blue-500" />}
          variant="info"
        />
        <StatCard
          title="Remaining Calls"
          value="0"
          description="Waiting to be made"
          icon={<Phone className="h-5 w-5 text-gray-500" />}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Failed Calls"
          value="0"
          description="Failed attempts"
          icon={<AlertCircle className="h-5 w-5 text-red-500" />}
          variant="error"
        />
        <StatCard
          title="Total Duration"
          value="0.0 min"
          description="Call duration"
          icon={<Clock3 className="h-5 w-5 text-purple-500" />}
          variant="purple"
        />
        <StatCard
          title="Total Cost"
          value="$0.00"
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
            <Button className="flex items-center space-x-2" variant="outline" onClick={() => document.getElementById('file-upload')?.click()}>
              <FileUp className="h-4 w-4" />
              <span>Upload CSV</span>
            </Button>
            <input 
              id="file-upload" 
              type="file" 
              accept=".csv" 
              className="hidden" 
              onChange={handleFileUpload} 
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
            <Button className="bg-green-500 hover:bg-green-600 w-full" onClick={toggleExecution}>
              <Play className="h-4 w-4 mr-2" />
              {isExecuting ? "Stop Execution" : "Start Execution"}
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
            <table className="w-full caption-bottom text-sm">
              <thead className="[&_tr]:border-b">
                <tr className="border-b">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Lead Name</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Phone Number</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Disposition</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Duration (min)</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Cost</th>
                </tr>
              </thead>
              <tbody className="[&_tr:last-child]:border-0">
                <tr className="h-[100px] border-t">
                  <td colSpan={6} className="p-4 align-middle text-center text-muted-foreground">
                    No campaign selected. Please select a campaign to view its calls.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
