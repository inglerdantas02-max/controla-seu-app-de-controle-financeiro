import { AlertTriangle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getStripeEnvironment } from "@/lib/stripe";
import { toast } from "@/hooks/use-toast";

const PastDueBanner = () => {
  const [loading, setLoading] = useState(false);

  const openPortal = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          returnUrl: `${window.location.origin}/dashboard`,
          environment: getStripeEnvironment(),
        },
      });
      if (error || !data?.url) throw new Error(error?.message || "Falha ao abrir o portal");
      window.open(data.url, "_blank");
    } catch (e: any) {
      toast({ title: "Erro", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-warning/15 border border-warning/40 text-foreground rounded-2xl p-4 mb-6 flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <AlertTriangle className="w-5 h-5 shrink-0 text-warning" />
        <div className="min-w-0">
          <p className="font-semibold text-sm">Sua última cobrança falhou</p>
          <p className="text-xs text-muted-foreground">
            Atualize seu cartão pra não perder o acesso ao CONTROLA PRO.
          </p>
        </div>
      </div>
      <Button onClick={openPortal} size="sm" variant="default" className="shrink-0" disabled={loading}>
        {loading && <Loader2 className="w-4 h-4 animate-spin" />} Atualizar cartão
      </Button>
    </div>
  );
};

export default PastDueBanner;
