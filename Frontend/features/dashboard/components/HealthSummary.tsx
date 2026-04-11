import { Activity, Heart, Shield, TrendingUp } from "lucide-react";
import { cn } from "@/utils";

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  trend?: string;
  color: "primary" | "secondary" | "success" | "accent";
}

const colorClasses = {
  primary: {
    bg: "bg-primary-light",
    text: "text-primary",
  },
  secondary: {
    bg: "bg-secondary-light",
    text: "text-secondary",
  },
  success: {
    bg: "bg-success-light",
    text: "text-success",
  },
  accent: {
    bg: "bg-accent-light",
    text: "text-accent",
  },
};

function StatCard({ label, value, icon: Icon, trend, color }: StatCardProps) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-xl bg-card border border-border/50">
      <div
        className={cn(
          "flex h-10 w-10 items-center justify-center rounded-lg",
          colorClasses[color].bg
        )}
      >
        <Icon className={cn("h-5 w-5", colorClasses[color].text)} />
      </div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <div className="flex items-baseline gap-2">
          <span className="text-lg font-semibold">{value}</span>
          {trend && (
            <span className="text-xs text-success flex items-center gap-0.5">
              <TrendingUp className="h-3 w-3" />
              {trend}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

export function HealthSummary() {
  return (
    <div className="space-y-4 animate-slide-up opacity-0" style={{ animationDelay: "400ms", animationFillMode: "forwards" }}>
      <h2 className="text-lg font-semibold">Health Overview</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          label="Health Score"
          value="85/100"
          icon={Heart}
          trend="+5%"
          color="primary"
        />
        <StatCard
          label="Reports"
          value="12"
          icon={Activity}
          color="secondary"
        />
        <StatCard
          label="Scans"
          value="4"
          icon={Shield}
          color="success"
        />
        <StatCard
          label="Consultations"
          value="3"
          icon={TrendingUp}
          color="accent"
        />
      </div>
    </div>
  );
}

