import { useAuth } from "@/hooks/useAuth";
import { Navigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings, Shield, MessageCircle, TrendingUp, TrendingDown, Inbox, Trash2, FileText, CalendarIcon, Pencil, Eye, EyeOff } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import TrialBanner from "@/components/dashboard/TrialBanner";
import Paywall from "@/pages/Paywall";
import { useSubscription } from "@/hooks/useSubscription";
import { useCheckout } from "@/hooks/useCheckout";
import PastDueBanner from "@/components/dashboard/PastDueBanner";
import { toast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
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
  const [balanceHidden, setBalanceHidden] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem("balanceHidden") === "1";
  });
  const [insight, setInsight] = useState<string | null>(null);
  const [insightSeen, setInsightSeen] = useState<boolean>(false);
  const [pendingInsightForChat, setPendingInsightForChat] = useState<string | null>(null);
  const [pendingChatPrompt, setPendingChatPrompt] = useState<string | null>(null);
  const [coachInsights, setCoachInsights] = useState<Array<{ id: string; text: string; tone: "danger" | "warning" | "success" | "info"; action?: string }>>([]);

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
      setCoachInsights(Array.isArray(data?.insights) ? data.insights : []);
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
    setPendingChatPrompt(null);
    setChatOpen(true);
  };

  const openChatWith = (prompt: string) => {
    setPendingInsightForChat(null);
    setPendingChatPrompt(prompt);
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
      initialBalance +
      txs.reduce(
        (s, t) => s + (t.type === "income" ? Number(t.amount) : -Number(t.amount)),
        0,
      ),
    [txs, initialBalance],
  );

  // Onboarding: ao primeiro acesso (sem saldo definido E sem transações), abrir dialog
  useEffect(() => {
    if (loadingTxs) return;
    if (!hasInitialBalanceSet && txs.length === 0 && !balanceDialogOpen) {
      setBalanceInput("");
      setBalanceDialogOpen(true);
    }
  }, [loadingTxs, hasInitialBalanceSet, txs.length, balanceDialogOpen]);

  const saveInitialBalance = async () => {
    if (!user) return;
    const normalized = balanceInput.replace(/\./g, "").replace(",", ".");
    const value = Number(normalized);
    if (Number.isNaN(value)) {
      toast({ title: "Valor inválido", description: "Informe um número válido.", variant: "destructive" });
      return;
    }
    const newBalance = hasInitialBalanceSet ? initialBalance + value : value;
    if (newBalance < 0) {
      toast({ title: "Valor inválido", description: "O saldo total não pode ficar negativo.", variant: "destructive" });
      return;
    }
    setSavingBalance(true);
    const { error } = await supabase
      .from("profiles")
      .update({ initial_balance: newBalance })
      .eq("id", user.id);
    setSavingBalance(false);
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setInitialBalance(newBalance);
    setHasInitialBalanceSet(true);
    setBalanceDialogOpen(false);
    toast({ title: "Saldo atualizado", description: "Seu saldo atual foi atualizado." });
  };

  if (loading || subLoading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (isBlocked) return <Paywall />;

  const income = filteredTxs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const expense = filteredTxs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  const firstName = (fullName || user.email?.split("@")[0] || "").trim().split(" ")[0];
  const capitalized = firstName ? firstName.charAt(0).toUpperCase() + firstName.slice(1) : "";

  // === Inteligência: insights e comparação dia atual vs ontem (apenas dados locais) ===
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart); yesterdayStart.setDate(todayStart.getDate() - 1);

  const todayTxs = txs.filter((t) => new Date(t.occurred_at) >= todayStart);
  const yesterdayTxs = txs.filter((t) => {
    const d = new Date(t.occurred_at);
    return d >= yesterdayStart && d < todayStart;
  });

  const todayIncome = todayTxs.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const todayExpense = todayTxs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);
  const yesterdayExpense = yesterdayTxs.filter((t) => t.type === "expense").reduce((s, t) => s + Number(t.amount), 0);

  // Maior categoria de gasto do dia
  const todayExpenseByCat = todayTxs
    .filter((t) => t.type === "expense")
    .reduce<Record<string, number>>((acc, t) => {
      const k = (t.category || "Outros").toString();
      acc[k] = (acc[k] || 0) + Number(t.amount);
      return acc;
    }, {});
  const topCategory = Object.entries(todayExpenseByCat).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;

  // Mensagem dinâmica do topo
  const headerMessage =
    todayTxs.length === 0
      ? `${capitalized || "Olá"}, você ainda não registrou nada hoje 👀\nFale comigo e comece agora 👇`
      : `Boa, ${capitalized || "tudo certo"}! Você já registrou ${todayTxs.length} ${todayTxs.length === 1 ? "movimentação" : "movimentações"} hoje 🔥`;

  // Insights automáticos (frases curtas)
  const localInsights: string[] = [];
  if (todayTxs.length === 0) {
    localInsights.push("Seu dia ainda está sem movimentações.");
  } else {
    if (todayExpense > 0) localInsights.push(`Hoje você gastou ${formatBRL(todayExpense)}.`);
    if (topCategory && todayExpense > 0) localInsights.push(`Seu maior gasto foi com ${topCategory}.`);
    if (todayIncome > 0) localInsights.push(`Você recebeu ${formatBRL(todayIncome)} hoje.`);
  }

  // Comparação com ontem (apenas se houver dado de ontem)
  let comparison: { text: string; tone: "good" | "bad" | "neutral" } | null = null;
  if (yesterdayExpense > 0 && (todayExpense > 0 || todayTxs.length > 0)) {
    if (todayExpense > yesterdayExpense) {
      const pct = Math.round(((todayExpense - yesterdayExpense) / yesterdayExpense) * 100);
      comparison = { text: `Seu gasto aumentou ${pct}% em relação a ontem.`, tone: "bad" };
    } else if (todayExpense < yesterdayExpense) {
      const saved = yesterdayExpense - todayExpense;
      comparison = { text: `Boa! Hoje você economizou ${formatBRL(saved)} em relação a ontem.`, tone: "good" };
    } else {
      comparison = { text: "Você gastou o mesmo valor de ontem.", tone: "neutral" };
    }
  }


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
            <p className="text-muted-foreground text-sm whitespace-pre-line">
              {headerMessage}
            </p>
            {filteredTxs.length > 0 && (
              <p className="text-muted-foreground/80 text-xs mt-1">
                Resumo • {periodLabel.toLowerCase()}
              </p>
            )}
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
          <div className="bg-gradient-primary text-primary-foreground p-6 rounded-3xl shadow-glow relative">
            <div className="absolute top-4 right-4 flex items-center gap-1">
              <button
                type="button"
                onClick={() => {
                  setBalanceHidden((prev) => {
                    const next = !prev;
                    try {
                      window.localStorage.setItem("balanceHidden", next ? "1" : "0");
                    } catch {}
                    return next;
                  });
                }}
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                aria-label={balanceHidden ? "Mostrar saldo" : "Ocultar saldo"}
              >
                {balanceHidden ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => {
                  setBalanceInput("");
                  setBalanceDialogOpen(true);
                }}
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                aria-label="Editar saldo atual"
              >
                <Pencil className="w-4 h-4" />
              </button>
            </div>
            <p className="text-sm opacity-80 mb-1">Saldo atual</p>
            <p className="font-display text-3xl font-bold tracking-wider">
              {balanceHidden ? "R$ ••••••" : formatBRL(totalBalance)}
            </p>
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

        {/* Coach financeiro: insights inteligentes do dia */}
        {(coachInsights.length > 0 || localInsights.length > 0 || comparison) && (
          <div className="mb-8 bg-card border border-border rounded-3xl p-5 animate-fade-in">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-2 h-2 rounded-full bg-gradient-primary animate-pulse" />
              <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                Coach financeiro
              </p>
            </div>

            {/* Insights inteligentes do servidor (com ação clicável) */}
            {coachInsights.length > 0 && (
              <ul className="space-y-2 mb-3">
                {coachInsights.slice(0, 3).map((ci) => (
                  <li
                    key={ci.id}
                    className={cn(
                      "rounded-2xl p-3 border text-sm",
                      ci.tone === "danger" && "bg-danger/10 border-danger/30 text-foreground",
                      ci.tone === "warning" && "bg-yellow-500/10 border-yellow-500/30 text-foreground",
                      ci.tone === "success" && "bg-success/10 border-success/30 text-foreground",
                      ci.tone === "info" && "bg-muted border-border text-foreground/90",
                    )}
                  >
                    <p className="leading-snug whitespace-pre-line">{ci.text}</p>
                    {ci.action && (
                      <button
                        type="button"
                        onClick={() => openChatWith(ci.action!)}
                        className="mt-2 text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                      >
                        <MessageCircle className="w-3 h-3" /> {ci.action}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {/* Resumo local rápido (já calculado no client) */}
            {(localInsights.length > 0 || comparison) && (
              <ul className="space-y-1.5">
                {localInsights.map((line, i) => (
                  <li key={i} className="text-sm text-foreground/90">• {line}</li>
                ))}
                {comparison && (
                  <li
                    className={cn(
                      "text-sm font-medium mt-2",
                      comparison.tone === "good" && "text-success",
                      comparison.tone === "bad" && "text-danger",
                      comparison.tone === "neutral" && "text-muted-foreground",
                    )}
                  >
                    {comparison.tone === "good" ? "📉 " : comparison.tone === "bad" ? "📈 " : "➖ "}
                    {comparison.text}
                  </li>
                )}
              </ul>
            )}

            {/* CTAs sugeridos */}
            <div className="flex flex-wrap gap-2 mt-3">
              <button
                type="button"
                onClick={() => openChatWith("Me mostra o resumo de hoje")}
                className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 transition-colors"
              >
                📊 Resumo de hoje
              </button>
              <button
                type="button"
                onClick={() => openChatWith("Como tá indo minha semana?")}
                className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 transition-colors"
              >
                📅 Minha semana
              </button>
              <button
                type="button"
                onClick={() => openChatWith("Quanto sobrou pra mim esse mês?")}
                className="text-xs px-3 py-1.5 rounded-full bg-muted hover:bg-muted/70 transition-colors"
              >
                💰 Saldo do mês
              </button>
            </div>
          </div>
        )}

        <section>

          <h2 className="font-display text-xl font-bold mb-4">Movimentações recentes</h2>
          {loadingTxs ? (
            <p className="text-muted-foreground text-sm">Carregando...</p>
          ) : filteredTxs.length === 0 ? (
            <div className="bg-card border border-dashed border-border rounded-3xl p-10 text-center">
              <Inbox className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-semibold mb-1">Tudo vazio por aqui 👀</p>
              <p className="text-sm text-muted-foreground mb-4">
                Que tal registrar seu primeiro gasto agora? Fale comigo ou digite para registrar 👇
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

      <Tooltip>
        <TooltipTrigger asChild>
          <button
            onClick={openChatWithInsight}
            aria-label={insight && !insightSeen ? "Novo insight do assistente" : "Registrar gasto ou entrada"}
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
        </TooltipTrigger>
        <TooltipContent side="left" sideOffset={8}>
          Registrar gasto ou entrada
        </TooltipContent>
      </Tooltip>

      <ChatAssistant
        open={chatOpen}
        onOpenChange={(o) => {
          setChatOpen(o);
          if (!o) {
            setPendingInsightForChat(null);
            setPendingChatPrompt(null);
          }
        }}
        onTransactionSaved={loadTxs}
        initialAssistantMessage={pendingInsightForChat}
        pendingPrompt={pendingChatPrompt}
      />
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <ReportDialog open={reportOpen} onOpenChange={setReportOpen} txs={filteredTxs} periodLabel={periodLabel} />

      <Dialog open={balanceDialogOpen} onOpenChange={setBalanceDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {hasInitialBalanceSet ? "Adicionar ao saldo atual" : "Bem-vindo! Qual é o seu saldo atual?"}
            </DialogTitle>
            <DialogDescription>
              {hasInitialBalanceSet
                ? `Seu saldo manual atual é ${formatBRL(initialBalance)}. O valor informado abaixo será somado a ele (use valor negativo para subtrair). Isso não cria entrada no histórico.`
                : "Informe quanto você já tem em conta. Isso será seu ponto de partida e não conta como entrada."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="initial-balance">{hasInitialBalanceSet ? "Valor a somar (R$)" : "Saldo (R$)"}</Label>
            <Input
              id="initial-balance"
              inputMode="decimal"
              placeholder="0,00"
              value={balanceInput}
              onChange={(e) => setBalanceInput(e.target.value)}
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2">
            {hasInitialBalanceSet && (
              <Button variant="outline" onClick={() => setBalanceDialogOpen(false)}>
                Cancelar
              </Button>
            )}
            <Button
              variant="hero"
              onClick={saveInitialBalance}
              disabled={savingBalance || balanceInput.trim() === ""}
            >
              {savingBalance ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Dashboard;
