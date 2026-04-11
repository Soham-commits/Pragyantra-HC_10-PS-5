import { FloatingNav } from "@/layouts/FloatingNav";
import { Button } from "@/components/ui/button";
import { Shield, Lock, Eye, FileText, ChevronRight, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function Trust() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  const achievedIcon = <CheckCircle className="h-4 w-4 text-emerald-600 mt-0.5" />;

  const renderItems = (items: string[]) => (
    <div className="space-y-2 mt-2">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-2">
          {achievedIcon}
          <p className="text-sm text-gray-700">{item}</p>
        </div>
      ))}
    </div>
  );

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
          <div className="inline-flex p-3 rounded-full bg-blue-50 mb-4">
            <Shield className="h-8 w-8 text-blue-600" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('trust.title')}</h1>
          <p className="text-gray-500 mt-2">{t('trust.subtitle')}</p>
        </div>

        {/* Trust Sections */}
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-white">
                <Lock className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t('trust.encryption')}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {t('trust.encryption_desc')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-white">
                <Eye className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t('trust.access_control')}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {t('trust.access_control_desc')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-white">
                <FileText className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t('trust.audit_logs')}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {t('trust.audit_logs_desc')}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
            <div className="flex items-start gap-4">
              <div className="p-2 rounded-lg bg-white">
                <Lock className="h-5 w-5 text-gray-700" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{t('trust.session_security')}</h3>
                <p className="text-sm text-gray-600 mt-1">
                  {t('trust.session_security_desc')}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <h3 className="font-semibold text-gray-900">Data Protection</h3>
              {renderItems([
                "DPDP Act 2023 â€” Explicit layered consent",
                "DPDP Act 2023 â€” Right to erasure",
                "DPDP Act 2023 â€” Right to data export",
                "Purpose-specific consent for each data use",
                "Timestamped consent audit trail",
              ])}
            </div>

            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <h3 className="font-semibold text-gray-900">Clinical Standards</h3>
              {renderItems([
                "Telemedicine Practice Guidelines 2020",
                "MCI/NMC verified specialists",
                "Patient notification on every referral",
                "Complete audit trail on all clinical actions",
                "AI disclaimer on all reports and scan results",
              ])}
            </div>

            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <h3 className="font-semibold text-gray-900">AI Transparency</h3>
              {renderItems([
                "Grad-CAM explainability on all scans",
                "Confidence scores on all results",
                "Screening tool â€” not a diagnostic instrument",
              ])}
            </div>

            <div className="bg-gray-50 rounded-2xl p-5 border border-gray-100">
              <h3 className="font-semibold text-gray-900">ABDM</h3>
              {renderItems([
                "ABHA ID compatible",
              ])}
            </div>
          </div>
        </div>

        {/* Compliance Badges */}
        <div className="mt-8 p-4 bg-blue-50 rounded-2xl border border-blue-100">
          <p className="text-sm text-blue-800 font-medium text-center">
            Built in alignment with India's Digital Personal Data Protection Act 2023 and Telemedicine Practice Guidelines 2020
          </p>
        </div>
      </main>
    </div>
  );
}

