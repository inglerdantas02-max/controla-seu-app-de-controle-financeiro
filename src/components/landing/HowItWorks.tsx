import { motion } from "framer-motion";
import { MessageSquare, Bot, BarChart3 } from "lucide-react";

const steps = [
  { icon: MessageSquare, title: "Digite ou fale seu gasto", desc: "“Gastei 30 no almoço” — é só isso." },
  { icon: Bot, title: "O CONTROLA registra automaticamente", desc: "A IA categoriza e organiza pra você." },
  { icon: BarChart3, title: "Veja relatórios claros", desc: "Acompanhe seu saldo e tendências em tempo real." },
];

export const HowItWorks = () => (
  <section className="py-20 sm:py-24 bg-muted/30 border-y border-border/50">
    <div className="container">
      <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
          Como <span className="text-gradient">funciona</span>
        </h2>
        <p className="text-muted-foreground text-base sm:text-lg">Em 3 passos simples você assume o controle.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-5 sm:gap-6 max-w-5xl mx-auto">
        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="relative p-6 sm:p-7 rounded-3xl bg-card border border-border hover:shadow-card transition-all"
          >
            <div className="absolute -top-3 -left-3 w-9 h-9 rounded-full bg-gradient-primary text-primary-foreground font-display font-bold flex items-center justify-center shadow-glow">
              {i + 1}
            </div>
            <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
              <s.icon className="w-6 h-6 text-primary" />
            </div>
            <h3 className="font-display font-semibold text-lg mb-2">{s.title}</h3>
            <p className="text-muted-foreground text-sm leading-relaxed">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);
