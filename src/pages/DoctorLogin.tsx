import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, ArrowLeft, Eye, EyeOff } from "lucide-react";
import { cn } from "@/utils";

interface DoctorSignupForm {
  fullName: string;
  aadhaar: string;
  email: string;
  phone: string;
  password: string;
  confirmPassword: string;
  medicalLicense: string;
  specialization: string;
  qualification: string;
  experienceYears: string;
  hospitalAffiliation: string;
  consultationFee: string;
}

export default function DoctorLogin() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [signupStep, setSignupStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loginData, setLoginData] = useState({
    aadhaar: "",
    password: "",
  });
  const [signupData, setSignupData] = useState<DoctorSignupForm>({
    fullName: "",
    aadhaar: "",
    email: "",
    phone: "",
    password: "",
    confirmPassword: "",
    medicalLicense: "",
    specialization: "",
    qualification: "",
    experienceYears: "",
    hospitalAffiliation: "",
    consultationFee: "",
  });

  const handleBack = () => {
    if (mode === "signup" && signupStep > 1) {
      setSignupStep(signupStep - 1);
      setError("");
    } else {
      navigate("/welcome");
    }
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

      if (!response.ok) {
        setError(data.detail || "Login failed. Please try again.");
        return;
      }

      if (data.role !== "doctor" && data.role !== "specialist") {
        setError("This account is not registered as a medical professional.");
        return;
      }

      localStorage.setItem("token", data.access_token);
      // Specialist role is merged into doctor role; treat legacy "specialist" as doctor.
      localStorage.setItem("role", "doctor");
      localStorage.setItem("doctor_id", data.doctor_id || "");
      localStorage.setItem("doctor_name", data.full_name || "");
      localStorage.setItem("onboarded", "true");
      localStorage.removeItem("health_id");
      localStorage.removeItem("specialist_id");

      navigate("/doctor/dashboard");
    } catch (err) {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  const updateSignupField = (field: keyof DoctorSignupForm, value: string) => {
    setSignupData({ ...signupData, [field]: value });
  };

  const handleNextStep = () => {
    setError("");

    if (signupStep === 1) {
      if (!signupData.fullName || !signupData.aadhaar || !signupData.email || !signupData.phone) {
        setError("Please fill in all fields");
        return;
      }
      if (signupData.aadhaar.length !== 12) {
        setError("Aadhaar must be 12 digits");
        return;
      }
    }

    if (signupStep === 2) {
      if (signupData.password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
      if (signupData.password !== signupData.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    setSignupStep(signupStep + 1);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!signupData.medicalLicense || !signupData.specialization || !signupData.qualification || !signupData.experienceYears) {
      setError("Please fill in all required fields");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const response = await fetch("/api/auth/register/doctor", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          full_name: signupData.fullName,
          aadhaar_number: signupData.aadhaar,
          email: signupData.email,
          password: signupData.password,
          phone: signupData.phone,
          medical_license: signupData.medicalLicense,
          specialization: signupData.specialization,
          qualification: signupData.qualification,
          experience_years: parseInt(signupData.experienceYears),
          hospital_affiliation: signupData.hospitalAffiliation || undefined,
          consultation_fee: signupData.consultationFee ? parseFloat(signupData.consultationFee) : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("role", data.role);
        localStorage.setItem("doctor_id", data.doctor_id);
        localStorage.setItem("doctor_name", data.full_name || signupData.fullName);
        localStorage.setItem("onboarded", "true");
        navigate("/doctor/dashboard");
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
          <div className="w-20 h-20 sm:w-28 sm:h-28 bg-gray-100 rounded-full flex items-center justify-center">
            <Activity className="w-10 h-10 sm:w-14 sm:h-14 text-gray-700" />
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
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {mode === "login" ? "Welcome back ðŸ‘‹" : (
              signupStep === 1 ? "Doctor Registration" :
                signupStep === 2 ? "Secure Your Account" :
                  "Professional Credentials"
            )}
          </h1>
          <p className="text-sm text-gray-500">
            {mode === "login"
              ? "Enter your details to access your doctor dashboard"
              : (
                signupStep === 1 ? "Let's verify your identity" :
                  signupStep === 2 ? "Create a secure password" :
                    "Complete your professional profile"
              )
            }
          </p>
        </div>

        {/* Toggle Pills - Only show in login mode or step 1 of signup */}
        {(mode === "login" || signupStep === 1) && (
          <div className="bg-gray-100 rounded-full p-1 mb-6 flex">
            <button
              onClick={() => {
                setMode("login");
                setSignupStep(1);
                setError("");
              }}
              className={cn(
                "flex-1 py-3 rounded-full font-semibold text-sm transition-all",
                mode === "login"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              )}
            >
              Login
            </button>
            <button
              onClick={() => {
                setMode("signup");
                setSignupStep(1);
                setError("");
              }}
              className={cn(
                "flex-1 py-3 rounded-full font-semibold text-sm transition-all",
                mode === "signup"
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500"
              )}
            >
              Sign up
            </button>
          </div>
        )}

        {/* Signup Progress Indicator - Only show in signup mode and not in step 1 */}
        {mode === "signup" && signupStep > 1 && (
          <div className="flex justify-center gap-2 mb-6">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={cn(
                  "h-2 rounded-full transition-all",
                  s === signupStep ? "w-8 bg-gray-900" : "w-2 bg-gray-300"
                )}
              />
            ))}
          </div>
        )}

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
                Aadhaar Number
              </label>
              <Input
                type="text"
                placeholder="Enter your 12-digit Aadhaar"
                value={loginData.aadhaar}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 12);
                  setLoginData({ ...loginData, aadhaar: value });
                }}
                maxLength={12}
                required
                className="h-11 rounded-xl bg-gray-50 border-gray-200 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  required
                  className="h-11 rounded-xl bg-gray-50 border-gray-200 pr-12 text-sm"
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
                Forgot Password?
              </button>
            </div>

            <Button
              type="submit"
              disabled={loading || loginData.aadhaar.length !== 12}
              className="w-full h-11 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm"
            >
              {loading ? "Logging in..." : "Login"}
            </Button>
          </form>
        )}

        {/* Signup Form - Step 1: Basic Info */}
        {mode === "signup" && signupStep === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); handleNextStep(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Full Name
              </label>
              <Input
                type="text"
                placeholder="Dr. Full Name"
                value={signupData.fullName}
                onChange={(e) => updateSignupField("fullName", e.target.value)}
                required
                className="h-11 rounded-xl bg-gray-50 border-gray-200 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Aadhaar Number
              </label>
              <Input
                type="text"
                placeholder="Enter your 12-digit Aadhaar"
                value={signupData.aadhaar}
                onChange={(e) => {
                  const value = e.target.value.replace(/\D/g, "").slice(0, 12);
                  updateSignupField("aadhaar", value);
                }}
                maxLength={12}
                required
                className="h-11 rounded-xl bg-gray-50 border-gray-200 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email Address
              </label>
              <Input
                type="email"
                placeholder="doctor@hospital.com"
                value={signupData.email}
                onChange={(e) => updateSignupField("email", e.target.value)}
                required
                className="h-11 rounded-xl bg-gray-50 border-gray-200 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number
              </label>
              <Input
                type="tel"
                placeholder="+91 XXXXX XXXXX"
                value={signupData.phone}
                onChange={(e) => updateSignupField("phone", e.target.value.replace(/\D/g, ""))}
                required
                className="h-11 rounded-xl bg-gray-50 border-gray-200 text-sm"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm mt-4"
            >
              Continue
            </Button>
          </form>
        )}

        {/* Signup Form - Step 2: Password */}
        {mode === "signup" && signupStep === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); handleNextStep(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password (min 8 characters)"
                  value={signupData.password}
                  onChange={(e) => updateSignupField("password", e.target.value)}
                  required
                  className="h-11 rounded-xl bg-gray-50 border-gray-200 text-sm"
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
                Confirm Password
              </label>
              <Input
                type="password"
                placeholder="Re-enter your password"
                value={signupData.confirmPassword}
                onChange={(e) => updateSignupField("confirmPassword", e.target.value)}
                required
                className="h-11 rounded-xl bg-gray-50 border-gray-200 text-sm"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-11 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm mt-4"
            >
              Continue
            </Button>
          </form>
        )}

        {/* Signup Form - Step 3: Professional Info */}
        {mode === "signup" && signupStep === 3 && (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Medical License Number
              </label>
              <Input
                type="text"
                placeholder="License number"
                value={signupData.medicalLicense}
                onChange={(e) => updateSignupField("medicalLicense", e.target.value)}
                required
                className="h-11 rounded-xl bg-gray-50 border-gray-200 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Specialization
              </label>
              <Input
                type="text"
                placeholder="e.g., Cardiologist"
                value={signupData.specialization}
                onChange={(e) => updateSignupField("specialization", e.target.value)}
                required
                className="h-11 rounded-xl bg-gray-50 border-gray-200 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Qualification
              </label>
              <Input
                type="text"
                placeholder="e.g., MBBS, MD"
                value={signupData.qualification}
                onChange={(e) => updateSignupField("qualification", e.target.value)}
                required
                className="h-11 rounded-xl bg-gray-50 border-gray-200 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Experience (years)
                </label>
                <Input
                  type="number"
                  placeholder="10"
                  value={signupData.experienceYears}
                  onChange={(e) => updateSignupField("experienceYears", e.target.value)}
                  required
                  min="0"
                  className="h-11 rounded-xl bg-gray-50 border-gray-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fee (â‚¹)
                </label>
                <Input
                  type="number"
                  placeholder="500"
                  value={signupData.consultationFee}
                  onChange={(e) => updateSignupField("consultationFee", e.target.value)}
                  min="0"
                  className="h-11 rounded-xl bg-gray-50 border-gray-200 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Hospital (Optional)
              </label>
              <Input
                type="text"
                placeholder="Hospital name"
                value={signupData.hospitalAffiliation}
                onChange={(e) => updateSignupField("hospitalAffiliation", e.target.value)}
                className="h-11 rounded-xl bg-gray-50 border-gray-200 text-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm mt-4"
            >
              {loading ? "Creating Account..." : "Complete Registration"}
            </Button>
          </form>
        )}

        {/* Patient Registration Link */}
        <div className="mt-8 mb-6 bg-gray-50 rounded-2xl p-4 border border-gray-200">
          <p className="text-sm text-gray-700 text-center font-medium">
            Are you a patient?{" "}
            <button
              onClick={() => navigate("/login")}
              className="font-bold text-gray-900 hover:text-gray-700 underline"
            >
              Sign in here
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

