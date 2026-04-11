import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { FloatingNav } from "@/layouts/FloatingNav";
import { Header } from "@/layouts/Header";
import { ReportCard } from "@/features/reports/components/ReportCard";
import { MedicalTimeline, MedicalHistoryEntry, ScanReviewSummary } from "@/features/reports/components/MedicalTimeline";
import { TimelineEntryDetail } from "@/features/reports/components/TimelineEntryDetail";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HospitalRecommendations } from "@/features/chat/components/HospitalRecommendations";
import { MediqIcon } from "@/components/ui/MediqIcon";
import { Search, FileText, ArrowLeft, Loader2, Clock, Calendar, ShieldAlert, ShieldCheck, CheckCircle2, AlertTriangle, Stethoscope, HeartPulse, ClipboardList, Download, Phone, Navigation, MapPin, MessageSquare } from "lucide-react";
import { cn } from "@/utils";
import { fetchWithAuth, locationApi } from "@/services/api";
import { useLocation } from "@/store/LocationContext";

interface Report {
  id: string;
  title: string;
  type: "symptom" | "scan" | "comprehensive";
  date: string;
  summary: string;
  status: "completed" | "pending";
}

const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};


export default function Reports() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get("tab") || "timeline";
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedReport, setSelectedReport] = useState<string | null>(null);
  
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reportDetail, setReportDetail] = useState<any | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [nearbyHospitals, setNearbyHospitals] = useState<any[]>([]);
  const [isLoadingHospitals, setIsLoadingHospitals] = useState(false);
  const [hospitalError, setHospitalError] = useState<string | null>(null);
  const [hasRequestedLocation, setHasRequestedLocation] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  // Medical timeline state
  const [timeline, setTimeline] = useState<MedicalHistoryEntry[]>([]);
  const [isLoadingTimeline, setIsLoadingTimeline] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState<MedicalHistoryEntry | null>(null);
  const [showEntryDetail, setShowEntryDetail] = useState(false);
  const [scanReviewMap, setScanReviewMap] = useState<Record<string, ScanReviewSummary>>({});
  const [remarks, setRemarks] = useState<any[]>([]);
  const [isLoadingRemarks, setIsLoadingRemarks] = useState(true);
  const [referralMap, setReferralMap] = useState<Record<string, any>>({});
  const { location, hasPermission, requestLocation, isLoading: isLocationLoading } = useLocation();

  // Fetch screening reports ONLY - exclude X-ray scan analyses
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const response = await fetchWithAuth("/api/patient/reports");

        if (!response.ok) {
          throw new Error("Failed to fetch reports");
        }

        const data = await response.json();
        
        // STRICT FILTERING: Only screening reports, NOT X-ray scan analyses
        const filteredData = data.filter((report: any) => {
          const reportType = (report.report_type || "").toLowerCase();
          // Only include screening reports
          return reportType.includes("screening") || reportType.includes("preliminary");
        }).sort((a: any, b: any) => new Date(b.generated_date).getTime() - new Date(a.generated_date).getTime());
        
        // Transform backend data to match frontend interface
        const transformedReports: Report[] = filteredData.map((report: any) => ({
          id: report.report_id,
          title: report.report_type || "Medical Report",
          type: report.report_type?.toLowerCase().includes("screening") ? "symptom" : "comprehensive",
          date: new Date(report.generated_date).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          summary: report.chief_complaint || "No summary available",
          status: "completed" as const,
        }));

        setReports(transformedReports);
        setIsLoading(false);
      } catch (err) {
        console.error("Error fetching reports:", err);
        setError("Failed to load reports");
        setIsLoading(false);
        setReports([]);
      }
    };

    fetchReports();
  }, []);

  // Fetch medical timeline - ONLY X-ray scan analyses and doctor visits
  useEffect(() => {
    const fetchTimeline = async () => {
      try {
        const response = await fetchWithAuth("/api/history/my-timeline?limit=50");

        if (!response.ok) {
          throw new Error("Failed to fetch timeline");
        }

        const data = await response.json();
        // STRICT FILTERING: Show scan_analysis and doctor_visit
        const filteredEntries = (data.entries || []).filter((entry: MedicalHistoryEntry) => {
          // Show all scan_analysis entries (X-ray, Skin, etc.)
          if (entry.entry_type === "scan_analysis") {
            return true;
          }
          // Exclude chatbot_screening and medical_report - those go to Reports tab
          if (entry.entry_type === "chatbot_screening" || entry.entry_type === "medical_report") {
            return false;
          }
          // Show doctor_visit and other non-screening entries
          return entry.entry_type === "doctor_visit";
        });
        setTimeline(filteredEntries);
        setIsLoadingTimeline(false);
      } catch (err) {
        console.error("Error fetching timeline:", err);
        setIsLoadingTimeline(false);
      }
    };

    fetchTimeline();
  }, []);

  // Fetch patient remarks
  useEffect(() => {
    const fetchRemarks = async () => {
      try {
        const response = await fetchWithAuth("/api/patient/remarks");

        if (!response.ok) {
          throw new Error("Failed to fetch remarks");
        }

        const data = await response.json();
        setRemarks(data || []);
        setIsLoadingRemarks(false);
      } catch (err) {
        console.error("Error fetching remarks:", err);
        setIsLoadingRemarks(false);
      }
    };

    fetchRemarks();
  }, []);

  // Fetch referrals for scan status
  useEffect(() => {
    const fetchReferrals = async () => {
      try {
        const token = localStorage.getItem('token');
        if (!token) return;

        const profileResponse = await fetchWithAuth('/api/auth/profile');
        if (!profileResponse.ok) return;

        const profileData = await profileResponse.json();
        if (!profileData.health_id) return;

        const referralsResponse = await fetchWithAuth(`/api/referrals/patient/${profileData.health_id}`);
        if (referralsResponse.ok) {
          const referrals = await referralsResponse.json();
          const map: Record<string, any> = {};
          referrals.forEach((ref: any) => {
            if (ref.source_scan_id) {
              map[ref.source_scan_id] = ref;
            }
          });
          setReferralMap(map);
        }
      } catch (err) {
        console.error("Error fetching referrals:", err);
      }
    };

    fetchReferrals();
  }, []);



  useEffect(() => {
    const scanIds = Array.from(
      new Set(
        timeline
          .filter((entry) => entry.entry_type === "scan_analysis")
          .map((entry) => entry.metadata?.scan_id)
          .filter((scanId): scanId is string => Boolean(scanId))
      )
    );

    if (scanIds.length === 0) {
      setScanReviewMap({});
      return;
    }

    const fetchScanReviews = async () => {
      try {
        const responses = await Promise.all(
          scanIds.map(async (scanId) => {
            const response = await fetchWithAuth(`/api/patient/scans/${scanId}`);

            if (!response.ok) return [scanId, null] as const;
            const data = await response.json();
            return [scanId, {
              review_status: data.review_status,
              reviewed_by_doctor: data.reviewed_by_doctor,
              reviewed_by_name: data.reviewed_by_name,
              reviewed_at: data.reviewed_at,
            }] as const;
          })
        );

        const nextMap: Record<string, ScanReviewSummary> = {};
        responses.forEach(([scanId, review]) => {
          if (review) {
            nextMap[scanId] = review;
          }
        });
        setScanReviewMap(nextMap);
      } catch (err) {
        console.error("Error fetching scan reviews:", err);
      }
    };

    fetchScanReviews();
  }, [timeline]);

  // Fetch report detail when a report is selected
  useEffect(() => {
    const fetchReportDetail = async () => {
      if (!selectedReport) {
        setReportDetail(null);
        setNearbyHospitals([]);
        setHospitalError(null);
        return;
      }

      setIsLoadingDetail(true);
      try {
        const response = await fetchWithAuth(`/api/patient/report/${selectedReport}`);

        if (!response.ok) {
          throw new Error("Failed to fetch report details");
        }

        const data = await response.json();
        setReportDetail(data);
      } catch (err) {
        console.error("Error fetching report detail:", err);
        setReportDetail(null);
      } finally {
        setIsLoadingDetail(false);
      }
    };

    fetchReportDetail();
  }, [selectedReport]);

  useEffect(() => {
    if (selectedReport && !hasRequestedLocation) {
      setHasRequestedLocation(true);
      requestLocation();
    }
  }, [selectedReport, hasRequestedLocation, requestLocation]);

  useEffect(() => {
    const fetchNearbyHospitals = async () => {
      if (!selectedReport || !location) return;

      setIsLoadingHospitals(true);
      setHospitalError(null);

      try {
        const data = await locationApi.getNearbyHospitals(
          location.latitude,
          location.longitude,
          5000
        );

        const mapped = data
          .map((h, idx) => {
            const distanceKm = Math.round(
              haversineKm(
                location.latitude,
                location.longitude,
                h.latitude,
                h.longitude
              ) * 10
            ) / 10;
            return {
              hospital_id: `osm-${h.latitude}-${h.longitude}-${idx}`,
              name: h.hospital_name,
              distance_km: distanceKm,
              address: h.address,
              google_maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                `${h.hospital_name} ${h.latitude},${h.longitude}`
              )}`,
              latitude: h.latitude,
              longitude: h.longitude,
            };
          })
          .sort((a, b) => a.distance_km - b.distance_km)
          .slice(0, 5);

        setNearbyHospitals(mapped);
        if (mapped.length === 0) {
          setHospitalError("No nearby hospitals found. Try increasing search radius.");
        }
      } catch (err) {
        console.error("Error fetching nearby hospitals:", err);
        setHospitalError("Failed to fetch nearby hospitals.");
      } finally {
        setIsLoadingHospitals(false);
      }
    };

    fetchNearbyHospitals();
  }, [selectedReport, location]);

  const filteredReports = reports.filter((report) => {
    const matchesSearch = report.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          report.summary.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const handleDownloadReport = async () => {
    if (!reportDetail || isDownloading) return;
    setIsDownloading(true);
    setDownloadError(null);

    try {
      const response = await fetchWithAuth(`/api/patient/report/${reportDetail.report_id}/pdf`);
      if (!response.ok) {
        throw new Error("Failed to download report");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `medical_report_${reportDetail.report_id}.pdf`;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading report:", err);
      setDownloadError("Unable to download report. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };


  if (selectedReport) {
    if (isLoadingDetail) {
      return (
        <div className="min-h-screen bg-white pb-24">
          <Header />
          <FloatingNav />
          <main className="max-w-md md:max-w-6xl lg:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 py-6">
            <Button
              variant="ghost"
              onClick={() => setSelectedReport(null)}
              className="mb-4 -ml-2 h-10 hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="text-center py-12">
              <Loader2 className="h-12 w-12 mx-auto text-gray-300 mb-4 animate-spin" />
              <h3 className="font-medium text-gray-900">Loading report...</h3>
            </div>
          </main>
        </div>
      );
    }

    if (!reportDetail) {
      return (
        <div className="min-h-screen bg-white pb-24">
          <Header />
          <FloatingNav />
          <main className="max-w-md md:max-w-6xl lg:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 py-6">
            <Button
              variant="ghost"
              onClick={() => setSelectedReport(null)}
              className="mb-4 -ml-2 h-10 hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <div className="text-center py-12">
              <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
              <h3 className="font-medium text-gray-900">Unable to load report</h3>
              <p className="text-sm text-gray-500 mt-1">Please try again later.</p>
            </div>
          </main>
        </div>
      );
    }

    const detail = reportDetail;
    const ensureArray = <T,>(value: any, fallback: T[]): T[] =>
      Array.isArray(value) && value.length > 0 ? value : fallback;
    const reportTitle = detail?.report_type || detail?.title || "Medical Report";
    const reportDate = detail?.generated_date
      ? new Date(detail.generated_date).toLocaleDateString("en-US", {
          month: "long",
          day: "numeric",
          year: "numeric",
        })
      : detail?.date || "Recent";
    const reportSummary =
      detail?.chief_complaint ||
      detail?.summary ||
      detail?.analysis?.details ||
      "AI-generated findings and recommended next steps tailored to your profile.";
    const patientName = detail?.patient_name || detail?.patientInfo?.name;
    const patientGender = detail?.patient_gender || detail?.patientInfo?.gender;
    const patientAge = detail?.patient_age ?? detail?.patientInfo?.age;
    const patientRecordId = detail?.health_id || detail?.patientInfo?.id;
    const rawSeverity = String(
      detail?.severity_assessment?.level || detail?.severityLevel || detail?.analysis?.severity || "low"
    ).toLowerCase();
    const severityLabel = rawSeverity.charAt(0).toUpperCase() + rawSeverity.slice(1);
    const severityTone = rawSeverity;
    const severityBadge =
      severityTone === "critical" || severityTone === "high"
        ? "bg-red-50 text-red-700"
        : severityTone === "moderate"
        ? "bg-amber-50 text-amber-700"
        : "bg-emerald-50 text-emerald-700";
    const severityLevel = severityTone === "critical" || severityTone === "high" ? "high" : "low";

    const symptoms = ensureArray(
      detail?.detected_symptoms || detail?.symptoms || detail?.analysis?.symptoms || detail?.metadata?.symptoms,
      detail?.chief_complaint ? [detail.chief_complaint] : ["No symptoms recorded"]
    );

    const keyFindings = ensureArray(
      detail?.analysis?.findings || detail?.findings,
      [
        detail?.chief_complaint ? `Chief complaint: ${detail.chief_complaint}` : "No chief complaint recorded.",
        ...symptoms.slice(0, 2).map((symptom: string) => `Reported symptom: ${symptom}`),
      ]
    );

    const recommendations = ensureArray(detail?.recommendations, [
      "Consult a qualified healthcare professional for diagnosis and treatment.",
      "Track your symptoms and seek urgent care if they worsen.",
    ]);

    const vitals =
      Array.isArray(detail?.vitals) && detail.vitals.length > 0
        ? detail.vitals
        : detail?.vital_signs && typeof detail.vital_signs === "object"
        ? Object.entries(detail.vital_signs).map(([label, value]) => ({
            label: label.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            value: String(value ?? "N/A"),
          }))
        : [{ label: "Vitals", value: "Not recorded" }];

    const tests =
      Array.isArray(detail?.tests) && detail.tests.length > 0
        ? detail.tests
        : detail?.lab_results && typeof detail.lab_results === "object"
        ? Object.entries(detail.lab_results).map(([name, result]) => ({
            name,
            status: "Recorded",
            note: String(result ?? "N/A"),
          }))
        : [{ name: "Lab results", status: "Not available", note: "No lab results recorded." }];

    const carePlan = ensureArray(detail?.care_plan, recommendations);

    const hospitals = nearbyHospitals;
    const primaryHospital = hospitals[0];

    return (
      <div className="min-h-screen bg-white pb-24">
        <FloatingNav />

        <main className="max-w-md md:max-w-6xl lg:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 py-6">
          <Button
            variant="ghost"
            onClick={() => setSelectedReport(null)}
            className="mb-4 -ml-2 h-10 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          <section className="relative overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-slate-50 via-white to-amber-50 p-6 shadow-sm">
            <div className="absolute -right-24 -top-24 h-56 w-56 rounded-full bg-amber-100/60 blur-3xl" />
            <div className="absolute -bottom-24 -left-24 h-56 w-56 rounded-full bg-sky-100/60 blur-3xl" />

            <div className="relative flex flex-wrap items-start justify-between gap-6">
              <div className="max-w-2xl">
                <div className="flex items-center gap-2">
                  <MediqIcon className="h-10 w-10 rounded-full" />
                  <div>
                    <p className="text-xs uppercase tracking-[0.3em] text-slate-500">MediQ Report</p>
                    <h1 className="text-2xl font-semibold text-slate-900 md:text-3xl">
                      {reportTitle}
                    </h1>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-3 py-1">
                    <Calendar className="h-3 w-3" />
                    {reportDate}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-emerald-700">
                    <CheckCircle2 className="h-3 w-3" />
                    Completed
                  </span>
                  <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1", severityBadge)}>
                    <AlertTriangle className="h-3 w-3" />
                    {severityLabel} Priority
                  </span>
                </div>
                <p className="mt-4 text-sm text-slate-600">
                  {reportSummary}
                </p>
              </div>

              {patientName && (
                <div className="rounded-2xl border border-white/70 bg-white/80 px-4 py-3 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.2em] text-slate-500">Patient</p>
                  <p className="text-sm font-semibold text-slate-900">
                    {patientName}
                  </p>
                  {(patientGender || patientAge) && (
                    <p className="text-xs text-slate-600">
                      {patientGender || ""}
                      {patientGender && patientAge ? " Â· " : ""}
                      {patientAge ? `${patientAge} yrs` : ""}
                    </p>
                  )}
                  {patientRecordId && (
                    <p className="mt-1 text-xs text-slate-500">ID: {patientRecordId}</p>
                  )}
                </div>
              )}
            </div>
          </section>

          <div className="mt-6 grid gap-6 lg:grid-cols-[2fr,1fr]">
            <div className="space-y-6">
              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Clinical Snapshot</h2>
                <div className="grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">Condition</p>
                    <p className="text-sm font-semibold text-slate-900">{detail?.analysis?.condition || symptoms[0] || "Pending review"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">Probability</p>
                    <p className="text-sm font-semibold text-slate-900">{detail?.analysis?.probability || detail?.severity_assessment?.confidence || "Preliminary"}</p>
                  </div>
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 px-4 py-3">
                    <p className="text-xs text-slate-500">Severity</p>
                    <p className="text-sm font-semibold text-slate-900">{severityLabel}</p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Symptoms & Signals</h2>
                <div className="flex flex-wrap gap-2">
                  {symptoms.map((symptom: string, index: number) => (
                    <span
                      key={`${symptom}-${index}`}
                      className="rounded-full border border-gray-200 bg-gray-50 px-3 py-1 text-xs font-medium text-gray-700"
                    >
                      {symptom}
                    </span>
                  ))}
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-blue-700 text-xs font-semibold">
                      <Stethoscope className="h-4 w-4" />
                      Primary Concern
                    </div>
                    <p className="mt-2 text-sm text-blue-900">
                      {detail?.analysis?.condition || symptoms[0] || "Symptom review"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                      <HeartPulse className="h-4 w-4" />
                      Risk Flag
                    </div>
                    <p className="mt-2 text-sm text-emerald-900">{severityLabel} monitoring recommended</p>
                  </div>
                </div>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Key Findings</h2>
                <ul className="space-y-3">
                  {keyFindings.map((finding: string, index: number) => (
                    <li key={`${finding}-${index}`} className="flex items-start gap-3 text-sm text-gray-700">
                      <span className="mt-0.5 h-6 w-6 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center text-xs font-semibold">
                        {index + 1}
                      </span>
                      <span>{finding}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Care Plan & Next Steps</h2>
                <div className="space-y-3">
                  {carePlan.map((step: string, index: number) => (
                    <div key={`${step}-${index}`} className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                      <ClipboardList className="h-4 w-4 text-gray-600 mt-0.5" />
                      <span className="text-sm text-gray-700">{step}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                  <div className="flex items-center gap-2 text-emerald-700 text-xs font-semibold">
                    <ShieldCheck className="h-4 w-4" />
                    Recommended Actions
                  </div>
                  <ul className="mt-2 space-y-2 text-sm text-emerald-900">
                    {recommendations.map((rec: string, index: number) => (
                      <li key={`${rec}-${index}`} className="flex items-start gap-2">
                        <span className="text-emerald-600 font-bold">â€¢</span>
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h2>
                <div className="grid gap-3">
                  <Button
                    className="w-full justify-between bg-gray-900 text-white hover:bg-gray-800"
                    onClick={handleDownloadReport}
                    disabled={isDownloading}
                  >
                    {isDownloading ? "Downloading..." : "Download report"}
                    <Download className="h-4 w-4" />
                  </Button>
                  {downloadError && (
                    <p className="text-xs text-rose-600">{downloadError}</p>
                  )}
                </div>
                {primaryHospital && (
                  <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                      <MapPin className="h-4 w-4" />
                      Nearest facility
                    </div>
                    <p className="mt-2 text-sm font-semibold text-gray-900">{primaryHospital.name}</p>
                    <p className="text-xs text-gray-600">{primaryHospital.distance_km} km</p>
                    <div className="mt-3 flex gap-2">
                      <Button
                        size="sm"
                        className="flex-1 gap-2 rounded-full bg-gray-900 text-white hover:bg-gray-800"
                        onClick={() => window.open(primaryHospital.google_maps_url, "_blank")}
                      >
                        <Navigation className="h-3.5 w-3.5" />
                        Maps
                      </Button>
                      {primaryHospital.phone && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 gap-2 rounded-full border-gray-200 text-gray-700 hover:bg-gray-50"
                          onClick={() => window.open(`tel:${primaryHospital.phone}`, "_self")}
                        >
                          <Phone className="h-3.5 w-3.5" />
                          Call
                        </Button>
                      )}
                    </div>
                  </div>
                )}
              </section>

              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Safety Checks</h2>
                <div className="space-y-3">
                  <div className="flex items-start gap-3 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
                    <ShieldAlert className="h-4 w-4 text-amber-700 mt-0.5" />
                    <p className="text-sm text-amber-900">Seek urgent care if you experience severe or rapidly worsening symptoms.</p>
                  </div>
                  <div className="flex items-start gap-3 rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3">
                    <ShieldCheck className="h-4 w-4 text-emerald-700 mt-0.5" />
                    <p className="text-sm text-emerald-900">Follow prescribed guidance, keep medications accessible, and monitor symptom changes daily.</p>
                  </div>
                </div>
              </section>
            </div>
          </div>

          <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-4 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Diagnostic Timeline</h2>
                <p className="text-sm text-gray-600">Track tests, results, and upcoming reviews.</p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-gray-50 px-3 py-1 text-xs text-gray-600">
                <ClipboardList className="h-3.5 w-3.5" />
                {tests.length} items
              </span>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {tests.map((test: { name: string; status: string; note: string }, index: number) => (
                <div key={`${test.name}-${index}`} className="rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <p className="text-sm font-semibold text-gray-900">{test.name}</p>
                  <p className="text-xs text-gray-500 mt-1">{test.note}</p>
                  <span className="mt-3 inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-xs text-gray-600">
                    <CheckCircle2 className="h-3 w-3" />
                    {test.status}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <section className="mt-6">
            {isLocationLoading || isLoadingHospitals ? (
              <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm text-center">
                <Loader2 className="h-6 w-6 mx-auto text-gray-400 animate-spin" />
                <p className="text-sm text-gray-500 mt-2">Fetching nearby hospitals...</p>
              </div>
            ) : !hasPermission ? (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
                <AlertTriangle className="h-6 w-6 mx-auto text-amber-500" />
                <p className="text-sm text-amber-800 mt-2">Enable location to find nearby hospitals.</p>
                <Button
                  size="sm"
                  className="mt-3 rounded-full bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={requestLocation}
                >
                  <MapPin className="h-4 w-4 mr-2" />
                  Enable Location
                </Button>
              </div>
            ) : hospitalError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center">
                <AlertTriangle className="h-6 w-6 mx-auto text-red-500" />
                <p className="text-sm text-red-700 mt-2">{hospitalError}</p>
              </div>
            ) : nearbyHospitals.length > 0 ? (
              <HospitalRecommendations
                hospitals={hospitals}
                reason="Nearby facilities based on your current location."
                severityLevel={severityLevel}
              />
            ) : null}
          </section>

          <section className="mt-6 rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-gray-900">
              <ShieldCheck className="h-5 w-5" />
              <h2 className="text-lg font-semibold">Important Disclaimer</h2>
            </div>
            <p className="text-sm text-gray-600">
              {detail?.disclaimer || ensureArray(detail?.disclaimers, []).join(" ") || "This report is generated by an AI system and should not be used as a definitive diagnosis. Please consult a qualified healthcare professional for medical advice."}
            </p>
          </section>
        </main>
      </div>
    );
  }

  const handleEntryClick = (entry: MedicalHistoryEntry) => {
    setSelectedEntry(entry);
    setShowEntryDetail(true);
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <FloatingNav />

      <main className="max-w-md md:max-w-6xl lg:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 py-6">
        {/* Header */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/")}
            className="mb-3 -ml-2 h-10 text-sm hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">Health Records</h1>
          <p className="text-gray-600 text-sm mt-1">
            X-ray analyses in Timeline â€¢ Screening reports and skin scans in Reports
          </p>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={(val) => setSearchParams({ tab: val })} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="timeline" className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Timeline
            </TabsTrigger>
            <TabsTrigger value="reports" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Reports
            </TabsTrigger>
            <TabsTrigger value="remarks" className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Doctor Notes
            </TabsTrigger>
          </TabsList>

          {/* Timeline Tab */}
          <TabsContent value="timeline" className="mt-0">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-blue-700">
                <strong>Timeline shows:</strong> X-ray scan analyses and diagnostic imaging only
              </p>
            </div>
            <MedicalTimeline
              entries={timeline}
              scanReviewMap={scanReviewMap}
              referralMap={referralMap}
              onEntryClick={handleEntryClick}
              isLoading={isLoadingTimeline}
              emptyMessage="No scan analyses available yet."
            />
          </TabsContent>

          {/* Reports Tab */}
          <TabsContent value="reports" className="mt-0">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4">
              <p className="text-sm text-green-700">
                <strong>Reports shows:</strong> AI screening reports and skin scan analyses only
              </p>
            </div>
            {/* Search */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Search reports..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-11 bg-gray-50 border-gray-200 rounded-xl h-12"
                />
              </div>
            </div>



            {/* Reports List */}
            <div className="space-y-3">
              {isLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-12 w-12 mx-auto text-gray-300 mb-4 animate-spin" />
                  <h3 className="font-medium text-gray-900">Loading reports...</h3>
                </div>
              ) : (
                <>
                  {/* Medical Reports Section */}
                  {filteredReports.length > 0 && (
                    <div className="space-y-3">
                      {filteredReports.map((report) => (
                        <div key={report.id}>
                          <ReportCard report={report} onView={setSelectedReport} />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Empty state */}
                  {filteredReports.length === 0 && (
                    <div className="text-center py-12">
                      <FileText className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                      <h3 className="font-medium text-gray-900">No screening reports generated yet.</h3>
                      <p className="text-sm text-gray-500 mt-1">
                        Complete an AI screening chat to generate a report.
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          </TabsContent>

          {/* Doctor Remarks Tab */}
          <TabsContent value="remarks" className="mt-0">
            {isLoadingRemarks ? (
              <div className="text-center py-12">
                <Loader2 className="h-12 w-12 mx-auto text-gray-300 mb-4 animate-spin" />
                <h3 className="font-medium text-gray-900">Loading doctor notes...</h3>
              </div>
            ) : remarks.length > 0 ? (
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Stethoscope className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div>
                      <h3 className="font-semibold text-blue-900 mb-1">About Doctor Notes</h3>
                      <p className="text-sm text-blue-700">
                        These are observations, warnings, and important notes added by doctors during your consultations. 
                        Pay special attention to warnings and allergy notes.
                      </p>
                    </div>
                  </div>
                </div>
                {remarks.map((remark) => (
                  <div
                    key={remark.remark_id}
                    className={cn(
                      "border rounded-lg p-5 transition-all",
                      remark.category === "warning"
                        ? "border-red-200 bg-red-50"
                        : remark.category === "allergy"
                        ? "border-orange-200 bg-orange-50"
                        : "border-gray-200 bg-white hover:border-purple-300"
                    )}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        {remark.category === "warning" && <AlertTriangle className="h-5 w-5 text-red-600" />}
                        {remark.category === "allergy" && <ShieldAlert className="h-5 w-5 text-orange-600" />}
                        {remark.category === "observation" && <ClipboardList className="h-5 w-5 text-blue-600" />}
                        {(!remark.category || remark.category === "general") && <MessageSquare className="h-5 w-5 text-gray-600" />}
                        <span
                          className={cn(
                            "text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wide",
                            remark.category === "warning"
                              ? "bg-red-100 text-red-700"
                              : remark.category === "allergy"
                              ? "bg-orange-100 text-orange-700"
                              : remark.category === "observation"
                              ? "bg-blue-100 text-blue-700"
                              : "bg-gray-100 text-gray-700"
                          )}
                        >
                          {remark.category || "general"}
                        </span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {new Date(remark.created_at).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                    <p className="text-gray-900 text-base leading-relaxed mb-3">
                      {remark.remark}
                    </p>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Stethoscope className="h-4 w-4" />
                      <span className="font-medium">Dr. {remark.doctor_name.replace(/^(Dr\.?\s*)/i, '')}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <MessageSquare className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                <h3 className="font-medium text-gray-900">No doctor notes yet</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Doctors will add important observations and notes during your consultations
                </p>
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Timeline Entry Detail Modal */}
        <TimelineEntryDetail
          entry={selectedEntry}
          open={showEntryDetail}
          onOpenChange={setShowEntryDetail}
        />
      </main>
    </div>
  );
}

