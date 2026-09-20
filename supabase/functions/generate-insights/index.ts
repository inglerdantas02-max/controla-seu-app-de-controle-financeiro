import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Coach financeiro proativo — gera múltiplos insights determinísticos
// baseados nos dados reais do usuário. Sem IA, sem custo, rápido.
//
// Tipos de insight:
//  - alert     → algo que precisa de atenção imediata (pico ou concentração de gastos)
//  - pattern   → padrão recorrente identificado (Uber diário, fim de semana caro)
//  - trend     → comparação com período anterior (gastou mais que ontem, semana cara)
//  - tip       → sugestão prática de ação
//  - summary   → CTA para abrir resumo no chat
//  - celebrate → reconhecimento positivo
//
// Cada insight tem: id, text, tone, action? (texto a enviar ao chat ao clicar)

type Tone = "warning" | "info" | "success" | "danger";
type Insight = {
  id: string;
  text: string;
  tone: Tone;
  action?: string; // mensagem que será enviada ao chat ao clicar
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: userData } = await supabase.auth.getUser();
    const user = userData?.user;
    if (!user) {
      return new Response(JSON.stringify({ insight: null, insights: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Nome (para personalização)
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .maybeSingle();
    const firstName = ((profile?.full_name || "").trim().split(" ")[0] || "")
      .replace(/^./, (c) => c.toUpperCase());

    // Datas em fuso BR
    const TZ = -3 * 60 * 60 * 1000;
    const nowBR = new Date(Date.now() + TZ);
    const y = nowBR.getUTCFullYear();
    const m = nowBR.getUTCMonth();
    const today = nowBR.getUTCDate();
    const currentHour = nowBR.getUTCHours();
    const dow = nowBR.getUTCDay(); // 0=dom..6=sab
    const lastDayOfMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const isEndOfMonth = lastDayOfMonth - today <= 2;

    const dayRangeUTC = (yy: number, mm: number, dd: number) => ({
      start: new Date(Date.UTC(yy, mm, dd, 0, 0, 0) - TZ).toISOString(),
      end: new Date(Date.UTC(yy, mm, dd, 23, 59, 59, 999) - TZ).toISOString(),
    });

    const todayR = dayRangeUTC(y, m, today);
    const yesterdayR = dayRangeUTC(y, m, today - 1);

    // Início da semana corrente (segunda)
    const daysSinceMonday = (dow + 6) % 7;
    const weekStartUTC = new Date(
      Date.UTC(y, m, today - daysSinceMonday, 0, 0, 0) - TZ
    ).toISOString();
    // Semana anterior (mesmo nº de dias até agora, p/ comparação justa)
    const prevWeekStartUTC = new Date(
      Date.UTC(y, m, today - daysSinceMonday - 7, 0, 0, 0) - TZ
    ).toISOString();
    const prevWeekEndUTC = new Date(
      Date.UTC(y, m, today - daysSinceMonday - 1, 23, 59, 59, 999) - TZ
    ).toISOString();

    const startMonthUTC = new Date(Date.UTC(y, m, 1, 0, 0, 0) - TZ).toISOString();
    const endMonthUTC = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999) - TZ).toISOString();

    // Últimos 30 dias para detectar padrões
    const last30StartUTC = new Date(
      Date.UTC(y, m, today - 29, 0, 0, 0) - TZ
    ).toISOString();

    const fmt = (n: number) =>
      n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // Carrega tudo dos últimos 30 dias (suficiente p/ análises)
    const { data: last30Tx } = await supabase
      .from("transactions")
      .select("amount, category, occurred_at")
      .eq("user_id", user.id)
      .eq("type", "expense")
      .gte("occurred_at", last30StartUTC)
      .order("occurred_at", { ascending: true })
      .limit(5000);

    const all = last30Tx || [];

    let monthExpense = 0;
    const monthExpByCat: Record<string, number> = {};
    const todayExpByCat: Record<string, number> = {};
    let todayExpense = 0, todayCount = 0, todayExpenseCount = 0;
    let yesterdayExpense = 0;
    let weekExpense = 0;
    let prevWeekExpense = 0;
    const weekExpByCat: Record<string, number> = {};

    // Padrões: contagem por categoria (descrição+categoria) nos últimos 30d
    const patternCount: Record<string, number> = {};
    // Por dia da semana (saídas)
    const dowExpense: number[] = [0, 0, 0, 0, 0, 0, 0];
    const dowDaysWithData: Set<number>[] = [
      new Set(), new Set(), new Set(), new Set(), new Set(), new Set(), new Set()
    ];

    for (const t of all) {
      const amt = Number(t.amount);
      const occUTC = new Date(t.occurred_at);
      const occBR = new Date(occUTC.getTime() + TZ);
      const occISO = t.occurred_at as string;
      const occDay = occBR.getUTCDate();
      const occMonth = occBR.getUTCMonth();
      const occYear = occBR.getUTCFullYear();
      const occDow = occBR.getUTCDay();
      const dayKey = `${occYear}-${occMonth}-${occDay}`;

      // Mês corrente
      if (occISO >= startMonthUTC && occISO <= endMonthUTC) {
        monthExpense += amt;
        const c = t.category || "Outros";
        monthExpByCat[c] = (monthExpByCat[c] || 0) + amt;
      }

      // Hoje
      if (occISO >= todayR.start && occISO <= todayR.end) {
        todayCount++;
        todayExpense += amt;
        todayExpenseCount++;
        const c = t.category || "Outros";
        todayExpByCat[c] = (todayExpByCat[c] || 0) + amt;
      }

      // Ontem
      if (occISO >= yesterdayR.start && occISO <= yesterdayR.end) {
        yesterdayExpense += amt;
      }

      // Semana corrente
      if (occISO >= weekStartUTC) {
        weekExpense += amt;
        const c = t.category || "Outros";
        weekExpByCat[c] = (weekExpByCat[c] || 0) + amt;
      }

      // Semana anterior
      if (occISO >= prevWeekStartUTC && occISO <= prevWeekEndUTC) {
        prevWeekExpense += amt;
      }

      // Padrões: somente saídas com categoria
      if (t.category) {
        patternCount[t.category] = (patternCount[t.category] || 0) + 1;
      }

      // Dia da semana (saídas)
      dowExpense[occDow] += amt;
      dowDaysWithData[occDow].add(dayKey);
    }

    const insights: Insight[] = [];
    const named = (s: string) => (firstName ? `${firstName}, ${s}` : s.charAt(0).toUpperCase() + s.slice(1));
    // O coach só fecha conclusões do dia após as 18h em Brasília e com
    // pelo menos duas despesas. Antes disso, prioriza padrões consolidados.
    const canAssessToday = currentHour >= 18 && todayExpenseCount >= 2;

    // ===== 1) FECHAMENTO DO MÊS BASEADO SOMENTE EM DESPESAS =====
    if (isEndOfMonth && monthExpense > 0) {
      insights.push({
        id: "month-expense-summary",
        text: `📊 ${named(`suas despesas somam ${fmt(monthExpense)} neste mês. Vale revisar as categorias com maior peso antes do fechamento.`)}`,
        tone: "info",
        action: "Quais foram meus maiores gastos esse mês?",
      });
    }

    // ===== 2) COMPARAÇÃO HOJE vs ONTEM =====
    if (canAssessToday && todayExpense > 0 && yesterdayExpense > 0) {
      if (todayExpense > yesterdayExpense * 1.5) {
        const pct = Math.round(((todayExpense - yesterdayExpense) / yesterdayExpense) * 100);
        insights.push({
          id: "today-vs-yesterday-up",
          text: `👀 Você já gastou ${pct}% a mais hoje do que ontem inteiro (${fmt(todayExpense)} vs ${fmt(yesterdayExpense)}).`,
          tone: "warning",
        });
      } else if (todayExpense < yesterdayExpense * 0.5) {
        insights.push({
          id: "today-vs-yesterday-down",
          text: `🔥 Mandando bem! Hoje você gastou ${fmt(yesterdayExpense - todayExpense)} a menos que ontem.`,
          tone: "success",
        });
      }
    }

    // ===== 3) SEMANA ATUAL vs SEMANA PASSADA =====
    if (weekExpense > 0 && prevWeekExpense > 0 && today - daysSinceMonday >= 1) {
      if (weekExpense > prevWeekExpense * 1.4) {
        const pct = Math.round(((weekExpense - prevWeekExpense) / prevWeekExpense) * 100);
        insights.push({
          id: "week-up",
          text: `📈 Cuidado: seus gastos da semana estão ${pct}% acima da semana passada.`,
          tone: "warning",
          action: "Onde eu gastei mais essa semana?",
        });
      }
    }

    // ===== 4) CATEGORIA DOMINANTE NA SEMANA =====
    if (weekExpense > 0) {
      const sortedWeek = Object.entries(weekExpByCat).sort((a, b) => b[1] - a[1]);
      const topW = sortedWeek[0];
      if (topW && topW[1] / weekExpense >= 0.4 && topW[1] >= 50) {
        const pct = Math.round((topW[1] / weekExpense) * 100);
        insights.push({
          id: `cat-dominant-${topW[0]}`,
          text: `💡 ${topW[0]} representa ${pct}% dos seus gastos da semana (${fmt(topW[1])}). Que tal reduzir um pouco?`,
          tone: "info",
          action: `Quanto gastei com ${topW[0]} essa semana?`,
        });
      }
    }

    // ===== 5) PADRÃO RECORRENTE (categoria usada em 8+ dias dos últimos 30) =====
    const recurring = Object.entries(patternCount)
      .filter(([, c]) => c >= 8)
      .sort((a, b) => b[1] - a[1])[0];
    if (recurring && !insights.some((i) => i.id.startsWith("cat-dominant"))) {
      insights.push({
        id: `pattern-${recurring[0]}`,
        text: `🔁 Notei que ${recurring[0]} aparece com frequência nos seus gastos (${recurring[1]}x nos últimos 30 dias).`,
        tone: "info",
        action: `Quanto gastei com ${recurring[0]} esse mês?`,
      });
    }

    // ===== 6) PADRÃO DE FIM DE SEMANA =====
    const weekendDays = dowDaysWithData[0].size + dowDaysWithData[6].size;
    const weekDays =
      dowDaysWithData[1].size + dowDaysWithData[2].size + dowDaysWithData[3].size +
      dowDaysWithData[4].size + dowDaysWithData[5].size;
    const weekendExp = dowExpense[0] + dowExpense[6];
    const weekdayExp = dowExpense[1] + dowExpense[2] + dowExpense[3] + dowExpense[4] + dowExpense[5];
    if (weekendDays >= 3 && weekDays >= 5 && weekendExp > 0 && weekdayExp > 0) {
      const avgWeekend = weekendExp / weekendDays;
      const avgWeekday = weekdayExp / weekDays;
      if (avgWeekend > avgWeekday * 1.6) {
        insights.push({
          id: "weekend-pattern",
          text: `📅 Você costuma gastar mais aos finais de semana (média ${fmt(avgWeekend)}/dia vs ${fmt(avgWeekday)} em dias úteis).`,
          tone: "info",
        });
      }
    }

    // ===== 7) MAIOR GASTO DE HOJE =====
    if (canAssessToday && todayExpense > 0) {
      const topT = Object.entries(todayExpByCat).sort((a, b) => b[1] - a[1])[0];
      if (topT) {
        insights.push({
          id: "today-top",
          text: `📤 Seu maior gasto hoje foi com ${topT[0]} (${fmt(topT[1])}).`,
          tone: "info",
        });
      }
    }

    // ===== 8) MUITAS TRANSAÇÕES NO DIA =====
    if (canAssessToday && todayCount >= 6) {
      insights.push({
        id: "many-today",
        text: `⚠️ Você já registrou ${todayCount} movimentações hoje. Que tal dar uma respirada nos gastos?`,
        tone: "warning",
        action: "Me mostra o resumo de hoje",
      });
    }

    // ===== 9) DIA SEM REGISTRO (CTA suave) =====
    if (currentHour >= 18 && todayCount === 0 && all.length > 0) {
      insights.push({
        id: "today-empty",
        text: `${firstName ? firstName + ", q" : "Q"}ue tal registrar como o dia tá indo? 👇`,
        tone: "info",
      });
    }

    // ===== 10) BOAS-VINDAS / PRIMEIRA EXPERIÊNCIA =====
    if (all.length === 0) {
      insights.push({
        id: "first-time",
        text: `${firstName ? "Bem-vindo, " + firstName + "! " : "Bem-vindo! "}Me conta seus gastos que eu organizo tudo pra você 🚀`,
        tone: "info",
      });
    }

    // Ordena por importância: danger > warning > success > info
    const tonePriority: Record<Tone, number> = { danger: 0, warning: 1, success: 2, info: 3 };
    insights.sort((a, b) => tonePriority[a.tone] - tonePriority[b.tone]);

    // Mantém compatibilidade com chamadas antigas (campo `insight` único)
    const primary = insights[0] || null;

    return new Response(
      JSON.stringify({
        insight: primary ? { text: primary.text, tone: primary.tone === "danger" ? "warning" : primary.tone, action: primary.action } : null,
        insights, // lista completa para o dashboard exibir até 3
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("generate-insights error:", e);
    return new Response(JSON.stringify({ insight: null, insights: [] }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
