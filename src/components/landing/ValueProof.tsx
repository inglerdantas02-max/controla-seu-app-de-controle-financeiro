import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowRight, ShieldCheck } from "lucide-react";

export const ValueProof = () => (
  <section className="py-20 sm:py-24 container">
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="relative overflow-hidden rounded-3xl bg-gradient-primary text-primary-foreground p-8 sm:p-12 md:p-16 text-center shadow-glow"
    >
      <div className="absolute -top-10 -left-10 w-40 h-40 bg-primary-foreground/10 rounded-full blur-3xl" />
      <div className="absolute -bottom-10 -right-10 w-52 h-52 bg-primary-foreground/10 rounded-full blur-3xl" />
      <div className="relative max-w-2xl mx-auto">
        <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4 leading-tight">
          Pare de perder o controle do seu dinheiro
        </h2>
        <p className="text-base sm:text-lg text-primary-foreground/90 mb-8">
          O CONTROLA organiza tudo de forma simples e automática.
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <Button asChild variant="secondary" size="xl">
            <Link to="/auth?mode=signup">
              Começar agora <ArrowRight className="w-5 h-5" />
            </Link>
          </Button>
        </div>
        <div className="mt-6 inline-flex items-center gap-2 text-sm text-primary-foreground/90">
          <ShieldCheck className="w-4 h-4" />
          Cancele quando quiser
        </div>
      </div>
    </motion.div>
  </section>
);
