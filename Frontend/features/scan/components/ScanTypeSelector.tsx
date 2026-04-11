import { cn } from "@/utils";
import { Activity, Fingerprint } from "lucide-react";

interface ScanType {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  color: "primary" | "secondary" | "accent" | "success";
}

const scanTypes: ScanType[] = [
  {
    id: "lung",
    name: "Lung Scan",
    description: "Chest X-ray analysis",
    icon: Activity,
    color: "primary",
  },
  {
    id: "skin",
    name: "Skin Cancer",
    description: "Dermoscopic image",
    icon: Fingerprint,
    color: "success",
  },
];

const colorClasses = {
  primary: {
    bg: "bg-blue-100",
    border: "border-blue-500",
    text: "text-blue-600",
  },
  secondary: {
    bg: "bg-purple-100",
    border: "border-purple-500",
    text: "text-purple-600",
  },
  accent: {
    bg: "bg-pink-100",
    border: "border-pink-500",
    text: "text-pink-600",
  },
  success: {
    bg: "bg-green-100",
    border: "border-green-500",
    text: "text-green-600",
  },
};

interface ScanTypeSelectorProps {
  selectedType: string | null;
  onSelect: (type: string) => void;
}

export function ScanTypeSelector({ selectedType, onSelect }: ScanTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-3">
      {scanTypes.map((type) => {
        const isSelected = selectedType === type.id;
        const colors = colorClasses[type.color];
        const Icon = type.icon;

        return (
          <button
            key={type.id}
            onClick={() => onSelect(type.id)}
            className={cn(
              "p-4 rounded-xl border-2 transition-all duration-200 text-left",
              isSelected
                ? `${colors.border} ${colors.bg}`
                : "border-gray-200 hover:border-gray-300 bg-white"
            )}
          >
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-10 w-10 items-center justify-center rounded-lg",
                  colors.bg
                )}
              >
                <Icon className={cn("h-5 w-5", colors.text)} />
              </div>
              <div>
                <p className="font-medium text-sm text-gray-900">{type.name}</p>
                <p className="text-xs text-gray-600">{type.description}</p>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

