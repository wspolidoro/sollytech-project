import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface StatusChipProps {
  status: "certified" | "pending" | "rejected";
  className?: string;
}

export const StatusChip = ({ status, className }: StatusChipProps) => {
  const variants = {
    certified: {
      bg: "bg-success/10 border-success",
      text: "text-success",
      icon: CheckCircle2,
      label: "Certificado",
    },
    pending: {
      bg: "bg-muted border-muted-foreground/30",
      text: "text-muted-foreground",
      icon: Clock,
      label: "Pendente",
    },
    rejected: {
      bg: "bg-destructive/10 border-destructive",
      text: "text-destructive",
      icon: AlertCircle,
      label: "Rejeitado",
    },
  };

  const variant = variants[status];
  const Icon = variant.icon;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-medium transition-all",
        variant.bg,
        variant.text,
        className
      )}
    >
      <Icon className="w-3.5 h-3.5" />
      {variant.label}
    </div>
  );
};
