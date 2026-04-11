import { ClipboardCheck, LayoutGrid, LogOut, Inbox, CalendarCheck } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { cn } from "@/utils";

const navItems = [
  { label: "Dashboard", path: "/doctor/dashboard", icon: LayoutGrid },
  { label: "Appointments", path: "/doctor/appointments", icon: CalendarCheck },
  { label: "Reviews", path: "/doctor/reviews", icon: ClipboardCheck },
  { label: "Referrals", path: "/doctor/referrals", icon: Inbox },
];

export function DoctorFloatingNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("doctor_id");
    localStorage.removeItem("onboarded");
    localStorage.removeItem("health_id");
    navigate("/doctor/login");
  };

  return (
    <div className="fixed left-1/2 -translate-x-1/2 bottom-5 z-50">
      <div className="flex items-center gap-2 rounded-full border border-gray-100 bg-white px-4 py-2 shadow-lg">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => navigate(item.path)}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-full transition-all",
                isActive
                  ? "bg-gray-100 text-gray-900"
                  : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
              )}
              aria-label={item.label}
            >
              <Icon className="h-5 w-5" />
            </button>
          );
        })}

        <div className="h-7 w-px bg-gray-200" />

        <button
          type="button"
          onClick={handleLogout}
          className="flex h-11 w-11 items-center justify-center rounded-full text-gray-400 transition-all hover:text-rose-600 hover:bg-rose-50"
          aria-label="Sign out"
        >
          <LogOut className="h-5 w-5" />
        </button>
      </div>
    </div>
  );
}

