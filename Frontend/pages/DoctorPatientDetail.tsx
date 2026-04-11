import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { DoctorLayout } from "@/features/doctor/components/DoctorLayout";
import { ReferralPanel } from "@/features/doctor/components/ReferralPanel";
import { User, FileText, Activity, ClipboardCheck, ArrowLeft, Plus, Save, Stethoscope, Scan, AlertCircle, CheckCircle, Eye, ChevronDown, ChevronUp } from "lucide-react";
import { cn } from "@/utils";
import { fetchWithAuth } from "@/services/api";
import { Avatar as UserAvatar } from "@/components/Avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface PlatformDoctor {
  specialist_id: string;
  name: string;
  specialty: string;
  hospital_name: string;
  contact: string;
  is_registered: boolean;
}

interface PatientProfile {
  health_id: string;
  full_name: string;
  email: string;
  phone: string;
  date_of_birth: string;
  age: number;
  gender: string;
  height: number;
  weight: number;
  blood_group: string;
  emergency_contact_name?: string;
  reviewed_by_doctor?: boolean;
  reviewed_by_name?: string | null;
}

interface Scan {
  scan_id: string;
  scan_type: string;
  image_url: string;
  gradcam_url?: string;
  upload_date: string;
  prediction?: string;
  confidence?: number;
  model_result?: string;
  abnormal_probability?: number;
  malignant_probability?: number;
  review_status: string;
  reviewed_by_doctor?: boolean;
  reviewed_by_name?: string | null;
  reviewed_at?: string;
  doctor_notes?: string;
  flagged_followup?: boolean;
  // Referral fields (Step 2)
  referral_triggered?: boolean;
  referral_id?: string | null;
}



interface Remark {
  remark_id: string;
  doctor_id: string;
  doctor_name: string;
  remark: string;
  category?: string;
  created_at: string;
  updated_at: string;
}

interface MedicalHistory {
  report_id: string;
  report_type: string;
  generated_date: string;
  doctor_name: string;
  doctor_specialization?: string;
  diagnosis: Array<{
    condition: string;
    severity?: string;
    notes?: string;
  }>;
  medications: Array<{
    name: string;
    dosage: string;
    frequency: string;
    duration: string;
  }>;
  lab_tests_recommended?: string[];
  follow_up_date?: string;
  doctor_notes?: string;
}

interface PatientDetails {
  patient: PatientProfile;
  scans: Scan[];
  medical_history: MedicalHistory[];
  remarks: Remark[];
  statistics: {
    total_scans: number;
    total_visits: number;
    total_remarks: number;
  };
}

