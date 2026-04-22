import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Send, Sparkles, Check, X, Loader2 } from "lucide-react";

interface PendingTransaction {
  type: "income" | "expense";
  amount: number;
  category?: string;
  description?: string;
}

interface Msg {
  id: string;
  role: "user" | "assistant";
  content: string;
  pending?: PendingTransaction;
  confirmed?: boolean;
  cancelled?: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onTransactionSaved: () => void;
}

const ChatAssistant = ({ open, onOpenChange, onTransactionSaved }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Olá! 👋 Eu sou seu assistente. Me conte algo como:\n\n• \"Gastei 30 com almoço\"\n• \"Ganhei 200 hoje\"\n• \"Paguei 50 de uber\"",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setLoading(true);

    try {
      const { data, error } = await supabase.functions.invoke("parse-transaction", {
        body: { message: text },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const assistantMsg: Msg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        pending: data.is_transaction && data.amount && data.type
          ? { type: data.type, amount: data.amount, category: data.category, description: data.description }
          : undefined,
      };
      setMessages((p) => [...p, assistantMsg]);
    } catch (e: any) {
      toast({ title: "Erro", description: e.message || "Falha ao processar", variant: "destructive" });
      setMessages((p) => [...p, { id: crypto.randomUUID(), role: "assistant", content: "Desculpe, não consegui processar. Tente novamente." }]);
    } finally {
      setLoading(false);
    }
  };

  const confirm = async (msgId: string, tx: PendingTransaction) => {
    if (!user) return;
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: tx.type,
      amount: tx.amount,
      category: tx.category || null,
      description: tx.description || null,
    });
    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
      return;
    }
    setMessages((p) => p.map((m) => (m.id === msgId ? { ...m, confirmed: true } : m)));
    setMessages((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        role: "assistant",
        content: `✅ ${tx.type === "income" ? "Entrada" : "Saída"} de R$ ${tx.amount.toFixed(2)} registrada!`,
      },
    ]);
    onTransactionSaved();
  };

  const cancel = (msgId: string) => {
    setMessages((p) => p.map((m) => (m.id === msgId ? { ...m, cancelled: true } : m)));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 h-[85vh] sm:h-[600px] flex flex-col rounded-3xl overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b bg-gradient-primary text-primary-foreground">
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="w-5 h-5" /> Assistente CONTROLA
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 px-4 py-4" ref={scrollRef as any}>
          <div className="space-y-3">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"} animate-fade-in`}>
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap ${
                    m.role === "user"
                      ? "bg-gradient-primary text-primary-foreground rounded-br-sm"
                      : "bg-muted text-foreground rounded-bl-sm"
                  }`}
                >
                  {m.content}
                  {m.pending && !m.confirmed && !m.cancelled && (
                    <div className="flex gap-2 mt-3">
                      <Button size="sm" variant="success" onClick={() => confirm(m.id, m.pending!)} className="h-8">
                        <Check className="w-4 h-4" /> Confirmar
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => cancel(m.id)} className="h-8">
                        <X className="w-4 h-4" /> Cancelar
                      </Button>
                    </div>
                  )}
                  {m.cancelled && <p className="text-xs opacity-60 mt-2">Cancelado</p>}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-2xl px-4 py-2.5 rounded-bl-sm">
                  <Loader2 className="w-4 h-4 animate-spin" />
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-3 flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Ex: Gastei 30 com almoço"
            disabled={loading}
            className="rounded-full"
          />
          <Button onClick={send} disabled={loading || !input.trim()} size="icon" variant="hero" className="shrink-0">
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChatAssistant;
