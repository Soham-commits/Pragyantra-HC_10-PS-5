import { FloatingNav } from "@/layouts/FloatingNav";
import { ChevronRight, MessageSquare, Clock, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { useState } from "react";
import { fetchWithAuth } from "@/services/api";
import { useTranslation } from "react-i18next";

type GrievanceType = "unauthorized_access" | "incorrect_record" | "consent_violation" | "data_breach" | "other";

export default function Grievance() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedType, setSelectedType] = useState<GrievanceType | null>(null);
  const [description, setDescription] = useState("");
  const [referenceId, setReferenceId] = useState("");

  const grievanceTypes: { id: GrievanceType; label: string; description: string }[] = [
    { id: "unauthorized_access", label: t('grievance.unauthorized_access'), description: t('grievance.unauthorized_desc') },
    { id: "incorrect_record", label: t('grievance.incorrect_record'), description: t('grievance.incorrect_desc') },
    { id: "consent_violation", label: t('grievance.consent_violation'), description: t('grievance.consent_desc') },
    { id: "data_breach", label: t('grievance.data_breach'), description: t('grievance.data_breach_desc') },
  ];

  const handleSubmit = async () => {
    if (!selectedType) {
      setError(t('grievance.error_select_type'));
      return;
    }
    if (description.length < 10) {
      setError(t('grievance.error_min_chars'));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetchWithAuth("/api/privacy/grievance", {
        method: "POST",
        body: JSON.stringify({
          grievance_type: selectedType,
          description: description,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to submit grievance");
      }

      const data = await response.json();
      setReferenceId(data.reference_id);
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit grievance");
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setSubmitted(false);
    setSelectedType(null);
    setDescription("");
    setError("");
    setReferenceId("");
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <FloatingNav />

      <main className="max-w-md md:max-w-3xl mx-auto px-5 py-6">
        {/* Back Button */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-gray-600 mb-6"
        >
          <ChevronRight className="h-5 w-5 rotate-180" />
          <span>{t('common.back')}</span>
        </button>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex p-3 rounded-full bg-amber-50 mb-4">
            <MessageSquare className="h-8 w-8 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('grievance.title')}</h1>
          <p className="text-gray-500 mt-2">{t('grievance.subtitle')}</p>
        </div>

        {!submitted ? (
          <>
            {/* Grievance Types */}
            <div className="space-y-3 mb-6">
              {grievanceTypes.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type.id)}
                  className={`w-full rounded-2xl p-4 border text-left transition-colors ${
                    selectedType === type.id
                      ? "bg-amber-50 border-amber-200"
                      : "bg-gray-50 border-gray-100 hover:bg-gray-100"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <AlertCircle className={`h-5 w-5 mt-0.5 ${selectedType === type.id ? "text-amber-600" : "text-amber-600"}`} />
                    <div>
                      <h3 className="font-semibold text-gray-900">{type.label}</h3>
                      <p className="text-sm text-gray-600 mt-1">{type.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>

            {/* Grievance Form */}
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <h3 className="font-semibold text-gray-900 mb-4">{t('grievance.submit_title')}</h3>
              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-xl text-sm">
                  {error}
                </div>
              )}
              <textarea
                placeholder={t('grievance.describe_concern')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full h-32 p-3 rounded-xl border border-gray-200 bg-white resize-none focus:outline-none focus:ring-2 focus:ring-gray-200"
              />
              <p className="text-xs text-gray-500 mt-2">{t('grievance.min_chars')}</p>
              <Button
                className="w-full mt-4"
                onClick={handleSubmit}
                disabled={loading || !selectedType || description.length < 10}
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {t('grievance.submitting')}
                  </>
                ) : (
                  t('grievance.submit_btn')
                )}
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center py-12">
            <div className="inline-flex p-4 rounded-full bg-green-50 mb-4">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="font-semibold text-gray-900 text-lg">{t('grievance.submitted')}</h3>
            <p className="text-gray-500 mt-2">
              {t('grievance.submitted_desc')}
            </p>
            <div className="mt-6 p-4 bg-blue-50 rounded-xl">
              <div className="flex items-center gap-2 text-blue-800">
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">{t('grievance.reference_id')} {referenceId}</span>
              </div>
            </div>
            <Button
              variant="outline"
              className="mt-6"
              onClick={handleReset}
            >
              {t('grievance.submit_another')}
            </Button>
          </div>
        )}

        {/* SLAs */}
        <div className="mt-8 p-4 bg-gray-50 rounded-2xl border border-gray-100">
          <h4 className="font-semibold text-gray-900 mb-3">{t('grievance.commitment')}</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{t('grievance.hours_24')}</p>
              <p className="text-gray-500">{t('grievance.acknowledgment')}</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{t('grievance.days_7')}</p>
              <p className="text-gray-500">{t('grievance.resolution')}</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

