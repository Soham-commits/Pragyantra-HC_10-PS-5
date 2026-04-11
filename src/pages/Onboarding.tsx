import { useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Activity, ArrowLeft } from "lucide-react";

interface OnboardingFormData {
  dateOfBirth: string;
  gender: string;
  height: string;
  weight: string;
  bloodGroup: string;
  allergies: string;
  conditions: string;
  medications: string;
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const role = localStorage.getItem("role");
  const healthId = localStorage.getItem("health_id") || "UHID-XXXXXXXXXXXXXXXX";
  
  // Redirect doctors to home - they don't need patient onboarding
  if (role === "doctor") {
    return <Navigate to="/" replace />;
  }

  const [formData, setFormData] = useState<OnboardingFormData>({
    dateOfBirth: "",
    gender: "",
    height: "",
    weight: "",
    bloodGroup: "",
    allergies: "",
    conditions: "",
    medications: "",
  });

  const updateField = (field: keyof OnboardingFormData, value: string) => {
    setFormData({ ...formData, [field]: value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.dateOfBirth || !formData.gender || !formData.height || !formData.weight || !formData.bloodGroup) {
      setError("Please fill in all required fields");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const token = localStorage.getItem("token");
      if (!token) {
        setError("Authentication token not found. Please log in again.");
        navigate("/login");
        return;
      }

      const response = await fetch("/api/auth/onboarding", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify({
          date_of_birth: formData.dateOfBirth,
          gender: formData.gender,
          height: parseFloat(formData.height),
          weight: parseFloat(formData.weight),
          blood_group: formData.bloodGroup,
          allergies: formData.allergies || null,
          chronic_conditions: formData.conditions || null,
          current_medications: formData.medications || null,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Update onboarded flag
        localStorage.setItem("onboarded", "true");

        // Navigate to home
        navigate("/");
      } else {
        setError(data.detail || "Onboarding failed. Please try again.");
      }
    } catch (err) {
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <div className="max-w-2xl mx-auto px-5 pt-6">
        <Button
          variant="ghost"
          onClick={() => {
            localStorage.clear();
            navigate("/login");
          }}
          className="mb-4 -ml-2"
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Login
        </Button>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-5 py-4">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Complete Your Health Profile</h1>
          <p className="text-gray-600">Let's set up your health information to personalize your experience</p>
          
          {/* Health ID Display - Info pill style */}
          <div className="mt-6 inline-flex">
            <div className="bg-gray-50 rounded-full px-5 py-3 flex items-center gap-2 border border-gray-200">
              <Activity className="h-5 w-5 text-gray-700" />
              <div className="flex flex-col items-start">
                <span className="text-[9px] font-medium text-gray-500">Health ID</span>
                <p className="font-mono text-xs font-semibold text-gray-900">{healthId}</p>
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 p-4 bg-red-50 border border-red-200 rounded-2xl text-red-600 text-sm font-medium">
            {error}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Basic Information</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Date of Birth *
                </label>
                <Input
                  type="date"
                  value={formData.dateOfBirth}
                  onChange={(e) => updateField("dateOfBirth", e.target.value)}
                  required
                  max={new Date().toISOString().split('T')[0]}
                  className="h-12"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Gender *
                </label>
                <select
                  value={formData.gender}
                  onChange={(e) => updateField("gender", e.target.value)}
                  required
                  className="w-full h-12 px-3 rounded-md border border-input bg-background"
                >
                  <option value="">Select gender</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Height (cm) *
                </label>
                <Input
                  type="number"
                  placeholder="170"
                  value={formData.height}
                  onChange={(e) => updateField("height", e.target.value)}
                  required
                  min="1"
                  className="h-12"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Weight (kg) *
                </label>
                <Input
                  type="number"
                  placeholder="70"
                  value={formData.weight}
                  onChange={(e) => updateField("weight", e.target.value)}
                  required
                  min="1"
                  className="h-12"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Blood Group *
              </label>
              <select
                value={formData.bloodGroup}
                onChange={(e) => updateField("bloodGroup", e.target.value)}
                required
                className="w-full h-12 px-3 rounded-md border border-input bg-background"
              >
                <option value="">Select blood group</option>
                <option value="A+">A+</option>
                <option value="A-">A-</option>
                <option value="B+">B+</option>
                <option value="B-">B-</option>
                <option value="AB+">AB+</option>
                <option value="AB-">AB-</option>
                <option value="O+">O+</option>
                <option value="O-">O-</option>
              </select>
            </div>
          </div>

          {/* Medical History (Optional) */}
          <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200 space-y-4">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Medical History (Optional)</h2>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Allergies
              </label>
              <Input
                type="text"
                placeholder="e.g., Peanuts, Penicillin (comma-separated)"
                value={formData.allergies}
                onChange={(e) => updateField("allergies", e.target.value)}
                className="h-12"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Chronic Conditions
              </label>
              <Input
                type="text"
                placeholder="e.g., Diabetes, Hypertension (comma-separated)"
                value={formData.conditions}
                onChange={(e) => updateField("conditions", e.target.value)}
                className="h-12"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Current Medications
              </label>
              <Input
                type="text"
                placeholder="e.g., Aspirin, Metformin (comma-separated)"
                value={formData.medications}
                onChange={(e) => updateField("medications", e.target.value)}
                className="h-12"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-14 text-base font-bold rounded-2xl bg-gray-900 hover:bg-gray-800 text-white transition-all active:scale-95"
          >
            {loading ? "Completing Setup..." : "Complete Profile"}
          </Button>
        </form>
      </div>
    </div>
  );
}
