import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

export const Navbar = () => (
  <nav className="fixed top-0 inset-x-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/50">
    <div className="container flex items-center justify-between h-16 gap-2 px-3 sm:px-4">
      <Link to="/" className="flex items-center gap-1 min-w-0 shrink">
        <img src={logo} alt="CONTROLA" className="w-11 h-11 sm:w-12 sm:h-12 rounded-xl shadow-glow shrink-0" />
        <span className="font-display font-bold text-lg sm:text-xl">CONTROLA</span>
      </Link>
      <div className="flex items-center gap-1 shrink-0">
        <Button asChild variant="ghost" size="sm" className="h-8 px-2 text-xs sm:text-sm sm:h-9 sm:px-3">
          <Link to="/auth?mode=login">Entrar</Link>
        </Button>
        <Button asChild variant="hero" size="sm" className="h-8 px-2.5 text-xs sm:text-sm sm:h-9 sm:px-3">
          <Link to="/auth?mode=signup" className="whitespace-nowrap">Começar</Link>
        </Button>
      </div>
    </div>
  </nav>
);
