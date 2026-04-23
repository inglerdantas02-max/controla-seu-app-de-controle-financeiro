import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

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

    // Auth: pegar user via JWT
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const today = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().split("T")[0];

    const tools = [
      {
        type: "function",
        function: {
          name: "register_transaction",
          description: "Registra uma transação financeira identificada na mensagem do usuário (gasto ou ganho).",
          parameters: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["income", "expense"] },
              amount: { type: "number", description: "Valor em reais (positivo)" },
              category: { type: "string" },
              description: { type: "string" },
              reply: { type: "string", description: "Confirmação amigável em PT-BR, ex: 'Deseja registrar uma saída de R$30 com almoço?'" },
            },
            required: ["type", "amount", "reply"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_financial_report",
          description: "Consulta as transações reais do usuário e gera um relatório para um período (hoje, ontem, semana, mês ou data específica). Use sempre que o usuário pedir resumo, relatório, ou perguntar quanto gastou/recebeu.",
          parameters: {
            type: "object",
            properties: {
              period: {
                type: "string",
                enum: ["today", "yesterday", "week", "month", "custom"],
                description: "Período do relatório",
              },
              start_date: { type: "string", description: "YYYY-MM-DD (obrigatório se period=custom)" },
              end_date: { type: "string", description: "YYYY-MM-DD (opcional, default = start_date)" },
            },
            required: ["period"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "chat_reply",
          description: "Responde ao usuário sem registrar transação nem consultar relatório (saudações, dúvidas gerais).",
          parameters: {
            type: "object",
            properties: { reply: { type: "string" } },
            required: ["reply"],
            additionalProperties: false,
          },
        },
      },
    ];

    const messages: any[] = [
      {
        role: "system",
        content: `Você é um assistente financeiro brasileiro do app CONTROLA. Hoje é ${today}.
Você tem 3 ferramentas:
1) register_transaction → quando o usuário descreve um gasto/ganho ("gastei 30 com almoço", "recebi 200").
2) get_financial_report → quando o usuário pede relatório, resumo, ou pergunta valores ("quanto gastei hoje", "resumo da semana", "relatório do dia 15").
3) chat_reply → para conversa geral.

Categorias comuns: Alimentação, Transporte, Lazer, Saúde, Moradia, Trabalho, Salário, Investimento, Educação, Outros.

Para relatórios: SEMPRE chame get_financial_report primeiro para obter os dados reais, depois responda ao usuário com base no resultado, formatando de forma amigável com emojis (💰 entradas, 💸 saídas, 📉 saldo) e destacando a categoria com maior gasto se houver. Se não houver dados, diga: "Você ainda não tem movimentações nesse período."`,
      },
      { role: "user", content: message },
    ];

    // Loop de tool calling (máx 3 iterações)
    for (let i = 0; i < 3; i++) {
      const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages,
          tools,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione fundos no workspace." }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const t = await response.text();
        console.error("AI error:", response.status, t);
        return new Response(JSON.stringify({ error: "Erro no assistente" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const data = await response.json();
      const choice = data.choices?.[0]?.message;
      const toolCall = choice?.tool_calls?.[0];

      if (!toolCall) {
        const reply = choice?.content || "Não consegui entender. Tente novamente.";
        return new Response(JSON.stringify({ is_transaction: false, reply }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const fnName = toolCall.function.name;
      const args = JSON.parse(toolCall.function.arguments || "{}");

      if (fnName === "register_transaction") {
        return new Response(JSON.stringify({
          is_transaction: true,
          type: args.type,
          amount: args.amount,
          category: args.category,
          description: args.description,
          reply: args.reply,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      if (fnName === "chat_reply") {
        return new Response(JSON.stringify({ is_transaction: false, reply: args.reply }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (fnName === "get_financial_report") {
        const report = await buildReport(supabase, user.id, args);
        // Devolver para o modelo continuar
        messages.push({
          role: "assistant",
          content: null,
          tool_calls: [toolCall],
        });
        messages.push({
          role: "tool",
          tool_call_id: toolCall.id,
          content: JSON.stringify(report),
        });
        // Forçar próxima iteração a responder em texto puro
        continue;
      }
    }

    return new Response(JSON.stringify({ is_transaction: false, reply: "Não consegui processar. Tente novamente." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-transaction error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function buildReport(supabase: any, userId: string, args: any) {
  // Fuso horário do Brasil (UTC-3) — converte "agora UTC" para "agora no BR"
  const TZ_OFFSET_MS = -3 * 60 * 60 * 1000; // BRT
  const nowBR = new Date(Date.now() + TZ_OFFSET_MS);

  // Constrói intervalo [start, end] em horário BR e converte para UTC ISO
  const dayRangeBR = (yyyy: number, mm: number, dd: number) => {
    // 00:00 BR = 03:00 UTC do mesmo dia ; 23:59:59.999 BR = 02:59:59.999 UTC do dia seguinte
    const startUTC = new Date(Date.UTC(yyyy, mm, dd, 0, 0, 0) - TZ_OFFSET_MS);
    const endUTC = new Date(Date.UTC(yyyy, mm, dd, 23, 59, 59, 999) - TZ_OFFSET_MS);
    return { startUTC, endUTC };
  };

  const parseYMD = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return { y, m: m - 1, d };
  };

  let startISO: string;
  let endISO: string;
  let label = "";

  const yBR = nowBR.getUTCFullYear();
  const mBR = nowBR.getUTCMonth();
  const dBR = nowBR.getUTCDate();

  switch (args.period) {
    case "today": {
      const r = dayRangeBR(yBR, mBR, dBR);
      startISO = r.startUTC.toISOString(); endISO = r.endUTC.toISOString();
      label = "hoje"; break;
    }
    case "yesterday": {
      const y = new Date(Date.UTC(yBR, mBR, dBR));
      y.setUTCDate(y.getUTCDate() - 1);
      const r = dayRangeBR(y.getUTCFullYear(), y.getUTCMonth(), y.getUTCDate());
      startISO = r.startUTC.toISOString(); endISO = r.endUTC.toISOString();
      label = "ontem"; break;
    }
    case "week": {
      const w = new Date(Date.UTC(yBR, mBR, dBR));
      w.setUTCDate(w.getUTCDate() - 6); // últimos 7 dias incluindo hoje
      const s = dayRangeBR(w.getUTCFullYear(), w.getUTCMonth(), w.getUTCDate()).startUTC;
      const e = dayRangeBR(yBR, mBR, dBR).endUTC;
      startISO = s.toISOString(); endISO = e.toISOString();
      label = "últimos 7 dias"; break;
    }
    case "month": {
      const s = dayRangeBR(yBR, mBR, 1).startUTC;
      const e = dayRangeBR(yBR, mBR, dBR).endUTC;
      startISO = s.toISOString(); endISO = e.toISOString();
      label = "este mês"; break;
    }
    case "custom": {
      const sParts = args.start_date ? parseYMD(args.start_date) : { y: yBR, m: mBR, d: dBR };
      const eParts = args.end_date ? parseYMD(args.end_date) : sParts;
      startISO = dayRangeBR(sParts.y, sParts.m, sParts.d).startUTC.toISOString();
      endISO = dayRangeBR(eParts.y, eParts.m, eParts.d).endUTC.toISOString();
      label = args.end_date && args.end_date !== args.start_date
        ? `${args.start_date} a ${args.end_date}`
        : (args.start_date ?? "data informada");
      break;
    }
    default: {
      const r = dayRangeBR(yBR, mBR, dBR);
      startISO = r.startUTC.toISOString(); endISO = r.endUTC.toISOString();
      label = "hoje";
    }
  }

  console.log("[report] period:", args.period, "range:", startISO, "→", endISO);

  // Busca COMPLETA — sem limite (até 10k transações por período)
  const { data: txs, error } = await supabase
    .from("transactions")
    .select("type, amount, category, occurred_at")
    .eq("user_id", userId)
    .gte("occurred_at", startISO)
    .lte("occurred_at", endISO)
    .order("occurred_at", { ascending: true })
    .limit(10000);

  if (error) {
    console.error("[report] db error:", error);
    return { error: error.message, period_label: label };
  }

  console.log("[report] rows:", txs?.length ?? 0);

  if (!txs || txs.length === 0) {
    return {
      period_label: label,
      count: 0,
      income: 0,
      expense: 0,
      balance: 0,
      top_category: null,
      by_category: {},
      message: "Você não teve movimentações nesse período.",
    };
  }

  let income = 0, expense = 0;
  const byCat: Record<string, number> = {};
  for (const t of txs) {
    const amt = Number(t.amount);
    if (t.type === "income") income += amt;
    else {
      expense += amt;
      const c = t.category || "Outros";
      byCat[c] = (byCat[c] || 0) + amt;
    }
  }
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0];

  return {
    period_label: label,
    count: txs.length,
    income: Number(income.toFixed(2)),
    expense: Number(expense.toFixed(2)),
    balance: Number((income - expense).toFixed(2)),
    top_category: top ? { name: top[0], amount: Number(top[1].toFixed(2)) } : null,
    by_category: Object.fromEntries(Object.entries(byCat).map(([k, v]) => [k, Number(v.toFixed(2))])),
  };
}
