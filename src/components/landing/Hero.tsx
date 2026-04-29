import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, TrendingUp, TrendingDown, Send } from "lucide-react";

export const Hero = () => (
  <section className="relative pt-28 sm:pt-32 pb-20 sm:pb-28 overflow-hidden bg-gradient-hero">
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
        <h1 className="font-display text-4xl sm:text-5xl md:text-7xl font-extrabold leading-[1.05] mb-6">
          Controle seu dinheiro<br />
          <span className="text-gradient">sem planilhas</span>
        </h1>
        <p className="text-base sm:text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto">
          Fale ou digite, e o CONTROLA organiza tudo pra você automaticamente.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild variant="hero" size="xl">
            <Link to="/auth?mode=signup">
              Começar grátis por 7 dias <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl">
            <Link to="/auth?mode=login">Já tenho conta</Link>
          </Button>
        </div>
        <p className="mt-4 text-xs text-muted-foreground">Sem cartão de crédito • Cancele quando quiser</p>
      </motion.div>

      {/* Demo: chat + resumo financeiro */}
      <motion.div
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, delay: 0.2 }}
        className="relative max-w-5xl mx-auto mt-16 sm:mt-20"
      >
        <div className="relative rounded-3xl bg-gradient-card backdrop-blur border border-border/50 shadow-glow p-5 sm:p-8 md:p-10">
          <div className="grid md:grid-cols-3 gap-3 sm:gap-4 mb-6">
            <MockCard label="Saldo atual" value="R$ 4.280,50" gradient />
            <MockCard label="Entradas" value="+R$ 6.150" icon={<TrendingUp className="w-4 h-4 text-success" />} />
            <MockCard label="Saídas" value="-R$ 1.869" icon={<TrendingDown className="w-4 h-4 text-danger" />} />
          </div>

          <div className="rounded-2xl bg-muted/40 border border-border/50 p-4 sm:p-5 space-y-3">
            <ChatBubble side="user" text="Gastei 30 no almoço" />
            <ChatBubble side="bot" text="✓ Saída de R$ 30,00 em Alimentação registrada" />
            <ChatBubble side="user" text="Recebi 200 hoje" />
            <ChatBubble side="bot" text="✓ Entrada de R$ 200,00 registrada" />
            <ChatBubble side="user" text="Quanto gastei hoje?" />
            <ChatBubble side="bot" text="Hoje você gastou R$ 30,00 em Alimentação." />

            <div className="flex items-center gap-2 mt-3 rounded-xl border border-border bg-background/70 px-3 py-2">
              <input
                disabled
                placeholder="Diga ou digite seu gasto..."
                className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
              />
              <div className="w-8 h-8 rounded-lg bg-gradient-primary flex items-center justify-center">
                <Send className="w-4 h-4 text-primary-foreground" />
              </div>
            </div>
          </div>
        </div>
        <div className="absolute -top-4 -left-4 w-24 h-24 bg-primary/30 rounded-full blur-3xl animate-float" />
        <div className="absolute -bottom-4 -right-4 w-32 h-32 bg-secondary/30 rounded-full blur-3xl animate-float" style={{ animationDelay: "2s" }} />
      </motion.div>
    </div>
  </section>
);

const MockCard = ({ label, value, gradient, icon }: { label: string; value: string; gradient?: boolean; icon?: React.ReactNode }) => (
  <div className={`rounded-2xl p-4 sm:p-5 ${gradient ? "bg-gradient-primary text-primary-foreground" : "bg-card border border-border"}`}>
    <div className="flex items-center justify-between mb-2">
      <p className={`text-xs ${gradient ? "text-primary-foreground/80" : "text-muted-foreground"}`}>{label}</p>
      {icon}
    </div>
    <p className="text-xl sm:text-2xl font-display font-bold">{value}</p>
  </div>
);

const ChatBubble = ({ side, text }: { side: "user" | "bot"; text: string }) => (
  <div className={`flex ${side === "user" ? "justify-end" : "justify-start"}`}>
    <div
      className={`max-w-[85%] text-sm rounded-2xl px-3.5 py-2 ${
        side === "user"
          ? "bg-gradient-primary text-primary-foreground rounded-br-sm"
          : "bg-card border border-border text-foreground rounded-bl-sm"
      }`}
    >
      {text}
    </div>
  </div>
);
