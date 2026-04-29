import logo from "@/assets/logo.png";

export const Footer = () => (
  <footer className="border-t border-border/50 py-12">
    <div className="container">
      <div className="flex flex-col items-center text-center gap-3">
        <div className="flex items-center gap-2">
          <img src={logo} alt="CONTROLA" className="w-9 h-9 rounded-lg" />
          <span className="font-display font-bold text-lg">CONTROLA</span>
        </div>
        <p className="text-sm text-muted-foreground max-w-md">
          Seu assistente financeiro com IA. Registre gastos por texto ou voz e tenha o controle no seu ritmo.
        </p>
        <p className="text-xs text-muted-foreground mt-4">
          © {new Date().getFullYear()} CONTROLA. Todos os direitos reservados.
        </p>
      </div>
    </div>
  </footer>
);
