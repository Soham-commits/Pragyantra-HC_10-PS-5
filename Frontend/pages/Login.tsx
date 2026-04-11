import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Eye, EyeOff, Heart } from "lucide-react";
import { cn } from "@/utils";
import { useTranslation } from "react-i18next";

export default function Login() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState({
    aadhaar: "",
    password: "",
  });
  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    aadhaar: "",
    abhaId: "",
    password: "",
    confirmPassword: "",
    consentAIProcessing: false,
    consentDataStorage: false,
    consentReferralNotifications: false,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const clearAuthStorage = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("health_id");
    localStorage.removeItem("doctor_id");
  };

  const handleBack = () => {
    navigate("/welcome");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          aadhaar_number: loginData.aadhaar,
          password: loginData.password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.role !== "patient") {
          clearAuthStorage();
          setError("This account is registered as a doctor. Please use Doctor Sign In.");
          return;
        }
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("role", data.role);
        if (data.health_id) {
          localStorage.setItem("health_id", data.health_id);
        }
        if (data.doctor_id) {
          localStorage.setItem("doctor_id", data.doctor_id);
        }
        localStorage.setItem("onboarded", data.onboarded ? "true" : "false");

        if (data.onboarded) {
          navigate("/");
        } else {
          navigate("/onboarding");
        }
      } else {
        setError(data.detail || "Login failed. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (signupData.password !== signupData.confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (signupData.password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (signupData.aadhaar.length !== 12) {
      setError("Please enter a valid 12-digit Aadhaar number");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: signupData.email,
          password: signupData.password,
          full_name: signupData.fullName,
          aadhaar_number: signupData.aadhaar,
          role: "user",
        }),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.role && data.role !== "patient") {
          clearAuthStorage();
          setError("This account is registered as a doctor. Please use Doctor Sign In.");
          return;
        }
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("role", data.role);
        localStorage.setItem("health_id", data.health_id);
        localStorage.setItem("onboarded", "false");

        // Record consent records (wrapped in try/catch - don't block if fails)
        try {
          const consentPayload = {
            patient_id: data.health_id,
            consents: [
              { consent_type: "registration", consented: true, consent_version: "1.0" },
              { consent_type: "scan_upload", consented: true, consent_version: "1.0" },
              { consent_type: "referral_notification", consented: true, consent_version: "1.0" }
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

        navigate("/onboarding");
      } else {
        setError(data.detail || "Registration failed. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col justify-center relative">
      <div className="absolute left-5 top-5">
        <Button variant="ghost" onClick={handleBack} className="-ml-2 h-10">
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </Button>
      </div>
      {/* Health Illustration */}
      <div className="flex justify-center pt-6 pb-6">
        <div className="relative">
          <div className="w-32 h-32 bg-gradient-to-br from-blue-100 to-purple-100 rounded-full flex items-center justify-center">
            <Heart className="w-16 h-16 text-[#E91E63] fill-[#E91E63]" />
          </div>
          <div className="absolute -top-2 -right-2 w-8 h-8 bg-green-400 rounded-full flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 max-w-md mx-auto px-6 w-full">
        {/* Title */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('login.welcome_back')}
          </h1>
          <p className="text-sm text-gray-500">
            {t('login.enter_details')}
          </p>
        </div>

        {/* Toggle Pills */}
        <div className="bg-gray-100 rounded-full p-1 mb-6 flex">
          <button
            onClick={() => {
              setMode("login");
              setError("");
            }}
            className={cn(
              "flex-1 py-3 rounded-full font-semibold text-sm transition-all",
              mode === "login"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            )}
          >
            {t('login.login')}
          </button>
          <button
            onClick={() => {
              setMode("signup");
              setError("");
            }}
            className={cn(
              "flex-1 py-3 rounded-full font-semibold text-sm transition-all",
              mode === "signup"
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500"
            )}
          >
            {t('login.sign_up')}
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 rounded-xl text-red-600 text-sm text-center">
            {error}
          </div>
        )}

        {/* Login Form */}
        {mode === "login" && (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('login.aadhaar_number')}
              </label>
              <Input
                type="text"
                placeholder={t('login.enter_aadhaar')}
                value={loginData.aadhaar}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 12);
                  setLoginData({ ...loginData, aadhaar: value });
                }}
                maxLength={12}
                required
                className="h-14 rounded-xl bg-gray-50 border-gray-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('login.password')}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t('login.enter_password')}
                  value={loginData.password}
                  onChange={(e) =>
                    setLoginData({ ...loginData, password: e.target.value })
                  }
                  required
                  className="h-14 rounded-xl bg-gray-50 border-gray-200 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div className="text-right">
              <button
                type="button"
                className="text-sm font-semibold text-gray-900"
              >
                {t('login.forgot_password')}
              </button>
            </div>

            <Button
              type="submit"
              disabled={loading || loginData.aadhaar.length !== 12}
              className="w-full h-14 rounded-full bg-gray-900 hover:bg-gray-800 text-white font-bold text-base"
            >
              {loading ? t('login.logging_in') : t('login.login')}
            </Button>
          </form>
        )}

        {/* Signup Form */}
        {mode === "signup" && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('login.full_name')}
              </label>
              <Input
                type="text"
                placeholder={t('signup.enter_full_name')}
                value={signupData.fullName}
                onChange={(e) =>
                  setSignupData({ ...signupData, fullName: e.target.value })
                }
                required
                className="h-14 rounded-xl bg-gray-50 border-gray-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('login.email_address')}
              </label>
              <Input
                type="email"
                placeholder="your.email@example.com"
                value={signupData.email}
                onChange={(e) =>
                  setSignupData({ ...signupData, email: e.target.value })
                }
                required
                className="h-14 rounded-xl bg-gray-50 border-gray-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('login.aadhaar_number')}
              </label>
              <Input
                type="text"
                placeholder={t('login.enter_aadhaar')}
                value={signupData.aadhaar}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 12);
                  setSignupData({ ...signupData, aadhaar: value });
                }}
                maxLength={12}
                required
                className="h-14 rounded-xl bg-gray-50 border-gray-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('login.abha_id')}
              </label>
              <Input
                type="text"
                placeholder={t('login.enter_abha')}
                value={signupData.abhaId || ""}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 14);
                  setSignupData({ ...signupData, abhaId: value });
                }}
                maxLength={14}
                className="h-14 rounded-xl bg-gray-50 border-gray-200"
              />
              <p className="text-xs text-gray-500 mt-1">
                {t('login.abha_desc')}
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('login.password')}
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={t('login.create_password')}
                  value={signupData.password}
                  onChange={(e) =>
                    setSignupData({ ...signupData, password: e.target.value })
                  }
                  required
                  className="h-14 rounded-xl bg-gray-50 border-gray-200 pr-12"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('login.confirm_password')}
              </label>
              <Input
                type="password"
                placeholder={t('login.re_enter_password')}
                value={signupData.confirmPassword}
                onChange={(e) =>
                  setSignupData({ ...signupData, confirmPassword: e.target.value })
                }
                required
                className="h-14 rounded-xl bg-gray-50 border-gray-200"
              />
            </div>

            {/* Consent Checkboxes */}
            <div className="space-y-3 pt-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signupData.consentAIProcessing}
                  onChange={(e) => setSignupData({ ...signupData, consentAIProcessing: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm text-gray-600">
                  {t('login.consent_ai')}
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signupData.consentDataStorage}
                  onChange={(e) => setSignupData({ ...signupData, consentDataStorage: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm text-gray-600">
                  {t('login.consent_data')}
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={signupData.consentReferralNotifications}
                  onChange={(e) => setSignupData({ ...signupData, consentReferralNotifications: e.target.checked })}
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                />
                <span className="text-sm text-gray-600">
                  {t('login.consent_referral')}
                </span>
              </label>
            </div>

            <Button
              type="submit"
              disabled={loading || signupData.aadhaar.length !== 12 || !signupData.consentAIProcessing || !signupData.consentDataStorage || !signupData.consentReferralNotifications}
              className="w-full h-14 rounded-full bg-gray-900 hover:bg-gray-800 text-white font-bold text-base mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? t('login.creating_account') : t('login.sign_up_btn')}
            </Button>
          </form>
        )}

        {/* Doctor Registration Link */}
        <div className="mt-8 mb-6 bg-gradient-to-br from-blue-50 to-purple-50 rounded-2xl p-4 border border-gray-200">
          <p className="text-sm text-gray-700 text-center font-medium">
            {t('login.are_doctor')}{" "}
            <button
              onClick={() => navigate("/doctor/login")}
              className="font-bold text-gray-900 hover:text-gray-700 underline"
            >
              {t('login.sign_in_here')}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

