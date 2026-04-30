import { useState, useRef, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Send, Sparkles, Check, X, Loader2, Mic, Square } from "lucide-react";
import { usePushToTalk } from "@/hooks/usePushToTalk";
import RecordingIndicator from "./RecordingIndicator";

interface PendingTransaction {
  type: "income" | "expense";
  amount: number;
  category?: string;
  description?: string;
  occurred_at?: string | null; // YYYY-MM-DD em Brasília, opcional
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
  initialAssistantMessage?: string | null;
  pendingPrompt?: string | null;
}

const ChatAssistant = ({ open, onOpenChange, onTransactionSaved, initialAssistantMessage, pendingPrompt }: Props) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Msg[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Olá! 👋 Eu sou seu assistente. Me conte algo como:\n\n• \"Gastei 30 com almoço\"\n• \"Ganhei 200 hoje\"\n• \"Quanto gastei essa semana?\"\n• \"Quanto sobrou pra mim hoje?\"",
    },
  ]);

  // Injeta insight como mensagem inicial quando o chat abre
  useEffect(() => {
    if (!open || !initialAssistantMessage) return;
    setMessages((prev) => {
      if (prev.some((m) => m.id === "insight-injected" && m.content === initialAssistantMessage)) return prev;
      return [
        ...prev,
        { id: "insight-injected", role: "assistant", content: initialAssistantMessage },
      ];
    });
  }, [open, initialAssistantMessage]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRowRef = useRef<HTMLDivElement>(null);
  const lastSentPromptRef = useRef<string | null>(null);

  // Auto-envia uma pergunta sugerida (vinda do dashboard) ao abrir o chat
  useEffect(() => {
    if (!open) {
      lastSentPromptRef.current = null;
      return;
    }
    if (!pendingPrompt) return;
    if (lastSentPromptRef.current === pendingPrompt) return;
    lastSentPromptRef.current = pendingPrompt;
    // pequeno delay para o dialog terminar de montar
    const t = setTimeout(() => { void send(pendingPrompt); }, 150);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, pendingPrompt]);

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    // ScrollArea uses a viewport child for scrolling
    const root = scrollRef.current;
    const viewport = root?.querySelector<HTMLElement>("[data-radix-scroll-area-viewport]") || root;
    viewport?.scrollTo({ top: viewport.scrollHeight, behavior });
  };

  useEffect(() => {
    scrollToBottom("smooth");
  }, [messages]);

  // Reajustar quando o teclado virtual abrir/fechar (visualViewport)
  useEffect(() => {
    if (!open) return;
    const vv = (window as any).visualViewport as VisualViewport | undefined;
    if (!vv) return;
    const handler = () => {
      scrollToBottom("auto");
      inputRowRef.current?.scrollIntoView({ block: "end" });
    };
    vv.addEventListener("resize", handler);
    vv.addEventListener("scroll", handler);
    return () => {
      vv.removeEventListener("resize", handler);
      vv.removeEventListener("scroll", handler);
    };
  }, [open]);

  const handleInputFocus = () => {
    setTimeout(() => {
      scrollToBottom("smooth");
      inputRowRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
    }, 250);
  };

  const send = async (overrideText?: string) => {
    const text = (overrideText ?? input).trim();
    if (!text || loading) return;
    if (!overrideText) setInput("");
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", content: text };
    setMessages((p) => [...p, userMsg]);
    setLoading(true);

    try {
      // Envia últimas mensagens (sem botões/estados) como contexto
      const history = messages
        .filter((m) => !m.pending || m.confirmed || m.cancelled)
        .slice(-8)
        .map((m) => ({ role: m.role, content: m.content }));
      const { data, error } = await supabase.functions.invoke("parse-transaction", {
        body: { message: text, history },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const assistantMsg: Msg = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: data.reply,
        pending: data.is_transaction && data.amount && data.type
          ? { type: data.type, amount: data.amount, category: data.category, description: data.description, occurred_at: data.occurred_at }
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
    let occurredAtISO: string | undefined;
    if (tx.occurred_at && /^\d{4}-\d{2}-\d{2}$/.test(tx.occurred_at)) {
      // Meio-dia em Brasília (UTC-3) = 15:00 UTC — evita virar de dia por fuso
      const [y, m, d] = tx.occurred_at.split("-").map(Number);
      occurredAtISO = new Date(Date.UTC(y, m - 1, d, 15, 0, 0)).toISOString();
    }
    const { error } = await supabase.from("transactions").insert({
      user_id: user.id,
      type: tx.type,
      amount: tx.amount,
      category: tx.category || null,
      description: tx.description || null,
      ...(occurredAtISO ? { occurred_at: occurredAtISO } : {}),
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
      <DialogContent className="max-w-md p-0 gap-0 h-[100dvh] sm:h-[600px] max-h-[100dvh] flex flex-col rounded-none sm:rounded-3xl overflow-hidden">
        <DialogHeader className="px-5 py-4 border-b bg-gradient-primary text-primary-foreground">
          <DialogTitle className="flex items-center gap-2 font-display">
            <Sparkles className="w-5 h-5" /> Assistente CONTROLA
          </DialogTitle>
        </DialogHeader>

        <ScrollArea className="flex-1 min-h-0 px-4 py-4" ref={scrollRef as any}>
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
              <div className="flex justify-start animate-fade-in">
                <div className="bg-muted rounded-2xl rounded-bl-sm px-4 py-2.5 flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="flex gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" style={{ animationDelay: "300ms" }} />
                  </span>
                  <span className="opacity-80">pensando...</span>
                </div>
              </div>
            )}
          </div>
        </ScrollArea>

        <div ref={inputRowRef} className="sticky bottom-0 bg-background z-10" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
          <VoiceInputRow input={input} setInput={setInput} send={send} loading={loading} onFocus={handleInputFocus} />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ChatAssistant;

function VoiceInputRow({
  input,
  setInput,
  send,
  loading,
  onFocus,
}: {
  input: string;
  setInput: (v: string) => void;
  send: (overrideText?: string) => void;
  loading: boolean;
  onFocus?: () => void;
}) {
  const [transcribing, setTranscribing] = useState(false);
  const [cancelHint, setCancelHint] = useState(false);
  const startXRef = useRef<number | null>(null);
  const CANCEL_THRESHOLD = 80; // px swipe left to cancel

  const ptt = usePushToTalk({
    minDurationMs: 500,
    onError: (msg) => toast({ title: "Microfone", description: msg, variant: "destructive" }),
    onResult: async (audioBase64, mimeType) => {
      setTranscribing(true);
      try {
        const { data, error } = await supabase.functions.invoke("transcribe-audio", {
          body: { audio: audioBase64, mimeType },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        const text: string = (data?.text || "").trim();
        if (!text) {
          toast({ title: "Áudio", description: "Não entendi bem o que você falou, pode repetir?", variant: "destructive" });
          return;
        }
        // Coloca a transcrição corrigida no input para o usuário revisar/editar antes de enviar.
        // O assistente ainda mostrará botões "Confirmar/Cancelar" depois — dupla checagem.
        setInput(text);
      } catch (e: any) {
        const msg = e?.message || "Falha ao transcrever";
        toast({ title: "Erro", description: msg, variant: "destructive" });
      } finally {
        setTranscribing(false);
      }
    },
  });

  const onPointerDown = (e: React.PointerEvent) => {
    if (loading || transcribing || ptt.starting || ptt.recording) return;
    try { (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId); } catch {}
    startXRef.current = e.clientX;
    setCancelHint(false);
    void ptt.start();
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!ptt.recording || startXRef.current == null) return;
    const dx = e.clientX - startXRef.current;
    setCancelHint(dx < -CANCEL_THRESHOLD);
  };

  const onPointerUp = (e: React.PointerEvent) => {
    try { (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId); } catch {}
    if (!ptt.recording && !ptt.starting) return;
    const start = startXRef.current;
    startXRef.current = null;
    const shouldCancel = start != null && e.clientX - start < -CANCEL_THRESHOLD;
    setCancelHint(false);
    if (shouldCancel) ptt.cancel();
    else ptt.stop();
  };

  const onPointerCancel = () => {
    startXRef.current = null;
    setCancelHint(false);
    if (ptt.recording || ptt.starting) ptt.cancel();
  };

  const busy = loading || transcribing;

  return (
    <div className="border-t p-3 flex gap-2 items-center select-none">
      {ptt.recording ? (
        <RecordingIndicator elapsedMs={ptt.elapsedMs} level={ptt.level} cancelHint={cancelHint} />
      ) : (
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") send(); }}
          onFocus={onFocus}
          placeholder={transcribing ? "Transcrevendo..." : "Ex: Gastei 30 com almoço"}
          disabled={busy}
          className="rounded-full"
        />
      )}

      {!input.trim() && !ptt.recording ? (
        <Button
          type="button"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerCancel}
          onContextMenu={(e) => e.preventDefault()}
          disabled={busy}
          size="icon"
          variant="hero"
          className="shrink-0 touch-none"
          aria-label="Segure para gravar"
          title="Segure para gravar"
        >
          {transcribing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mic className="w-4 h-4" />}
        </Button>
      ) : ptt.recording ? (
        <Button
          type="button"
          onPointerUp={onPointerUp}
          onPointerMove={onPointerMove}
          onPointerCancel={onPointerCancel}
          size="icon"
          variant={cancelHint ? "destructive" : "hero"}
          className="shrink-0 touch-none animate-pulse"
          aria-label="Solte para enviar"
        >
          <Square className="w-4 h-4 fill-current" />
        </Button>
      ) : (
        <Button onClick={() => send()} disabled={busy || !input.trim()} size="icon" variant="hero" className="shrink-0">
          <Send className="w-4 h-4" />
        </Button>
      )}
    </div>
  );
}
