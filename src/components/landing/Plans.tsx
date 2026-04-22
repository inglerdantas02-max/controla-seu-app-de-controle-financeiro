import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Check, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";

interface Plan {
  id: string;
  name: string;
  price: number;
  benefits: string[];
}

export const Plans = () => {
  const [plans, setPlans] = useState<Plan[]>([]);

  useEffect(() => {
    supabase
      .from("plans")
      .select("id,name,price,benefits")
      .eq("is_active", true)
      .order("sort_order")
      .then(({ data }) => {
        if (data) setPlans(data as Plan[]);
      });
  }, []);

  return (
    <section className="py-24 container">
      <div className="text-center max-w-2xl mx-auto mb-16">
        <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
          Planos <span className="text-gradient">simples</span>
        </h2>
        <p className="text-muted-foreground text-lg">Comece grátis. Evolua quando quiser.</p>
      </div>
      <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {plans.map((plan, i) => {
          const isPremium = plan.price > 0;
          return (
            <motion.div
              key={plan.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className={`relative rounded-3xl p-8 ${
                isPremium
                  ? "bg-gradient-primary text-primary-foreground shadow-glow"
                  : "bg-card border border-border"
              }`}
            >
              {isPremium && (
                <div className="absolute -top-3 right-6 bg-background text-foreground text-xs font-semibold px-3 py-1 rounded-full border border-border flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> Mais popular
                </div>
              )}
              <h3 className="font-display text-2xl font-bold mb-2">{plan.name}</h3>
              <div className="mb-6">
                <span className="text-5xl font-display font-extrabold">
                  R$ {Number(plan.price).toFixed(2).replace(".", ",")}
                </span>
                {isPremium && <span className={`ml-1 ${isPremium ? "text-primary-foreground/80" : "text-muted-foreground"}`}>/mês</span>}
              </div>
              <ul className="space-y-3 mb-8">
                {plan.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-2">
                    <Check className={`w-5 h-5 shrink-0 mt-0.5 ${isPremium ? "" : "text-success"}`} />
                    <span className="text-sm">{b}</span>
                  </li>
                ))}
              </ul>
              <Button
                asChild
                variant={isPremium ? "secondary" : "outline"}
                className="w-full"
                size="lg"
              >
                <Link to="/auth?mode=signup">Começar com {plan.name}</Link>
              </Button>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
};
