import { AlertCircle, CheckCircle, AlertTriangle, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils";
import { Link } from "react-router-dom";

interface PredictionResultProps {
  result: {
    disease: string;
    probability: string;
    severity: "Low" | "Moderate" | "High";
    recommendations: string[];
  };
  onConsult?: () => void;
}

const severityConfig = {
  Low: {
    icon: CheckCircle,
    color: "text-green-600",
    bg: "bg-green-100",
    label: "Low Risk",
  },
  Moderate: {
    icon: AlertTriangle,
    color: "text-amber-600",
    bg: "bg-amber-100",
    label: "Moderate Risk",
  },
  High: {
    icon: AlertCircle,
    color: "text-red-600",
    bg: "bg-red-100",
    label: "High Risk",
  },
};

export function PredictionResult({ result, onConsult }: PredictionResultProps) {
  const severity = severityConfig[result.severity];
  const SeverityIcon = severity.icon;

  return (
    <div className="space-y-4 animate-slide-up">
      {/* Main Result Card */}
      <div className="rounded-2xl border-2 border-gray-200 bg-white overflow-hidden shadow-sm">
        <div className={cn("p-4", severity.bg)}>
          <div className="flex items-center gap-3">
            <SeverityIcon className={cn("h-6 w-6", severity.color)} />
            <div>
              <p className={cn("font-semibold", severity.color)}>{severity.label}</p>
              <p className="text-sm text-muted-foreground">AI Analysis Complete</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wider font-medium">
                Detected Condition
              </p>
              <p className="text-lg font-semibold mt-1 text-gray-900">{result.disease}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 uppercase tracking-wider font-medium">
                Confidence
              </p>
              <p className="text-lg font-semibold mt-1 text-gray-900">{result.probability}</p>
            </div>
          </div>

          {/* Confidence Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600 font-medium">Analysis Confidence</span>
              <span className="font-semibold text-gray-900">{result.probability}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500",
                  result.severity === "Low"
                    ? "bg-green-500"
                    : result.severity === "Moderate"
                    ? "bg-amber-500"
                    : "bg-red-500"
                )}
                style={{ width: result.probability }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Recommendations */}
      <div className="rounded-2xl border-2 border-gray-200 bg-white p-5 shadow-sm">
        <h3 className="font-semibold mb-3 text-gray-900">Recommendations</h3>
        <ul className="space-y-2">
          {result.recommendations.map((rec, index) => (
            <li key={index} className="flex items-start gap-2 text-sm">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 mt-2 shrink-0" />
              <span className="text-gray-700">{rec}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button variant="primary" className="flex-1 bg-blue-600 hover:bg-blue-700 text-white" asChild>
          <Link to="/reports">
            <FileText className="h-4 w-4 mr-2" />
            Generate Report
          </Link>
        </Button>
        <Button
          variant="outline"
          className="flex-1 whitespace-nowrap"
          onClick={onConsult}
        >
          Consult Doctor
        </Button>
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-gray-600 text-center font-medium">
        âš ï¸ This is an AI-assisted preliminary analysis. Please consult a healthcare
        professional for accurate diagnosis.
      </p>
    </div>
  );
}

