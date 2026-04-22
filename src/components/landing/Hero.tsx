import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, TrendingUp, TrendingDown } from "lucide-react";

export const Hero = () => (
  <section className="relative pt-32 pb-24 overflow-hidden bg-gradient-hero">
    <div className="container relative">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl mx-auto text-center"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/20 bg-primary/5 backdrop-blur mb-6">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium">Assistente financeiro com IA</span>
        </div>
        <h1 className="font-display text-5xl md:text-7xl font-extrabold leading-[1.05] mb-6">
          Controle suas finanças<br />
          <span className="text-gradient">de forma inteligente</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          Registre ganhos e gastos com uma simples mensagem e saiba exatamente para onde seu dinheiro está indo.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild variant="hero" size="xl">
            <Link to="/auth?mode=signup">
              Começar agora <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl">
            <Link to="/auth?mode=login">Entrar</Link>
          </Button>
        </div>
      </motion.div>

      {/* Floating mock cards */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="relative max-w-4xl mx-auto mt-20"
      >
        <div className="relative rounded-3xl bg-gradient-card backdrop-blur border border-border/50 shadow-glow p-8 md:p-12">
          <div className="grid md:grid-cols-3 gap-4">
            <MockCard label="Saldo atual" value="R$ 4.280,50" gradient />
            <MockCard label="Entradas" value="+R$ 6.150" icon={<TrendingUp className="text-success" />} />
            <MockCard label="Saídas" value="-R$ 1.869" icon={<TrendingDown className="text-danger" />} />
          </div>
          <div className="mt-6 p-4 rounded-2xl bg-muted/50 border border-border/50">
            <p className="text-xs text-muted-foreground mb-1">Você disse</p>
            <p className="font-medium">"Gastei 32 reais no almoço hoje"</p>
            <p className="text-xs text-success mt-2">✓ Saída de R$ 32,00 em Alimentação registrada</p>
          </div>
        </div>
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/30 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-secondary/30 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
      </motion.div>
    </div>
  </section>
);

const MockCard = ({ label, value, gradient, icon }: { label: string; value: string; gradient?: boolean; icon?: React.ReactNode }) => (
  <div className={`rounded-2xl p-5 ${gradient ? "bg-gradient-primary text-primary-foreground" : "bg-card border border-border"}`}>
    <div className="flex items-center justify-between mb-2">
      <p className={`text-xs ${gradient ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</p>
      {icon}
    </div>
    <p className="text-2xl font-display font-bold">{value}</p>
  </div>
);
