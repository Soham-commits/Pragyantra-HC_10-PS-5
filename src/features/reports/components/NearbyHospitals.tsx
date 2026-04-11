import { useState, useEffect } from "react";
import { MapPin, Phone, Clock, Navigation, Star, Building2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils";

interface Hospital {
  id: string;
  name: string;
  specialty: string;
  distance: string;
  rating: number;
  address: string;
  phone: string;
  openNow: boolean;
  waitTime?: string;
}

interface NearbyHospitalsProps {
  condition: string;
  severity: string;
}

const getHospitalsForCondition = (condition: string): Hospital[] => {
  // Mock hospitals data based on condition
  const hospitals: Hospital[] = [
    {
      id: "1",
      name: "City Medical Center",
      specialty: "Pulmonology & Oncology",
      distance: "1.2 km",
      rating: 4.8,
      address: "123 Healthcare Blvd, Medical District",
      phone: "+1 (555) 123-4567",
      openNow: true,
      waitTime: "15 min",
    },
    {
      id: "2",
      name: "St. Mary's Hospital",
      specialty: "General & Specialty Care",
      distance: "2.5 km",
      rating: 4.6,
      address: "456 Wellness Ave, Downtown",
      phone: "+1 (555) 234-5678",
      openNow: true,
      waitTime: "30 min",
    },
    {
      id: "3",
      name: "University Medical Hospital",
      specialty: "Research & Advanced Diagnostics",
      distance: "3.8 km",
      rating: 4.9,
      address: "789 Academic Dr, University District",
      phone: "+1 (555) 345-6789",
      openNow: true,
      waitTime: "45 min",
    },
    {
      id: "4",
      name: "Community Health Clinic",
      specialty: "Primary Care & Screening",
      distance: "0.8 km",
      rating: 4.4,
      address: "321 Neighborhood St, Local Area",
      phone: "+1 (555) 456-7890",
      openNow: false,
    },
  ];

  // Filter or prioritize based on condition
  if (condition.toLowerCase().includes("lung") || condition.toLowerCase().includes("chest")) {
    return hospitals.filter(h => 
      h.specialty.toLowerCase().includes("pulmonology") || 
      h.specialty.toLowerCase().includes("general")
    ).concat(hospitals.filter(h => 
      !h.specialty.toLowerCase().includes("pulmonology") && 
      !h.specialty.toLowerCase().includes("general")
    ));
  }

  return hospitals;
};

export function NearbyHospitals({ condition, severity }: NearbyHospitalsProps) {
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);

  useEffect(() => {
    // Request location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setLoading(false);
          // Simulate fetching hospitals based on location and condition
          setTimeout(() => {
            setHospitals(getHospitalsForCondition(condition));
          }, 500);
        },
        (err) => {
          setError("Location access denied. Showing general results.");
          setLoading(false);
          setHospitals(getHospitalsForCondition(condition));
        }
      );
    } else {
      setError("Geolocation not supported. Showing general results.");
      setLoading(false);
      setHospitals(getHospitalsForCondition(condition));
    }
  }, [condition]);

  const openMaps = (hospital: Hospital) => {
    const query = encodeURIComponent(hospital.name + " " + hospital.address);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };

  const callHospital = (phone: string) => {
    window.open(`tel:${phone}`, "_self");
  };

  return (
    <div className="p-6 border-b border-border/50">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          Nearby Hospitals
        </h2>
        {severity === "Moderate" || severity === "High" ? (
          <span className="text-xs bg-warning/10 text-warning px-2 py-1 rounded-full font-medium">
            Recommended Visit
          </span>
        ) : null}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="ml-2 text-muted-foreground">Finding nearby hospitals...</span>
        </div>
      ) : (
        <>
          {error && (
            <p className="text-xs text-muted-foreground mb-4 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {error}
            </p>
          )}

          <div className="space-y-3">
            {hospitals.slice(0, 3).map((hospital, index) => (
              <div
                key={hospital.id}
                className={cn(
                  "bg-muted/30 rounded-xl p-4 transition-all duration-200 hover:bg-muted/50 cursor-pointer animate-fade-in",
                  index === 0 && "ring-2 ring-primary/20 bg-primary/5"
                )}
                style={{ animationDelay: `${index * 100}ms` }}
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      "h-10 w-10 rounded-xl flex items-center justify-center shrink-0",
                      index === 0 ? "bg-primary/10" : "bg-muted"
                    )}>
                      <Building2 className={cn(
                        "h-5 w-5",
                        index === 0 ? "text-primary" : "text-muted-foreground"
                      )} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">{hospital.name}</h3>
                      <p className="text-xs text-muted-foreground">{hospital.specialty}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-xs">
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                    <span className="font-medium">{hospital.rating}</span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mb-3">
                  <span className="flex items-center gap-1">
                    <Navigation className="h-3 w-3" />
                    {hospital.distance}
                  </span>
                  <span className={cn(
                    "flex items-center gap-1",
                    hospital.openNow ? "text-success" : "text-destructive"
                  )}>
                    <Clock className="h-3 w-3" />
                    {hospital.openNow ? "Open Now" : "Closed"}
                  </span>
                  {hospital.waitTime && hospital.openNow && (
                    <span className="flex items-center gap-1 text-secondary">
                      ~{hospital.waitTime} wait
                    </span>
                  )}
                </div>

                <p className="text-xs text-muted-foreground mb-3 flex items-start gap-1">
                  <MapPin className="h-3 w-3 mt-0.5 shrink-0" />
                  {hospital.address}
                </p>

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="medical-outline"
                    className="flex-1 h-8 text-xs"
                    onClick={() => openMaps(hospital)}
                  >
                    <Navigation className="h-3 w-3 mr-1" />
                    Directions
                  </Button>
                  <Button
                    size="sm"
                    variant="medical"
                    className="flex-1 h-8 text-xs"
                    onClick={() => callHospital(hospital.phone)}
                  >
                    <Phone className="h-3 w-3 mr-1" />
                    Call
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {hospitals.length > 3 && (
            <Button variant="ghost" className="w-full mt-3 text-sm text-muted-foreground">
              View {hospitals.length - 3} more hospitals
            </Button>
          )}
        </>
      )}
    </div>
  );
}

