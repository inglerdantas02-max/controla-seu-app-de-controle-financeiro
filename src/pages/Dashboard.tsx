import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { Wallet, LogOut, Shield, MessageCircle, TrendingUp, TrendingDown, Inbox, Trash2 } from "lucide-react";
import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import ChatAssistant from "@/components/dashboard/ChatAssistant";
import { toast } from "@/hooks/use-toast";

interface Tx {
  id: string;
  type: string;
  amount: number;
  category: string | null;
  description: string | null;
  occurred_at: string;
}

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Dashboard = () => {
  const { user, isAdmin, loading } = useAuth();
  const [txs, setTxs] = useState<Tx[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [loadingTxs, setLoadingTxs] = useState(true);

  const loadTxs = useCallback(async () => {
    if (!user) return;
    const { data, error } = await supabase
      .from("transactions")
      .select("*")
      .eq("user_id", user.id)
      .order("occurred_at", { ascending: false });
    if (!error && data) setTxs(data as Tx[]);
    setLoadingTxs(false);
  }, [user]);

  useEffect(() => {
    loadTxs();
  }, [loadTxs]);

  // Realtime updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel(`tx-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter: `user_id=eq.${user.id}` }, () => loadTxs())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, loadTxs]);

  const deleteTx = async (id: string) => {
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;

  const now = new Date();
  const monthTxs = txs.filter((t) => {
    const d = new Date(t.occurred_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });
  const income = monthTxs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = monthTxs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const balance = txs.reduce((s, t) => s + (t.type === "income" ? Number(t.amount) : -Number(t.amount)), 0);

  return (
    <div className="min-h-screen bg-background pb-24">
      <nav className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
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

      <main className="container py-8">
        <h1 className="font-display text-3xl md:text-4xl font-bold mb-2">Olá! 👋</h1>
        <p className="text-muted-foreground mb-8">
          {txs.length === 0
            ? "Toque no botão abaixo e comece registrando seu primeiro gasto ou ganho."
            : "Aqui está o resumo das suas finanças."}
        </p>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-primary text-primary-foreground p-6 rounded-3xl shadow-glow">
            <p className="text-sm opacity-80 mb-1">Saldo atual</p>
            <p className="font-display text-3xl font-bold">{formatBRL(balance)}</p>
          </div>
          <div className="bg-card border border-border p-6 rounded-3xl">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-success" />
              <p className="text-sm text-muted-foreground">Entradas do mês</p>
            </div>
            <p className="font-display text-3xl font-bold text-success">{formatBRL(income)}</p>
          </div>
          <div className="bg-card border border-border p-6 rounded-3xl">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-danger" />
              <p className="text-sm text-muted-foreground">Saídas do mês</p>
            </div>
            <p className="font-display text-3xl font-bold text-danger">{formatBRL(expense)}</p>
          </div>
        </div>

        <section>
          <h2 className="font-display text-xl font-bold mb-4">Movimentações recentes</h2>
          {loadingTxs ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : txs.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-3xl p-10 text-center">
              <Inbox className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-semibold mb-1">Nenhuma movimentação ainda</p>
              <p className="text-sm text-muted-foreground mb-4">
                Comece registrando um gasto ou ganho com o assistente.
              </p>
              <Button variant="hero" onClick={() => setChatOpen(true)}>
                <MessageCircle className="w-4 h-4" /> Abrir assistente
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {txs.slice(0, 20).map((t) => (
                <li
                  key={t.id}
                  className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between gap-3 animate-fade-in"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        t.type === "income" ? "bg-success/15 text-success" : "bg-danger/15 text-danger"
                      }`}
                    >
                      {t.type === "income" ? <TrendingUp className="w-5 h-5" /> : <TrendingDown className="w-5 h-5" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{t.description || t.category || (t.type === "income" ? "Entrada" : "Saída")}</p>
                      <p className="text-xs text-muted-foreground">
                        {t.category && <span>{t.category} • </span>}
                        {new Date(t.occurred_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <p className={`font-display font-bold ${t.type === "income" ? "text-success" : "text-danger"}`}>
                      {t.type === "income" ? "+" : "-"}{formatBRL(Number(t.amount))}
                    </p>
                    <Button size="icon" variant="ghost" onClick={() => deleteTx(t.id)} className="h-8 w-8 text-muted-foreground hover:text-danger">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Floating button */}
      <button
        onClick={() => setChatOpen(true)}
        aria-label="Abrir assistente"
        className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-gradient-primary text-primary-foreground shadow-glow flex items-center justify-center hover:scale-110 transition-transform animate-pulse-glow"
      >
        <MessageCircle className="w-7 h-7" />
        <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping -z-10" />
      </button>

      <ChatAssistant open={chatOpen} onOpenChange={setChatOpen} onTransactionSaved={loadTxs} />
    </div>
  );
};

export default Dashboard;
