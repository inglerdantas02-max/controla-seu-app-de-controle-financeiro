import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { message, history } = await req.json();
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

    // Personalização: nome do usuário
    let firstName = "";
    try {
      const { data: prof } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .maybeSingle();
      firstName = ((prof?.full_name || "").trim().split(" ")[0] || "")
        .replace(/^./, (c: string) => c.toUpperCase());
    } catch {}

    // Memória inteligente: top categorias usadas pelo usuário (últimos 90 dias)
    let userCategoriesHint = "";
    try {
      const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentTx } = await supabase
        .from("transactions")
        .select("category")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .gte("occurred_at", since)
        .not("category", "is", null)
        .limit(500);
      if (recentTx && recentTx.length) {
        const expCats: Record<string, number> = {};
        for (const t of recentTx as any[]) {
          expCats[t.category] = (expCats[t.category] || 0) + 1;
        }
        const top = (b: Record<string, number>) =>
          Object.entries(b).sort((a, c) => c[1] - a[1]).slice(0, 8).map(([k]) => k);
        const e = top(expCats);
        const parts: string[] = [];
        if (e.length) parts.push(`Categorias frequentes de despesas: ${e.join(", ")}`);
        if (parts.length) userCategoriesHint = `\n\n🧠 MEMÓRIA DO USUÁRIO — REUTILIZE estas categorias quando fizer sentido (mantém padrão):\n${parts.join("\n")}`;
      }
    } catch (e) {
      console.warn("[memory] could not load user categories", e);
    }

    const tools = [
      {
        type: "function",
        function: {
          name: "register_transaction",
          description: "Registra uma despesa identificada na mensagem do usuário.",
          parameters: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["expense"] },
              amount: { type: "number", description: "Valor em reais (positivo)" },
              category: { type: "string" },
              description: { type: "string" },
              occurred_at: {
                type: "string",
                description: `Data da transação no formato YYYY-MM-DD (fuso Brasília). Hoje é ${today}. Use somente se o usuário indicar uma data diferente de hoje (ex: 'ontem', 'anteontem', 'na segunda', 'dia 12', '15/03'). Se não for indicada, OMITA este campo (será considerado hoje).`,
              },
              reply: { type: "string", description: "Confirmação amigável em PT-BR. Se houver data diferente de hoje, mencione (ex: 'Deseja registrar uma saída de R$30 com Uber em 27/04?')." },
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
          description: "Consulta as despesas reais do usuário e gera um relatório para um período (hoje, ontem, semana, mês ou data específica). Pode filtrar por categoria. Use sempre que o usuário pedir resumo, relatório ou perguntar quanto gastou.",
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
              category_filter: {
                type: "string",
                description: "Filtra por categoria (case-insensitive, busca parcial). Ex: 'Uber' ou 'Alimentação'. Use para perguntas como 'quanto gastei com Uber'.",
              },
            },
            required: ["period"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "get_bills_report",
          description: "Consulta as contas a pagar reais do usuário. Use para perguntas sobre contas pendentes, pagas, vencidas, próximos vencimentos e quanto falta pagar.",
          parameters: {
            type: "object",
            properties: {
              period: {
                type: "string",
                enum: ["today", "week", "month", "next_month"],
                description: "Período das contas. Default: month",
              },
              status_filter: {
                type: "string",
                enum: ["pending", "paid", "overdue", "any"],
                description: "Situação solicitada. Default: any",
              },
            },
            required: [],
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
        content: `Você é o assistente financeiro pessoal do app CONTROLA — inteligente, preciso, proativo e amigável. Hoje é ${today} (fuso Brasília).${firstName ? `\n\n👤 USUÁRIO: ${firstName}. Use o nome dele com naturalidade (1 a cada 2-3 mensagens, no início da frase). Ex: "${firstName}, hoje você foi bem 🔥". NUNCA force o nome em toda resposta.` : ""}

🧠 SUA MISSÃO: entender, analisar e orientar o usuário exclusivamente sobre gastos, despesas e contas a pagar. O CONTROLA não acompanha saldo, entradas, renda ou dinheiro disponível. Nunca calcule, estime ou afirme saldo, lucro, prejuízo, valor disponível ou quanto ainda pode gastar.

Você tem 4 ferramentas:
1) register_transaction → quando o usuário descreve um gasto ("gastei 30 com almoço", "paguei 50 de uber"). Não registre entradas, ganhos, salário ou dinheiro recebido.
2) get_financial_report → SEMPRE que o usuário perguntar sobre GASTOS, DESPESAS, RESUMO, ou usar expressões como:
   - "quanto gastei..."
   - "como tá meu mês/semana/dia"
   - "onde estou gastando mais"
   Se ele perguntar sobre saldo, renda, lucro, prejuízo, quanto sobrou ou quanto ainda pode gastar, explique brevemente que o CONTROLA acompanha despesas e contas, e ofereça uma análise dos gastos do período. Não tente responder usando entradas antigas.
3) get_bills_report → SEMPRE que o usuário perguntar sobre contas a pagar, contas vencidas, próximas contas, vencimentos, contas pagas ou quanto falta pagar. Exemplos:
   - "quais contas vencem hoje/esta semana?"
   - "tenho contas atrasadas?"
   - "quanto falta pagar este mês?"
   - "quais contas já paguei?"
4) chat_reply → APENAS para saudações ("oi", "olá") ou dúvidas gerais sobre como usar o app. NUNCA invente valores aqui.

⚠️ REGRA DE OURO — PRECISÃO:
- NUNCA invente valores. Se o usuário pergunta qualquer coisa numérica, chame get_financial_report PRIMEIRO.
- Sempre mostre valores em R$ formatados (ex: R$ 1.234,56), categorias e período na resposta.

CATEGORIZAÇÃO AUTOMÁTICA — sempre preencha 'category' ao registrar:

📤 SAÍDAS (expense) — categorias padrão:
- Transporte → Uber, 99, taxi, gasolina, combustível, ônibus, metrô, estacionamento, pedágio
- Alimentação → almoço, jantar, café, lanche, restaurante, ifood, mercado, padaria, supermercado
- Moradia → aluguel, condomínio, luz, água, gás, internet, IPTU
- Lazer → cinema, show, viagem, passeio, bar, balada, streaming, jogo
- Saúde → farmácia, remédio, médico, plano de saúde, academia
- Educação → curso, faculdade, livro, escola, material
- Compras → roupa, eletrônico, presente
- Outros → quando não se encaixar

📅 DATA DA TRANSAÇÃO (occurred_at):
- Hoje é ${today} (Brasília). Se o usuário NÃO mencionar data, OMITA o campo (será hoje).
- Se mencionar data relativa, calcule e envie em YYYY-MM-DD:
  • "ontem" → ontem; "anteontem" → 2 dias atrás
  • "semana passada", "na segunda passada", "sexta passada" → calcule a data exata
  • "dia 12", "no dia 5" → mesmo mês atual; se já passou bem demais, use o mês anterior só se o usuário deixar claro
  • "12/03", "12/03/2026" → converta para YYYY-MM-DD
- Quando confirmar a transação no 'reply', cite a data no formato DD/MM se for diferente de hoje.

Se o usuário usar uma categoria personalizada (ex: "categoria pets"), respeite e use exatamente como ele disse.

Para relatórios:
- SEMPRE chame get_financial_report PRIMEIRO para obter dados reais antes de responder.
- Se o usuário perguntar sobre uma categoria específica (ex: "quanto gastei com Uber"), use 'category_filter'.
- Formate a resposta com emojis relacionados a despesas (💸/📤 gastos, 🏆 categoria principal, 📊 comparação).
- Se não houver dados, diga: "Você não teve despesas nesse período."

✍️ ESTILO DE RESPOSTA — humanizado, simples, direto:
- Use linguagem amigável e direta ("Você gastou…", "Sua maior despesa foi…").
- Sempre inclua: valores formatados, categorias relevantes e o período analisado.
- Compare despesas entre períodos e destaque categorias, frequência e concentração sem tirar conclusões sobre renda ou capacidade de pagamento.
- Ex: "Você gastou R$ 420 em Alimentação este mês, 30% acima da semana anterior. Essa foi sua maior categoria."
- Sinalize com emoji: 📊 comparação, ⚠️ aumento relevante, 🏆 maior categoria.
- Se uma categoria representar mais de 40% dos gastos, alerte gentilmente: "Atenção: Uber é 45% dos seus gastos do mês 🚗".${userCategoriesHint}

🤔 SE NÃO ENTENDER a mensagem do usuário, NÃO invente. Use chat_reply para pedir confirmação amigável, ex: "Não entendi muito bem 😅 Você quis dizer que gastou R$ 50,00 com Uber?"`,
      },
      ...(Array.isArray(history) ? history.filter((m: any) => m && (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim()).slice(-8).map((m: any) => ({ role: m.role, content: m.content })) : []),
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
          occurred_at: args.occurred_at || null,
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

      if (fnName === "get_bills_report") {
        const report = await buildBillsReport(supabase, user.id, args);
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
        continue;
      }
    }

    return new Response(JSON.stringify({ is_transaction: false, reply: "Não consegui processar. Tente novamente." }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("parse-transaction error:", e);
    return new Response(JSON.stringify({ error: "Erro interno. Tente novamente." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function buildBillsReport(supabase: any, userId: string, args: any) {
  const now = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const today = now.toISOString().slice(0, 10);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const makeYmd = (date: Date) => date.toISOString().slice(0, 10);
  let start = `${y}-${String(m + 1).padStart(2, "0")}-01`;
  let end = makeYmd(new Date(Date.UTC(y, m + 1, 0)));
  let label = "este mês";

  if (args.period === "today") {
    start = today;
    end = today;
    label = "hoje";
  } else if (args.period === "week") {
    end = makeYmd(new Date(Date.UTC(y, m, now.getUTCDate() + 7)));
    start = today;
    label = "os próximos 7 dias";
  } else if (args.period === "next_month") {
    start = makeYmd(new Date(Date.UTC(y, m + 1, 1)));
    end = makeYmd(new Date(Date.UTC(y, m + 2, 0)));
    label = "o próximo mês";
  }

  const { data, error } = await supabase
    .from("bill_occurrences")
    .select("name, amount, category, due_date, status, paid_at")
    .eq("user_id", userId)
    .gte("due_date", start)
    .lte("due_date", end)
    .order("due_date", { ascending: true })
    .limit(1000);

  if (error) return { error: error.message, period_label: label };

  const requested = args.status_filter || "any";
  const rows = (data || []).filter((bill: any) => {
    if (requested === "overdue") return bill.status === "pending" && bill.due_date < today;
    if (requested === "pending") return bill.status === "pending";
    if (requested === "paid") return bill.status === "paid";
    return true;
  });
  const pending = rows.filter((bill: any) => bill.status === "pending");
  const paid = rows.filter((bill: any) => bill.status === "paid");
  const overdue = pending.filter((bill: any) => bill.due_date < today);
  const total = (items: any[]) => Number(items.reduce((sum, item) => sum + Number(item.amount), 0).toFixed(2));

  return {
    period_label: label,
    status_filter: requested,
    count: rows.length,
    total: total(rows),
    pending_total: total(pending),
    paid_total: total(paid),
    overdue_total: total(overdue),
    overdue_count: overdue.length,
    bills: rows.slice(0, 30).map((bill: any) => ({
      name: bill.name,
      amount: Number(bill.amount),
      category: bill.category || "Outros",
      due_date: bill.due_date,
      status: bill.status === "paid" ? "paga" : bill.due_date < today ? "vencida" : "pendente",
    })),
    message: rows.length ? undefined : "Nenhuma conta encontrada nesse período.",
  };
}

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
    .select("amount, category, occurred_at")
    .eq("user_id", userId)
    .eq("type", "expense")
    .gte("occurred_at", startISO)
    .lte("occurred_at", endISO)
    .order("occurred_at", { ascending: true })
    .limit(10000);

  if (error) {
    console.error("[report] db error:", error);
    return { error: error.message, period_label: label };
  }

  console.log("[report] rows:", txs?.length ?? 0);

  // Filtros adicionais
  const categoryFilter: string | undefined = args.category_filter?.trim();

  let filtered = txs || [];
  if (categoryFilter) {
    const needle = categoryFilter.toLowerCase();
    filtered = filtered.filter((t: any) => (t.category || "").toLowerCase().includes(needle));
  }

  if (!filtered || filtered.length === 0) {
    return {
      period_label: label,
      category_filter: categoryFilter || null,
      count: 0,
      expense: 0,
      top_expense_category: null,
      expense_by_category: {},
      message: "Você não teve despesas nesse período.",
    };
  }

  let expense = 0;
  const expenseByCat: Record<string, number> = {};
  for (const t of filtered) {
    const amt = Number(t.amount);
    const cat = t.category || "Outros";
    expense += amt;
    expenseByCat[cat] = (expenseByCat[cat] || 0) + amt;
  }
  const topExp = Object.entries(expenseByCat).sort((a, b) => b[1] - a[1])[0];
  const round = (n: number) => Number(n.toFixed(2));
  const mapRound = (o: Record<string, number>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round(v)]));

  return {
    period_label: label,
    category_filter: categoryFilter || null,
    count: filtered.length,
    expense: round(expense),
    top_expense_category: topExp ? { name: topExp[0], amount: round(topExp[1]) } : null,
    expense_by_category: mapRound(expenseByCat),
  };
}
