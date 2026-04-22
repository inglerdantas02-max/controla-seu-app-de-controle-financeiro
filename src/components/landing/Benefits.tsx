import { motion } from "framer-motion";
import { MessageSquare, Wallet, PieChart, Lightbulb } from "lucide-react";

const items = [
  { icon: MessageSquare, title: "Registre com texto", desc: "Diga \"gastei 30 com almoço\" e a IA registra para você." },
  { icon: Wallet, title: "Saldo em tempo real", desc: "Acompanhe entradas e saídas a cada movimento." },
  { icon: PieChart, title: "Para onde vai seu dinheiro", desc: "Visualize categorias e tendências com clareza." },
  { icon: Lightbulb, title: "Insights inteligentes", desc: "Receba alertas e dicas baseadas no seu padrão." },
];

export const Benefits = () => (
  <section className="py-24 container">
    <div className="text-center max-w-2xl mx-auto mb-16">
      <h2 className="font-display text-4xl md:text-5xl font-bold mb-4">
        Tudo que você precisa, <span className="text-gradient">nada que você não precisa</span>
      </h2>
      <p className="text-muted-foreground text-lg">Simplicidade que vira hábito.</p>
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
      {items.map((item, i) => (
        <motion.div
          key={item.title}
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1 }}
          className="group p-6 rounded-3xl bg-card border border-border hover:border-primary/40 hover:shadow-card transition-all"
        >
          <div className="w-12 h-12 rounded-2xl bg-gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
            <item.icon className="w-6 h-6 text-primary-foreground" />
          </div>
          <h3 className="font-display font-semibold text-lg mb-2">{item.title}</h3>
          <p className="text-muted-foreground text-sm">{item.desc}</p>
        </motion.div>
      ))}
    </div>
  </section>
);
