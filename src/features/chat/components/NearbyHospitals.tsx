import { useEffect, useState, useCallback } from "react";
import {
  MapPin,
  Navigation,
  Building2,
  Loader2,
  AlertTriangle,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLocation } from "@/store/LocationContext";
import { locationApi, type NearbyHospital } from "@/services/api";

/* ------------------------------------------------------------------ */
/*  Distance badge colour helper                                       */
/* ------------------------------------------------------------------ */
function distanceBadge(km: number) {
  if (km < 2) return "bg-green-50 text-green-700 border-green-200";
  if (km <= 5) return "bg-amber-50 text-amber-700 border-amber-200";
  return "bg-red-50 text-red-700 border-red-200";
}

/* ------------------------------------------------------------------ */
/*  Skeleton loader                                                    */
/* ------------------------------------------------------------------ */
function SkeletonCard() {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse space-y-3">
      <div className="flex items-center gap-3">
        <div className="h-9 w-9 rounded-xl bg-gray-200" />
        <div className="flex-1 space-y-2">
          <div className="h-4 w-3/4 rounded bg-gray-200" />
          <div className="h-3 w-1/2 rounded bg-gray-100" />
        </div>
      </div>
      <div className="h-3 w-full rounded bg-gray-100" />
      <div className="h-3 w-2/3 rounded bg-gray-100" />
      <div className="h-9 w-full rounded-full bg-gray-200" />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Single hospital card                                               */
/* ------------------------------------------------------------------ */
function LiveHospitalCard({ hospital }: { hospital: NearbyHospital }) {
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    `${hospital.hospital_name} ${hospital.latitude},${hospital.longitude}`
  )}`;
  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-sm transition-shadow hover:shadow-md flex flex-col h-full">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Building2 className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-gray-900 truncate">
            {hospital.hospital_name}
          </h3>
          <p className="text-xs text-gray-500 line-clamp-2 mt-0.5">
            {hospital.address}
          </p>
        </div>
      </div>

      {/* Distance badge */}
      <div className="mt-3">
        <span
          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${distanceBadge(
            hospital.distance_km
          )}`}
        >
          <MapPin className="h-3.5 w-3.5" />
          {hospital.distance_km} km
        </span>
      </div>

      {/* Actions */}
      <div className="mt-auto pt-4">
        <Button
          onClick={() => window.open(mapsUrl, "_blank")}
          className="w-full gap-2 rounded-full bg-gray-900 text-white hover:bg-gray-800"
          size="sm"
        >
          <Navigation className="h-4 w-4" />
          Open in Maps
        </Button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                     */
/* ------------------------------------------------------------------ */
export interface NearbyHospitalsProps {
  /** If true the component requests location automatically on mount */
  autoRequest?: boolean;
}

export function NearbyHospitals({ autoRequest = true }: NearbyHospitalsProps) {
  const { location, isLoading: locationLoading, requestLocation, hasPermission } =
    useLocation();

  const [hospitals, setHospitals] = useState<NearbyHospital[]>([]);
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualCity, setManualCity] = useState("");
  const [radius, setRadius] = useState(5000);

  /* Fetch hospitals when we have a location */
  const loadHospitals = useCallback(
    async (lat: number, lng: number, rad: number = radius) => {
      setFetching(true);
      setError(null);
      try {
        const data = await locationApi.getNearbyHospitals(lat, lng, rad);
        setHospitals(data);
        if (data.length === 0) {
          setError("No nearby hospitals found. Try increasing search radius.");
        }
      } catch {
        setError("Failed to fetch nearby hospitals. Please try again.");
      } finally {
        setFetching(false);
      }
    },
    [radius]
  );

  /* Auto-request location on mount when allowed */
  useEffect(() => {
    if (autoRequest && !hasPermission && !locationLoading) {
      requestLocation();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* Trigger hospital fetch when location becomes available */
  useEffect(() => {
    if (location) {
      loadHospitals(location.latitude, location.longitude);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location]);

  /* ---- Permission denied / not yet granted ---- */
  if (!hasPermission && !locationLoading) {
    return (
      <div className="space-y-4">
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-center space-y-3">
          <AlertTriangle className="h-8 w-8 text-amber-500 mx-auto" />
          <p className="text-sm text-amber-800 font-medium">
            Enable location to find nearby hospitals.
          </p>
          <Button
            onClick={requestLocation}
            className="rounded-full bg-amber-600 hover:bg-amber-700 text-white"
            size="sm"
          >
            <MapPin className="mr-2 h-4 w-4" />
            Enable Location
          </Button>
        </div>

        {/* Manual city search fallback */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-3">
          <p className="text-sm text-gray-600 font-medium">
            Or enter a city to search manually:
          </p>
          <div className="flex gap-2">
            <input
              type="text"
              value={manualCity}
              onChange={(e) => setManualCity(e.target.value)}
              placeholder="e.g. Mumbai"
              className="flex-1 rounded-full border border-gray-300 px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button
              size="sm"
              disabled={!manualCity.trim()}
              className="rounded-full"
              onClick={async () => {
                // Geocode the city name via Nominatim (OSM)
                try {
                  setFetching(true);
                  setError(null);
                  const res = await fetch(
                    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
                      manualCity
                    )}&limit=1`
                  );
                  const results = await res.json();
                  if (results.length > 0) {
                    const { lat, lon } = results[0];
                    await loadHospitals(parseFloat(lat), parseFloat(lon));
                  } else {
                    setError("City not found. Please try a different name.");
                    setFetching(false);
                  }
                } catch {
                  setError("Search failed. Please try again.");
                  setFetching(false);
                }
              }}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ---- Loading states ---- */
  if (locationLoading || fetching) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>
            {locationLoading
              ? "Getting your locationâ€¦"
              : "Fetching nearby hospitalsâ€¦"}
          </span>
        </div>
        {/* Skeleton cards */}
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  /* ---- Error state ---- */
  if (error && hospitals.length === 0) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-5 text-center space-y-3">
        <AlertTriangle className="h-8 w-8 text-red-400 mx-auto" />
        <p className="text-sm text-red-700">{error}</p>
        <div className="flex flex-wrap justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            className="rounded-full border-red-300 text-red-700 hover:bg-red-100"
            onClick={() => {
              const newRadius = Math.min(radius + 5000, 50000);
              setRadius(newRadius);
              if (location) loadHospitals(location.latitude, location.longitude, newRadius);
            }}
          >
            Increase Radius
          </Button>
          <Button
            size="sm"
            className="rounded-full bg-red-600 hover:bg-red-700 text-white"
            onClick={() => location && loadHospitals(location.latitude, location.longitude)}
          >
            Retry
          </Button>
        </div>
      </div>
    );
  }

  /* ---- Results ---- */
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-700 font-medium">
          <MapPin className="h-4 w-4 text-blue-600" />
          {hospitals.length} {hospitals.length === 1 ? "facility" : "facilities"}{" "}
          nearby
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="text-xs text-gray-500 hover:text-gray-700"
          onClick={() => location && loadHospitals(location.latitude, location.longitude)}
        >
          Refresh
        </Button>
      </div>

      {/* Cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {hospitals.map((h, idx) => (
          <LiveHospitalCard key={`${h.latitude}-${h.longitude}-${idx}`} hospital={h} />
        ))}
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

