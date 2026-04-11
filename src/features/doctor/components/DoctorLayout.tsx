import { ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { LogOut, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DoctorFloatingNav } from "@/features/doctor/components/DoctorFloatingNav";
import { MediqIcon } from "@/components/ui/MediqIcon";
import { Avatar as UserAvatar } from "@/components/Avatar";

interface DoctorLayoutProps {
  children: ReactNode;
  title?: string;
  showSearch?: boolean;
}

export function DoctorLayout({ children, title, showSearch = false }: DoctorLayoutProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchValue = searchParams.get("q") || "";
  const doctorName = localStorage.getItem("doctor_name") || "Doctor";
  const doctorId = localStorage.getItem("doctor_id") || undefined;

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("doctor_id");
    localStorage.removeItem("onboarded");
    localStorage.removeItem("health_id");
    navigate("/doctor/login");
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <main className="max-w-md md:max-w-6xl lg:max-w-7xl mx-auto px-5 md:px-8 lg:px-10 py-6">
        <header className="mb-6">
          <div className="flex items-center justify-between">
            <Link to="/doctor/dashboard" className="flex items-center gap-2">
              <MediqIcon className="h-10 w-10 rounded-full" />
              <div className="leading-tight">
                <div className="text-[10px] uppercase tracking-widest text-gray-500 font-medium">Doctor Portal</div>
                <div className="text-lg font-semibold text-gray-900">MediQ</div>
              </div>
            </Link>

            <div className="flex items-center gap-3">
              <UserAvatar name={doctorName} role="doctor" seed={doctorId || doctorName} size="md" />
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10 hover:bg-gray-100 rounded-full"
                onClick={handleLogout}
                title="Sign Out"
              >
                <LogOut className="h-5 w-5 text-gray-700" />
              </Button>
            </div>
          </div>

          <div className="mt-5 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                {title || "Doctor Dashboard"}
              </h1>
              <p className="mt-1 text-sm text-gray-500">Clinical workspace and patient overview</p>
            </div>

            {showSearch && (
              <div className="relative w-full md:w-96">
                <Search className="absolute left-5 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  placeholder="Search patients or cases"
                  value={searchValue}
                  onChange={(event) => {
                    const nextValue = event.target.value;
                    const nextParams = new URLSearchParams(searchParams);
                    if (nextValue.trim().length > 0) {
                      nextParams.set("q", nextValue);
                    } else {
                      nextParams.delete("q");
                    }
                    setSearchParams(nextParams);
                  }}
                  className="w-full h-14 rounded-2xl bg-gradient-to-r from-gray-50 to-white border border-gray-200 pl-14 pr-6 text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:border-purple-300 focus:ring-2 focus:ring-purple-100 transition-all shadow-sm"
                />
              </div>
            )}
          </div>
        </header>

        {children}
      </main>

      <DoctorFloatingNav />
    </div>
  );
}

