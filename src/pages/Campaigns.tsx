
import { FC } from "react";
import { Badge } from "@/components/ui/badge";

const Campaigns: FC = () => {
  // Mock data based on the screenshot
  const campaigns = [
    {
      id: 1,
      name: "AI-Caller ConversionMediaGroup - Sheet12 (11)",
      fileName: "AI-Caller ConversionMediaGroup - Sheet12 (11).csv",
      status: "in-progress",
      leads: 14,
      completed: 0,
      inProgress: 1,
      remaining: 13,
      failed: 0,
      duration: 0.0,
      cost: "$0.00",
      dateCreated: "May 13, 2025",
    },
    {
      id: 2,
      name: "AI-Caller ConversionMediaGroup - Sheet12 (11)",
      fileName: "AI-Caller ConversionMediaGroup - Sheet12 (11).csv",
      status: "in-progress",
      leads: 14,
      completed: 0,
      inProgress: 1,
      remaining: 13,
      failed: 0,
      duration: 0.0,
      cost: "$0.00",
      dateCreated: "May 12, 2025",
    },
    {
      id: 3,
      name: "AI-Caller ConversionMediaGroup - Sheet12 (10)",
      fileName: "AI-Caller ConversionMediaGroup - Sheet12 (10).csv",
      status: "stopped",
      leads: 14,
      completed: 0,
      inProgress: 1,
      remaining: 13,
      failed: 0,
      duration: 0.0,
      cost: "$0.00",
      dateCreated: "May 12, 2025",
    },
    {
      id: 4,
      name: "AI-Caller ConversionMediaGroup - Sheet12 (10)",
      fileName: "AI-Caller ConversionMediaGroup - Sheet12 (10).csv",
      status: "in-progress",
      leads: 14,
      completed: 0,
      inProgress: 1,
      remaining: 13,
      failed: 0,
      duration: 0.0,
      cost: "$0.00",
      dateCreated: "May 12, 2025",
    },
    {
      id: 5,
      name: "AI-Caller ConversionMediaGroup - Sheet12 (9)",
      fileName: "AI-Caller ConversionMediaGroup - Sheet12 (9).csv",
      status: "in-progress",
      leads: 4,
      completed: 1,
      inProgress: 1,
      remaining: 2,
      failed: 0,
      duration: 1.0,
      cost: "$0.99",
      dateCreated: "May 12, 2025",
    },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "in-progress":
        return <Badge className="bg-blue-500 hover:bg-blue-600">In Progress</Badge>;
      case "stopped":
        return <Badge variant="outline" className="text-gray-500 border-gray-300">Stopped</Badge>;
      case "paused":
        return <Badge variant="outline" className="text-amber-500 border-amber-300">Paused</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col space-y-2">
        <h2 className="text-2xl font-bold">Campaigns</h2>
        <p className="text-muted-foreground">View and manage your calling campaigns</p>
      </div>

      <div className="bg-white shadow-sm rounded-lg border overflow-hidden">
        <div className="p-6 border-b">
          <h3 className="text-lg font-semibold">Campaign History</h3>
          <p className="text-sm text-muted-foreground">List of all your uploaded campaign files and their statuses</p>
        </div>
        <div className="p-0">
          <div className="relative w-full overflow-auto">
            <table className="w-full caption-bottom text-sm">
              <thead>
                <tr className="border-b">
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Campaign Name</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">File Name</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Status</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Leads</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Completed</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">In Progress</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Remaining</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Failed</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Duration (min)</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Cost ($)</th>
                  <th className="h-12 px-4 text-left align-middle font-medium text-muted-foreground">Date Created</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((campaign) => (
                  <tr key={campaign.id} className="border-b">
                    <td className="p-4 align-middle">{campaign.name}</td>
                    <td className="p-4 align-middle">{campaign.fileName}</td>
                    <td className="p-4 align-middle">{getStatusBadge(campaign.status)}</td>
                    <td className="p-4 align-middle">{campaign.leads}</td>
                    <td className="p-4 align-middle">{campaign.completed}</td>
                    <td className="p-4 align-middle">{campaign.inProgress}</td>
                    <td className="p-4 align-middle">{campaign.remaining}</td>
                    <td className="p-4 align-middle">{campaign.failed}</td>
                    <td className="p-4 align-middle">{campaign.duration}</td>
                    <td className="p-4 align-middle">{campaign.cost}</td>
                    <td className="p-4 align-middle">{campaign.dateCreated}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Campaigns;
