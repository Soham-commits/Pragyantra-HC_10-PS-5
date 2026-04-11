import { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { LogOut, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SpecialistFloatingNav } from "@/features/specialist/components/SpecialistFloatingNav";
import { Avatar as UserAvatar } from "@/components/Avatar";

interface SpecialistLayoutProps {
  children: ReactNode;
  title?: string;
  showSearch?: boolean;
}

export function SpecialistLayout({ children, title, showSearch = false }: SpecialistLayoutProps) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const searchValue = searchParams.get("q") || "";
  const specialistName = localStorage.getItem("doctor_name") || "Doctor";
  const specialistId = localStorage.getItem("doctor_id") || localStorage.getItem("specialist_id") || undefined;

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    localStorage.removeItem("specialist_id");
    localStorage.removeItem("onboarded");
    localStorage.removeItem("health_id");
    navigate("/doctor/login");
  };

  return (
    <div className="min-h-screen bg-white pb-24">
      <header className="px-5 md:px-8 lg:px-10 pt-6">
        <div className="flex items-center justify-between mb-6">
          <UserAvatar name={specialistName} role="doctor" seed={specialistId || specialistName} size="md" />
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 rounded-full hover:bg-rose-50"
            onClick={handleLogout}
            title="Sign Out"
          >
            <LogOut className="h-5 w-5 text-gray-600" />
          </Button>
        </div>

        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">Specialist Portal</p>
            <h1 className="mt-2 text-2xl font-semibold text-slate-900">
              {title || "Specialist Dashboard"}
            </h1>
          </div>

          {showSearch && (
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                placeholder="Search referrals or patients"
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
                className="w-full h-11 rounded-2xl bg-gray-50 border border-gray-200 pl-10 pr-4 text-sm text-gray-700 outline-none focus:border-gray-300"
              />
            </div>
          )}
        </div>
      </header>

      <main className="px-5 md:px-8 lg:px-10 py-8">{children}</main>

      <SpecialistFloatingNav />
    </div>
  );
}

