import { Heart, Activity, Droplet, Moon, TrendingUp, Thermometer, Weight, Zap } from "lucide-react";
import { cn } from "@/utils";

interface MetricCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  unit: string;
  status: "normal" | "warning" | "good";
  trend?: "up" | "down" | "stable";
  delay?: number;
}

const statusColors = {
  normal: "text-blue-500 bg-blue-500/10 border-blue-500/20",
  warning: "text-amber-500 bg-amber-500/10 border-amber-500/20",
  good: "text-green-500 bg-green-500/10 border-green-500/20",
};

const statusBadgeColors = {
  normal: "bg-blue-500/20 text-blue-600",
  warning: "bg-amber-500/20 text-amber-600",
  good: "bg-green-500/20 text-green-600",
};

function MetricCard({ icon: Icon, label, value, unit, status, trend, delay = 0 }: MetricCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 p-4",
        "bg-card transition-all duration-300 hover:shadow-lg active:scale-95",
        "animate-slide-up opacity-0 min-h-[120px]",
        statusColors[status]
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      {/* Icon */}
      <div className="flex items-start justify-between mb-3">
        <div
          className={cn(
            "flex items-center justify-center rounded-xl h-12 w-12",
            statusColors[status]
          )}
        >
          <Icon className="h-6 w-6" />
        </div>
        {trend && (
          <TrendingUp
            className={cn(
              "h-4 w-4",
              trend === "up" ? "text-green-500" : trend === "down" ? "text-red-500 rotate-180" : "rotate-90 text-muted-foreground"
            )}
          />
        )}
      </div>

      {/* Value */}
      <div className="mb-1">
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-bold text-foreground">{value}</span>
          <span className="text-sm font-medium text-muted-foreground">{unit}</span>
        </div>
      </div>

      {/* Label */}
      <p className="text-sm font-medium text-muted-foreground">{label}</p>

      {/* Status Badge */}
      <div className={cn("absolute top-2 right-2 px-2 py-0.5 rounded-full text-xs font-semibold", statusBadgeColors[status])}>
        {status === "normal" && "Normal"}
        {status === "warning" && "Check"}
        {status === "good" && "Great"}
      </div>
    </div>
  );
}

export function HealthMetrics() {
  const metrics = [
    {
      icon: Heart,
      label: "Heart Rate",
      value: "72",
      unit: "bpm",
      status: "normal" as const,
      trend: "stable" as const,
    },
    {
      icon: Activity,
      label: "Blood Pressure",
      value: "120/80",
      unit: "mmHg",
      status: "good" as const,
      trend: "stable" as const,
    },
    {
      icon: Droplet,
      label: "Blood Sugar",
      value: "95",
      unit: "mg/dL",
      status: "normal" as const,
      trend: "down" as const,
    },
    {
      icon: Thermometer,
      label: "Temperature",
      value: "98.6",
      unit: "Â°F",
      status: "normal" as const,
      trend: "stable" as const,
    },
  ];

  return (
    <div className="mb-10">
      {/* Section Header */}
      <div className="mb-5">
        <h2 className="text-2xl font-bold mb-1 flex items-center gap-2">
          <Activity className="h-7 w-7 text-primary" />
          Your Health Overview
        </h2>
        <p className="text-base text-muted-foreground">Quick glance at your vital signs</p>
      </div>

      {/* 2x2 Grid on mobile, 4x1 on larger screens */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        {metrics.map((metric, index) => (
          <MetricCard key={metric.label} {...metric} delay={index * 50} />
        ))}
      </div>

      {/* Last Updated */}
      <p className="text-xs text-muted-foreground text-center mt-4">
        Last updated: Today at 2:30 PM
      </p>
    </div>
  );
}

