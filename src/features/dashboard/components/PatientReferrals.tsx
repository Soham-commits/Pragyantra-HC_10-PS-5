import { useEffect, useRef, useState } from "react";
import { fetchWithAuth } from "@/services/api";
import { ChevronDown, ChevronUp, Stethoscope, ArrowRight, User } from "lucide-react";
import { cn } from "@/utils";
import { Avatar as UserAvatar } from "@/components/Avatar";

interface ReferralRecord {
  referral_id: string;
  scan_type: string;
  referring_doctor_id?: string;
  referring_doctor_name?: string;
  specialist_id?: string | null;
  specialist_name?: string;
  specialist_specialty?: string;
  specialist_hospital_name?: string;
  specialist_verified?: boolean;
  external_specialist?: { name: string; specialty: string };
  status: string;
  priority: string;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  pending:              { label: "Pending",               className: "bg-amber-100  text-amber-700  border-amber-200"  },
  active:               { label: "Active",                className: "bg-blue-100   text-blue-700   border-blue-200"   },
  pending_registration: { label: "Awaiting Registration", className: "bg-purple-100 text-purple-700 border-purple-200" },
  rerouted:             { label: "Rerouted",              className: "bg-orange-100 text-orange-700 border-orange-200" },
  completed:            { label: "Completed",             className: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  declined:             { label: "Declined",              className: "bg-red-100    text-red-700    border-red-200"    },
};

const PRIORITY_CONFIG: Record<string, { label: string; className: string }> = {
  routine:   { label: "Routine",   className: "bg-gray-100 text-gray-700 border-gray-200" },
  urgent:    { label: "Urgent",    className: "bg-orange-100 text-orange-700 border-orange-200" },
  emergency: { label: "Emergency", className: "bg-red-100 text-red-700 border-red-200" },
};

const SCAN_TYPE_LABEL: Record<string, string> = {
  "chest_xray": "Chest X-Ray",
  "skin_lesion": "Skin Scan",
  "x-ray":   "X-Ray",
  "skin":    "Skin Scan",
  "mri":     "MRI",
  "ct-scan": "CT Scan",
};

export function PatientReferrals({ patientId }: { patientId: string }) {
  const [referrals, setReferrals] = useState<ReferralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [isOpen, setIsOpen] = useState(false);
  const loggedReferrals = useRef<Set<string>>(new Set());

  useEffect(() => {
    const loadReferrals = async () => {
      try {
        console.log("ðŸ” PatientReferrals: Fetching referrals for patient_id:", patientId);
        const res = await fetchWithAuth(`/api/referrals/patient/${patientId}`);
        console.log("ðŸ“¡ PatientReferrals: API response status:", res.status);
        if (res.ok) {
          const data = await res.json();
          console.log("âœ… PatientReferrals: Received data:", data);
          console.log("ðŸ“Š PatientReferrals: Number of referrals:", data.length);
          setReferrals(data);
        } else {
          console.error("âŒ PatientReferrals: API returned error status:", res.status);
        }
      } catch (err) {
        console.error("âŒ PatientReferrals: Failed to load patient referrals:", err);
      } finally {
        setLoading(false);
      }
    };
    if (patientId) {
      console.log("ðŸš€ PatientReferrals: Component mounted with patientId:", patientId);
      loadReferrals();
    } else {
      console.warn("âš ï¸ PatientReferrals: No patientId provided");
    }
  }, [patientId]);

  if (loading || referrals.length === 0) {
    console.log("ðŸš« PatientReferrals: Component returning null - loading:", loading, "referrals.length:", referrals.length);
    return null; // Hidden entirely if loading or no referrals
  }

  const formatDate = (val: string) => {
    const d = new Date(val);
    if (isNaN(d.getTime())) return val;
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  return (
    <div className="mb-8 bg-gradient-to-br from-blue-50/70 via-white to-blue-50/30 rounded-3xl border border-blue-200/80 shadow-sm overflow-hidden">
      {/* Header acting as toggle switch */}
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between focus:outline-none hover:bg-white/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="inline-flex p-2 rounded-xl bg-blue-100 flex-shrink-0">
            <Stethoscope className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-left">
            <h3 className="text-base font-semibold text-gray-900">My Referrals</h3>
            <p className="text-xs text-gray-500">{referrals.length} active or past referrals</p>
          </div>
        </div>
        <div className="text-gray-400">
          {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
        </div>
      </button>

      {/* Collapsible Content */}
      {isOpen && (
        <div className="px-5 pb-5 pt-2 border-t border-blue-100/50">
          <div className="space-y-3">
	            {referrals.map((ref) => {
	              if (import.meta.env.DEV && !loggedReferrals.current.has(ref.referral_id)) {
	                // eslint-disable-next-line no-console
	                console.log("[ReferralCard]", ref);
	                loggedReferrals.current.add(ref.referral_id);
	              }
	              const statusInfo = STATUS_CONFIG[ref.status] || { label: ref.status, className: "bg-gray-100 text-gray-700" };
	              const priorityInfo = PRIORITY_CONFIG[ref.priority] || { label: ref.priority, className: "bg-gray-100 text-gray-700" };
	              const scanLabel = SCAN_TYPE_LABEL[ref.scan_type || ""] || ref.scan_type || "Scan";
	              const specName = ref.specialist_name || ref.external_specialist?.name || "Unknown Specialist";
	              const specSpecialty = ref.specialist_specialty || ref.external_specialist?.specialty || null;
              
              return (
                <div key={ref.referral_id} className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm relative">
                  <div className="flex justify-between items-start mb-3 pr-2">
                    <div>
                      <h4 className="font-semibold text-sm text-gray-900">{scanLabel} Evaluation</h4>
                      <p className="text-xs text-gray-500 mt-0.5">{formatDate(ref.created_at)}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded border", statusInfo.className)}>
                        {statusInfo.label}
                      </span>
                      {ref.priority !== "routine" && (
                        <span className={cn("text-[10px] font-semibold px-2 py-0.5 rounded border", priorityInfo.className)}>
                          {priorityInfo.label}
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-3 text-xs text-gray-700 bg-gray-50/80 p-2.5 rounded-xl border border-gray-50">
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <UserAvatar name={ref.referring_doctor_name || "Doctor"} role="doctor" seed={ref.referring_doctor_id || ref.referring_doctor_name} size="sm" />
                      <div className="min-w-0">
                        <span className="text-gray-400 block mb-0.5 text-[10px] uppercase tracking-wider font-semibold">From</span>
                        <p className="font-medium truncate">Dr. {ref.referring_doctor_name?.replace(/^(Dr\.?\s*)/i, '') || "Doctor"}</p>
                      </div>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-gray-300 flex-shrink-0" />
                    <div className="flex-1 flex items-center gap-2 min-w-0">
                      <UserAvatar name={specName} role="doctor" seed={ref.specialist_id || specName} size="sm" />
                      <div className="min-w-0">
                        <span className="text-gray-400 block mb-0.5 text-[10px] uppercase tracking-wider font-semibold">To Specialist</span>
                        <p className="font-medium truncate text-blue-700">{specName}</p>
                        {specSpecialty && (
                          <p className="text-[11px] text-gray-500 truncate mt-0.5">{specSpecialty}</p>
                        )}
                      </div>
                    </div>
	                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

