import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { Wallet, LogOut, Shield } from "lucide-react";

const Dashboard = () => {
  const { user, isAdmin, loading } = useAuth();
  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-primary flex items-center justify-center shadow-glow">
              <Wallet className="w-5 h-5 text-primary-foreground" />
            </div>
            <span className="font-display font-bold text-xl">CONTROLA</span>
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin"><Shield className="w-4 h-4" /> Admin</Link>
              </Button>
            )}
            <Button onClick={() => signOut()} variant="ghost" size="sm">
              <LogOut className="w-4 h-4" /> Sair
            </Button>
          </div>
        </div>
      </nav>
      <main className="container py-12">
        <h1 className="font-display text-4xl font-bold mb-2">Olá! 👋</h1>
        <p className="text-muted-foreground mb-8">
          Seu dashboard completo virá nos próximos passos. Por enquanto, sua conta está pronta.
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-gradient-primary text-primary-foreground p-6 rounded-3xl shadow-glow">
            <p className="text-sm opacity-80 mb-1">Saldo atual</p>
            <p className="font-display text-3xl font-bold">R$ 0,00</p>
          </div>
          <div className="bg-card border border-border p-6 rounded-3xl">
            <p className="text-sm text-muted-foreground mb-1">Entradas do mês</p>
            <p className="font-display text-3xl font-bold text-success">R$ 0,00</p>
          </div>
          <div className="bg-card border border-border p-6 rounded-3xl">
            <p className="text-sm text-muted-foreground mb-1">Saídas do mês</p>
            <p className="font-display text-3xl font-bold text-danger">R$ 0,00</p>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
