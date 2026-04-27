import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save, Users as UsersIcon, Package } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

interface Plan {
  id: string;
  name: string;
  price: number;
  benefits: string[];
  is_active: boolean;
  sort_order: number;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  plan_id: string | null;
  status: string;
  trial_end_date: string | null;
}

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [stats, setStats] = useState({ users: 0, active: 0, revenue: 0 });

  const load = async () => {
    const [{ data: p }, { data: prof, count }, { data: subs }] = await Promise.all([
      supabase.from("plans").select("*").order("sort_order"),
      supabase.from("profiles").select("*", { count: "exact" }).order("created_at", { ascending: false }),
      supabase.from("subscriptions").select("user_id,status,price_id"),
    ]);
    if (p) setPlans(p as Plan[]);
    if (prof) {
      setProfiles(prof as Profile[]);
      // Active = users with a Stripe subscription currently in active/trialing/past_due
      const activeSubUsers = new Set(
        (subs ?? [])
          .filter((s: any) => ["active", "trialing", "past_due"].includes(s.status))
          .map((s: any) => s.user_id)
      );
      const active = activeSubUsers.size;
      // Real MRR: count one CONTROLA PRO price per active subscriber
      const proPlanPrice = (p || []).find((pl: any) => pl.name === "CONTROLA PRO")?.price ?? 0;
      const revenue = active * Number(proPlanPrice);
      setStats({ users: count || 0, active, revenue });
    }
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (loading) return <div className="min-h-screen flex items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;

  const updatePlan = async (plan: Plan) => {
    const { error } = await supabase
      .from("plans")
      .update({ name: plan.name, price: plan.price, benefits: plan.benefits })
      .eq("id", plan.id);
    if (error) toast.error(error.message);
    else toast.success("Plano atualizado");
  };

  const addPlan = async () => {
    const { error } = await supabase
      .from("plans")
      .insert({ name: "Novo plano", price: 0, benefits: [], sort_order: plans.length + 1 });
    if (error) toast.error(error.message);
    else load();
  };

  const deletePlan = async (id: string) => {
    const { error } = await supabase.from("plans").delete().eq("id", id);
    if (error) toast.error(error.message);
    else load();
  };

  // Status & plan are managed exclusively by the Stripe webhook → DB trigger flow.
  // Admin no longer mutates these fields manually to avoid drift with Stripe.

  const statusLabel = (s: string) =>
    s === "active" ? "Ativo" : s === "trial" ? "Em teste" : s === "expired" ? "Expirado" : s;

  const statusVariant = (s: string): "default" | "secondary" | "destructive" =>
    s === "active" ? "default" : s === "expired" ? "destructive" : "secondary";

  const formatBRL = (n: number) =>
    n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          <h1 className="font-display font-bold text-lg">Painel Admin</h1>
          <div />
        </div>
      </nav>
      <main className="container py-10 space-y-8">
        <section>
          <div className="grid sm:grid-cols-3 gap-4">
            <StatCard label="Total de usuários" value={stats.users} />
            <StatCard label="Usuários ativos" value={stats.active} />
            <StatCard label="Receita estimada" value={formatBRL(stats.revenue)} />
          </div>
        </section>

        <Tabs defaultValue="users">
          <TabsList>
            <TabsTrigger value="users"><UsersIcon className="w-4 h-4" /> Usuários</TabsTrigger>
            <TabsTrigger value="plans"><Package className="w-4 h-4" /> Planos</TabsTrigger>
          </TabsList>

          <TabsContent value="users" className="mt-6">
            <div className="bg-card border border-border rounded-3xl p-2 sm:p-4 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Plano</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((u) => {
                    const planName = plans.find((p) => p.id === u.plan_id)?.name || "—";
                    return (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.full_name || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{u.email || "—"}</TableCell>
                        <TableCell>{planName}</TableCell>
                        <TableCell>
                          <Badge variant={statusVariant(u.status)}>
                            {statusLabel(u.status)}
                          </Badge>
                          {u.status === "trial" && u.trial_end_date && (
                            <p className="text-xs text-muted-foreground mt-1">
                              até {new Date(u.trial_end_date).toLocaleDateString("pt-BR")}
                            </p>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {profiles.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum usuário cadastrado
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
              <p className="text-xs text-muted-foreground p-3">
                Status e plano são gerenciados automaticamente pelo sistema de pagamento.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="plans" className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">Planos</h2>
              <Button onClick={addPlan} variant="hero" size="sm"><Plus className="w-4 h-4" /> Novo plano</Button>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              {plans.map((plan, idx) => (
                <div key={plan.id} className="bg-card border border-border rounded-3xl p-6 space-y-3">
                  <div>
                    <Label>Nome</Label>
                    <Input
                      value={plan.name}
                      onChange={(e) => {
                        const next = [...plans];
                        next[idx] = { ...plan, name: e.target.value };
                        setPlans(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Preço (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={plan.price}
                      onChange={(e) => {
                        const next = [...plans];
                        next[idx] = { ...plan, price: parseFloat(e.target.value) || 0 };
                        setPlans(next);
                      }}
                    />
                  </div>
                  <div>
                    <Label>Benefícios (um por linha)</Label>
                    <textarea
                      className="w-full min-h-[120px] rounded-xl border border-input bg-background px-3 py-2 text-sm"
                      value={plan.benefits.join("\n")}
                      onChange={(e) => {
                        const next = [...plans];
                        next[idx] = { ...plan, benefits: e.target.value.split("\n").filter(Boolean) };
                        setPlans(next);
                      }}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button onClick={() => updatePlan(plan)} variant="hero" size="sm" className="flex-1">
                      <Save className="w-4 h-4" /> Salvar
                    </Button>
                    <Button onClick={() => deletePlan(plan.id)} variant="outline" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

const StatCard = ({ label, value }: { label: string; value: string | number }) => (
  <div className="bg-card border border-border rounded-3xl p-6">
    <p className="text-sm text-muted-foreground mb-1">{label}</p>
    <p className="font-display text-3xl font-bold">{value}</p>
  </div>
);

export default Admin;
