import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useSubscription } from "@/hooks/useSubscription";
import { useCheckout } from "@/hooks/useCheckout";
import { signOut } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { LogOut, Plus, Trash2, Loader2, ExternalLink, Sparkles } from "lucide-react";
import { getStripeEnvironment } from "@/lib/stripe";

interface FixedExpense {
  id: string;
  name: string;
  amount: number;
  day_of_month: number;
  category: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

const SettingsDialog = ({ open, onOpenChange }: Props) => {
  const { user } = useAuth();
  const { status, currentPeriodEnd, cancelAtPeriodEnd, hasSubscription, daysLeft, trialEndDate } = useSubscription();
  const { openCheckout } = useCheckout();

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [exName, setExName] = useState("");
  const [exAmount, setExAmount] = useState("");
  const [exDay, setExDay] = useState("");

  const [portalLoading, setPortalLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  useEffect(() => {
    if (!open || !user) return;
    supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle().then(({ data }) => {
      setFullName(data?.full_name ?? "");
      setEmail(data?.email ?? user.email ?? "");
    });
    supabase.from("fixed_expenses").select("*").eq("user_id", user.id).order("day_of_month").then(({ data }) => {
      setExpenses((data as FixedExpense[]) ?? []);
    });
  }, [open, user]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error: pErr } = await supabase.from("profiles").update({ full_name: fullName }).eq("id", user.id);
    let emailErr: string | null = null;
    if (email && email !== user.email) {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) emailErr = error.message;
    }
    setSavingProfile(false);
    if (pErr || emailErr) {
      toast({ title: "Erro", description: pErr?.message || emailErr || "", variant: "destructive" });
    } else {
      toast({ title: "Perfil atualizado" });
    }
  };

  const savePassword = async () => {
    if (newPassword.length < 6) {
      toast({ title: "Senha muito curta", description: "Mínimo 6 caracteres", variant: "destructive" });
      return;
    }
    setSavingPassword(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPassword(false);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Senha alterada" });
      setNewPassword("");
    }
  };

