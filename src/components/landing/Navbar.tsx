import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

export const Navbar = () => (
  <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/50">
    <div className="container flex items-center justify-between h-16">
      <Link to="/" className="flex items-center gap-2">
        <img src={logo} alt="CONTROLA" className="w-9 h-9 rounded-xl shadow-glow" />
        <span className="font-display font-bold text-xl">CONTROLA</span>
      </Link>
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link to="/auth?mode=login">Entrar</Link>
        </Button>
        <Button asChild variant="hero" size="sm">
          <Link to="/auth?mode=signup">Começar agora</Link>
        </Button>
      </div>
    </div>
  </nav>
);
