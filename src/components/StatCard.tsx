
import { FC, ReactNode } from "react";

interface StatCardProps {
  title: string;
  value: string | number;
  description: string;
  icon: ReactNode;
  variant?: "success" | "info" | "warning" | "error" | "purple" | "orange";
}

const StatCard: FC<StatCardProps> = ({ title, value, description, icon, variant = "info" }) => {
  return (
    <div className={`stats-card stats-card-${variant}`}>
      <div className="absolute top-6 right-6">{icon}</div>
      <div className="flex flex-col items-center">
        <h3 className="text-lg font-medium text-gray-600">{title}</h3>
        <p className="text-4xl font-bold mt-2">{value}</p>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  );
};

export default StatCard;
