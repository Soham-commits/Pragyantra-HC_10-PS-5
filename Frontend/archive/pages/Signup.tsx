import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { cn } from "@/utils";
import { useTranslation } from "react-i18next";

interface SignupFormData {
  fullName: string;
  aadhaar: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  dateOfBirth: string;
  gender: string;
  height: string;
  weight: string;
  bloodGroup: string;
  consentAIProcessing: boolean;
  consentDataStorage: boolean;
  consentReferralNotifications: boolean;
}

export default function Signup() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState<SignupFormData>({
    fullName: "",
    aadhaar: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    dateOfBirth: "",
    gender: "",
    height: "",
    weight: "",
    bloodGroup: "",
    consentAIProcessing: false,
    consentDataStorage: false,
    consentReferralNotifications: false,
  });

  const updateField = (field: keyof SignupFormData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleNextStep = () => {
    if (step === 1) {
      // Validate step 1
      if (!formData.fullName || !formData.email) {
        setError(t('signup.fill_all_fields'));
        return;
      }
    }

    setError("");
    setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (formData.password.length < 8) {
      setError(t('login.error_password_length'));
      return;
    }
    if (!formData.aadhaar || formData.aadhaar.length !== 12) {
      setError(t('login.error_aadhaar'));
      return;
    }
    if (!formData.password || formData.password !== formData.confirmPassword) {
      setError(t('login.error_passwords'));
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          full_name: formData.fullName,
          phone: formData.phone,
          aadhaar_number: formData.aadhaar,
          role: "user",  // "user" for patient, "doctor" for doctor
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Save token and user info
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("role", data.role);
        localStorage.setItem("health_id", data.health_id);
        localStorage.setItem("onboarded", "false");  // Not yet onboarded

        // Record consent records (wrapped in try/catch - don't block if fails)
        try {
          const consentPayload = {
            patient_id: data.health_id,
            consents: [
              {
                consent_type: "registration",
                consented: true,
                consent_version: "1.0"
              },
              {
                consent_type: "scan_upload",
                consented: true,
                consent_version: "1.0"
              },
              {
                consent_type: "referral_notification",
                consented: true,
                consent_version: "1.0"
              }
            ]
          };
          console.log("[Consent Debug] Bulk payload after signup:", consentPayload);

          const consentResponse = await fetch("/api/consent/record/bulk", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${data.access_token}`
            },
            body: JSON.stringify(consentPayload)
          });
          if (!consentResponse.ok) {
            const errorText = await consentResponse.text();
            console.warn("Failed to record consents, but registration succeeded", {
              status: consentResponse.status,
              body: errorText
            });
          } else {
            const result = await consentResponse.json();
            console.log("[Consent Debug] Bulk record response:", result);
          }
        } catch (consentErr) {
          console.warn("Consent recording failed (non-blocking):", consentErr);
        }

        // Redirect to onboarding to complete profile
        navigate("/onboarding");
      } else {
        setError(data.detail || t('signup.error_registration'));
      }
    } catch (err) {
      setError(t('login.error_network'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white relative flex flex-col justify-center">
      <div className="absolute left-5 top-5">
        <Button
          variant="ghost"
          onClick={() => step === 1 ? navigate("/welcome") : setStep(step - 1)}
          className="-ml-2 h-10"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          {t('common.back')}
        </Button>
      </div>

      {/* Content */}
      <div className="max-w-md mx-auto px-5 py-4">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{t('signup.create_account')}</h1>
          <p className="text-gray-600">
            {step === 1 && t('signup.basic_info')}
            {step === 2 && t('signup.security_verify')}
          </p>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center gap-2 mb-8">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={cn(
                "h-2 rounded-full transition-all",
                s === step ? "w-8 bg-gray-900" : "w-2 bg-gray-300"
              )}
            />
          ))}
        </div>

        {error && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
            {error}
          </div>
        )}

        {/* Step 1: Basic Info */}
        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); handleNextStep(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('signup.full_name')}
              </label>
              <Input
                type="text"
                placeholder={t('signup.enter_full_name')}
                value={formData.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
                required
                className="h-12"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('signup.email_address')}
              </label>
              <Input
                type="email"
                placeholder="your.email@example.com"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
                className="h-12"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 rounded-2xl bg-gray-900 hover:bg-gray-800 text-white font-bold transition-all active:scale-95"
            >
              {t('signup.continue')}
            </Button>
          </form>
        )}

        {/* Step 2: Security & Verification */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('signup.aadhaar_number')}
              </label>
              <Input
                type="text"
                placeholder={t('signup.enter_aadhaar')}
                value={formData.aadhaar}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 12);
                  updateField("aadhaar", value);
                }}
                maxLength={12}
                required
                className="h-12"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('signup.aadhaar_hint')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('signup.password')}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t('signup.create_strong_password')}
                  value={formData.password}
                  onChange={(e) => updateField("password", e.target.value)}
                  required
                  className="h-12 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('signup.confirm_password')}
              </label>
              <Input
                type="password"
                placeholder={t('signup.re_enter_password')}
                value={formData.confirmPassword}
                onChange={(e) => updateField("confirmPassword", e.target.value)}
                required
                className="h-12"
              />
            </div>

            {/* Consent Checkboxes */}
            <div className="space-y-3 pt-2">
              <label className="block text-sm font-medium text-gray-700">
                {t('signup.required_consents')}
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.consentAIProcessing}
                  onChange={(e) => setFormData({ ...formData, consentAIProcessing: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm text-gray-600">
                  {t('signup.consent_ai')}
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.consentDataStorage}
                  onChange={(e) => setFormData({ ...formData, consentDataStorage: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm text-gray-600">
                  {t('signup.consent_data')}
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.consentReferralNotifications}
                  onChange={(e) => setFormData({ ...formData, consentReferralNotifications: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm text-gray-600">
                  {t('signup.consent_referral')}
                </span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading || !formData.consentAIProcessing || !formData.consentDataStorage || !formData.consentReferralNotifications}
              className="w-full h-12 rounded-2xl bg-gray-900 hover:bg-gray-800 text-white font-bold transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('signup.creating_account') : t('signup.create_account_btn')}
            </Button>
          </form>
        )}

        {/* Login Link */}
        {step === 1 && (
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              {t('signup.already_have_account')}{" "}
              <Link
                to="/login"
                className="font-semibold text-gray-900 hover:text-gray-700"
              >
                {t('signup.sign_in')}
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

