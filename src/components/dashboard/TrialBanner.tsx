import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

interface Props {
  daysLeft: number;
}

const TrialBanner = ({ daysLeft }: Props) => {
  const handleSubscribe = () => {
    toast.info("Em breve! Entre em contato com o suporte para ativar sua assinatura.");
  };

  return (
    <div className="bg-gradient-primary text-primary-foreground rounded-2xl p-4 mb-6 flex items-center justify-between gap-3 shadow-glow">
      <div className="flex items-center gap-3 min-w-0">
        <Sparkles className="w-5 h-5 shrink-0" />
        <div className="min-w-0">
          <p className="font-semibold text-sm truncate">
            Você está no período gratuito
          </p>
          <p className="text-xs opacity-90">
            {daysLeft > 0
              ? `${daysLeft} ${daysLeft === 1 ? "dia restante" : "dias restantes"}`
              : "Termina hoje"}
          </p>
        </div>
      </div>
      <Button onClick={handleSubscribe} size="sm" variant="secondary" className="shrink-0">
        Assinar
      </Button>
    </div>
  );
};

export default TrialBanner;
