import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
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

export default function DoctorSignup() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [formData, setFormData] = useState<DoctorSignupForm>({
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

  const updateField = (field: keyof DoctorSignupForm, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleNextStep = () => {
    setError("");

    if (step === 1) {
      if (!formData.fullName || !formData.aadhaar || !formData.email || !formData.phone) {
        setError("Please fill in all fields");
        return;
      }
      if (formData.aadhaar.length !== 12) {
        setError("Aadhaar must be 12 digits");
        return;
      }
    }

    if (step === 2) {
      if (formData.password.length < 8) {
        setError("Password must be at least 8 characters");
        return;
      }
      if (formData.password !== formData.confirmPassword) {
        setError("Passwords do not match");
        return;
      }
    }

    setStep(step + 1);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.medicalLicense || !formData.specialization || !formData.qualification || !formData.experienceYears) {
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
          full_name: formData.fullName,
          aadhaar_number: formData.aadhaar,
          email: formData.email,
          password: formData.password,
          phone: formData.phone,
          medical_license: formData.medicalLicense,
          specialization: formData.specialization,
          qualification: formData.qualification,
          experience_years: parseInt(formData.experienceYears),
          hospital_affiliation: formData.hospitalAffiliation || undefined,
          consultation_fee: formData.consultationFee ? parseFloat(formData.consultationFee) : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        localStorage.setItem("token", data.access_token);
        localStorage.setItem("role", data.role);
        localStorage.setItem("doctor_id", data.doctor_id);
        localStorage.setItem("doctor_name", data.full_name || formData.fullName);
        localStorage.setItem("onboarded", "true");  // Doctors don't need patient onboarding
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
    <div className="min-h-screen bg-white relative flex flex-col justify-center">
      <div className="absolute left-5 top-5">
        <Button
          variant="ghost"
          onClick={() => step === 1 ? navigate("/welcome") : setStep(step - 1)}
          className="-ml-2 h-10"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back
        </Button>
      </div>

      <div className="flex justify-center pt-6 pb-6">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-900 shadow-lg">
          <Activity className="h-7 w-7 text-white" />
        </div>
      </div>

      <div className="flex-1 max-w-md mx-auto px-6 w-full">

        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-1">Doctor Registration</h1>
          <p className="text-gray-600">
            {step === 1 && "Let's verify your identity"}
            {step === 2 && "Secure your account"}
            {step === 3 && "Professional credentials"}
          </p>
        </div>

        <div className="flex justify-center gap-2 mb-8">
          {[1, 2, 3].map((s) => (
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

        {step === 1 && (
          <form onSubmit={(e) => { e.preventDefault(); handleNextStep(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
              <Input
                type="text"
                placeholder="Dr. Full Name"
                value={formData.fullName}
                onChange={(e) => updateField("fullName", e.target.value)}
                required
                className="h-11 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Aadhaar Number</label>
              <Input
                type="text"
                placeholder="Enter 12-digit Aadhaar"
                value={formData.aadhaar}
                onChange={(e) => updateField("aadhaar", e.target.value.replace(/\D/g, "").slice(0, 12))}
                maxLength={12}
                required
                className="h-11 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
              <Input
                type="email"
                placeholder="doctor@hospital.com"
                value={formData.email}
                onChange={(e) => updateField("email", e.target.value)}
                required
                className="h-11 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
              <Input
                type="tel"
                placeholder="+91 XXXXX XXXXX"
                value={formData.phone}
                onChange={(e) => updateField("phone", e.target.value.replace(/\D/g, ""))}
                required
                className="h-11 text-sm"
              />
            </div>

            <Button type="submit" className="w-full h-11 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm">
              Continue
            </Button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={(e) => { e.preventDefault(); handleNextStep(); }} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a strong password"
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
              <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
              <Input
                type="password"
                placeholder="Re-enter password"
                value={formData.confirmPassword}
                onChange={(e) => updateField("confirmPassword", e.target.value)}
                required
                className="h-11 text-sm"
              />
            </div>

            <Button type="submit" className="w-full h-11 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm">
              Continue
            </Button>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Medical License Number</label>
              <Input
                type="text"
                placeholder="License number"
                value={formData.medicalLicense}
                onChange={(e) => updateField("medicalLicense", e.target.value)}
                required
                className="h-11 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Specialization</label>
              <Input
                type="text"
                placeholder="e.g., Cardiologist"
                value={formData.specialization}
                onChange={(e) => updateField("specialization", e.target.value)}
                required
                className="h-11 text-sm"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Qualification</label>
              <Input
                type="text"
                placeholder="e.g., MBBS, MD"
                value={formData.qualification}
                onChange={(e) => updateField("qualification", e.target.value)}
                required
                className="h-11 text-sm"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Experience (years)</label>
                <Input
                  type="number"
                  placeholder="10"
                  value={formData.experienceYears}
                  onChange={(e) => updateField("experienceYears", e.target.value)}
                  required
                  min="0"
                  className="h-11 text-sm"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fee (â‚¹)</label>
                <Input
                  type="number"
                  placeholder="500"
                  value={formData.consultationFee}
                  onChange={(e) => updateField("consultationFee", e.target.value)}
                  min="0"
                  className="h-11 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Hospital (Optional)</label>
              <Input
                type="text"
                placeholder="Hospital name"
                value={formData.hospitalAffiliation}
                onChange={(e) => updateField("hospitalAffiliation", e.target.value)}
                className="h-11 text-sm"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 bg-gray-900 hover:bg-gray-800 text-white font-semibold"
            >
              {loading ? "Creating Account..." : "Complete Registration"}
            </Button>
          </form>
        )}

        {step === 1 && (
          <div className="mt-6 text-center">
            <p className="text-gray-600">
              Already registered?{" "}
              <Link to="/doctor/login" className="font-medium text-gray-900 hover:text-gray-700 underline">
                Sign In
              </Link>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

