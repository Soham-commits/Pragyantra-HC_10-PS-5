import { cn } from "@/utils";
import { useMemo, useState } from "react";

type Role = "patient" | "doctor";

export type UserAvatarProps = {
  name?: string | null;
  role: Role;
  photoUrl?: string | null;
  seed?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const COLORS = ["#6366f1", "#8b5cf6", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];
const UI_AVATAR_BG = "6366f1";

const getInitials = (name?: string | null) => {
  const safe = (name || "").trim();
  if (!safe) return "U";
  const parts = safe.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return safe.slice(0, 2).toUpperCase();
};

const getColor = (name?: string | null) => {
  const safe = (name || "U").trim();
  const ch = safe ? safe.charCodeAt(0) : "U".charCodeAt(0);
  return COLORS[ch % COLORS.length];
};

const getUiAvatarsUrl = (name: string) => {
  // Professional initials avatar. Rounded=true yields a circle.
  // Example:
  // https://ui-avatars.com/api/?name=First+Last&background=6366f1&color=fff&size=128&bold=true&rounded=true
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${UI_AVATAR_BG}&color=fff&size=128&bold=true&rounded=true`;
};

const sizeClass: Record<NonNullable<UserAvatarProps["size"]>, string> = {
  sm: "h-8 w-8 text-xs",
  md: "h-11 w-11 text-sm",
  lg: "h-16 w-16 text-xl",
};

export function Avatar({ name, role, photoUrl, seed, size = "md", className }: UserAvatarProps) {
  const initials = getInitials(name);
  const bg = getColor(name);
  const shape = "rounded-full";

  // UI Avatars needs a name (not an ID). If name is missing we skip it and use initials fallback.
  const uiName = useMemo(() => (name || "").trim(), [name]);
  const uiUrl = useMemo(() => (uiName ? getUiAvatarsUrl(uiName) : null), [uiName]);

  const [photoFailed, setPhotoFailed] = useState(false);
  const [uiFailed, setUiFailed] = useState(false);

  const primarySrc = !photoFailed && photoUrl ? photoUrl : null;
  const fallbackSrc = !uiFailed ? uiUrl : null;

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center overflow-visible select-none shrink-0",
        sizeClass[size],
        shape,
        className
      )}
      aria-label={name ? `${name} avatar` : "User avatar"}
      title={name || undefined}
      style={primarySrc || fallbackSrc ? undefined : { backgroundColor: bg }}
    >
      {primarySrc ? (
        <img
          src={primarySrc}
          alt={name ? `${name} profile` : "Profile"}
          className={cn("h-full w-full object-cover", shape)}
          referrerPolicy="no-referrer"
          onError={() => setPhotoFailed(true)}
        />
      ) : fallbackSrc ? (
        <img
          src={fallbackSrc}
          alt={name ? `${name} avatar` : "Avatar"}
          className={cn("h-full w-full object-cover", shape)}
          referrerPolicy="no-referrer"
          onError={() => setUiFailed(true)}
        />
      ) : (
        <span className="font-semibold text-white">{initials}</span>
      )}

      {/* Doctor styling: subtle badge to distinguish from patients */}
      {role === "doctor" && (
        <span className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-white flex items-center justify-center shadow-sm ring-1 ring-gray-200">
          <span className="text-[7px] font-bold leading-none text-gray-700">DR</span>
        </span>
      )}
    </div>
  );
}

