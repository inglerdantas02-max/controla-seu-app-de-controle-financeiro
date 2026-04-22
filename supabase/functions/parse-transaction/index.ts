import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Mensagem inválida" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    const today = new Date().toISOString().split("T")[0];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: `Você é um assistente financeiro brasileiro. Analise mensagens do usuário e extraia transações financeiras. Hoje é ${today}. Categorias comuns: Alimentação, Transporte, Lazer, Saúde, Moradia, Trabalho, Salário, Investimento, Educação, Outros. Se a mensagem não for uma transação, responda com is_transaction=false e uma resposta amigável.`,
          },
          { role: "user", content: message },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "register_transaction",
              description: "Registra uma transação financeira identificada na mensagem",
              parameters: {
                type: "object",
                properties: {
                  is_transaction: { type: "boolean", description: "true se a mensagem descreve uma transação" },
                  type: { type: "string", enum: ["income", "expense"], description: "income=ganho, expense=gasto" },
                  amount: { type: "number", description: "Valor em reais (positivo)" },
                  category: { type: "string", description: "Categoria sugerida" },
                  description: { type: "string", description: "Descrição curta" },
                  reply: { type: "string", description: "Mensagem de confirmação amigável em português, ex: 'Deseja registrar uma saída de R$30 com almoço?'" },
                },
                required: ["is_transaction", "reply"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "register_transaction" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione fundos no workspace." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      return new Response(JSON.stringify({ error: "Erro no assistente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(JSON.stringify({ is_transaction: false, reply: "Não consegui entender. Tente algo como 'Gastei 30 com almoço'." }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(toolCall.function.arguments);
    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-transaction error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
