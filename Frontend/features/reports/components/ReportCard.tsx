import { FileText, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/utils";

interface Report {
  id: string;
  title: string;
  type: "symptom" | "scan" | "comprehensive";
  date: string;
  summary: string;
  status: "completed" | "pending";
}

interface ReportCardProps {
  report: Report;
  onView: (id: string) => void;
}

const typeConfig = {
  symptom: {
    label: "Symptom Analysis",
    color: "bg-primary-light text-primary",
  },
  scan: {
    label: "Scan Report",
    color: "bg-secondary-light text-secondary",
  },
  comprehensive: {
    label: "Health Assessment",
    color: "bg-accent-light text-accent",
  },
};

export function ReportCard({ report, onView }: ReportCardProps) {
  const config = typeConfig[report.type];

  return (
    <div
      className="group rounded-2xl border border-border/50 bg-card p-4 transition-all duration-200 hover:shadow-medium cursor-pointer"
      onClick={() => onView(report.id)}
    >
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-muted shrink-0">
          <FileText className="h-6 w-6 text-muted-foreground" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", config.color)}>
              {config.label}
            </span>
            {report.status === "pending" && (
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-warning-light text-warning">
                Pending
              </span>
            )}
          </div>

          <h3 className="font-semibold text-foreground truncate">{report.title}</h3>
          <p className="text-sm text-muted-foreground line-clamp-1 mt-0.5">
            {report.summary}
          </p>

          <div className="flex items-center gap-1 mt-2 text-xs text-muted-foreground">
            <Calendar className="h-3 w-3" />
            <span>{report.date}</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </div>
      </div>
    </div>
  );
}

