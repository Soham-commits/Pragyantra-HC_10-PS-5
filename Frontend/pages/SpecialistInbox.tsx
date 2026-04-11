import { useEffect, useState } from "react";
import { DoctorLayout } from "@/features/doctor/components/DoctorLayout";
import { API_BASE_URL, fetchWithAuth } from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Activity, Clock, FileText, CheckCircle, XCircle, ArrowLeft, Building2, User } from "lucide-react";
import { cn } from "@/utils";
import { toast } from "sonner";
import { Avatar as UserAvatar } from "@/components/Avatar";

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

const resolveImageUrl = (value?: string | null) => {
  if (!value) return "";
  if (value.startsWith("http")) return value;
  return `${API_BASE_URL}${value}`;
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditLogEntry {
  status: string;
  changed_by: string;
  changed_by_role: string;
  timestamp: string;
  note?: string;
}

interface ReferralRecord {
  referral_id: string;
  patient_id: string;
  patient_name?: string;
  source_scan_id: string;
  image_url?: string;
  scan_type?: string;
  prediction?: string;
  confidence?: number;
  gradcam_url?: string;
  referring_doctor_id: string;
  referring_doctor_name?: string;
  clinical_notes: string;
  priority: string;
  status: string;
  created_at: string;
  audit_log: AuditLogEntry[];
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending: { label: "Pending", className: "bg-amber-100  text-amber-700  border-amber-200" },
  active: { label: "Active", className: "bg-blue-100   text-blue-700   border-blue-200" },
  pending_registration: { label: "Awaiting Registration", className: "bg-gray-100 text-gray-700 border-gray-200" },
  rerouted: { label: "Rerouted", className: "bg-orange-100 text-orange-700 border-orange-200" },
  completed: { label: "Completed", className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  declined: { label: "Declined", className: "bg-red-100    text-red-700    border-red-200" },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  routine: { label: "Routine", className: "bg-gray-100 text-gray-700 border-gray-200" },
  urgent: { label: "Urgent", className: "bg-orange-100 text-orange-700 border-orange-200" },
  emergency: { label: "Emergency", className: "bg-red-100 text-red-700 border-red-200" },
};

const SCAN_TYPE_LABEL: Record<string, string> = {
  "chest_xray": "Chest X-Ray",
  "skin_lesion": "Skin Lesion",
  "x-ray": "X-Ray",
  "skin": "Skin Scan",
  "mri": "MRI",
  "ct-scan": "CT Scan",
};

export default function SpecialistInbox() {
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [sentCount, setSentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedReferral, setSelectedReferral] = useState<ReferralRecord | null>(null);

  const [declineNote, setDeclineNote] = useState("");
  const [showDeclineInput, setShowDeclineInput] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchReferrals();
  }, []);

  const fetchReferrals = async () => {
    try {
      setLoading(true);
      const [receivedRes, sentRes] = await Promise.all([
        fetchWithAuth("/api/referrals/doctor/inbox"),
        fetchWithAuth("/api/referrals/doctor/sent"),
      ]);

      if (receivedRes.ok) {
        const data = await receivedRes.json();
        setReferrals(data);
      } else {
        toast.error("Failed to load inbox");
      }

      if (sentRes.ok) {
        const sent = await sentRes.json();
        setSentCount(Array.isArray(sent) ? sent.length : 0);
      } else {
        setSentCount(0);
      }
    } catch (e) {
      toast.error("Network error");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (status: string, note?: string) => {
    if (!selectedReferral) return;

    setActionLoading(true);
    try {
      const payload: any = { status };
      if (note) payload.note = note;

      const res = await fetchWithAuth(`/api/referrals/${selectedReferral.referral_id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to update status");
      }

      const updatedDoc = await res.json();

      // Update local state directly
      setSelectedReferral(updatedDoc);
      setReferrals((prev) => prev.map((r) => r.referral_id === updatedDoc.referral_id ? updatedDoc : r));
      toast.success(`Referral marked as ${STATUS_CONFIG[status]?.label || status}`);
      setShowDeclineInput(false);
      setDeclineNote("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update status");
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (val: string) => {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatConfidence = (conf?: number) => {
    if (conf === undefined || conf === null) return "N/A";
    const scaled = conf > 1 ? conf : conf * 100;
    return `${scaled.toFixed(1)}%`;
  };

  if (loading) {
    return (
      <DoctorLayout title="Referral Inbox" showSearch={false}>
        <div className="text-center py-12 text-gray-500">Loading inbox...</div>
      </DoctorLayout>
    );
  }

  // ---------------------------------------------------------------------------
  // DETAIL VIEW
  // ---------------------------------------------------------------------------
  if (selectedReferral) {
    console.log("ðŸ” Full referral object:", selectedReferral);
    console.log("ðŸ“· image_url:", selectedReferral.image_url);
    console.log("ðŸ”¥ gradcam_url:", selectedReferral.gradcam_url);
    console.log("ðŸ“Š confidence:", selectedReferral.confidence);

    const statusInfo = STATUS_CONFIG[selectedReferral.status] || { label: selectedReferral.status, className: "bg-gray-100 text-gray-700" };
    const priorityInfo = PRIORITY_CONFIG[selectedReferral.priority] || { label: selectedReferral.priority, className: "bg-gray-100 text-gray-700" };
    const scanLabel = SCAN_TYPE_LABEL[selectedReferral.scan_type || ""] || selectedReferral.scan_type || "Scan";
    const showActions = !["active", "declined", "completed"].includes(selectedReferral.status);

    return (
      <DoctorLayout title="Referral Details" showSearch={false}>
        <div className="mb-4">
          <button
            onClick={() => { setSelectedReferral(null); setShowDeclineInput(false); setDeclineNote(""); }}
            className="inline-flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ArrowLeft className="h-3 w-3 md:h-4 md:w-4" />
            Back to Inbox
          </button>
        </div>

        <Card className="mb-4 border-2 shadow-sm border-indigo-100">
          <CardHeader className="bg-gradient-to-r from-gray-50 to-indigo-50 border-b border-indigo-100 p-4 md:p-6">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-3">
                <UserAvatar name={selectedReferral.patient_name || selectedReferral.patient_id} role="patient" seed={selectedReferral.patient_id} size="lg" />
                <div>
                  <CardTitle className="text-lg md:text-xl text-gray-900 mb-1">{selectedReferral.patient_name || "Unknown Patient"}</CardTitle>
                  <CardDescription className="text-sm font-mono text-gray-600">ID: {selectedReferral.patient_id}</CardDescription>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={cn("text-xs font-semibold px-3 py-1.5 rounded-full border", statusInfo.className)}>
                  {statusInfo.label}
                </span>
                <span className={cn("text-xs font-semibold px-2 py-1 rounded-md border", priorityInfo.className)}>
                  {priorityInfo.label} Priority
                </span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="p-4 md:p-6 space-y-6">

            {/* AI Results & Recommender */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Scan Details</h4>
                <div className="space-y-1 text-sm text-gray-800">
                  <p><span className="font-medium text-gray-600">Type:</span> {scanLabel}</p>
                  <p><span className="font-medium text-gray-600">AI Result:</span> <span className={selectedReferral.prediction?.toLowerCase().includes("abnormal") || selectedReferral.prediction?.toLowerCase().includes("malignant") ? "text-red-600 font-semibold" : ""}>{selectedReferral.prediction || "N/A"}</span></p>
                  <p><span className="font-medium text-gray-600">Confidence:</span> {formatConfidence(selectedReferral.confidence)}</p>
                  <p><span className="font-medium text-gray-600">Referred on:</span> {formatDate(selectedReferral.created_at)}</p>
                </div>
              </div>

              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Referring Doctor</h4>
                <div className="flex items-center gap-3">
                  <UserAvatar name={selectedReferral.referring_doctor_name || selectedReferral.referring_doctor_id} role="doctor" seed={selectedReferral.referring_doctor_id} size="md" />
                  <div className="min-w-0">
                    <p className="font-medium text-gray-900 truncate">Dr. {selectedReferral.referring_doctor_name?.replace(/^(Dr\.?\s*)/i, '') || "Unknown"}</p>
                    <p className="text-xs text-gray-600 font-mono mt-1 truncate">ID: {selectedReferral.referring_doctor_id}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Images */}
            {(selectedReferral.image_url || selectedReferral.gradcam_url) && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-3">Scan Images</h4>
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {selectedReferral.image_url && (
                    <div className="relative rounded border border-gray-200 w-48 h-48 bg-black flex-shrink-0">
                      <img src={resolveImageUrl(selectedReferral.image_url)} alt="Original Scan" className="w-full h-full object-contain" />
                      <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">Original</div>
                    </div>
                  )}
                  {selectedReferral.gradcam_url && (
                    <div className="relative rounded border border-gray-200 w-48 h-48 bg-black flex-shrink-0">
                      <img src={resolveImageUrl(selectedReferral.gradcam_url)} alt="Grad-CAM" className="w-full h-full object-contain" />
                      <div className="absolute top-1 left-1 bg-black/60 text-white text-[10px] px-2 py-0.5 rounded">Heatmap</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Clinical Notes */}
            {selectedReferral.clinical_notes && (
              <div>
                <h4 className="text-sm font-semibold text-gray-700 mb-2">Clinical Notes</h4>
                <div className="text-sm text-gray-700 bg-gray-50 p-4 rounded-lg border border-gray-200">
                  {selectedReferral.clinical_notes}
                </div>
              </div>
            )}

            {/* Audit Log */}
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Audit History</h4>
              <div className="space-y-2 text-sm max-h-40 overflow-y-auto bg-gray-50 border border-gray-200 rounded-lg p-3">
                {selectedReferral.audit_log.map((entry, idx) => (
                  <div key={idx} className="flex gap-3 text-xs">
                    <div className="text-gray-500 w-24 flex-shrink-0">{formatDate(entry.timestamp)}</div>
                    <div>
                      <span className="font-semibold text-gray-700 mr-2 drop-shadow-sm capitalize">{entry.status.replace("_", " ")}</span>
                      <span className="text-gray-600">{entry.note || "Status updated"}</span>
                      <span className="text-gray-400 italic ml-2">({entry.changed_by_role})</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Action Area */}
            {showActions && (
              <div className="border-t border-gray-200 pt-6 mt-6 flex flex-col gap-4">
                {!showDeclineInput ? (
                  <div className="flex gap-3 w-full justify-end">
                    <Button
                      variant="outline"
                      className="border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                      onClick={() => setShowDeclineInput(true)}
                    >
                      <XCircle className="w-4 h-4 mr-2" /> Decline
                    </Button>
                    <Button
                      className="bg-indigo-600 hover:bg-indigo-700 text-white"
                      disabled={actionLoading}
                      onClick={() => handleUpdateStatus("active", "Specialist accepted the referral.")}
                    >
                      <CheckCircle className="w-4 h-4 mr-2" /> Accept Referral
                    </Button>
                  </div>
                ) : (
                  <div className="bg-red-50 p-4 rounded-lg border border-red-100 flex flex-col gap-3">
                    <Label className="text-red-800 text-sm font-medium">Reason for Declining</Label>
                    <Textarea
                      value={declineNote}
                      onChange={(e) => setDeclineNote(e.target.value)}
                      placeholder="Please explain why you cannot accept this referral..."
                      className="bg-white"
                    />
                    <div className="flex gap-2 justify-end">
                      <Button variant="ghost" onClick={() => setShowDeclineInput(false)} disabled={actionLoading}>Cancel</Button>
                      <Button
                        variant="destructive"
                        disabled={actionLoading || declineNote.trim().length === 0}
                        onClick={() => handleUpdateStatus("declined", declineNote)}
                      >
                        Confirm Decline
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </DoctorLayout>
    );
  }

  // ---------------------------------------------------------------------------
  // LIST VIEW
  // ---------------------------------------------------------------------------
  return (
    <DoctorLayout title="Referral Inbox" showSearch={false}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full border bg-white text-gray-700 border-gray-200">
            Received: <span className="text-gray-900">{referrals.length}</span>
          </span>
          <span className="text-xs font-semibold px-3 py-1.5 rounded-full border bg-white text-gray-700 border-gray-200">
            Sent: <span className="text-gray-900">{sentCount}</span>
          </span>
        </div>
        {referrals.length === 0 ? (
          <div className="text-center py-16 px-4 border-2 border-dashed border-gray-200 rounded-xl bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Inbox Zero</h3>
            <p className="text-sm text-gray-500">You have no referrals assigned to you right now.</p>
          </div>
        ) : (
          referrals.map((ref) => {
            const statusInfo = STATUS_CONFIG[ref.status] || { label: ref.status, className: "bg-gray-100 text-gray-700" };
            const priorityInfo = PRIORITY_CONFIG[ref.priority] || { label: ref.priority, className: "bg-gray-100 text-gray-700" };
            const scanLabel = SCAN_TYPE_LABEL[ref.scan_type || ""] || ref.scan_type || "Scan";

            return (
              <div
                key={ref.referral_id}
                className="bg-white border border-gray-200 rounded-xl p-4 md:p-5 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer relative"
                onClick={() => {
                  console.log("ðŸ” Referral clicked:", ref);
                  console.log("ðŸ“· image_url:", ref.image_url);
                  console.log("ðŸ”¥ gradcam_url:", ref.gradcam_url);
                  setSelectedReferral(ref);
                }}
              >

                {/* Top badges */}
                <div className="absolute top-4 right-4 flex gap-2">
                  <span className={cn("text-[10px] md:text-xs font-semibold px-2.5 py-1 rounded-md border", priorityInfo.className)}>
                    {priorityInfo.label}
                  </span>
                  <span className={cn("text-[10px] md:text-xs font-semibold px-2.5 py-1 rounded-full border", statusInfo.className)}>
                    {statusInfo.label}
                  </span>
                </div>

                {/* Patient Info */}
                <div className="flex items-center gap-3 pr-40">
                  <UserAvatar name={ref.patient_name || ref.patient_id} role="patient" seed={ref.patient_id} size="md" />
                  <div className="min-w-0">
                    <h3 className="text-base md:text-lg font-bold text-gray-900 truncate">{ref.patient_name || "Unknown Patient"}</h3>
                    <p className="text-xs text-gray-500 font-mono truncate">{ref.patient_id}</p>
                  </div>
                </div>
                <div className="h-4" />

                {/* Grid info */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs md:text-sm my-4 bg-gray-50 p-3 rounded-lg border border-gray-100">
                  <div>
                    <p className="text-gray-500 font-medium mb-0.5">Scan Type</p>
                    <p className="font-semibold text-gray-900">{scanLabel}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-medium mb-0.5">AI Result</p>
                    <p className={cn("font-semibold text-gray-900", ref.prediction?.toLowerCase().includes("abnormal") || ref.prediction?.toLowerCase().includes("malignant") ? "text-red-600" : "")}>{ref.prediction || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-medium mb-0.5">Confidence</p>
                    <p className="font-semibold text-gray-900">{formatConfidence(ref.confidence)}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 font-medium mb-0.5">Date</p>
                    <p className="font-semibold text-gray-900">{formatDate(ref.created_at)}</p>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs md:text-sm text-gray-600">
                  <div className="flex items-center gap-2 min-w-0">
                    <UserAvatar name={ref.referring_doctor_name || ref.referring_doctor_id} role="doctor" seed={ref.referring_doctor_id} size="sm" />
                    <div className="truncate">
                      <span className="font-medium text-gray-500">Referred by:</span>{" "}
                      Dr. {ref.referring_doctor_name?.replace(/^(Dr\.?\s*)/i, "") || "Unknown"}
                    </div>
                  </div>
                  <div className="font-medium text-indigo-600 group-hover:underline">Click to view details â†’</div>
                </div>

              </div>
            );
          })
        )}
      </div>
    </DoctorLayout>
  );
}

