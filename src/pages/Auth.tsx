import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { signIn, signUp, resetPassword } from "@/lib/auth";
import { useAuth } from "@/hooks/useAuth";
import logo from "@/assets/logo.png";

const emailSchema = z.string().trim().email("Email inválido").max(255);
const pwdSchema = z.string().min(6, "Mínimo 6 caracteres").max(72);
const nameSchema = z.string().trim().min(1, "Informe seu nome").max(100);

const Auth = () => {
  const [params] = useSearchParams();
  const initial = (params.get("mode") as "login" | "signup") || "login";
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initial);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) navigate("/dashboard");
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "forgot") {
        emailSchema.parse(email);
        const { error } = await resetPassword(email);
        if (error) throw error;
        toast.success("Email de recuperação enviado!");
        setMode("login");
        return;
      }
      emailSchema.parse(email);
      pwdSchema.parse(password);
      if (mode === "signup") {
        nameSchema.parse(name);
        const { error } = await signUp(email, password, name);
        if (error) throw error;
        toast.success("Cadastro criado! Faça login para continuar.");
        setMode("login");
      } else {
        const { error } = await signIn(email, password);
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate("/dashboard");
      }
    } catch (err: any) {
      toast.error(err?.message || "Algo deu errado");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <img src={logo} alt="CONTROLA" className="w-10 h-10 rounded-xl shadow-glow" />
          <span className="font-display font-bold text-2xl">CONTROLA</span>
        </Link>
        <div className="bg-card border border-border rounded-3xl p-8 shadow-soft">
          <h1 className="font-display text-2xl font-bold mb-2">
            {mode === "signup" ? "Criar conta" : mode === "forgot" ? "Recuperar senha" : "Entrar"}
          </h1>
          <p className="text-muted-foreground text-sm mb-6">
            {mode === "signup"
              ? "Comece a controlar suas finanças hoje"
              : mode === "forgot"
              ? "Enviaremos um link para seu email"
              : "Bem-vindo de volta"}
          </p>
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "signup" && (
              <div>
                <Label htmlFor="name">Nome</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              </div>
            )}
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
            </div>
            {mode !== "forgot" && (
              <div>
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
              </div>
            )}
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
              {loading ? "Aguarde..." : mode === "signup" ? "Criar conta" : mode === "forgot" ? "Enviar link" : "Entrar"}
            </Button>
          </form>
          <div className="mt-6 text-sm text-center space-y-2">
            {mode === "login" && (
              <>
                <button onClick={() => setMode("forgot")} className="text-primary hover:underline block w-full">
                  Esqueci minha senha
                </button>
                <span className="text-muted-foreground">
                  Não tem conta?{" "}
                  <button onClick={() => setMode("signup")} className="text-primary hover:underline font-medium">
                    Criar conta
                  </button>
                </span>
              </>
            )}
            {mode === "signup" && (
              <span className="text-muted-foreground">
                Já tem conta?{" "}
                <button onClick={() => setMode("login")} className="text-primary hover:underline font-medium">
                  Entrar
                </button>
              </span>
            )}
            {mode === "forgot" && (
              <button onClick={() => setMode("login")} className="text-primary hover:underline">
                Voltar para login
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
