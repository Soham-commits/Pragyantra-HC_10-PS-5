import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ProtectedRoute, PublicOnlyRoute, DoctorRoute } from "@/components/ProtectedRoute";
import { LocationProvider } from "@/store/LocationContext";
import { LocationPermissionDialog } from "@/components/LocationPermissionDialog";
import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import Index from "./pages/Index";
import Chat from "./pages/Chat";
import Scan from "./pages/Scan";
import Reports from "./pages/Reports";
import Profile from "./pages/Profile";
import Login from "./pages/Login";
import DoctorLogin from "./pages/DoctorLogin";
import DoctorDashboard from "./pages/DoctorDashboard";
import DoctorReviews from "./pages/DoctorReviews";
import DoctorReviewDetail from "./pages/DoctorReviewDetail";
import DoctorPatientDetail from "./pages/DoctorPatientDetail";
import DoctorReferrals from "./pages/DoctorReferrals";
import Onboarding from "./pages/Onboarding";
import NotFound from "./pages/NotFound";
import Welcome from "./pages/Welcome";
import SpecialistInbox from "./pages/SpecialistInbox";
import BookAppointment from "./pages/BookAppointment";
import DoctorAppointments from "./pages/DoctorAppointments";
import Trust from "./pages/Trust";
import Privacy from "./pages/Privacy";
import Grievance from "./pages/Grievance";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <LocationProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <LocationPermissionDialog />
        <BrowserRouter>
          <AppErrorBoundary>
            <Routes>
              {/* Public routes - redirect to home if already logged in */}
              <Route path="/welcome" element={<PublicOnlyRoute><Welcome /></PublicOnlyRoute>} />
              <Route path="/login" element={<PublicOnlyRoute><Login /></PublicOnlyRoute>} />
              <Route path="/signup" element={<Navigate to="/welcome" replace />} />
              <Route path="/doctor/login" element={<PublicOnlyRoute><DoctorLogin /></PublicOnlyRoute>} />
              <Route path="/doctor/signup" element={<Navigate to="/doctor/login" replace />} />

              {/* Onboarding - only accessible when logged in but not onboarded */}
              <Route path="/onboarding" element={<Onboarding />} />

              {/* Protected routes - require authentication and onboarding */}
              <Route path="/" element={<ProtectedRoute><Index /></ProtectedRoute>} />
              <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
              <Route path="/scan" element={<ProtectedRoute><Scan /></ProtectedRoute>} />
              <Route path="/reports" element={<ProtectedRoute><Reports /></ProtectedRoute>} />
              <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
              <Route path="/book-appointment" element={<ProtectedRoute><BookAppointment /></ProtectedRoute>} />

              {/* Doctor routes */}
              <Route path="/doctor/dashboard" element={<DoctorRoute><DoctorDashboard /></DoctorRoute>} />
              <Route path="/doctor/reviews" element={<DoctorRoute><DoctorReviews /></DoctorRoute>} />
              <Route path="/doctor/reviews/:id" element={<DoctorRoute><DoctorReviewDetail /></DoctorRoute>} />
              <Route path="/doctor/patients/:healthId" element={<DoctorRoute><DoctorPatientDetail /></DoctorRoute>} />
              <Route path="/doctor/referrals" element={<DoctorRoute><DoctorReferrals /></DoctorRoute>} />
              <Route path="/doctor/appointments" element={<DoctorRoute><DoctorAppointments /></DoctorRoute>} />
              {/* Specialist role merged into doctor role */}
              <Route path="/specialist/dashboard" element={<Navigate to="/doctor/dashboard" replace />} />
              <Route path="/specialist/inbox" element={<DoctorRoute><SpecialistInbox /></DoctorRoute>} />
              <Route path="/doctor/inbox" element={<DoctorRoute><SpecialistInbox /></DoctorRoute>} />
              {/* Compliance pages - public */}
              <Route path="/trust" element={<Trust />} />
              <Route path="/privacy" element={<Privacy />} />
              <Route path="/grievance" element={<Grievance />} />

              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AppErrorBoundary>
        </BrowserRouter>
      </TooltipProvider>
    </LocationProvider>
  </QueryClientProvider>
);

export default App;

