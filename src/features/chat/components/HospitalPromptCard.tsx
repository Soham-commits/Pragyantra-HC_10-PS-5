import { useState } from "react";
import { MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { locationApi } from "@/services/api";

interface HospitalPromptCardProps {
  detectedSymptoms?: string[];
  severityLevel?: string;
  reason?: string;
  location: { latitude: number; longitude: number } | null;
  onHospitalsRequested: (hospitals: any[]) => void;
  onDismiss?: () => void;
}

export function HospitalPromptCard({
  detectedSymptoms = [],
  severityLevel = "moderate",
  reason,
  location,
  onHospitalsRequested,
  onDismiss,
}: HospitalPromptCardProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { toast } = useToast();

  const haversineKm = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos((lat1 * Math.PI) / 180) *
        Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const handleFindHospitals = async () => {
    if (!location) {
      toast({
        title: "Location Required",
        description: "Please enable location access to find nearby hospitals.",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      // Use the new OSM Overpass API endpoint
      const osmResults = await locationApi.getNearbyHospitals(
        location.latitude,
        location.longitude,
        5000
      );

      // Map OSM results to the Hospital shape expected by HospitalRecommendations
      const hospitals = osmResults
        .map((h, idx) => {
        const distanceKm =
          Math.round(
            haversineKm(
              location.latitude,
              location.longitude,
              h.latitude,
              h.longitude
            ) * 10
          ) / 10;
          return {
            hospital_id: `osm-${h.latitude}-${h.longitude}-${idx}`,
            name: h.hospital_name,
            distance_km: distanceKm,
            address: h.address,
            phone: "",
            specializations: [] as string[],
            has_required_specialization: false,
            emergency_available: false,
            estimated_travel_time: `${Math.max(1, Math.round(distanceKm * 3))} mins`,
            google_maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
              `${h.hospital_name} ${h.latitude},${h.longitude}`
            )}`,
            latitude: h.latitude,
            longitude: h.longitude,
          };
        })
        .sort((a, b) => a.distance_km - b.distance_km);

      onHospitalsRequested(hospitals);
      setDismissed(true);
    } catch (error) {
      console.error("Error fetching hospitals:", error);
      toast({
        title: "Error",
        description: "Failed to fetch nearby hospitals. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (dismissed) {
    return null;
  }

  const isHighSeverity = severityLevel === "high";

  return (
    <div
      className={`rounded-2xl p-5 border-2 shadow-sm ${isHighSeverity
          ? "bg-red-50/80 border-red-200"
          : "bg-blue-50/80 border-blue-200"
        }`}
    >
      <div className="flex items-start gap-3 mb-4">
        <div
          className={`p-2.5 rounded-xl ${isHighSeverity ? "bg-red-100" : "bg-blue-100"
            }`}
        >
          <MapPin
            className={`h-5 w-5 ${isHighSeverity ? "text-red-600" : "text-blue-600"
              }`}
          />
        </div>
        <div className="flex-1">
          <h3
            className={`font-semibold mb-1 ${isHighSeverity ? "text-red-900" : "text-blue-900"
              }`}
          >
            {isHighSeverity
              ? "Medical Attention Recommended"
              : "Healthcare Facilities Available"}
          </h3>
          {reason && (
            <p
              className={`text-sm ${isHighSeverity ? "text-red-700" : "text-blue-700"
                }`}
            >
              {reason}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleFindHospitals}
          disabled={isLoading}
          className={`flex-1 ${isHighSeverity
              ? "bg-red-600 hover:bg-red-700"
              : "bg-blue-600 hover:bg-blue-700"
            }`}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Searching...
            </>
          ) : (
            <>
              <MapPin className="mr-2 h-4 w-4" />
              Find Nearby Hospitals
            </>
          )}
        </Button>
        <Button
          variant="outline"
          onClick={() => {
            setDismissed(true);
            onDismiss?.();
          }}
          disabled={isLoading}
          className="px-4"
        >
          Not Now
        </Button>
      </div>
    </div>
  );
}

