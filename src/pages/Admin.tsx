import { useEffect, useState } from "react";
import { Navigate, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, Save } from "lucide-react";

interface Plan {
  id: string;
  name: string;
  price: number;
  benefits: string[];
  is_active: boolean;
  sort_order: number;
}

const Admin = () => {
  const { user, isAdmin, loading } = useAuth();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [stats, setStats] = useState({ users: 0 });

  const load = async () => {
    const [{ data: p }, { count }] = await Promise.all([
      supabase.from("plans").select("*").order("sort_order"),
      supabase.from("profiles").select("*", { count: "exact", head: true }),
    ]);
    if (p) setPlans(p as Plan[]);
    setStats({ users: count || 0 });
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

  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b border-border">
        <div className="container flex items-center justify-between h-16">
          <Link to="/dashboard" className="flex items-center gap-2 text-sm">
            <ArrowLeft className="w-4 h-4" /> Voltar
          </Link>
          <h1 className="font-display font-bold text-lg">Admin</h1>
          <div />
        </div>
      </nav>
      <main className="container py-10 space-y-10">
        <section>
          <h2 className="font-display text-2xl font-bold mb-4">Visão geral</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            <StatCard label="Total de usuários" value={stats.users} />
            <StatCard label="Usuários ativos" value={stats.users} />
            <StatCard label="Receita estimada" value="R$ 0,00" />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between mb-4">
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
        </section>
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
