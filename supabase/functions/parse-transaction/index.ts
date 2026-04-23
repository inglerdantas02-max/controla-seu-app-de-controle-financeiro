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
          description: "Consulta as transações reais do usuário e gera um relatório para um período (hoje, ontem, semana, mês ou data específica). Pode filtrar por tipo (entrada/saída) e/ou categoria. Use sempre que o usuário pedir resumo, relatório, ou perguntar quanto gastou/recebeu (ex: 'quanto gastei com Uber esse mês', 'quanto recebi de salário').",
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
              type_filter: {
                type: "string",
                enum: ["income", "expense", "any"],
                description: "Filtrar apenas entradas, saídas, ou ambas. Default: any",
              },
              category_filter: {
                type: "string",
                description: "Filtra por categoria (case-insensitive, busca parcial). Ex: 'Uber', 'Salário', 'Vendas'. Use para perguntas como 'quanto gastei com Uber' ou 'quanto recebi de salário'.",
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
        content: `Você é o assistente financeiro pessoal do app CONTROLA — inteligente, preciso, proativo e amigável. Hoje é ${today} (fuso Brasília).

🧠 SUA MISSÃO: não apenas registrar dados — entender, analisar e orientar o usuário sobre a vida financeira dele.

Você tem 3 ferramentas:
1) register_transaction → quando o usuário descreve um gasto/ganho ("gastei 30 com almoço", "recebi 200 de salário", "vendi 150 reais", "paguei 50 de uber", "recebi pix 100").
2) get_financial_report → SEMPRE que o usuário perguntar sobre VALORES, SALDO, RESUMO, ou usar expressões como:
   - "quanto gastei/recebi/ganhei..."
   - "quanto sobrou pra mim hoje" → period=today (mostre saldo)
   - "to no prejuízo?" / "tô no vermelho?" → period=month (avalie saldo)
   - "quanto ainda posso gastar" → period=month (calcule income - expense)
   - "como tá meu mês/semana/dia"
   - "qual meu saldo"
3) chat_reply → APENAS para saudações ("oi", "olá") ou dúvidas gerais sobre como usar o app. NUNCA invente valores aqui.

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

📥 ENTRADAS (income) — categorias padrão:
- Salário → salário, holerite, pagamento mensal do trabalho
- Vendas → vendi, venda de produto/serviço próprio
- Freelance → freela, projeto, bico, trabalho extra pontual
- Transferências → pix recebido, transferência, devolução de empréstimo
- Investimentos → rendimento, dividendo, juros, resgate
- Outros ganhos → presente recebido, prêmio, reembolso, indenização

Se o usuário usar uma categoria personalizada (ex: "categoria pets"), respeite e use exatamente como ele disse.

Para relatórios:
- SEMPRE chame get_financial_report PRIMEIRO para obter dados reais antes de responder.
- Se o usuário perguntar sobre uma categoria específica (ex: "quanto gastei com Uber", "quanto recebi de salário"), use 'category_filter' E 'type_filter' ('expense' para gastos, 'income' para receitas).
- Formate a resposta com emojis (💰/📥 entradas, 💸/📤 saídas, 📉 saldo, 🏆 categoria top).
- Para receitas, use emojis temáticos: 💼 Salário, 🛒 Vendas, 💻 Freelance, 🔄 Transferências, 📈 Investimentos.
- Se não houver dados, diga: "Você não teve movimentações nesse período."

✍️ ESTILO DE RESPOSTA — humanizado, simples, direto:
- Use 1ª pessoa amigável ("Você gastou…", "Seu saldo está…").
- Sempre inclua: valores formatados, categorias relevantes e o período analisado.
- Para "quanto sobrou hoje" / "quanto posso gastar": mostre saldo do período + breve avaliação.
  Ex: "Hoje você recebeu R$ 200 e gastou R$ 120. Sobrou R$ 80 ✅"
- Para "to no prejuízo?": avalie saldo do mês.
  Ex: "No mês você gastou R$ 1.500 e recebeu R$ 1.200. Está no vermelho em R$ 300 ⚠️" ou "Tranquilo! Saldo positivo em R$ X ✅"
- Sinalize com emoji: ✅ saldo positivo, ⚠️ saldo negativo, 🏆 maior categoria.
- Se uma categoria representar mais de 40% dos gastos, alerte gentilmente: "Atenção: Uber é 45% dos seus gastos do mês 🚗".`,
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
    return new Response(JSON.stringify({ error: "Erro interno. Tente novamente." }), {
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

  // Filtros adicionais
  const typeFilter: "income" | "expense" | "any" = args.type_filter || "any";
  const categoryFilter: string | undefined = args.category_filter?.trim();

  let filtered = txs || [];
  if (typeFilter !== "any") filtered = filtered.filter((t: any) => t.type === typeFilter);
  if (categoryFilter) {
    const needle = categoryFilter.toLowerCase();
    filtered = filtered.filter((t: any) => (t.category || "").toLowerCase().includes(needle));
  }

  if (!filtered || filtered.length === 0) {
    return {
      period_label: label,
      type_filter: typeFilter,
      category_filter: categoryFilter || null,
      count: 0,
      income: 0,
      expense: 0,
      balance: 0,
      top_expense_category: null,
      top_income_category: null,
      expense_by_category: {},
      income_by_category: {},
      message: "Você não teve movimentações nesse período.",
    };
  }

  let income = 0, expense = 0;
  const expenseByCat: Record<string, number> = {};
  const incomeByCat: Record<string, number> = {};
  for (const t of filtered) {
    const amt = Number(t.amount);
    const cat = t.category || "Outros";
    if (t.type === "income") {
      income += amt;
      incomeByCat[cat] = (incomeByCat[cat] || 0) + amt;
    } else {
      expense += amt;
      expenseByCat[cat] = (expenseByCat[cat] || 0) + amt;
    }
  }
  const topExp = Object.entries(expenseByCat).sort((a, b) => b[1] - a[1])[0];
  const topInc = Object.entries(incomeByCat).sort((a, b) => b[1] - a[1])[0];
  const round = (n: number) => Number(n.toFixed(2));
  const mapRound = (o: Record<string, number>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, round(v)]));

  return {
    period_label: label,
    type_filter: typeFilter,
    category_filter: categoryFilter || null,
    count: filtered.length,
    income: round(income),
    expense: round(expense),
    balance: round(income - expense),
    top_expense_category: topExp ? { name: topExp[0], amount: round(topExp[1]) } : null,
    top_income_category: topInc ? { name: topInc[0], amount: round(topInc[1]) } : null,
    expense_by_category: mapRound(expenseByCat),
    income_by_category: mapRound(incomeByCat),
  };
}
