import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Senha atualizada!");
      navigate("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-hero flex items-center justify-center p-4">
      <form onSubmit={handleSubmit} className="bg-card border border-border rounded-3xl p-8 w-full max-w-md space-y-4">
        <h1 className="font-display text-2xl font-bold">Nova senha</h1>
        <div>
          <Label>Senha</Label>
          <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        </div>
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={loading}>
          {loading ? "Salvando..." : "Atualizar senha"}
        </Button>
      </form>
    </div>
  );
};

export default ResetPassword;
