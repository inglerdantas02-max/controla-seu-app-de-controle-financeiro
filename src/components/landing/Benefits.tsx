import { motion } from "framer-motion";
import { Zap, FileBarChart, Sparkles, FileX } from "lucide-react";

const items = [
  { icon: Zap, title: "Registro rápido", desc: "Anote gastos em segundos por texto ou voz." },
  { icon: FileBarChart, title: "Relatórios automáticos", desc: "Veja para onde seu dinheiro vai, sem esforço." },
  { icon: Sparkles, title: "IA inteligente", desc: "Categorização e insights personalizados." },
  { icon: FileX, title: "Sem planilhas", desc: "Esqueça o Excel. O CONTROLA cuida de tudo." },
];

export const Benefits = () => (
  <section className="py-20 sm:py-24 container">
    <div className="text-center max-w-2xl mx-auto mb-12 sm:mb-16">
      <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
        Simples. Rápido. <span className="text-gradient">Inteligente.</span>
      </h2>
      <p className="text-muted-foreground text-base sm:text-lg">Tudo que você precisa para assumir o controle.</p>
    </div>
    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5 sm:gap-6">
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
          <p className="text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
        </motion.div>
      ))}
    </div>
  </section>
);
