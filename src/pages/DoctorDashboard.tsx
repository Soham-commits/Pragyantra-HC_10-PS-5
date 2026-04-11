import { useEffect, useState } from "react";
import { DoctorLayout } from "@/features/doctor/components/DoctorLayout";
import { Clock, Search, Flag, Activity, Trash2, CheckCircle, CalendarCheck, Inbox } from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { fetchWithAuth } from "@/services/api";
import { Button } from "@/components/ui/button";
import { Avatar as UserAvatar } from "@/components/Avatar";

interface PatientSummary {
  health_id: string;
  full_name: string;
  age: number;
  gender: string;
  blood_group: string;
  last_visit_date?: string | null;
  total_scans: number;
}

interface DoctorSummaryCounts {
  total_screenings: number;
  abnormal_cases: number;
  pending_reviews: number;
  reviewed_cases: number;
  followup_cases: number;
}

interface DoctorProfile {
  full_name?: string;
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

export default function DoctorDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [summary, setSummary] = useState<DoctorSummaryCounts>({
    total_screenings: 0,
    abnormal_cases: 0,
    pending_reviews: 0,
    reviewed_cases: 0,
    followup_cases: 0,
  });
  const [doctorProfile, setDoctorProfile] = useState<DoctorProfile | null>(null);
  const [doctorName, setDoctorName] = useState<string>(() => {
    const storedName = localStorage.getItem('doctor_name');
    if (!storedName || storedName === 'null' || storedName === 'undefined') return '';
    // Remove "Dr." or "Dr " prefix if it exists
    return storedName.replace(/^(Dr\.?\s*)/i, '');
  });
  const [patientResults, setPatientResults] = useState<PatientSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState("");
  const [deletingPatientId, setDeletingPatientId] = useState<string | null>(null);
  const currentHour = new Date().getHours();
  const greeting =
    currentHour >= 0 && currentHour < 5 ? "Good Night" :
      currentHour >= 5 && currentHour < 12 ? "Good Morning" :
        currentHour >= 12 && currentHour < 18 ? "Good Afternoon" :
          "Good Evening";
  const searchQuery = (searchParams.get("q") || "").trim();

