import { Navigate } from "react-router-dom";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = localStorage.getItem("token");
  const onboarded = localStorage.getItem("onboarded");
  const role = localStorage.getItem("role");
  
  // Not logged in - redirect to login
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (role === "doctor" || role === "specialist") {
    return <Navigate to="/doctor/dashboard" replace />;
  }
  
  // Logged in but not onboarded - redirect to onboarding (only for patients)
  if (role === "patient" && onboarded !== "true") {
    return <Navigate to="/onboarding" replace />;
  }
  
  // Fully authenticated and onboarded (or doctor who doesn't need onboarding)
  return <>{children}</>;
}

interface DoctorRouteProps {
  children: React.ReactNode;
}

export function DoctorRoute({ children }: DoctorRouteProps) {
  const token = localStorage.getItem("token");
  const role = localStorage.getItem("role");

  if (!token) {
    return <Navigate to="/doctor/login" replace />;
  }

  if (role !== "doctor" && role !== "specialist") {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

interface PublicOnlyRouteProps {
  children: React.ReactNode;
}

export function PublicOnlyRoute({ children }: PublicOnlyRouteProps) {
  const token = localStorage.getItem("token");
  const onboarded = localStorage.getItem("onboarded");
  const role = localStorage.getItem("role");
  
  // Already logged in and onboarded - redirect to home
  if (token && onboarded === "true" && role === "patient") {
    return <Navigate to="/" replace />;
  }
  
  // Already logged in as doctor - redirect to home (doctors don't need onboarding)
  if (token && role === "doctor") {
    return <Navigate to="/doctor/dashboard" replace />;
  }
  
  // Already logged in but not onboarded - redirect to onboarding (patients only)
  if (token && role === "patient" && onboarded !== "true") {
    return <Navigate to="/onboarding" replace />;
  }
  
  // Not logged in - show public content
  return <>{children}</>;
}


// Specialist role has been merged into doctor role. Keep legacy "specialist"
// storage values working by treating them as doctors (see checks above).
