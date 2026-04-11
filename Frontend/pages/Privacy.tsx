import { FloatingNav } from "@/layouts/FloatingNav";
import { ChevronRight, Shield, Database, Mail } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Privacy() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-white pb-24">
      <FloatingNav />

      <main className="max-w-md md:max-w-3xl mx-auto px-5 py-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 mb-6"
        >
          <ChevronRight className="h-5 w-5 rotate-180" />
          <span>Back</span>
        </button>

        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-full bg-purple-50 mb-4">
            <Shield className="h-8 w-8 text-purple-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Privacy Policy</h1>
          <p className="text-gray-500 mt-2">How MediQ collects, uses, and protects your health data</p>
        </div>

        <div className="space-y-4">
          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <div className="flex items-start gap-3">
              <Database className="h-5 w-5 text-gray-700 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">What data we collect</h3>
                <ul className="text-sm text-gray-600 mt-2 list-disc pl-5 space-y-1">
                  <li>Medical scan images and AI analysis results</li>
                  <li>Health reports and consultation summaries</li>
                  <li>Specialist referral records</li>
                  <li>Basic profile information</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <h3 className="font-semibold text-gray-900">Your rights under DPDP Act 2023</h3>
            <ul className="text-sm text-gray-600 mt-2 list-disc pl-5 space-y-1">
              <li>Right to access your data</li>
              <li>Right to erasure (delete account)</li>
              <li>Right to data export</li>
              <li>Right to withdraw consent</li>
            </ul>
            <p className="text-sm text-gray-600 mt-3">
              You can manage export and account deletion from your Profile Settings under Privacy &amp; Security.
            </p>
          </div>

          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <div className="flex items-start gap-3">
              <Mail className="h-5 w-5 text-gray-700 mt-1" />
              <div>
                <h3 className="font-semibold text-gray-900">Contact</h3>
                <p className="text-sm text-gray-600 mt-1">For consent withdrawal or data concerns:</p>
                <p className="text-sm text-gray-800 mt-2">privacy@mediq.health</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

