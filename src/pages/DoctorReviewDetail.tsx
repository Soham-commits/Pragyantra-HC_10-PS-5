import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { DoctorLayout } from "@/features/doctor/components/DoctorLayout";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, Flag, Image as ImageIcon, Info } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/utils";
import { API_BASE_URL, fetchWithAuth } from "@/services/api";

interface DoctorScanDetail {
  scan_id: string;
  health_id: string;
  patient_name: string;
  scan_type: string;
  image_url: string;
  gradcam_url?: string | null;
  upload_date: string;
  prediction?: string | null;
  confidence?: number | null;
  model_result?: string | null;
  abnormal_probability?: number | null;
  malignant_probability?: number | null;
  severity?: string | null;
  review_status: "pending" | "reviewed";
  reviewed_by_doctor?: boolean | null;
  reviewed_by_name?: string | null;
  reviewed_at?: string | null;
  doctor_notes?: string | null;
  flagged_followup?: boolean | null;
}

const formatProbability = (item: DoctorScanDetail) => {
  const directProb = item.abnormal_probability ?? item.malignant_probability;
  if (directProb !== null && directProb !== undefined) {
    return `${directProb.toFixed(1)}%`;
  }
  if (item.confidence !== null && item.confidence !== undefined) {
    const normalized = item.confidence > 1 ? item.confidence : item.confidence * 100;
    return `${normalized.toFixed(1)}%`;
  }
  return "N/A";
};

const isAbnormal = (item: DoctorScanDetail) => {
  const modelResult = (item.model_result || "").toLowerCase();
  if (modelResult === "abnormal" || modelResult === "malignant") {
    return true;
  }
  const prediction = (item.prediction || "").toLowerCase();
  return prediction.includes("abnormal") || prediction.includes("malignant");
};

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

const resolveImageUrl = (value?: string | null) => {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  return `${API_BASE_URL}${value}`;
};

