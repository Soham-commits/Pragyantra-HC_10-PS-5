import mediqIcon from "@/assets/mediq-icon.png";

interface MediqIconProps {
  className?: string;
}

export function MediqIcon({ className }: MediqIconProps) {
  return <img src={mediqIcon} alt="MediQ" className={className} />;
}
