import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings, Shield, MessageCircle, TrendingUp, TrendingDown, Inbox, Trash2, FileText, CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import ChatAssistant from "@/components/dashboard/ChatAssistant";
import SettingsDialog from "@/components/dashboard/SettingsDialog";
import ReportDialog from "@/components/dashboard/ReportDialog";
import TrialBanner from "@/components/dashboard/TrialBanner";
import Paywall from "@/pages/Paywall";
import { useSubscription } from "@/hooks/useSubscription";
import { useCheckout } from "@/hooks/useCheckout";
import PastDueBanner from "@/components/dashboard/PastDueBanner";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Tx {
  id: string;
  type: string;
  amount: number;
  category: string | null;
  description: string | null;
  occurred_at: string;
}

type Period = "today" | "week" | "month" | "all" | "custom";

const formatBRL = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const Dashboard = () => {
  const { user, isAdmin, loading } = useAuth();
  const { status: subStatus, daysLeft, isBlocked, loading: subLoading, refresh: refreshSub } = useSubscription();
  const { openCheckout } = useCheckout();

  // Handle checkout intents from URL: ?checkout=success (after payment) or ?checkout=open (from landing)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ck = params.get("checkout");
    if (ck === "success") {
      toast({ title: "Pagamento recebido!", description: "Liberando o acesso PRO..." });
      let tries = 0;
      const t = setInterval(async () => {
        tries++;
        await refreshSub();
        if (tries >= 6) clearInterval(t);
      }, 2000);
      window.history.replaceState({}, "", window.location.pathname);
      return () => clearInterval(t);
    }
    if (ck === "open") {
      window.history.replaceState({}, "", window.location.pathname);
      openCheckout();
    }
  }, [refreshSub, openCheckout]);
  const [txs, setTxs] = useState<Tx[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [loadingTxs, setLoadingTxs] = useState(true);
  const [period, setPeriod] = useState<Period>("today");
  const [customDate, setCustomDate] = useState<Date | undefined>(undefined);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [fullName, setFullName] = useState<string>("");
  const [initialBalance, setInitialBalance] = useState<number>(0);
  const [hasInitialBalanceSet, setHasInitialBalanceSet] = useState<boolean>(true);
  const [balanceDialogOpen, setBalanceDialogOpen] = useState(false);
  const [balanceInput, setBalanceInput] = useState<string>("");
  const [savingBalance, setSavingBalance] = useState(false);
  const [insight, setInsight] = useState<string | null>(null);
  const [insightSeen, setInsightSeen] = useState<boolean>(false);
  const [pendingInsightForChat, setPendingInsightForChat] = useState<string | null>(null);

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

  useEffect(() => {
    if (!user) return;
    supabase
      .from("profiles")
      .select("full_name, initial_balance")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        setFullName(data?.full_name ?? "");
        const ib = data?.initial_balance != null ? Number(data.initial_balance) : 0;
        setInitialBalance(ib);
        // Considera "definido" se já tem valor != 0 OU se já temos transações (ver outro effect)
        if (ib !== 0) setHasInitialBalanceSet(true);
        else setHasInitialBalanceSet(false);
      });
  }, [user, settingsOpen, balanceDialogOpen]);

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

  // Buscar insight automático (1x ao montar e quando txs mudam significativamente)
  const fetchInsight = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.functions.invoke("generate-insights", { body: {} });
      const text: string | null = data?.insight?.text ?? null;
      setInsight((prev) => {
        if (text !== prev) setInsightSeen(false);
        return text;
      });
    } catch (e) {
      // silencioso
    }
  }, [user]);

  useEffect(() => {
    if (!loadingTxs) fetchInsight();
  }, [loadingTxs, txs.length, fetchInsight]);

  const openChatWithInsight = () => {
    if (insight && !insightSeen) {
      setPendingInsightForChat(insight);
      setInsightSeen(true);
    } else {
      setPendingInsightForChat(null);
    }
    setChatOpen(true);
  };

  const deleteTx = async (id: string) => {
    setTxs((prev) => prev.filter((t) => t.id !== id));
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      loadTxs();
    } else {
      toast({ title: "Movimentação excluída" });
    }
  };

  const { filteredTxs, periodLabel } = useMemo(() => {
    const now = new Date();
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    let label = "Todo período";
    if (period === "today") {
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      label = "Hoje";
    } else if (period === "week") {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
      label = "Últimos 7 dias";
    } else if (period === "month") {
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      label = "Este mês";
    } else if (period === "custom" && customDate) {
      startDate = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate());
      endDate = new Date(customDate.getFullYear(), customDate.getMonth(), customDate.getDate(), 23, 59, 59, 999);
      label = format(customDate, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    }
    const filtered = txs.filter((t) => {
      const d = new Date(t.occurred_at);
      if (startDate && d < startDate) return false;
      if (endDate && d > endDate) return false;
      return true;
    });
    return { filteredTxs: filtered, periodLabel: label };
  }, [txs, period, customDate]);

  const totalBalance = useMemo(
    () =>
      txs.reduce(
        (s, t) => s + (t.type === "income" ? Number(t.amount) : -Number(t.amount)),
        0,
      ),
    [txs],
  );

  if (loading || subLoading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isBlocked) return <Paywall />;

  const income = filteredTxs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = filteredTxs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  const firstName = (fullName || user.email?.split("@")[0] || "").trim().split(" ")[0];
  const capitalized = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : "";

  return (
    <div className="min-h-screen bg-background pb-24">
      <nav className="border-b border-border bg-background/80 backdrop-blur sticky top-0 z-30">
        <div className="container flex items-center justify-between h-16">
          <Link to="/" className="flex items-center gap-2">
            <img src={logo} alt="CONTROLA" className="w-9 h-9 rounded-xl shadow-glow" />
            <span className="font-display font-bold text-xl">CONTROLA</span>
          </Link>
          <div className="flex items-center gap-2">
            {isAdmin && (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin"><Shield className="w-4 h-4" /> Admin</Link>
              </Button>
            )}
            <Button onClick={() => setSettingsOpen(true)} variant="ghost" size="icon" aria-label="Configurações">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </nav>

      <main className="container py-8">
        {!isAdmin && subStatus === "trial" && <TrialBanner daysLeft={daysLeft} />}
        {!isAdmin && subStatus === "past_due" && <PastDueBanner />}
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-bold mb-1">
              Olá{capitalized ? `, ${capitalized}` : ""} 👋
            </h1>
            <p className="text-muted-foreground text-sm">
              {filteredTxs.length === 0
                ? "Toque no botão abaixo e comece registrando seu primeiro gasto ou ganho."
                : `Resumo • ${periodLabel.toLowerCase()}`}
            </p>
          </div>
          <Button onClick={() => setReportOpen(true)} variant="outline" size="sm" className="self-start sm:self-auto">
            <FileText className="w-4 h-4" /> Gerar relatório
          </Button>
        </div>

        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <Tabs value={period === "custom" ? "" : period} onValueChange={(v) => setPeriod(v as Period)}>
            <TabsList className="grid grid-cols-4 w-full max-w-md">
              <TabsTrigger value="today">Hoje</TabsTrigger>
              <TabsTrigger value="week">Semana</TabsTrigger>
              <TabsTrigger value="month">Mês</TabsTrigger>
              <TabsTrigger value="all">Tudo</TabsTrigger>
            </TabsList>
          </Tabs>
          <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={period === "custom" ? "default" : "outline"}
                size="sm"
                className={cn("h-10 gap-2", period === "custom" && "bg-gradient-primary text-primary-foreground")}
              >
                <CalendarIcon className="w-4 h-4" />
                {period === "custom" && customDate
                  ? format(customDate, "dd/MM/yyyy")
                  : "Escolher dia"}
              </Button>
            </PopoverTrigger>
            <PopoverContent
              className="w-auto p-0 max-w-[calc(100vw-2rem)]"
              align="center"
              side="bottom"
              sideOffset={8}
              collisionPadding={16}
            >
              <Calendar
                mode="single"
                selected={customDate}
                onSelect={(d) => {
                  if (d) {
                    setCustomDate(d);
                    setPeriod("custom");
                    setDatePopoverOpen(false);
                  }
                }}
                disabled={(date) => date > new Date()}
                initialFocus
                locale={ptBR}
                className={cn("p-3 pointer-events-auto")}
              />
            </PopoverContent>
          </Popover>
        </div>

        <div className="grid md:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-primary text-primary-foreground p-6 rounded-3xl shadow-glow">
            <p className="text-sm opacity-80 mb-1">Saldo atual</p>
            <p className="font-display text-3xl font-bold">{formatBRL(totalBalance)}</p>
          </div>
          <div className="bg-card border border-border p-6 rounded-3xl">
            <div className="flex items-center gap-2 mb-1">
              <TrendingUp className="w-4 h-4 text-success" />
              <p className="text-sm text-muted-foreground">Entradas</p>
            </div>
            <p className="font-display text-3xl font-bold text-success">{formatBRL(income)}</p>
          </div>
          <div className="bg-card border border-border p-6 rounded-3xl">
            <div className="flex items-center gap-2 mb-1">
              <TrendingDown className="w-4 h-4 text-danger" />
              <p className="text-sm text-muted-foreground">Saídas</p>
            </div>
            <p className="font-display text-3xl font-bold text-danger">{formatBRL(expense)}</p>
          </div>
        </div>

        <section>
          <h2 className="font-display text-xl font-bold mb-4">Movimentações recentes</h2>
          {loadingTxs ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : filteredTxs.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-3xl p-10 text-center">
              <Inbox className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-semibold mb-1">Nenhuma movimentação no período</p>
              <p className="text-sm text-muted-foreground mb-4">
                Comece registrando um gasto ou ganho com o assistente.
              </p>
              <Button variant="hero" onClick={openChatWithInsight}>
                <MessageCircle className="w-4 h-4" /> Abrir assistente
              </Button>
            </div>
          ) : (
            <ul className="space-y-2">
              {filteredTxs.slice(0, 20).map((t) => (
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
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:text-danger">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Excluir movimentação?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta ação não pode ser desfeita. A movimentação será removida permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction onClick={() => deleteTx(t.id)}>Excluir</AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <button
        onClick={openChatWithInsight}
        aria-label={insight && !insightSeen ? "Novo insight do assistente" : "Abrir assistente"}
        className="fixed bottom-6 right-6 z-40 w-16 h-16 rounded-full bg-gradient-primary text-primary-foreground shadow-glow flex items-center justify-center hover:scale-110 transition-transform animate-pulse-glow"
      >
        <MessageCircle className="w-7 h-7" />
        <span className="absolute inset-0 rounded-full bg-primary/40 animate-ping -z-10" />
        {insight && !insightSeen && (
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1.5 rounded-full bg-danger text-danger-foreground text-[11px] font-bold flex items-center justify-center border-2 border-background shadow-lg animate-bounce">
            1
          </span>
        )}
      </button>

      <ChatAssistant
        open={chatOpen}
        onOpenChange={(o) => { setChatOpen(o); if (!o) setPendingInsightForChat(null); }}
        onTransactionSaved={loadTxs}
        initialAssistantMessage={pendingInsightForChat}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} txs={filteredTxs} periodLabel={periodLabel} />
    </div>
  );
};

export default Dashboard;