const formatDate = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatDateTime = (value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatProbability = (scan: Scan) => {
  const directProb = scan.abnormal_probability ?? scan.malignant_probability;
  if (directProb !== null && directProb !== undefined) {
    return `${directProb.toFixed(1)}%`;
  }
  if (scan.confidence !== null && scan.confidence !== undefined) {
    const normalized = scan.confidence > 1 ? scan.confidence : scan.confidence * 100;
    return `${normalized.toFixed(1)}%`;
  }
  return "N/A";
};

const isAbnormal = (scan: Scan) => {
  const modelResult = (scan.model_result || "").toLowerCase();
  if (modelResult === "abnormal" || modelResult === "malignant") {
    return true;
  }
  const prediction = (scan.prediction || "").toLowerCase();
  return prediction.includes("abnormal") || prediction.includes("malignant");
};

export default function DoctorPatientDetail() {
  const { healthId } = useParams<{ healthId: string }>();
  const navigate = useNavigate();
  const [details, setDetails] = useState<PatientDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Remark state
  const [newRemark, setNewRemark] = useState("");
  const [remarkCategory, setRemarkCategory] = useState("general");
  const [availableDoctorsOpen, setAvailableDoctorsOpen] = useState(false);
  const [availableDoctors, setAvailableDoctors] = useState<PlatformDoctor[]>([]);
  const [availableDoctorsLoading, setAvailableDoctorsLoading] = useState(false);
  const [availableDoctorsError, setAvailableDoctorsError] = useState("");
  const [referralPrefillName, setReferralPrefillName] = useState("");
  const [submittingRemark, setSubmittingRemark] = useState(false);

  // Referral map for status display
  const [referralMap, setReferralMap] = useState<Record<string, any>>({});



  const fetchPatientDetails = async () => {
    if (!healthId) {
      // If the route param is missing (bad URL / route mismatch), don't hang on the loader forever.
      setError("Missing patient Health ID in URL");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetchWithAuth(`/api/doctor/patients/${healthId}/details`);
      if (!response.ok) {
        throw new Error("Failed to load patient details");
      }
      const data = await response.json();
      setDetails(data);

      // Fetch all referrals for this patient to build a map
      const referralResponse = await fetchWithAuth(`/api/referrals/patient/${healthId}`);
      if (referralResponse.ok) {
        const referrals = await referralResponse.json();
        console.log("ðŸ“‹ Fetched referrals for patient:", referrals);
        const map: Record<string, any> = {};
        referrals.forEach((ref: any) => {
          if (ref.source_scan_id) {
            // Use source_scan_id as key so we can look up by scan
            map[ref.source_scan_id] = ref;
            console.log(`âœ… Mapped scan ${ref.source_scan_id} to referral status: ${ref.status}`);
          }
        });
        setReferralMap(map);
        console.log("ðŸ—ºï¸ Final referralMap:", map);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load patient details");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatientDetails();
  }, [healthId]);

  useEffect(() => {
    if (!availableDoctorsOpen) return;
    if (availableDoctorsLoading) return;
    if (availableDoctors.length > 0) return;

    const fetchDoctors = async () => {
      setAvailableDoctorsLoading(true);
      setAvailableDoctorsError("");
      try {
        const res = await fetchWithAuth("/api/referrals/search?q=");
        if (!res.ok) {
          throw new Error("Failed to load doctors");
        }
        const data = await res.json();
        setAvailableDoctors(Array.isArray(data) ? data : []);
      } catch (err) {
        setAvailableDoctorsError(err instanceof Error ? err.message : "Failed to load doctors");
      } finally {
        setAvailableDoctorsLoading(false);
      }
    };

    fetchDoctors();
  }, [availableDoctorsOpen, availableDoctorsLoading, availableDoctors.length]);

  const handleAddRemark = async () => {
    if (!newRemark.trim() || !healthId) return;

    setSubmittingRemark(true);
    try {
      const response = await fetchWithAuth("/api/doctor/patient/remark", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          health_id: healthId,
          remark: newRemark,
          category: remarkCategory,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to add remark");
      }

      setNewRemark("");
      setRemarkCategory("general");
      await fetchPatientDetails();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add remark");
    } finally {
      setSubmittingRemark(false);
    }
  };



  if (loading) {
    return (
      <DoctorLayout title="Patient Profile" showSearch={false}>
        <div className="text-center py-12 text-gray-500">Loading patient details...</div>
      </DoctorLayout>
    );
  }

  if (error || !details) {
    return (
      <DoctorLayout title="Patient Profile" showSearch={false}>
        <div className="text-center py-12 text-rose-600">{error || "Patient not found"}</div>
      </DoctorLayout>
    );
  }

  const patientName = details.patient.full_name || "Unknown Patient";
  const stats = details.statistics || {
    total_scans: 0,
    total_visits: 0,
    total_remarks: 0,
  };

  return (
    <DoctorLayout title="Patient Profile" showSearch={false}>
      {/* Back Button */}
      <div className="mb-3 md:mb-6">
        <Link
          to="/doctor/dashboard"
          className="inline-flex items-center gap-1.5 md:gap-2 text-xs md:text-sm font-medium text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-3 w-3 md:h-4 md:w-4" />
          Back to Dashboard
        </Link>
      </div>

      {/* Patient Profile Card - Prominent */}
      <Card className="mb-4 md:mb-8 border border-gray-200 shadow-sm">
        <CardHeader className="bg-gray-50 border-b border-gray-200 p-4 md:p-6">
          <div className="flex items-start gap-3 md:gap-6">
            <UserAvatar name={patientName} role="patient" seed={details.patient.health_id || healthId} size="lg" className="ring-4 ring-purple-100" />
            <div className="flex-1 min-w-0">
              <CardTitle className="text-xl md:text-2xl lg:text-3xl text-gray-900 mb-1 md:mb-2 truncate">{patientName}</CardTitle>
              <CardDescription className="text-sm md:text-base text-gray-600 flex items-center gap-2">
                <span className="font-mono font-medium text-xs md:text-sm truncate">{details.patient.health_id || "N/A"}</span>
              </CardDescription>
              <div className="grid grid-cols-2 gap-2 md:gap-3 mt-3 md:mt-4">
                <div className="bg-white rounded-lg p-2 md:p-3 shadow-sm">
                  <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wide">Age</p>
                  <p className="text-sm md:text-base font-semibold text-gray-900 mt-0.5 md:mt-1">{details.patient.age ? `${details.patient.age} yrs` : "N/A"}</p>
                </div>
                <div className="bg-white rounded-lg p-2 md:p-3 shadow-sm">
                  <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wide">Gender</p>
                  <p className="text-sm md:text-base font-semibold text-gray-900 mt-0.5 md:mt-1 capitalize">{details.patient.gender || "N/A"}</p>
                </div>
                <div className="bg-white rounded-lg p-2 md:p-3 shadow-sm">
                  <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wide">Blood</p>
                  <p className="text-sm md:text-base font-semibold text-red-600 mt-0.5 md:mt-1">{details.patient.blood_group || "N/A"}</p>
                </div>
                <div className="bg-white rounded-lg p-2 md:p-3 shadow-sm">
                  <p className="text-[10px] md:text-xs font-medium text-gray-500 uppercase tracking-wide">Last Scan</p>
                  <p className="text-[11px] md:text-xs font-semibold text-gray-900 mt-0.5 md:mt-1">
                    {details.scans.length > 0
                      ? new Date(details.scans[0].upload_date).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })
                      : "No scans"
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4 md:pt-6 p-4 md:p-6">
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <div className="flex items-center gap-2 md:gap-3">
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                <Activity className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg md:text-xl font-bold text-gray-900">{stats.total_scans}</p>
                <p className="text-[10px] md:text-xs text-gray-600 truncate">Scans</p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg md:text-xl font-bold text-gray-900">{stats.total_visits}</p>
                <p className="text-[10px] md:text-xs text-gray-600 truncate">Visits</p>
              </div>
            </div>
            <div className="flex items-center gap-2 md:gap-3">
              <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Stethoscope className="h-4 w-4 md:h-5 md:w-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <p className="text-lg md:text-xl font-bold text-gray-900">{stats.total_remarks}</p>
                <p className="text-[10px] md:text-xs text-gray-600 truncate">Remarks</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Main Content - 2/3 width */}
        <div className="lg:col-span-2 space-y-4 md:space-y-6 order-1">
          {/* 1. Previous Reports / Doctor Visits */}
          <Card>
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <FileText className="h-4 w-4 md:h-5 md:w-5 text-emerald-600" />
                Scans & Doctor Visits
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">Medical history, scans, and visit records</CardDescription>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0 md:pt-0">
              <div className="space-y-3 md:space-y-4 max-h-[400px] md:max-h-[600px] overflow-y-auto">
                {(() => {
                  // Combine scans and medical history, then sort by date
                  const allRecords = [
                    ...details.scans.map(scan => ({ type: 'scan' as const, data: scan, date: new Date(scan.upload_date) })),
                    ...details.medical_history
                      .filter(report => !report.report_type.toLowerCase().includes("preliminary ai screening"))
                      .map(report => ({ type: 'report' as const, data: report, date: new Date(report.generated_date) }))
                  ].sort((a, b) => b.date.getTime() - a.date.getTime());

                  if (allRecords.length === 0) {
                    return <p className="text-center text-gray-500 py-6 md:py-8 text-sm">No medical history or scans found</p>;
                  }

                  return allRecords.map((record, idx) => {
                    if (record.type === 'scan') {
                      const scan = record.data;
                      const abnormal = isAbnormal(scan);
                      const probability = formatProbability(scan);
                      const scanTypeLabel = scan.scan_type === 'chest_xray' ? 'Chest X-Ray' : scan.scan_type === 'skin_lesion' ? 'Skin Lesion' : scan.scan_type;

                      return (
                        <div
                          key={`scan-${scan.scan_id}`}
                          className="relative border border-gray-200 rounded-lg p-3 md:p-4 hover:border-gray-300 hover:shadow-md transition-all cursor-pointer bg-white"
                          onClick={() => navigate(`/doctor/reviews/${scan.scan_id}?returnTo=/doctor/patients/${healthId}`)}
                        >
                          {/* Status Pill in Corner */}
                          <div className="absolute top-2 md:top-3 right-2 md:right-3">
                            <span className={cn(
                              "text-[10px] md:text-xs font-semibold px-2 md:px-3 py-1 md:py-1.5 rounded-full shadow-sm",
                              scan.review_status === 'reviewed' ? "bg-emerald-100 text-emerald-700 border border-emerald-200" :
                                (scan.referral_triggered && referralMap[scan.scan_id]) ? (
                                  referralMap[scan.scan_id].status === 'active' ? "bg-blue-100 text-blue-700 border border-blue-200" :
                                    referralMap[scan.scan_id].status === 'pending' ? "bg-amber-100 text-amber-700 border border-amber-200" :
                                      referralMap[scan.scan_id].status === 'declined' ? "bg-red-100 text-red-700 border border-red-200" :
                                        referralMap[scan.scan_id].status === 'completed' ? "bg-green-100 text-green-700 border border-green-200" :
                                          "bg-gray-100 text-gray-700 border border-gray-200"
                                ) :
                                  scan.review_status === 'pending' ? "bg-amber-100 text-amber-700 border border-amber-200" :
                                    "bg-gray-100 text-gray-700 border border-gray-200"
                            )}>
                              {scan.review_status === 'reviewed' ? 'âœ“ Reviewed' :
                                (scan.referral_triggered && referralMap[scan.scan_id]) ? (
                                  referralMap[scan.scan_id].status === 'active' ? 'âœ“ Accepted' :
                                    referralMap[scan.scan_id].status === 'pending' ? 'ðŸ“‹ Referred (Pending)' :
                                      referralMap[scan.scan_id].status === 'declined' ? 'âœ— Declined' :
                                        referralMap[scan.scan_id].status === 'completed' ? 'âœ“ Completed' :
                                          'ðŸ“‹ Referred'
                                ) :
                                  scan.review_status === 'pending' ? 'â³ Pending' : 'âŠ˜ Not Reviewed'}
                            </span>
                          </div>

                          {/* Result Type Pill */}
                          {abnormal && (
                            <div className="absolute top-2 md:top-3 left-2 md:left-3">
                              <span className="text-[10px] md:text-xs font-semibold px-2 md:px-3 py-1 md:py-1.5 rounded-full bg-red-100 text-red-700 border border-red-200 shadow-sm">
                                âš  Abnormal
                              </span>
                            </div>
                          )}

                          <div className="flex items-start gap-2 md:gap-3 mb-2 md:mb-3 mt-6 md:mt-8">
                            <div className="h-8 w-8 md:h-10 md:w-10 rounded-lg bg-blue-100 flex items-center justify-center flex-shrink-0">
                              <Activity className="h-4 w-4 md:h-5 md:w-5 text-blue-600" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-gray-900 text-sm md:text-base truncate">
                                {scanTypeLabel} Scan
                              </h3>
                              <p className="text-xs md:text-sm text-gray-500 mt-0.5">{formatDate(scan.upload_date)}</p>
                            </div>
                          </div>

                          <div className="space-y-1.5 md:space-y-2 ml-10 md:ml-13">
                            {scan.prediction && (
                              <p className="text-xs md:text-sm text-gray-700">
                                <span className="font-semibold">Result:</span> <span className={abnormal ? "text-red-700 font-medium" : "text-emerald-700 font-medium"}>{scan.prediction}</span>
                              </p>
                            )}
                            {scan.model_result && (
                              <p className="text-xs md:text-sm text-gray-700">
                                <span className="font-semibold">Assessment:</span> <span className={abnormal ? "text-red-700" : ""}>{scan.model_result}</span>
                              </p>
                            )}
                            <p className="text-xs md:text-sm text-gray-700">
                              <span className="font-semibold">Confidence:</span> {probability}
                            </p>
                            {scan.reviewed_by_name && (
                              <p className="text-xs md:text-sm text-gray-600">
                                <span className="font-semibold">Reviewed by:</span> Dr. {scan.reviewed_by_name.replace(/^(Dr\.?\s*)/i, '')}
                              </p>
                            )}
                            {scan.doctor_notes && (
                              <div className="text-xs md:text-sm text-gray-700 bg-gray-50 p-2 md:p-3 rounded-lg border border-gray-200 mt-1.5 md:mt-2">
                                <span className="font-semibold">Doctor's Notes:</span> {scan.doctor_notes}
                              </div>
                            )}
                            {scan.flagged_followup && (
                              <div className="flex items-center gap-2 text-xs md:text-sm font-medium text-amber-700 mt-1.5 md:mt-2">
                                <AlertCircle className="h-3 w-3 md:h-4 md:w-4" />
                                Flagged for follow-up
                              </div>
                            )}

                            {/* Referral Status Information */}
                            {scan.referral_triggered && referralMap[scan.scan_id] && (
                              <div className={cn(
                                "text-xs md:text-sm p-2 md:p-3 rounded-lg border mt-1.5 md:mt-2",
                                referralMap[scan.scan_id].status === 'active' ? "bg-blue-50 border-blue-200" :
                                  referralMap[scan.scan_id].status === 'pending' ? "bg-amber-50 border-amber-200" :
                                    referralMap[scan.scan_id].status === 'declined' ? "bg-red-50 border-red-200" :
                                      referralMap[scan.scan_id].status === 'completed' ? "bg-green-50 border-green-200" :
                                        "bg-gray-50 border-gray-200"
                              )}>
                                <div className="font-semibold mb-1">
                                  Referral Status: {
                                    referralMap[scan.scan_id].status === 'active' ? 'âœ“ Accepted by Specialist' :
                                      referralMap[scan.scan_id].status === 'pending' ? 'â³ Pending Specialist Response' :
                                        referralMap[scan.scan_id].status === 'declined' ? 'âœ— Declined by Specialist' :
                                          referralMap[scan.scan_id].status === 'completed' ? 'âœ“ Completed' :
                                            referralMap[scan.scan_id].status
                                  }
                                </div>
                                <div className="text-gray-700">
                                  <span className="font-semibold">Referred to:</span> {referralMap[scan.scan_id].specialist_name || 'Specialist'}
                                </div>
                                {referralMap[scan.scan_id].status === 'declined' && referralMap[scan.scan_id].audit_log && (
                                  <div className="mt-2 pt-2 border-t border-red-200">
                                    <span className="font-semibold text-red-700">Decline Reason:</span>
                                    <p className="text-red-900 mt-1">
                                      {(() => {
                                        const declineEntry = referralMap[scan.scan_id].audit_log
                                          .reverse()
                                          .find((entry: any) => entry.status === 'declined');
                                        return declineEntry?.note || 'No reason provided';
                                      })()}
                                    </p>
                                  </div>
                                )}
                                {referralMap[scan.scan_id].status === 'active' && referralMap[scan.scan_id].audit_log && (
                                  <div className="mt-2 pt-2 border-t border-blue-200">
                                    <span className="font-semibold text-blue-700">Specialist Note:</span>
                                    <p className="text-blue-900 mt-1">
                                      {(() => {
                                        const activeEntry = referralMap[scan.scan_id].audit_log
                                          .reverse()
                                          .find((entry: any) => entry.status === 'active');
                                        return activeEntry?.note || 'Specialist accepted the referral';
                                      })()}
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Click to View Indicator */}
                          <div className="mt-2 md:mt-3 pt-2 md:pt-3 border-t border-gray-100 flex items-center justify-center gap-2 text-xs md:text-sm text-gray-500 font-medium pb-2">
                            <Eye className="h-3 w-3 md:h-4 md:w-4" />
                            Click to view details
                          </div>

                          {/* Embedded Referral Form */}
                          <div className="mt-1 relative z-10" onClick={(e) => e.stopPropagation()}>
                            <ReferralPanel
                              patientId={healthId}
                              scans={[scan]}
                              prefillSpecialistName={referralPrefillName}
                            />

                            <div className="mt-4 rounded-2xl border border-gray-200 bg-white overflow-hidden">
                              <button
                                type="button"
                                onClick={() => setAvailableDoctorsOpen((v) => !v)}
                                className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
                              >
                                <div className="text-left">
                                  <p className="text-sm font-semibold text-gray-900">Available Doctors on Platform</p>
                                  <p className="text-xs text-gray-500 mt-0.5">Tap a doctor to prefill the referral search</p>
                                </div>
                                {availableDoctorsOpen ? (
                                  <ChevronUp className="h-4 w-4 text-gray-400" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 text-gray-400" />
                                )}
                              </button>

                              {availableDoctorsOpen && (
                                <div className="px-4 pb-4">
                                  {availableDoctorsLoading && (
                                    <div className="text-sm text-gray-500 py-2">Loading doctors...</div>
                                  )}
                                  {!availableDoctorsLoading && availableDoctorsError && (
                                    <div className="text-sm text-rose-600 py-2">{availableDoctorsError}</div>
                                  )}
                                  {!availableDoctorsLoading && !availableDoctorsError && availableDoctors.length === 0 && (
                                    <div className="text-sm text-gray-500 py-2">No doctors found.</div>
                                  )}

                                  {!availableDoctorsLoading && !availableDoctorsError && availableDoctors.length > 0 && (
                                    <div className="space-y-2 mt-2">
                                      {availableDoctors.map((doc) => (
                                        <button
                                          key={doc.specialist_id}
                                          type="button"
                                          onClick={() => setReferralPrefillName(doc.name)}
                                          className="w-full text-left rounded-xl border border-gray-100 bg-gray-50 hover:bg-gray-100 transition-colors px-3 py-3"
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <div className="min-w-0">
                                              <p className="text-sm font-semibold text-gray-900 truncate">{doc.name}</p>
                                              <p className="text-xs text-gray-600 truncate mt-0.5">
                                                {doc.specialty} Â· {doc.hospital_name}
                                              </p>
                                            </div>
                                            {doc.is_registered && (
                                              <span className="shrink-0 text-[10px] font-semibold px-2 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                                Verified
                                              </span>
                                            )}
                                          </div>
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    } else {
                      const report = record.data;
                      return (
                        <div key={`report-${report.report_id}`} className="border border-gray-200 rounded-lg p-3 md:p-4 hover:border-gray-300 transition-colors">
                          <div className="flex items-start justify-between mb-2 md:mb-3 gap-2">
                            <div className="min-w-0 flex-1">
                              <h3 className="font-semibold text-gray-900 text-sm md:text-base truncate">{report.report_type}</h3>
                              <p className="text-xs md:text-sm text-gray-500 mt-1">{formatDate(report.generated_date)}</p>
                            </div>
                            <span className="text-[10px] md:text-xs font-medium text-gray-600 bg-gray-100 px-2 md:px-3 py-1 rounded-full whitespace-nowrap">
                              Dr. {report.doctor_name.replace(/^(Dr\.?\s*)/i, '')}
                            </span>
                          </div>
                          {report.diagnosis.length > 0 && (
                            <div className="mb-2 md:mb-3">
                              <p className="text-xs md:text-sm font-semibold text-gray-700 mb-1.5 md:mb-2">Diagnosis:</p>
                              <ul className="list-disc list-inside text-xs md:text-sm text-gray-600 space-y-1">
                                {report.diagnosis.map((d, i) => (
                                  <li key={i}>
                                    <span className="font-medium">{d.condition}</span>
                                    {d.severity && <span className="text-orange-600"> ({d.severity})</span>}
                                    {d.notes && <span className="text-gray-500"> - {d.notes}</span>}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {report.medications.length > 0 && (
                            <div className="mb-2 md:mb-3">
                              <p className="text-xs md:text-sm font-semibold text-gray-700 mb-1.5 md:mb-2">Medications:</p>
                              <ul className="list-disc list-inside text-xs md:text-sm text-gray-600 space-y-1">
                                {report.medications.map((m, i) => (
                                  <li key={i}>
                                    {m.name} - {m.dosage}, {m.frequency} for {m.duration}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {report.doctor_notes && (
                            <div className="text-xs md:text-sm text-gray-600 bg-gray-50 p-2 md:p-3 rounded-lg">
                              <span className="font-semibold">Notes:</span> {report.doctor_notes}
                            </div>
                          )}
                        </div>
                      );
                    }
                  });
                })()}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar - 1/3 width (Add Remarks) */}
        <div className="lg:col-span-1 space-y-4 md:space-y-6 order-2">
          <Card className="lg:sticky lg:top-6">
            <CardHeader className="p-4 md:p-6">
              <CardTitle className="flex items-center gap-2 text-base md:text-lg">
                <Stethoscope className="h-4 w-4 md:h-5 md:w-5 text-amber-600" />
                Add Remarks
              </CardTitle>
              <CardDescription className="text-xs md:text-sm">General observations and notes</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 md:space-y-4 p-4 md:p-6 pt-0 md:pt-0">
              <div>
                <Label htmlFor="remark" className="text-xs md:text-sm font-medium">
                  Remark *
                </Label>
                <Textarea
                  id="remark"
                  value={newRemark}
                  onChange={(e) => setNewRemark(e.target.value)}
                  placeholder="Enter observations, warnings, or notes..."
                  rows={3}
                  className="mt-1 text-xs md:text-sm"
                />
              </div>
              <div>
                <Label htmlFor="category" className="text-xs md:text-sm font-medium">
                  Category
                </Label>
                <Select value={remarkCategory} onValueChange={setRemarkCategory}>
                  <SelectTrigger className="mt-1 text-xs md:text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General</SelectItem>
                    <SelectItem value="observation">Observation</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="allergy">Allergy</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleAddRemark}
                disabled={submittingRemark || !newRemark.trim()}
                className="w-full text-xs md:text-sm"
              >
                <Plus className="h-3 w-3 md:h-4 md:w-4 mr-2" />
                {submittingRemark ? "Adding..." : "Add Remark"}
              </Button>

              {/* Previous Remarks */}
              <div className="mt-4 md:mt-6">
                <h4 className="text-xs md:text-sm font-semibold text-gray-700 mb-2 md:mb-3">Previous Remarks</h4>
                <div className="space-y-2 md:space-y-3 max-h-[300px] md:max-h-[400px] overflow-y-auto">
                  {details.remarks.length === 0 ? (
                    <p className="text-xs md:text-sm text-gray-500 text-center py-3 md:py-4">No remarks yet</p>
                  ) : (
                    details.remarks.map((remark) => (
                      <div
                        key={remark.remark_id}
                        className="bg-gray-50 border border-gray-200 rounded-lg p-2.5 md:p-3"
                      >
                        <div className="flex items-start justify-between mb-1.5 md:mb-2">
                          <span
                            className={cn(
                              "text-[10px] md:text-xs font-medium px-1.5 md:px-2 py-0.5 md:py-1 rounded",
                              remark.category === "warning"
                                ? "bg-red-100 text-red-700"
                                : remark.category === "allergy"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-blue-100 text-blue-700"
                            )}
                          >
                            {remark.category || "general"}
                          </span>
                        </div>
                        <p className="text-xs md:text-sm text-gray-700">{remark.remark}</p>
                        <div className="mt-1.5 md:mt-2 text-[10px] md:text-xs text-gray-500">
                          <span className="font-medium">By Dr. {remark.doctor_name.replace(/^(Dr\.?\s*)/i, '')}</span>
                          <span className="mx-1">â€¢</span>
                          <span>{formatDate(remark.created_at)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </DoctorLayout>
  );
}

