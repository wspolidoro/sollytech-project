import { Shield, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface BlockchainBadgeProps {
  verified?: boolean;
  className?: string;
}

export const BlockchainBadge = ({ verified = true, className }: BlockchainBadgeProps) => {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all",
        verified
          ? "border-success bg-success/10 text-success animate-certify"
          : "border-muted bg-muted/10 text-muted-foreground",
        className
      )}
    >
      <Shield className={cn("w-5 h-5", verified && "animate-glow")} />
      <div className="flex flex-col">
        <span className="text-xs font-medium">
          {verified ? "Verificado na Blockchain" : "Não Verificado"}
        </span>
        <span className="text-[10px] opacity-70">
          {verified ? "Registro Imutável" : "Certificação Pendente"}
        </span>
      </div>
      {verified && <Check className="w-4 h-4" />}
    </div>
  );
};
