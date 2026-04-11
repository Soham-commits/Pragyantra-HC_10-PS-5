import { FileText, MessageCircle, Scan, Clock } from "lucide-react";
import { cn } from "@/utils";

interface ActivityItem {
  id: string;
  type: "chat" | "scan" | "report";
  title: string;
  description: string;
  time: string;
}

const activityData: ActivityItem[] = [
  {
    id: "1",
    type: "chat",
    title: "Symptom Analysis",
    description: "Discussed headache and fatigue symptoms",
    time: "2 hours ago",
  },
  {
    id: "2",
    type: "scan",
    title: "Chest X-Ray Analysis",
    description: "Uploaded and analyzed chest X-ray",
    time: "1 day ago",
  },
  {
    id: "3",
    type: "report",
    title: "Health Report Generated",
    description: "Comprehensive health assessment completed",
    time: "3 days ago",
  },
];

const iconMap = {
  chat: MessageCircle,
  scan: Scan,
  report: FileText,
};

const colorMap = {
  chat: "bg-primary-light text-primary",
  scan: "bg-secondary-light text-secondary",
  report: "bg-accent-light text-accent",
};

export function RecentActivity() {
  return (
    <div
      className="space-y-4 animate-slide-up opacity-0"
      style={{ animationDelay: "500ms", animationFillMode: "forwards" }}
    >
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Recent Activity</h2>
        <button className="text-sm text-primary hover:underline">View all</button>
      </div>

      <div className="space-y-3">
        {activityData.map((activity) => {
          const Icon = iconMap[activity.type];
          return (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-4 rounded-xl bg-card border border-border/50 transition-all duration-200 hover:shadow-soft"
            >
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg shrink-0",
                  colorMap[activity.type]
                )}
              >
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-medium text-foreground">{activity.title}</h4>
                <p className="text-sm text-muted-foreground truncate">
                  {activity.description}
                </p>
              </div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
                <Clock className="h-3 w-3" />
                <span>{activity.time}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

