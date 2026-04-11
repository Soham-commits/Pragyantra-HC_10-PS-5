import { useEffect, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useLocation } from '@/store/LocationContext';

export function LocationPermissionDialog() {
  const [open, setOpen] = useState(false);
  const { location, requestLocation, isLoading, hasPermission } = useLocation();

  useEffect(() => {
    // Check if we should show the dialog
    const hasAskedBefore = localStorage.getItem('locationPermissionAsked');
    const isLoggedIn = localStorage.getItem('token');

    // Show dialog if user is logged in, hasn't been asked before, and doesn't have permission
    if (isLoggedIn && !hasAskedBefore && !hasPermission && !location) {
      // Delay showing by 1 second for better UX
      const timer = setTimeout(() => {
        setOpen(true);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [hasPermission, location]);

  const handleAllow = async () => {
    localStorage.setItem('locationPermissionAsked', 'true');
    await requestLocation();
    setOpen(false);
  };

  const handleDeny = () => {
    localStorage.setItem('locationPermissionAsked', 'true');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 rounded-full">
                <MapPin className="h-6 w-6 text-blue-600" />
              </div>
              <DialogTitle className="text-left">Enable Location Access</DialogTitle>
            </div>
          </div>
          <DialogDescription className="text-left pt-4">
            MediQ needs your location to show you nearby hospitals and healthcare facilities when you need medical assistance.
            <div className="mt-4 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <div className="mt-1">âœ“</div>
                <div>Find hospitals that can treat your detected condition</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-1">âœ“</div>
                <div>Get accurate distance and travel time estimates</div>
              </div>
              <div className="flex items-start gap-2">
                <div className="mt-1">âœ“</div>
                <div>Access emergency care quickly when needed</div>
              </div>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Your location is only used to find nearby healthcare facilities and is never shared with third parties.
            </p>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleDeny}
            className="w-full sm:w-auto"
          >
            Not Now
          </Button>
          <Button
            onClick={handleAllow}
            disabled={isLoading}
            className="w-full sm:w-auto"
          >
            {isLoading ? 'Getting Location...' : 'Allow Location'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

