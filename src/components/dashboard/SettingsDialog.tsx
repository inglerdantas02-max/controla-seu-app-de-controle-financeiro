import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { signOut } from "@/lib/auth";
import { toast } from "@/hooks/use-toast";
import { LogOut, Plus, Trash2, Loader2 } from "lucide-react";

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
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);

  const [expenses, setExpenses] = useState<FixedExpense[]>([]);
  const [exName, setExName] = useState("");
  const [exAmount, setExAmount] = useState("");
  const [exDay, setExDay] = useState("");

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="font-display">Configurações</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="profile" className="flex-1 overflow-hidden flex flex-col">
          <TabsList className="grid grid-cols-3">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
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
