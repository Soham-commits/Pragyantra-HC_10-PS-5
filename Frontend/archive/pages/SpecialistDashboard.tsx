import { useEffect, useState } from "react";
import { SpecialistLayout } from "@/features/specialist/components/SpecialistLayout";
import { Inbox, Clock, CheckCircle, XCircle, Stethoscope } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/utils";
import { fetchWithAuth } from "@/services/api";

interface SpecialistProfile {
  specialist_id: string;
  name: string;
  specialty: string;
  hospital_name?: string;
  email?: string;
  phone?: string;
}

export default function SpecialistDashboard() {
  const [profile, setProfile] = useState<SpecialistProfile | null>(null);
  const [referralStats, setReferralStats] = useState({
    total: 0,
    pending: 0,
    active: 0,
    completed: 0,
    declined: 0,
  });
  const [loading, setLoading] = useState(true);
  const [specialistName, setSpecialistName] = useState<string>(() => {
    const storedName = localStorage.getItem('specialist_name');
    if (!storedName || storedName === 'null' || storedName === 'undefined') return '';
    return storedName.replace(/^(Dr\.?\s*)/i, '');
  });

  const currentHour = new Date().getHours();
  const greeting =
    currentHour >= 0 && currentHour < 5 ? "Good Night" :
    currentHour >= 5 && currentHour < 12 ? "Good Morning" :
    currentHour >= 12 && currentHour < 18 ? "Good Afternoon" :
    "Good Evening";

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        // Fetch referrals
        const referralsResponse = await fetchWithAuth("/api/referrals/specialist/inbox");
        if (referralsResponse.ok) {
          const referrals = await referralsResponse.json();
          
          // Calculate stats
          const stats = {
            total: referrals.length,
            pending: referrals.filter((r: any) => r.status === 'pending').length,
            active: referrals.filter((r: any) => r.status === 'active').length,
            completed: referrals.filter((r: any) => r.status === 'completed').length,
            declined: referrals.filter((r: any) => r.status === 'declined').length,
          };
          setReferralStats(stats);
        }

        // Try to get specialist profile (if endpoint exists)
        try {
          const profileResponse = await fetchWithAuth("/api/auth/profile");
          if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            if (profileData.full_name) {
              const cleanName = profileData.full_name.replace(/^(Dr\.?\s*)/i, '');
              setSpecialistName(cleanName);
              localStorage.setItem('specialist_name', cleanName);
            }
          }
        } catch (err) {
          console.log("Could not fetch specialist profile");
        }
      } catch (err) {
        console.error("Failed to load dashboard:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  return (
    <SpecialistLayout title="Dashboard">
      <section className="mb-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-gray-900 md:text-5xl">
            {greeting}, {specialistName ? `Dr. ${specialistName.split(' ')[0]}` : 'Doctor'}
          </h1>
          <p className="text-gray-600 mt-2">Specialist Portal</p>
        </div>

        {/* Stats Overview */}
        <div className="mb-8">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Referral Overview</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <Link
              to="/specialist/inbox"
              className="bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 rounded-2xl p-6 hover:shadow-lg transition-all border border-gray-200/60 hover:border-blue-300 flex flex-col items-center text-center relative"
            >
              <div className="mb-3 inline-flex p-3 rounded-2xl bg-blue-50">
                <Inbox className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{referralStats.total}</span>
              <span className="text-xs font-semibold text-gray-600 mt-1">Total Referrals</span>
            </Link>

            <Link
              to="/specialist/inbox?filter=pending"
              className="bg-gradient-to-br from-amber-50/50 via-white to-amber-50/30 rounded-2xl p-6 hover:shadow-lg transition-all border border-gray-200/60 hover:border-amber-300 flex flex-col items-center text-center relative"
            >
              <div className="mb-3 inline-flex p-3 rounded-2xl bg-amber-50">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{referralStats.pending}</span>
              <span className="text-xs font-semibold text-gray-600 mt-1">Pending</span>
              {referralStats.pending > 0 && (
                <span className="absolute top-2 right-2 px-2 py-0.5 text-xs font-bold bg-amber-600 text-white rounded-full shadow-sm">
                  {referralStats.pending}
                </span>
              )}
            </Link>

            <Link
              to="/specialist/inbox?filter=active"
              className="bg-gradient-to-br from-emerald-50/50 via-white to-emerald-50/30 rounded-2xl p-6 hover:shadow-lg transition-all border border-gray-200/60 hover:border-emerald-300 flex flex-col items-center text-center"
            >
              <div className="mb-3 inline-flex p-3 rounded-2xl bg-emerald-50">
                <CheckCircle className="h-6 w-6 text-emerald-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{referralStats.active}</span>
              <span className="text-xs font-semibold text-gray-600 mt-1">Active</span>
            </Link>

            <Link
              to="/specialist/inbox?filter=completed"
              className="bg-gradient-to-br from-blue-50/50 via-white to-blue-50/30 rounded-2xl p-6 hover:shadow-lg transition-all border border-gray-200/60 hover:border-blue-300 flex flex-col items-center text-center"
            >
              <div className="mb-3 inline-flex p-3 rounded-2xl bg-blue-50">
                <Stethoscope className="h-6 w-6 text-blue-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{referralStats.completed}</span>
              <span className="text-xs font-semibold text-gray-600 mt-1">Completed</span>
            </Link>

            <Link
              to="/specialist/inbox?filter=declined"
              className="bg-gradient-to-br from-red-50/50 via-white to-red-50/30 rounded-2xl p-6 hover:shadow-lg transition-all border border-gray-200/60 hover:border-red-300 flex flex-col items-center text-center"
            >
              <div className="mb-3 inline-flex p-3 rounded-2xl bg-red-50">
                <XCircle className="h-6 w-6 text-red-600" />
              </div>
              <span className="text-2xl font-bold text-gray-900">{referralStats.declined}</span>
              <span className="text-xs font-semibold text-gray-600 mt-1">Declined</span>
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl p-6 border border-indigo-100">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/specialist/inbox?filter=pending"
              className="px-4 py-2 bg-white rounded-xl border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all text-sm font-medium text-gray-700"
            >
              Review Pending Referrals
            </Link>
            <Link
              to="/specialist/inbox?filter=active"
              className="px-4 py-2 bg-white rounded-xl border border-gray-200 hover:border-emerald-300 hover:shadow-md transition-all text-sm font-medium text-gray-700"
            >
              View Active Cases
            </Link>
            <Link
              to="/specialist/inbox"
              className="px-4 py-2 bg-white rounded-xl border border-gray-200 hover:border-blue-300 hover:shadow-md transition-all text-sm font-medium text-gray-700"
            >
              View All Referrals
            </Link>
          </div>
        </div>
      </section>
    </SpecialistLayout>
  );
}

