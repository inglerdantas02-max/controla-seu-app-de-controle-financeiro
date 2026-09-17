import { Navigate, Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { Button } from "@/components/ui/button";
import BillsManager from "@/components/bills/BillsManager";
import Paywall from "@/pages/Paywall";
import logo from "@/assets/logo.png";

export default function Bills() {
  const { user, loading: authLoading } = useAuth();
  const { isBlocked, loading: subLoading } = useSubscription();
  if (authLoading || subLoading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isBlocked) return <Paywall />;

  return (
    <div className="min-h-screen bg-background pb-16">
      <nav className="border-b border-border bg-background/90 backdrop-blur sticky top-0 z-30">
        <div className="container h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="icon"><Link to="/dashboard" aria-label="Voltar ao painel"><ArrowLeft className="w-5 h-5" /></Link></Button>
            <Link to="/dashboard" className="flex items-center gap-2"><img src={logo} alt="CONTROLA" className="w-8 h-8 rounded-lg" /><span className="font-display font-bold">CONTROLA</span></Link>
          </div>
        </div>
      </nav>

      <main className="container py-7 max-w-6xl">
        <BillsManager />
      </main>
    </div>
  );
}
