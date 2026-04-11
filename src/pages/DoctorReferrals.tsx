import { useEffect, useState } from "react";
import { DoctorLayout } from "@/features/doctor/components/DoctorLayout";
import { Stethoscope, Calendar, AlertCircle } from "lucide-react";
import { cn } from "@/utils";
import { fetchWithAuth } from "@/services/api";
import { Avatar as UserAvatar } from "@/components/Avatar";
import { toast } from "sonner";

interface AuditLogEntry {
  status: string;
  note?: string;
}

interface ReferralRecord {
  referral_id: string;
  patient_id: string;
  patient_name?: string;
  scan_type?: string;
  prediction?: string;
  specialist_name?: string;
  specialist_specialty?: string;
  referring_doctor_id: string;
  referring_doctor_name?: string;
  external_specialist?: {
    name?: string;
    specialty?: string;
  };
  priority: string;
  status: string;
  created_at: string;
  clinical_notes?: string;
  audit_log?: AuditLogEntry[];
}

export default function DoctorReferrals() {
  const [sentReferrals, setSentReferrals] = useState<ReferralRecord[]>([]);
  const [receivedReferrals, setReceivedReferrals] = useState<ReferralRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"sent" | "received">("sent");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchReferrals = async () => {
      setLoading(true);
      setError("");
      try {
        const [sentResponse, receivedResponse] = await Promise.all([
          fetchWithAuth("/api/referrals/doctor/sent"),
          fetchWithAuth("/api/referrals/specialist/inbox"),
        ]);

        if (!sentResponse.ok || !receivedResponse.ok) {
          throw new Error("Failed to load referrals");
        }

        const [sentData, receivedData] = await Promise.all([
          sentResponse.json(),
          receivedResponse.json(),
        ]);

        setSentReferrals(Array.isArray(sentData) ? sentData : []);
        setReceivedReferrals(Array.isArray(receivedData) ? receivedData : []);
      } catch (err) {
        console.error("Failed to load referrals:", err);
        setError(err instanceof Error ? err.message : "Failed to load referrals");
      } finally {
        setLoading(false);
      }
    };

    fetchReferrals();
  }, []);

  const handleReceivedReferralAction = async (referralId: string, status: "active" | "declined") => {
    setActionLoadingId(referralId);
    try {
      const res = await fetchWithAuth(`/api/referrals/${referralId}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          note:
            status === "active"
              ? "Referral accepted by receiving doctor."
              : "Referral declined by receiving doctor.",
        }),
      });

      if (!res.ok) {
        throw new Error(`Failed to ${status === "active" ? "accept" : "decline"} referral`);
      }

      const updated = await res.json();
      setReceivedReferrals((prev) =>
        prev.map((ref) => (ref.referral_id === referralId ? { ...ref, ...updated } : ref))
      );
      toast.success(status === "active" ? "Referral accepted" : "Referral declined");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to update referral");
    } finally {
      setActionLoadingId(null);
    }
  };

  const statusColors: Record<string, string> = {
    pending: "bg-amber-100 text-amber-700 border-amber-200",
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    declined: "bg-red-100 text-red-700 border-red-200",
    completed: "bg-blue-100 text-blue-700 border-blue-200",
  };

  const priorityColors: Record<string, string> = {
    routine: "bg-gray-100 text-gray-700 border-gray-200",
    urgent: "bg-orange-100 text-orange-700 border-orange-200",
    emergency: "bg-red-100 text-red-700 border-red-200",
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  const displayedReferrals = activeTab === "sent" ? sentReferrals : receivedReferrals;
  const pendingReceivedCount = receivedReferrals.filter((ref) => ref.status === "pending").length;

  return (
    <DoctorLayout title="My Referrals">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Stethoscope className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">My Referrals</h1>
              <p className="text-sm text-gray-500">Track referrals you sent and referrals received from other doctors</p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        {!loading && !error && (
          <div className="mb-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <button
                type="button"
                className={cn(
                  "px-4 py-2 text-sm font-semibold border-b-2 transition-colors",
                  activeTab === "sent"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
                onClick={() => setActiveTab("sent")}
              >
                Sent
              </button>
              <button
                type="button"
                className={cn(
                  "px-4 py-2 text-sm font-semibold border-b-2 transition-colors inline-flex items-center gap-2",
                  activeTab === "received"
                    ? "border-blue-600 text-blue-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                )}
                onClick={() => setActiveTab("received")}
              >
                Received
                {pendingReceivedCount > 0 && (
                  <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1.5 text-[11px] font-bold text-white">
                    {pendingReceivedCount}
                  </span>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading referrals...</p>
          </div>
        )}

        {/* Error State */}
        {!loading && error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
            <AlertCircle className="h-12 w-12 mx-auto text-red-500 mb-4" />
            <h3 className="font-semibold text-red-900 mb-2">Failed to load referrals</h3>
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && displayedReferrals.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-12 text-center">
            <div className="h-16 w-16 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <Stethoscope className="h-8 w-8 text-gray-400" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-2">
              {activeTab === "sent" ? "No sent referrals yet" : "No received referrals yet"}
            </h3>
            <p className="text-sm text-gray-500">
              {activeTab === "sent"
                ? "Referrals you send to specialists will appear here"
                : "Referrals sent to you by other doctors will appear here"}
            </p>
          </div>
        )}

        {/* Referrals List */}
        {!loading && !error && displayedReferrals.length > 0 && (
          <div className="space-y-4">
            {displayedReferrals.map((ref) => {
              const isReceivedPending = activeTab === "received" && ref.status === "pending";
              return (
              <div
                key={ref.referral_id}
                className="bg-white border border-gray-200 rounded-2xl p-6 hover:border-blue-300 hover:shadow-md transition-all"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar name={ref.patient_name || ref.patient_id} role="patient" seed={ref.patient_id} size="md" />
                    <div className="min-w-0">
                      <h3 className="font-semibold text-gray-900 text-lg truncate">
                        {ref.patient_name || "Unknown Patient"}
                      </h3>
                      <p className="text-xs text-gray-500 font-mono mt-1 truncate">{ref.patient_id}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <span
                      className={cn(
                        "text-xs font-semibold px-3 py-1 rounded-full border",
                        priorityColors[ref.priority] || "bg-gray-100 text-gray-700"
                      )}
                    >
                      {ref.priority}
                    </span>
                    <span
                      className={cn(
                        "text-xs font-semibold px-3 py-1 rounded-full border",
                        statusColors[ref.status] || "bg-gray-100 text-gray-700"
                      )}
                    >
                      {ref.status}
                    </span>
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 font-medium mb-1">Scan Type</p>
                    <p className="font-semibold text-gray-900">{ref.scan_type || "N/A"}</p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 font-medium mb-1">AI Result</p>
                    <p
                      className={cn(
                        "font-semibold",
                        ref.prediction?.toLowerCase().includes("abnormal")
                          ? "text-red-600"
                          : "text-gray-900"
                      )}
                    >
                      {ref.prediction || "N/A"}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    {activeTab === "sent" ? (
                      <>
                        <p className="text-xs text-gray-500 font-medium mb-1">Referred to</p>
                        <p className="font-semibold text-gray-900">
                          {ref.specialist_name || ref.external_specialist?.name || "Unknown"}
                        </p>
                        {(ref.specialist_specialty || ref.external_specialist?.specialty) && (
                          <p className="text-xs text-gray-500 mt-1">
                            {ref.specialist_specialty || ref.external_specialist?.specialty}
                          </p>
                        )}
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 font-medium mb-1">Referred by</p>
                        <p className="font-semibold text-gray-900">
                          {ref.referring_doctor_name || ref.referring_doctor_id || "Unknown"}
                        </p>
                      </>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 font-medium mb-1">Date Referred</p>
                    <p className="font-semibold text-gray-900 text-xs">
                      {formatDate(ref.created_at)}
                    </p>
                  </div>
                </div>

                {/* Clinical Notes */}
                {ref.clinical_notes && (
                  <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
                    <p className="text-xs text-blue-600 font-semibold mb-2">Clinical Notes:</p>
                    <p className="text-sm text-blue-900">{ref.clinical_notes}</p>
                  </div>
                )}

                {/* Status Message */}
                {ref.status === "active" && (
                  <div className="mt-4 bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                    <p className="text-xs text-emerald-700 font-semibold mb-1">
                      âœ“ {activeTab === "sent" ? "Specialist has accepted this referral" : "You have accepted this referral"}
                    </p>
                    {ref.audit_log && (() => {
                      const activeEntry = [...ref.audit_log].reverse().find((entry: any) => entry.status === 'active');
                      return activeEntry?.note ? (
                        <p className="text-xs text-emerald-900 mt-2">
                          <span className="font-semibold">Note:</span> {activeEntry.note}
                        </p>
                      ) : null;
                    })()}
                  </div>
                )}
                {ref.status === "pending" && (
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-3">
                    <p className="text-xs text-amber-700">
                      {activeTab === "sent"
                        ? "â³ Waiting for specialist to accept this referral"
                        : "â³ Awaiting your action on this referral"}
                    </p>
                  </div>
                )}
                {ref.status === "declined" && (
                  <div className="mt-4 bg-red-50 border border-red-200 rounded-xl p-3">
                    <p className="text-xs text-red-700 font-semibold mb-1">
                      âœ— {activeTab === "sent" ? "This referral was declined by the specialist" : "You declined this referral"}
                    </p>
                    {ref.audit_log && (() => {
                      const declineEntry = [...ref.audit_log].reverse().find((entry: any) => entry.status === 'declined');
                      return declineEntry?.note ? (
                        <p className="text-xs text-red-900 mt-2">
                          <span className="font-semibold">Reason:</span> {declineEntry.note}
                        </p>
                      ) : (
                        <p className="text-xs text-red-900 mt-2">No reason provided</p>
                      );
                    })()}
                  </div>
                )}
                {ref.status === "completed" && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-xl p-3">
                    <p className="text-xs text-blue-700">
                      âœ“ This referral has been completed
                    </p>
                  </div>
                )}

                {isReceivedPending && (
                  <div className="mt-4 flex gap-2 justify-end">
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-semibold rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
                      disabled={actionLoadingId === ref.referral_id}
                      onClick={() => handleReceivedReferralAction(ref.referral_id, "declined")}
                    >
                      Decline
                    </button>
                    <button
                      type="button"
                      className="px-4 py-2 text-sm font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                      disabled={actionLoadingId === ref.referral_id}
                      onClick={() => handleReceivedReferralAction(ref.referral_id, "active")}
                    >
                      Accept
                    </button>
                  </div>
                )}
              </div>
              );
            })}
          </div>
        )}
      </div>
    </DoctorLayout>
  );
}

