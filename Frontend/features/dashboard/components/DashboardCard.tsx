import { LucideIcon, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/utils";

interface DashboardCardProps {
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  gradient: "primary" | "secondary" | "accent" | "success" | "warning";
  delay?: number;
  size?: "large" | "compact";
  featured?: boolean;
  stats?: string;
}

const gradientClasses = {
  primary: "from-primary/20 via-primary/10 to-transparent",
  secondary: "from-secondary/20 via-secondary/10 to-transparent",
  accent: "from-accent/20 via-accent/10 to-transparent",
  success: "from-success/20 via-success/10 to-transparent",
  warning: "from-warning/20 via-warning/10 to-transparent",
};

const hoverGradientClasses = {
  primary: "group-hover:from-primary/30 group-hover:via-primary/15",
  secondary: "group-hover:from-secondary/30 group-hover:via-secondary/15",
  accent: "group-hover:from-accent/30 group-hover:via-accent/15",
  success: "group-hover:from-success/30 group-hover:via-success/15",
  warning: "group-hover:from-warning/30 group-hover:via-warning/15",
};

const iconBgClasses = {
  primary: "bg-primary/10 group-hover:bg-primary/15",
  secondary: "bg-secondary/10 group-hover:bg-secondary/15",
  accent: "bg-accent/10 group-hover:bg-accent/15",
  success: "bg-success/10 group-hover:bg-success/15",
  warning: "bg-warning/10 group-hover:bg-warning/15",
};

const iconColorClasses = {
  primary: "text-primary",
  secondary: "text-secondary",
  accent: "text-accent",
  success: "text-success",
  warning: "text-warning",
};

const borderClasses = {
  primary: "border-primary/20 group-hover:border-primary/40",
  secondary: "border-secondary/20 group-hover:border-secondary/40",
  accent: "border-accent/20 group-hover:border-accent/40",
  success: "border-success/20 group-hover:border-success/40",
  warning: "border-warning/20 group-hover:border-warning/40",
};

export function DashboardCard({
  title,
  description,
  icon: Icon,
  href,
  gradient,
  delay = 0,
  size = "large",
  featured = false,
  stats,
}: DashboardCardProps) {
  const isLarge = size === "large";
  
  return (
    <Link
      to={href}
      className={cn(
        "group relative overflow-hidden rounded-3xl bg-card border-2",
        "transition-all duration-500 ease-out",
        "animate-slide-up opacity-0",
        "active:scale-95",
        borderClasses[gradient],
        isLarge 
          ? "p-8 min-h-[180px] hover:shadow-2xl hover:scale-[1.02]" 
          : "p-7 min-h-[140px] hover:shadow-lg hover:scale-[1.01]"
      )}
      style={{ animationDelay: `${delay}ms`, animationFillMode: "forwards" }}
    >
      {/* Animated gradient background */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-br opacity-0 transition-opacity duration-500",
          gradientClasses[gradient],
          hoverGradientClasses[gradient],
          "group-hover:opacity-100"
        )}
      />

      {/* Decorative blur orb */}
      <div
        className={cn(
          "absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-0 transition-opacity duration-700",
          iconBgClasses[gradient].split(" ")[0],
          "group-hover:opacity-30"
        )}
      />

      <div className="relative z-10">
        {/* Top row with icon and arrow */}
        <div className="flex items-start justify-between mb-4">
          <div
            className={cn(
              "flex items-center justify-center rounded-2xl transition-all duration-500",
              iconBgClasses[gradient],
              isLarge ? "h-20 w-20" : "h-16 w-16",
              "group-hover:scale-110 group-hover:rotate-3"
            )}
          >
            <Icon className={cn(
              iconColorClasses[gradient],
              isLarge ? "h-10 w-10" : "h-8 w-8"
            )} />
          </div>

          {/* Arrow indicator */}
          <div className={cn(
            "flex items-center justify-center rounded-full transition-all duration-300",
            "opacity-0 -translate-y-2 group-hover:opacity-100 group-hover:translate-y-0",
            iconBgClasses[gradient],
            "h-10 w-10"
          )}>
            <ArrowUpRight className={cn("h-5 w-5", iconColorClasses[gradient])} />
          </div>
        </div>

        {/* Content */}
        <div className="space-y-3">
          <div>
            <h3 className={cn(
              "font-bold text-foreground transition-colors duration-300",
              isLarge ? "text-3xl mb-3" : "text-2xl mb-2"
            )}>
              {title}
            </h3>
            <p className={cn(
              "text-muted-foreground leading-relaxed",
              isLarge ? "text-lg" : "text-base"
            )}>
              {description}
            </p>
          </div>

          {/* Stats badge */}
          {stats && (
            <div className="flex items-center gap-2 pt-2">
              <div className={cn(
                "flex items-center gap-1.5 px-3 py-1.5 rounded-full",
                "border transition-all duration-300",
                borderClasses[gradient],
                "group-hover:scale-105"
              )}>
                <div className={cn(
                  "w-1.5 h-1.5 rounded-full animate-pulse",
                  iconColorClasses[gradient].replace("text-", "bg-")
                )} />
                <span className={cn(
                  "text-xs font-medium",
                  iconColorClasses[gradient]
                )}>
                  {stats}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom shine effect */}
      <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-foreground/5 to-transparent" />
    </Link>
  );
}

