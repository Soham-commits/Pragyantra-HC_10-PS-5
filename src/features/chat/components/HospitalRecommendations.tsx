import { MapPin, AlertCircle, Info, ShieldCheck } from "lucide-react";
import { HospitalCard } from "./HospitalCard";

interface Hospital {
  hospital_id: string;
  name: string;
  distance_km: number;
  address: string;
  phone?: string;
  specializations?: string[];
  has_required_specialization?: boolean;
  emergency_available?: boolean;
  rating?: number;
  estimated_travel_time?: string;
  google_maps_url: string;
  latitude?: number;
  longitude?: number;
}

interface HospitalRecommendationsProps {
  hospitals: Hospital[];
  reason?: string;
  severityLevel?: string;
}

export function HospitalRecommendations({ 
  hospitals, 
  reason,
  severityLevel 
}: HospitalRecommendationsProps) {
  if (!hospitals || hospitals.length === 0) {
    return null;
  }

  const isHighSeverity = severityLevel === "high";

  return (
    <div className="mt-5 space-y-4">
      {/* Header with Reason */}
      <div className={`rounded-2xl p-4 ${
        isHighSeverity 
          ? "bg-red-50 border border-red-200" 
          : "bg-blue-50 border border-blue-200"
      }`}>
        <div className="flex items-start gap-3">
          {isHighSeverity ? (
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          ) : (
            <Info className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
          )}
          <div className="flex-1">
            <h3 className={`font-semibold mb-1 ${
              isHighSeverity ? "text-red-900" : "text-blue-900"
            }`}>
              {isHighSeverity ? "Urgent Medical Attention Recommended" : "Nearby Healthcare Facilities"}
            </h3>
            {reason && (
              <p className={`text-sm ${
                isHighSeverity ? "text-red-700" : "text-blue-700"
              }`}>
                {reason}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Hospital Cards */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            <span className="font-medium">
              {hospitals.length} {hospitals.length === 1 ? "facility" : "facilities"} nearby
            </span>
          </div>
        </div>

        {/* Horizontal scroll container */}
        <div className="relative -mx-5 px-5">
          <div className="flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-hide"
               style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
            {hospitals.map((hospital) => (
              <div key={hospital.hospital_id} className="snap-center flex-shrink-0 w-[85vw] max-w-[400px]">
                <HospitalCard hospital={hospital} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Note */}
      <div className="text-xs text-gray-500 bg-gray-50 rounded-xl p-3 border border-gray-200">
        <p>
          💡 <strong>Tip:</strong> Call ahead to confirm availability and reduce wait times. 
          In case of emergency, always call your local emergency number immediately.
        </p>
      </div>

      {/* Privacy disclaimer */}
      <div className="flex items-start gap-2 rounded-xl bg-gray-50 border border-gray-200 p-3">
        <ShieldCheck className="h-4 w-4 text-gray-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-gray-500">
          Location is used only to find nearby medical facilities and is not stored.
        </p>
      </div>
    </div>
  );
}