  const handleDeletePatient = async (healthId: string, patientName: string) => {
    if (!confirm(`Are you sure you want to delete ${patientName} (${healthId}) and all associated data? This action cannot be undone.`)) {
      return;
    }

    setDeletingPatientId(healthId);
    try {
      const response = await fetchWithAuth(`/api/doctor/patients/${healthId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete patient');
      }

      // Remove from local state
      setPatientResults(prev => prev.filter(p => p.health_id !== healthId));

      // Show success message
      alert(`Patient ${patientName} deleted successfully`);
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete patient. Please try again.');
    } finally {
      setDeletingPatientId(null);
    }
  };

  // Fetch patient summaries when searching, or recent patients when not searching
  useEffect(() => {
    const fetchPatients = async () => {
      setSearchLoading(true);
      try {
        const endpoint = searchQuery
          ? `/api/doctor/patients/search?query=${encodeURIComponent(searchQuery)}`
          : `/api/doctor/patients/recent?limit=10`;

        const response = await fetchWithAuth(endpoint);
        if (!response.ok) {
          throw new Error("Failed to fetch patients");
        }
        const data = await response.json();
        setPatientResults(data);
      } catch (err) {
        console.error("Fetch error:", err);
        setPatientResults([]);
      } finally {
        setSearchLoading(false);
      }
    };

    fetchPatients();
  }, [searchQuery]);

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      setError("");

      try {
        // First, verify the user's role
        const authResponse = await fetchWithAuth("/api/auth/profile");
        if (authResponse.ok) {
          const authData = await authResponse.json();

          if (authData.role !== "doctor") {
            console.error("âŒ User is not a doctor, role:", authData.role);
            setError("Access denied: Doctor role required");
            setLoading(false);
            return;
          }
        }

        const [statsResponse, patientsResponse, profileResponse] = await Promise.all([
          fetchWithAuth("/api/doctor/dashboard/stats"),
          fetchWithAuth("/api/doctor/patients/recent?limit=10"),
          fetchWithAuth("/api/doctor/profile"),
        ]);

        if (!statsResponse.ok) {
          throw new Error("Failed to load summary counts");
        }

        if (!patientsResponse.ok) {
          throw new Error("Failed to load recent patients");
        }

        const statsData = await statsResponse.json();
        const patientsData = await patientsResponse.json();
        const profileData = profileResponse.ok ? await profileResponse.json() : null;

        setSummary({
          total_screenings: statsData.total_screenings ?? 0,
          abnormal_cases: statsData.abnormal_cases ?? 0,
          pending_reviews: statsData.pending_reviews ?? 0,
          reviewed_cases: statsData.reviewed_cases ?? 0,
          followup_cases: statsData.followup_cases ?? 0,
        });
        setPatientResults(patientsData);
        setDoctorProfile(profileData);

        // Update doctor name if we got it from the profile and it's not already set
        if (profileData?.full_name) {
          const cleanName = profileData.full_name.replace(/^(Dr\.?\s*)/i, '');
          setDoctorName(cleanName);
          localStorage.setItem('doctor_name', cleanName);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard data");
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  return (
    <DoctorLayout title="Dashboard" showSearch={false}>
      <section className="mb-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 md:text-5xl">
            {greeting}, {doctorName ? `Dr. ${doctorName.split(' ')[0]}` : (doctorProfile?.full_name ? `Dr. ${doctorProfile.full_name.split(' ')[0]}` : 'Doctor')}
          </h1>
        </div>

        {/* Search Bar */}
        <div className="relative mb-6">
          <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            placeholder="Search screenings by patient name or Health ID..."
            value={searchQuery}
            onChange={(event) => {
              const nextValue = event.target.value;
              const nextParams = new URLSearchParams(searchParams);
              if (nextValue.trim().length > 0) {
                nextParams.set("q", nextValue);
              } else {
                nextParams.delete("q");
              }
              setSearchParams(nextParams);
            }}
            className="w-full h-14 rounded-2xl bg-gradient-to-r from-gray-50 to-white border border-gray-200 pl-14 pr-6 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all shadow-sm"
          />
        </div>

        {/* Screening Actions */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Screening Actions</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            <Link
              to="/doctor/reviews?filter=pending"
              className="bg-gradient-to-br from-purple-50/50 via-white to-purple-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-purple-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0 relative"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-purple-50">
                <Clock className="h-5 w-5 text-purple-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Pending Reviews</span>
              {summary.pending_reviews > 0 && (
                <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-bold bg-purple-600 text-white rounded-full shadow-sm">
                  {summary.pending_reviews}
                </span>
              )}
            </Link>

            <Link
              to="/doctor/reviews?filter=reviewed"
              className="bg-gradient-to-br from-green-50/50 via-white to-green-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-green-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0 relative"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-green-50">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Reviewed Cases</span>
              {summary.reviewed_cases > 0 && (
                <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-bold bg-green-600 text-white rounded-full shadow-sm">
                  {summary.reviewed_cases}
                </span>
              )}
            </Link>

            <Link
              to="/doctor/reviews?filter=followup"
              className="bg-gradient-to-br from-indigo-50/50 via-white to-indigo-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-indigo-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0 relative"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-indigo-50">
                <Flag className="h-5 w-5 text-indigo-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Follow-ups</span>
              {summary.followup_cases > 0 && (
                <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-bold bg-indigo-600 text-white rounded-full shadow-sm">
                  {summary.followup_cases}
                </span>
              )}
            </Link>

            <Link
              to="/doctor/reviews"
              className="bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-blue-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0 relative"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-blue-50">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">All Screenings</span>
              {summary.total_screenings > 0 && (
                <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-bold bg-blue-600 text-white rounded-full shadow-sm">
                  {summary.total_screenings}
                </span>
              )}
            </Link>

            <Link
              to="/doctor/appointments"
              className="bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-emerald-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0 relative"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-emerald-50">
                <CalendarCheck className="h-5 w-5 text-emerald-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Appointments</span>
            </Link>

            <Link
              to="/doctor/inbox"
              className="bg-gradient-to-br from-sky-50/50 via-white to-sky-50/30 rounded-2xl p-4 hover:shadow-lg transition-all border border-gray-200/60 hover:border-sky-300 flex flex-col items-center text-center min-w-[100px] flex-shrink-0 relative"
            >
              <div className="mb-2 inline-flex p-3 rounded-2xl bg-sky-50">
                <Inbox className="h-5 w-5 text-sky-600" />
              </div>
              <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">Referral Inbox</span>
            </Link>
          </div>
        </div>
      </section>
      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {searchQuery ? "Patient Search Results" : "Recent Patients"}
            </h2>
            <p className="text-sm text-gray-500">
              {searchQuery
                ? `Found ${patientResults.length} patient${patientResults.length !== 1 ? "s" : ""}`
                : "Recently active patients"}
            </p>
          </div>
          <Link
            to="/doctor/reviews"
            className="text-sm font-medium text-purple-600 hover:text-purple-700"
          >
            View all screenings
          </Link>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500 border-b border-gray-100">
              <tr>
                <th className="px-6 py-3 font-medium">Patient</th>
                <th className="px-6 py-3 font-medium">Age / Gender</th>
                <th className="px-6 py-3 font-medium">Blood Group</th>
                <th className="px-6 py-3 font-medium">Total Scans</th>
                <th className="px-6 py-3 font-medium">Last Visit</th>
                <th className="px-6 py-3 font-medium"></th>
              </tr>
            </thead>
            <tbody>
              {(loading || searchLoading) && (
                <tr>
                  <td className="px-6 py-6 text-gray-500" colSpan={7}>
                    {searchQuery ? "Searching patients..." : "Loading recent patients..."}
                  </td>
                </tr>
              )}
              {!loading && !searchLoading && error && (
                <tr>
                  <td className="px-6 py-6 text-rose-600" colSpan={7}>
                    {error}
                  </td>
                </tr>
              )}
              {!loading && !searchLoading && !error && patientResults.length === 0 && (
                <tr>
                  <td className="px-6 py-6 text-gray-500" colSpan={6}>
                    {searchQuery ? `No patients found matching "${searchQuery}"` : "No patients available yet"}
                  </td>
                </tr>
              )}
              {!loading && !searchLoading && !error && patientResults.map((patient) => (
                <tr key={patient.health_id} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <UserAvatar name={patient.full_name} role="patient" seed={patient.health_id} size="md" />
                      <div>
                        <div className="font-medium text-gray-900">{patient.full_name}</div>
                        <div className="text-xs text-gray-500">{patient.health_id}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {patient.age} yrs / {patient.gender}
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-red-50 text-red-700 rounded text-xs font-medium">
                      {patient.blood_group}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-gray-600">{patient.total_scans}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {patient.last_visit_date ? formatDate(patient.last_visit_date) : "N/A"}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <Link
                        to={`/doctor/patients/${patient.health_id}`}
                        className="text-sm font-medium text-purple-600 hover:text-purple-700"
                      >
                        View Profile â†’
                      </Link>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeletePatient(patient.health_id, patient.full_name)}
                        disabled={deletingPatientId === patient.health_id}
                        className="h-8 w-8 p-0 text-gray-400 hover:text-red-600 hover:bg-red-50"
                        title="Delete patient"
                      >
                        {deletingPatientId === patient.health_id ? (
                          <div className="h-4 w-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </DoctorLayout>
  );
}

