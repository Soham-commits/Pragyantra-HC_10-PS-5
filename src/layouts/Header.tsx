import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { MediqIcon } from "@/components/ui/MediqIcon";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full bg-white border-b border-gray-100">
      <div className="max-w-md md:max-w-6xl lg:max-w-7xl mx-auto px-5 md:px-8 lg:px-10">
        <div className="flex h-16 items-center justify-between">
          {/* Logo - Left */}
          <Link to="/" className="flex items-center gap-2">
            <MediqIcon className="h-10 w-10 rounded-full" />
            <span className="text-xl font-bold text-gray-900">MediQ</span>
          </Link>

          {/* User Profile - Right */}
          <Link to="/profile">
            <Button variant="ghost" size="icon" className="h-10 w-10 hover:bg-gray-100 rounded-full">
              <User className="h-5 w-5 text-gray-700" />
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
