
import { FC } from "react";
import { Calendar, Phone, DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatCard from "@/components/StatCard";

const Billing: FC = () => {
  return (
    <div className="space-y-8">
      <div className="flex flex-col space-y-2">
        <h2 className="text-2xl font-bold">Billing Dashboard</h2>
        <p className="text-muted-foreground">Track your usage and expenses</p>
      </div>

      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold">Usage Summary</h3>
          <span className="text-sm text-muted-foreground">Apr 13, 2025 — May 13, 2025</span>
        </div>
        <div className="flex space-x-4">
          <Button variant="outline" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>Apr 13, 2025</span>
          </Button>
          <Button variant="outline" className="flex items-center space-x-2">
            <Calendar className="h-4 w-4" />
            <span>May 13, 2025</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard
          title="Total Calls"
          value="377"
          description="Calls completed across all campaigns"
          icon={<Phone className="h-5 w-5 text-blue-500" />}
          variant="info"
        />
        <StatCard
          title="Total Minutes"
          value="577.25"
          description="Total duration of all calls"
          icon={<Clock3 className="h-5 w-5 text-purple-500" />}
          variant="purple"
        />
        <StatCard
          title="Total Cost"
          value="$571.48"
          description="Cost at $0.99 per minute"
          icon={<DollarSign className="h-5 w-5 text-orange-500" />}
          variant="orange"
        />
      </div>
    </div>
  );
};

// Missing import for Clock3
import { Clock3 } from "lucide-react";

export default Billing;
