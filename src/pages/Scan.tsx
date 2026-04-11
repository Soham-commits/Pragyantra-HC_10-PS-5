import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FloatingNav } from "@/layouts/FloatingNav";
import { ImageUploader } from "@/features/scan/components/ImageUploader";
import { ScanTypeSelector } from "@/features/scan/components/ScanTypeSelector";
import { PredictionResult } from "@/features/scan/components/PredictionResult";
import { Button } from "@/components/ui/button";
import { Scan as ScanIcon, Loader2, ArrowLeft } from "lucide-react";
import { scanApi } from "@/services/api";
import { useToast } from "@/hooks/use-toast";

type Step = "upload" | "analyzing" | "result";

interface ScanResult {
  disease: string;
  probability: string;
  severity: "Low" | "Moderate" | "High";
  recommendations: string[];
}

export default function ScanPage() {
  const navigate = useNavigate();
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [result, setResult] = useState<ScanResult | null>(null);
  const { toast } = useToast();

  const handleAnalyze = async () => {
    if (!selectedImage || !selectedType) return;

    setStep("analyzing");

    try {
      // Map frontend scan type to backend scan type
      const scanTypeMap: Record<string, string> = {
        lung: "x-ray",
        breast: "mri",
        brain: "mri",
        skin: "skin",
      };
  setResult(null);
  
      const backendScanType = scanTypeMap[selectedType] || "other";

      // Call the API
      const response = await scanApi.uploadScan(backendScanType, selectedImage);

      // Format the response for display
      const formattedResult: ScanResult = {
        disease: response.prediction || "Analysis Complete",
        probability: response.confidence 
          ? `${(response.confidence * 100).toFixed(1)}%` 
          : response.abnormal_probability 
          ? `${response.abnormal_probability.toFixed(1)}%`
          : "N/A",
        severity: (response.severity || "Low") as "Low" | "Moderate" | "High",
        recommendations: response.recommendations || ["Consult with a healthcare professional"],
      };

      setResult(formattedResult);
      setStep("result");

      toast({
        title: "Analysis Complete",
        description: "Your scan has been analyzed successfully.",
      });
    } catch (error) {
      console.error("Error analyzing scan:", error);
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze scan. Please try again.",
        variant: "destructive",
      });
      setStep("upload");
    }
  };

  const handleReset = () => {
    setSelectedImage(null);
    setSelectedType(null);
    setStep("upload");
  };

  const handleConsultDoctor = () => {
    toast({
      title: "Doctor review requested",
      description: "Your scan is marked for review. Check Reports for updates.",
    });
    navigate("/reports");
  };

  const canAnalyze = selectedImage && selectedType;

  return (
    <div className="min-h-screen bg-white pb-24">
      <FloatingNav />

      <main className="max-w-md md:max-w-6xl lg:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 py-6">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-4 -ml-2 h-10 text-sm hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          {step !== "upload" && (
            <Button
              variant="ghost"
              onClick={handleReset}
              className="mb-4 -ml-2 h-10 text-sm hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Start New Scan
            </Button>
          )}
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {step === "upload" && "Upload Medical Scan"}
            {step === "analyzing" && "Analyzing..."}
            {step === "result" && "Analysis Results"}
          </h1>
          <p className="text-gray-600 text-sm">
            {step === "upload" && "Upload your medical scan for AI analysis"}
            {step === "analyzing" && "Processing your scan..."}
            {step === "result" && "Here's what we found"}
          </p>
        </div>

        {step === "upload" && (
          <div className="space-y-8 animate-slide-up">
            {/* Scan Type Selection */}
            <div>
              <h2 className="text-lg font-semibold mb-4">1. Choose Scan Type</h2>
              <ScanTypeSelector
                selectedType={selectedType}
                onSelect={setSelectedType}
              />
            </div>

            {/* Image Upload */}
            <div>
              <h2 className="text-lg font-semibold mb-4">2. Upload Your Image</h2>
              <ImageUploader
                onImageSelect={setSelectedImage}
                selectedImage={selectedImage}
                onClear={() => setSelectedImage(null)}
              />
            </div>

            {/* Analyze Button */}
            <Button
              className="w-full h-14 text-base font-semibold bg-gray-900 hover:bg-gray-800 text-white rounded-2xl"
              disabled={!canAnalyze}
              onClick={handleAnalyze}
            >
              <ScanIcon className="h-5 w-5 mr-2" />
              Analyze Scan
            </Button>

            {/* Disclaimer */}
            <p className="text-xs text-gray-500 text-center">
              JPEG and PNG â€¢ Maximum 20MB
            </p>
          </div>
        )}

        {step === "analyzing" && (
          <div className="flex flex-col items-center justify-center py-16">
            <div className="relative">
              <div className="h-20 w-20 rounded-full bg-gray-100 flex items-center justify-center">
                <Loader2 className="h-10 w-10 text-gray-900 animate-spin" />
              </div>
            </div>
            <h2 className="text-lg font-bold text-gray-900 mt-6 mb-2">Analyzing Scan</h2>
            <p className="text-gray-600 text-center text-sm max-w-xs">
              Our AI is examining your medical image
            </p>
            <div className="flex gap-1 mt-4">
              <span className="h-2 w-2 rounded-full bg-gray-900 animate-pulse" />
              <span className="h-2 w-2 rounded-full bg-gray-900 animate-pulse" style={{ animationDelay: "150ms" }} />
              <span className="h-2 w-2 rounded-full bg-gray-900 animate-pulse" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}

        {step === "result" && result && (
          <PredictionResult result={result} onConsult={handleConsultDoctor} />
        )}
      </main>
    </div>
  );
}

