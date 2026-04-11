import { MapPin, Phone, Star, Navigation, Clock, AlertCircle, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils";

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

interface HospitalCardProps {
  hospital: Hospital;
}

function distanceBadgeColor(km: number) {
  if (km < 2) return "bg-green-50 text-green-700 border border-green-200";
  if (km <= 5) return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-red-50 text-red-700 border border-red-200";
}

export function HospitalCard({ hospital }: HospitalCardProps) {
  const handleCall = () => {
    if (hospital.phone) window.location.href = `tel:${hospital.phone}`;
  };

  const mapsUrl =
    hospital.latitude && hospital.longitude
      ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
          `${hospital.name} ${hospital.latitude},${hospital.longitude}`
        )}`
      : hospital.google_maps_url || "#";

  const handleDirections = () => {
    window.open(mapsUrl, "_blank");
  };

  const hasRating = hospital.rating && hospital.rating > 0;
  const hasSpecializations =
    hospital.specializations && hospital.specializations.length > 0;
  const hasPhone = hospital.phone && hospital.phone.length > 0;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm transition-shadow hover:shadow-md h-full flex flex-col">
      {/* Hospital Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-gray-900 truncate">{hospital.name}</h3>
              <p className="text-xs text-gray-500">Healthcare facility</p>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          {hasRating && (
            <div className="flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
              <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
              {hospital.rating}
            </div>
          )}
          {hospital.emergency_available && (
            <div className="flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700">
              <AlertCircle className="h-3.5 w-3.5 text-red-600" />
              Emergency
            </div>
          )}
        </div>
      </div>

      {/* Distance & ETA */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-600">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-semibold", distanceBadgeColor(hospital.distance_km))}>
          <MapPin className="h-3.5 w-3.5" />
          {hospital.distance_km} km
        </span>
        {hospital.estimated_travel_time && (
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-50 px-2.5 py-1">
            <Clock className="h-3.5 w-3.5" />
            {hospital.estimated_travel_time}
          </span>
        )}
      </div>

      {/* Specializations */}
      {hasSpecializations && (
        <div className="mt-3">
          <div className="flex flex-wrap gap-2">
            {hospital.specializations!.slice(0, 3).map((spec, index) => (
              <span
                key={index}
                className={cn(
                  "px-3 py-1 rounded-full text-xs font-medium",
                  hospital.has_required_specialization && index === 0
                    ? "bg-green-50 text-green-700 border border-green-200"
                    : "bg-gray-50 text-gray-700"
                )}
              >
                {spec}
              </span>
            ))}
            {hospital.specializations!.length > 3 && (
              <span className="px-3 py-1 rounded-full text-xs font-medium text-gray-500 bg-gray-50">
                +{hospital.specializations!.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Address */}
      <div className="mt-3 flex-1">
        <p className="text-sm text-gray-600 line-clamp-2">{hospital.address}</p>
      </div>

      {/* Action Buttons */}
      <div className="mt-auto pt-4 flex flex-wrap gap-2">
        <Button
          onClick={handleDirections}
          className="flex-1 gap-2 rounded-full bg-gray-900 text-white hover:bg-gray-800"
          size="sm"
        >
          <Navigation className="h-4 w-4" />
          Open in Maps
        </Button>
        {hasPhone && (
          <Button
            onClick={handleCall}
            variant="outline"
            className="flex-1 gap-2 rounded-full border-gray-200 text-gray-700 hover:bg-gray-50"
            size="sm"
          >
            <Phone className="h-4 w-4" />
            Call
          </Button>
        )}
      </div>

      {/* Phone number (hidden on mobile, visible on desktop) */}
      {hasPhone && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <a
            href={`tel:${hospital.phone}`}
            className="text-xs text-gray-500 hover:text-gray-900 transition-colors flex items-center gap-1"
          >
            <Phone className="h-3 w-3" />
            {hospital.phone}
          </a>
        </div>
      )}
    </div>
  );
}

