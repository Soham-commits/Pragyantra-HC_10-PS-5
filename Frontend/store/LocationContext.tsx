import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useToast } from '@/hooks/use-toast';

interface Location {
  latitude: number;
  longitude: number;
}

interface LocationContextType {
  location: Location | null;
  isLoading: boolean;
  error: string | null;
  requestLocation: () => Promise<void>;
  hasPermission: boolean;
}

const LocationContext = createContext<LocationContextType | undefined>(undefined);

export const useLocation = () => {
  const context = useContext(LocationContext);
  if (!context) {
    throw new Error('useLocation must be used within LocationProvider');
  }
  return context;
};

interface LocationProviderProps {
  children: ReactNode;
}

export const LocationProvider: React.FC<LocationProviderProps> = ({ children }) => {
  const [location, setLocation] = useState<Location | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasPermission, setHasPermission] = useState(false);
  const { toast } = useToast();

  const requestLocation = async () => {
    if (!navigator.geolocation) {
      const errorMsg = 'Geolocation is not supported by your browser';
      setError(errorMsg);
      toast({
        title: 'Location Not Supported',
        description: errorMsg,
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setError(null);

    const getPosition = (options: PositionOptions) =>
      new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, options);
      });

    try {
      let position: GeolocationPosition | null = null;

      try {
        position = await getPosition({
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 300000, // Cache for 5 minutes
        });
      } catch (primaryErr: any) {
        // Retry with less strict settings for mobile reliability
        if (primaryErr?.code === 2 || primaryErr?.code === 3) {
          position = await getPosition({
            enableHighAccuracy: false,
            timeout: 20000,
            maximumAge: 600000, // Cache for 10 minutes
          });
        } else {
          throw primaryErr;
        }
      }

      if (!position) {
        throw new Error('Failed to get position');
      }

      const newLocation = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      };

      setLocation(newLocation);
      setHasPermission(true);
      
      // Store in localStorage for persistence
      localStorage.setItem('userLocation', JSON.stringify(newLocation));
      
      toast({
        title: 'Location Access Granted',
        description: 'We can now show you nearby hospitals when needed.',
      });
    } catch (err: any) {
      let errorMsg = 'Failed to get your location';
      
      if (err.code === 1) {
        errorMsg = 'Location is blocked in your browser. Tap the lock icon in the address bar, set Location to Allow, then try again.';
      } else if (err.code === 2) {
        errorMsg = 'Location unavailable. Please check your device settings.';
      } else if (err.code === 3) {
        errorMsg = 'Location request timeout. Please try again.';
      }
      
      // If we have a cached location, keep it rather than hard-failing
      const cachedLocation = localStorage.getItem('userLocation');
      if (cachedLocation) {
        try {
          const parsed = JSON.parse(cachedLocation);
          setLocation(parsed);
          setHasPermission(true);
          setError(null);
          return;
        } catch (e) {
          console.error('Failed to parse cached location:', e);
        }
      }

      setError(errorMsg);
      setHasPermission(false);
      
      toast({
        title: 'Location Access Failed',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Try to load cached location on mount
  useEffect(() => {
    const cachedLocation = localStorage.getItem('userLocation');
    if (cachedLocation) {
      try {
        const parsed = JSON.parse(cachedLocation);
        setLocation(parsed);
        setHasPermission(true);
      } catch (e) {
        console.error('Failed to parse cached location:', e);
      }
    }
  }, []);

  const value: LocationContextType = {
    location,
    isLoading,
    error,
    requestLocation,
    hasPermission,
  };

  return <LocationContext.Provider value={value}>{children}</LocationContext.Provider>;
};