  const addExpense = async () => {
    if (!user) return;
    const amt = parseFloat(exAmount.replace(",", "."));
    const day = parseInt(exDay);
    if (!exName || !amt || !day || day < 1 || day > 31) {
      toast({ title: "Dados inválidos", variant: "destructive" });
      return;
    }
    const { data, error } = await supabase
      .from("fixed_expenses")
      .insert({ user_id: user.id, name: exName, amount: amt, day_of_month: day })
      .select()
      .single();
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      return;
    }
    setExpenses((p) => [...p, data as FixedExpense]);
    setExName(""); setExAmount(""); setExDay("");
  };

  const removeExpense = async (id: string) => {
    const { error } = await supabase.from("fixed_expenses").delete().eq("id", id);
    if (error) toast({ title: "Erro", description: error.message, variant: "destructive" });
    else setExpenses((p) => p.filter((e) => e.id !== id));
  };

  const openPortal = async () => {
    setPortalLoading(true);
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
      setPortalLoading(false);
    }
  };

  const deleteAccount = async () => {
    setDeleteLoading(true);
    const { error } = await supabase.rpc("delete_my_account");
    if (error) {
      toast({ title: "Erro", description: error.message, variant: "destructive" });
      setDeleteLoading(false);
      return;
    }
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const formatDate = (d: Date | null) =>
    d ? d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" }) : "—";

  const statusBadge = () => {
    if (status === "active") {
      return <span className="inline-flex items-center gap-1 text-xs font-medium bg-success/15 text-success px-2 py-1 rounded-full">CONTROLA PRO</span>;
    }
    if (status === "trial") {
      return <span className="inline-flex items-center gap-1 text-xs font-medium bg-primary/15 text-primary px-2 py-1 rounded-full">Trial • {daysLeft}d restantes</span>;
    }
    if (status === "past_due") {
      return <span className="inline-flex items-center gap-1 text-xs font-medium bg-warning/20 text-warning-foreground px-2 py-1 rounded-full">Pagamento pendente</span>;
    }
    return <span className="inline-flex items-center gap-1 text-xs font-medium bg-muted text-muted-foreground px-2 py-1 rounded-full">Sem plano ativo</span>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">Configurações</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="profile" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-4">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="plan">Plano</TabsTrigger>
            <TabsTrigger value="password">Senha</TabsTrigger>
            <TabsTrigger value="fixed">Fixas</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Nome completo</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <p className="text-xs text-muted-foreground">Alterar email exigirá confirmação.</p>
            </div>
            <Button onClick={saveProfile} disabled={savingProfile} variant="hero" className="w-full">
              {savingProfile && <Loader2 className="w-4 h-4 animate-spin" />} Salvar perfil
            </Button>
            <Button onClick={() => signOut()} variant="outline" className="w-full">
              <LogOut className="w-4 h-4" /> Sair da conta
            </Button>

            <div className="pt-4 border-t border-border">
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="w-full text-danger hover:text-danger hover:bg-danger/10">
                    <Trash2 className="w-4 h-4" /> Excluir minha conta
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Excluir sua conta?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Todos os seus dados (movimentações, despesas fixas, perfil e assinatura)
                      serão removidos permanentemente. Esta ação não pode ser desfeita.
                      {hasSubscription && status === "active" && (
                        <span className="block mt-2 font-medium text-foreground">
                          Cancele sua assinatura no portal antes pra evitar próximas cobranças.
                        </span>
                      )}
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction onClick={deleteAccount} disabled={deleteLoading} className="bg-danger hover:bg-danger/90">
                      {deleteLoading && <Loader2 className="w-4 h-4 animate-spin" />} Sim, excluir
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </TabsContent>

          <TabsContent value="plan" className="space-y-4 overflow-y-auto pr-1">
            <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted-foreground">Plano atual</p>
                {statusBadge()}
              </div>

              {status === "active" && currentPeriodEnd && (
                <div>
                  <p className="text-xs text-muted-foreground">
                    {cancelAtPeriodEnd ? "Acesso até" : "Próxima cobrança"}
                  </p>
                  <p className="font-semibold">{formatDate(currentPeriodEnd)}</p>
                  {cancelAtPeriodEnd && (
                    <p className="text-xs text-warning-foreground mt-1">
                      Sua assinatura será encerrada nesta data.
                    </p>
                  )}
                </div>
              )}

              {status === "trial" && trialEndDate && (
                <div>
                  <p className="text-xs text-muted-foreground">Seu teste termina em</p>
                  <p className="font-semibold">{formatDate(trialEndDate)}</p>
                </div>
              )}

              {status === "past_due" && (
                <p className="text-sm">
                  A última cobrança falhou. Atualize seu cartão pra não perder o acesso.
                </p>
              )}
            </div>

            {(status === "trial" || status === "expired" || !hasSubscription) && (
              <Button onClick={openCheckout} variant="hero" className="w-full">
                <Sparkles className="w-4 h-4" /> Assinar CONTROLA PRO
              </Button>
            )}

            {hasSubscription && (
              <Button onClick={openPortal} disabled={portalLoading} variant="outline" className="w-full">
                {portalLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ExternalLink className="w-4 h-4" />}
                Gerenciar assinatura e cobrança
              </Button>
            )}

            <p className="text-xs text-muted-foreground text-center">
              No portal você pode atualizar o cartão, ver faturas e cancelar a qualquer momento.
            </p>
          </TabsContent>

          <TabsContent value="password" className="space-y-4 overflow-y-auto pr-1">
            <div className="space-y-2">
              <Label>Nova senha</Label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Mínimo 6 caracteres"
              />
            </div>
            <Button onClick={savePassword} disabled={savingPassword} variant="hero" className="w-full">
              {savingPassword && <Loader2 className="w-4 h-4 animate-spin" />} Alterar senha
            </Button>
          </TabsContent>

          <TabsContent value="fixed" className="space-y-3 overflow-y-auto pr-1">
            <div className="grid grid-cols-2 gap-2">
              <Input placeholder="Nome (Aluguel)" value={exName} onChange={(e) => setExName(e.target.value)} className="col-span-2" />
              <Input placeholder="Valor" value={exAmount} onChange={(e) => setExAmount(e.target.value)} />
              <Input placeholder="Dia (1-31)" value={exDay} onChange={(e) => setExDay(e.target.value)} />
            </div>
            <Button onClick={addExpense} variant="hero" className="w-full">
              <Plus className="w-4 h-4" /> Adicionar despesa fixa
            </Button>
            <ul className="space-y-2">
              {expenses.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">Nenhuma despesa fixa cadastrada</p>
              ) : (
                expenses.map((e) => (
                  <li key={e.id} className="flex items-center justify-between bg-muted rounded-xl p-3">
                    <div>
                      <p className="font-semibold text-sm">{e.name}</p>
                      <p className="text-xs text-muted-foreground">Dia {e.day_of_month} • R$ {Number(e.amount).toFixed(2)}</p>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => removeExpense(e.id)} className="h-8 w-8 text-muted-foreground hover:text-danger">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </li>
                ))
              )}
            </ul>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};

export default SettingsDialog;
