import { Button } from "@/components/ui/button";
import { Check, LogOut } from "lucide-react";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useCheckout } from "@/hooks/useCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

const Paywall = () => {
  const { openCheckout } = useCheckout();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    window.location.href = "/auth";
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex flex-col">
      <PaymentTestModeBanner />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="flex items-center justify-center gap-2 mb-8">
            <img src={logo} alt="CONTROLA" className="w-10 h-10 rounded-xl shadow-glow" />
            <span className="font-display font-bold text-2xl">CONTROLA</span>
          </div>

          <div className="bg-card border border-border rounded-3xl p-8 shadow-soft text-center">
            <div className="text-5xl mb-4">⏰</div>
            <h1 className="font-display text-2xl font-bold mb-2">
              Seu período de teste terminou
            </h1>
            <p className="text-muted-foreground text-sm mb-6">
              Para continuar usando o CONTROLA e manter o controle das suas finanças,
              assine por apenas R$19,90/mês.
            </p>

            <div className="bg-gradient-primary text-primary-foreground rounded-2xl p-6 mb-6">
              <p className="text-sm opacity-90">CONTROLA PRO</p>
              <p className="font-display text-4xl font-bold mb-1">R$19,90</p>
              <p className="text-xs opacity-80">por mês</p>
            </div>

            <ul className="text-left space-y-2 mb-6 text-sm">
              {[
                "Acesso completo ao app",
                "Assistente com IA",
                "Relatórios financeiros",
                "Movimentações ilimitadas",
              ].map((b) => (
                <li key={b} className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-success shrink-0" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            <Button onClick={openCheckout} variant="hero" size="lg" className="w-full mb-3">
              Assinar agora
            </Button>
            <Button onClick={handleSignOut} variant="ghost" size="sm" className="w-full">
              <LogOut className="w-4 h-4" /> Sair
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Paywall;
