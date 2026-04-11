import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download, AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";

interface ReportPromptCardProps {
  sessionId: string;
  detectedSymptoms?: string[];
  severityLevel?: string;
  onReportGenerated?: (reportId: string) => void;
  onDismiss?: () => void;
}

export function ReportPromptCard({
  sessionId,
  detectedSymptoms = [],
  severityLevel = "moderate",
  onReportGenerated,
  onDismiss
}: ReportPromptCardProps) {
  const navigate = useNavigate();
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [reportId, setReportId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const getSeverityColor = (severity: string) => {
    switch (severity.toLowerCase()) {
      case "low":
        return "bg-green-100 text-green-800 border-green-200";
      case "moderate":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "high":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const handleGenerateReport = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/patient/report/generate-from-chat/${sessionId}`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate report");
      }

      const data = await response.json();
      setReportId(data.report_id);
      setIsGenerated(true);
      onReportGenerated?.(data.report_id);
    } catch (err) {
      setError("Failed to generate report. Please try again.");
      console.error("Report generation error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleDownloadReport = async () => {
    if (!reportId) return;

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(
        `/api/patient/report/${reportId}/pdf`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to download report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `medical_report_${reportId}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error("Report download error:", err);
    }
  };

  if (isGenerated) {
    return (
      <Card className="border-2 border-green-200 bg-green-50/50 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <CardTitle className="text-lg text-green-900">Report Generated Successfully</CardTitle>
            </div>
          </div>
          <CardDescription className="text-green-700">
            Your preliminary medical screening report has been created and saved to your records.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-white rounded-lg p-3 border border-green-200">
            <p className="text-sm text-gray-600 mb-1">Report ID:</p>
            <p className="text-sm font-mono font-semibold text-gray-900">{reportId}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Button
              onClick={handleDownloadReport}
              variant="default"
              className="flex-1 bg-green-600 hover:bg-green-700"
            >
              <Download className="h-4 w-4 mr-2" />
              Download PDF
            </Button>
            <Button
              onClick={() => navigate("/reports?tab=reports")}
              variant="outline"
              className="flex-1 border-green-300 text-green-700 hover:bg-green-50 whitespace-nowrap"
            >
              <FileText className="h-4 w-4 mr-2" />
              View Reports
            </Button>
          </div>

          <Alert className="border-amber-200 bg-amber-50">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <AlertDescription className="text-amber-800 text-xs">
              This is a preliminary AI screening, NOT a medical diagnosis. Please consult a healthcare professional for proper medical advice.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  const uniqueSymptoms = Array.from(
    new Map(
      detectedSymptoms
        .map((symptom) => symptom.trim())
        .filter((symptom) => symptom.length > 0)
        .map((symptom) => [symptom.toLowerCase(), symptom])
    ).values()
  );

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-purple-50 shadow-lg">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-600" />
            <CardTitle className="text-lg text-gray-900">Generate Medical Report?</CardTitle>
          </div>
          <Badge className={getSeverityColor(severityLevel)}>
            {severityLevel.toUpperCase()}
          </Badge>
        </div>
        <CardDescription className="text-gray-600">
          Based on our conversation, I can generate a preliminary medical screening report for your records.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {uniqueSymptoms.length > 0 && (
          <div className="bg-white rounded-lg p-3 border border-blue-100">
            <p className="text-sm font-medium text-gray-700 mb-2">Detected Symptoms:</p>
            <div className="flex flex-wrap gap-1.5">
              {uniqueSymptoms.map((symptom, index) => (
                <Badge
                  key={index}
                  variant="outline"
                  className="bg-blue-50 text-blue-700 border-blue-200"
                >
                  {symptom}
                </Badge>
              ))}
            </div>
          </div>
        )}

        <Alert className="border-amber-200 bg-amber-50">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 text-xs">
            <strong>Important Disclaimer:</strong> This will be a preliminary AI screening, NOT a medical diagnosis. It should not be used for self-medication. Please consult a qualified healthcare professional for proper medical advice.
          </AlertDescription>
        </Alert>

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            onClick={handleGenerateReport}
            disabled={isGenerating}
            className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <FileText className="h-4 w-4 mr-2" />
                Generate Report
              </>
            )}
          </Button>
          {onDismiss && (
            <Button
              onClick={onDismiss}
              disabled={isGenerating}
              variant="outline"
              className="flex-1 whitespace-nowrap"
            >
              Not Now
            </Button>
          )}
        </div>

        <p className="text-xs text-gray-500 text-center">
          Your report will be saved to your medical records and can be accessed anytime from the Reports page.
        </p>
      </CardContent>
    </Card>
  );
}
