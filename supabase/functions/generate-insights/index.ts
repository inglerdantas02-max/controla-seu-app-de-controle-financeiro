import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Lógica:
// - Durante o mês: dicas SEMANAIS suaves (observações sobre categorias da semana atual)
// - Nos últimos 3 dias do mês: insights MENSAIS "duros" (saldo negativo, categoria dominante, mês saudável)
// Tudo determinístico, sem IA — rápido e sem custo.
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
      return new Response(JSON.stringify({ insight: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Datas em fuso BR
    const TZ = -3 * 60 * 60 * 1000;
    const nowBR = new Date(Date.now() + TZ);
    const y = nowBR.getUTCFullYear();
    const m = nowBR.getUTCMonth();
    const today = nowBR.getUTCDate();
    const lastDayOfMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const daysUntilEndOfMonth = lastDayOfMonth - today;
    const isEndOfMonth = daysUntilEndOfMonth <= 2; // últimos 3 dias

    const startMonthUTC = new Date(Date.UTC(y, m, 1, 0, 0, 0) - TZ).toISOString();
    const endMonthUTC = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999) - TZ).toISOString();

    // Início da semana corrente (segunda-feira) em BR
    const dow = nowBR.getUTCDay(); // 0=dom..6=sab
    const daysSinceMonday = (dow + 6) % 7;
    const weekStartBR = new Date(Date.UTC(y, m, today - daysSinceMonday, 0, 0, 0));
    const startWeekUTC = new Date(weekStartBR.getTime() - TZ).toISOString();

    const fmt = (n: number) =>
      n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    type Insight = { text: string; tone: "warning" | "info" | "success" } | null;
    let insight: Insight = null;

    // ====== FIM DO MÊS: insights mensais consolidados ======
    if (isEndOfMonth) {
      const { data: monthTxs } = await supabase
        .from("transactions")
        .select("type, amount, category, occurred_at")
        .eq("user_id", user.id)
        .gte("occurred_at", startMonthUTC)
        .lte("occurred_at", endMonthUTC)
        .limit(10000);

      if (monthTxs && monthTxs.length >= 3) {
        let income = 0, expense = 0;
        const expByCat: Record<string, number> = {};
        for (const t of monthTxs) {
          const amt = Number(t.amount);
          if (t.type === "income") income += amt;
          else {
            expense += amt;
            const c = t.category || "Outros";
            expByCat[c] = (expByCat[c] || 0) + amt;
          }
        }
        const balance = income - expense;

        if (balance < 0) {
          insight = {
            text: `⚠️ Fechamento do mês: saldo negativo em ${fmt(Math.abs(balance))}. Você gastou mais do que recebeu neste mês.`,
            tone: "warning",
          };
        } else if (expense > 0) {
          const top = Object.entries(expByCat).sort((a, b) => b[1] - a[1])[0];
          if (top && top[1] / expense >= 0.4) {
            const pct = Math.round((top[1] / expense) * 100);
            insight = {
              text: `🚨 Fechamento do mês: ${top[0]} representou ${pct}% das suas saídas (${fmt(top[1])}). Vale revisar essa categoria.`,
              tone: "warning",
            };
          }
        }
        if (!insight && income > 0 && balance > 0 && balance / income >= 0.3) {
          insight = {
            text: `✅ Mês fechou saudável! Saldo positivo em ${fmt(balance)}.`,
            tone: "success",
          };
        }
      }
    }

    // ====== DURANTE O MÊS: dica semanal suave ======
    if (!insight) {
      const { data: weekTxs } = await supabase
        .from("transactions")
        .select("type, amount, category, occurred_at")
        .eq("user_id", user.id)
        .eq("type", "expense")
        .gte("occurred_at", startWeekUTC)
        .limit(5000);

      if (weekTxs && weekTxs.length >= 3) {
        const expByCat: Record<string, number> = {};
        let weekExpense = 0;
        for (const t of weekTxs) {
          const amt = Number(t.amount);
          weekExpense += amt;
          const c = t.category || "Outros";
          expByCat[c] = (expByCat[c] || 0) + amt;
        }

        const sorted = Object.entries(expByCat).sort((a, b) => b[1] - a[1]);
        const top = sorted[0];
        // Só fala se a categoria top representa >= 30% da semana e tem ao menos R$ 50
        if (top && weekExpense > 0 && top[1] / weekExpense >= 0.3 && top[1] >= 50) {
          insight = {
            text: `💡 Percebi que essa semana você gastou bastante com ${top[0]} (${fmt(top[1])}). Pode ser interessante ficar de olho.`,
            tone: "info",
          };
        }
      }
    }

    return new Response(JSON.stringify({ insight }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("generate-insights error:", e);
    return new Response(JSON.stringify({ insight: null }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