export default function DoctorReviewDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get('returnTo') || '/doctor/reviews';

  const [scanDetail, setScanDetail] = useState<DoctorScanDetail | null>(null);
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState<"pending" | "reviewed">("pending");
  const [flagged, setFlagged] = useState(false);
  const [doctorName, setDoctorName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const screeningCase = useMemo(() => scanDetail, [scanDetail]);

  useEffect(() => {
    const fetchDetail = async () => {
      if (!id) return;
      setLoading(true);
      setError("");

      try {
        const response = await fetchWithAuth(`/api/doctor/scans/${id}`);
        if (!response.ok) {
          throw new Error("Failed to load scan detail");
        }
        const data = await response.json();
        setScanDetail(data);
        setNotes(data.doctor_notes || "");
        setStatus(data.review_status || "pending");
        setFlagged(Boolean(data.flagged_followup));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load scan detail");
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [id]);

  useEffect(() => {
    const fetchDoctorProfile = async () => {
      try {
        const response = await fetchWithAuth("/api/doctor/profile");
        if (!response.ok) return;
        const data = await response.json();
        setDoctorName(data.full_name || "");
      } catch (err) {
        console.error("Failed to load doctor profile", err);
      }
    };

    fetchDoctorProfile();
  }, []);

  const submitReview = async (nextStatus: "pending" | "reviewed", nextNotes: string) => {
    if (!id) return null;
    const response = await fetchWithAuth(`/api/doctor/scans/${id}/review`, {
      method: "POST",
      body: JSON.stringify({
        doctor_notes: nextNotes,
        reviewed_by_doctor: doctorName || undefined,
        status: nextStatus,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to update review");
    }

    return response.json();
  };

  const handleSaveNotes = async () => {
    if (!id) return;
    setSavingNotes(true);
    setError("");

    try {
      const data = await submitReview(status, notes);
      if (!data) return;
      setScanDetail(data);
      setNotes(data.doctor_notes || notes);
      setStatus(data.review_status || status);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save remarks");
    } finally {
      setSavingNotes(false);
    }
  };

  const handleStatusUpdate = async (nextStatus: "pending" | "reviewed", followup?: boolean) => {
    if (!id) return;
    setUpdatingStatus(true);
    setError("");

    try {
      const data = followup
        ? await fetchWithAuth(`/api/doctor/scans/${id}/status`, {
          method: "PUT",
          body: JSON.stringify({ status: nextStatus, flagged_followup: followup }),
        }).then(async (response) => {
          if (!response.ok) throw new Error("Failed to update status");
          return response.json();
        })
        : await submitReview(nextStatus, notes);

      if (!data) return;
      setScanDetail(data);
      setStatus(data.review_status || nextStatus);
      setFlagged(Boolean(data.flagged_followup));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleFlagFollowup = async () => {
    await handleStatusUpdate("reviewed", true);
  };

  if (loading) {
    return (
      <DoctorLayout title="Case Detail">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-gray-500">
          Loading case details...
        </div>
      </DoctorLayout>
    );
  }

  if (error) {
    return (
      <DoctorLayout title="Case Detail">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-rose-600">
          {error}
        </div>
      </DoctorLayout>
    );
  }

  if (!screeningCase) {
    return (
      <DoctorLayout title="Case Detail">
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center">
          <p className="text-gray-600">Case not found.</p>
          <Button className="mt-4" onClick={() => navigate("/doctor/reviews")}>Back</Button>
        </div>
      </DoctorLayout>
    );
  }

  return (
    <DoctorLayout title={`Case ${screeningCase.scan_id}`}>
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" onClick={() => navigate(returnTo)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {returnTo.includes('/patients/') ? 'Back to patient profile' : 'Back to reviews'}
        </Button>
        {flagged && (
          <span className="text-xs font-medium text-amber-600 bg-amber-50 px-3 py-1 rounded-full">
            Follow-up flagged
          </span>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Original scan</h2>
          {screeningCase.image_url ? (
            <img
              src={resolveImageUrl(screeningCase.image_url)}
              alt="Original scan"
              className="aspect-video w-full rounded-2xl border border-gray-100 object-cover"
            />
          ) : (
            <div className="aspect-video rounded-2xl border border-dashed border-gray-200 bg-gradient-to-br from-gray-50 to-white flex items-center justify-center text-gray-400">
              <div className="flex flex-col items-center gap-2">
                <ImageIcon className="h-6 w-6" />
                <span className="text-sm">Original image preview</span>
              </div>
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Grad-CAM Visualization</h2>
          {screeningCase.gradcam_url ? (
            <div>
              <img
                src={resolveImageUrl(screeningCase.gradcam_url)}
                alt="Grad-CAM Visualization"
                className="aspect-video w-full rounded-2xl border border-gray-100 object-cover"
              />
              <div className="mt-2.5 flex flex-wrap items-center justify-between gap-y-2 text-xs">
                <div className="flex items-center gap-1.5 text-gray-500 font-medium">
                  <span>Interpretation Guide</span>
                  <TooltipProvider>
                    <Tooltip delayDuration={300}>
                      <TooltipTrigger asChild>
                        <Info className="h-3.5 w-3.5 text-gray-400 hover:text-gray-600 cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-[260px] text-xs font-normal text-white bg-slate-800 border-slate-700">
                        <p>Activation map showing regions that influenced the AI screening prediction. Visualization supports screening transparency and does not confirm diagnosis.</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <div className="flex items-center gap-4 text-xs text-gray-600 font-medium">
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-500 shadow-sm" />
                    <span>High</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-yellow-400 shadow-sm" />
                    <span>Moderate</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500 shadow-sm" />
                    <span>Low</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="aspect-video rounded-2xl border border-dashed border-gray-200 bg-gray-50 flex items-center justify-center text-gray-400">
              <div className="flex flex-col items-center gap-2">
                <ImageIcon className="h-6 w-6" />
                <span className="text-sm">Grad-CAM Visualization</span>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr] mt-6">
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Case summary</h3>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-xs text-gray-500">Patient</p>
              <p className="text-sm font-medium text-gray-900">{screeningCase.patient_name}</p>
              <p className="text-xs text-gray-500">{screeningCase.health_id}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Date</p>
              <p className="text-sm font-medium text-gray-900">{formatDate(screeningCase.upload_date)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Prediction</p>
              <span
                className={cn(
                  "inline-flex px-3 py-1 rounded-full text-xs font-medium",
                  isAbnormal(screeningCase)
                    ? "bg-rose-50 text-rose-700"
                    : "bg-emerald-50 text-emerald-700"
                )}
              >
                {screeningCase.prediction || (isAbnormal(screeningCase) ? "Abnormal" : "Normal")}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500">Probability</p>
              <p className="text-sm font-medium text-gray-900">{formatProbability(screeningCase)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Status</p>
              <p
                className={cn(
                  "text-sm font-medium",
                  status === "pending" ? "text-amber-600" : "text-emerald-600"
                )}
              >
                {status === "pending" ? "Pending review" : "Reviewed"}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Grad-CAM Visualization</p>
              <p className="text-sm font-medium text-gray-900">
                {screeningCase.gradcam_url ? "Available" : "Processing"}
              </p>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Doctor actions</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-2 block">Remarks</label>
              <textarea
                rows={5}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add notes or recommendations"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-700 outline-none focus:border-gray-300"
              />
            </div>
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl"
              onClick={handleSaveNotes}
              disabled={savingNotes}
            >
              {savingNotes ? "Saving..." : "Save remarks"}
            </Button>
            <Button
              className="w-full h-11 rounded-xl bg-gray-900 hover:bg-gray-800"
              onClick={() => handleStatusUpdate("reviewed")}
              disabled={updatingStatus || status === "reviewed"}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              {updatingStatus ? "Updating..." : status === "reviewed" ? "Reviewed" : "Mark as reviewed"}
            </Button>
            <Button
              variant="outline"
              className="w-full h-11 rounded-xl"
              onClick={handleFlagFollowup}
              disabled={updatingStatus}
            >
              <Flag className="h-4 w-4 mr-2" />
              Flag follow-up
            </Button>
          </div>
        </div>
      </div>
    </DoctorLayout>
  );
}

