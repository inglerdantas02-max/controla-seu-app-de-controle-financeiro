import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { CheckoutDialog } from "@/components/CheckoutDialog";

interface Props {
  daysLeft: number;
}

const TrialBanner = ({ daysLeft }: Props) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <>
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
        <Button onClick={() => setOpen(true)} size="sm" variant="secondary" className="shrink-0">
          Assinar
        </Button>
      </div>

      <CheckoutDialog
        open={open}
        onOpenChange={setOpen}
        priceId="controla_pro_monthly"
        customerEmail={user?.email}
        userId={user?.id}
      />
    </>
  );
};

export default TrialBanner;
