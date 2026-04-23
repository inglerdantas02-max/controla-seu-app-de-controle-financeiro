import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

// Retorna no máximo 1 insight financeiro relevante baseado em dados reais do mês.
// Calculado deterministicamente (sem IA) — rápido, preciso e sem custo.
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

    // Mês atual em fuso BR
    const TZ = -3 * 60 * 60 * 1000;
    const nowBR = new Date(Date.now() + TZ);
    const y = nowBR.getUTCFullYear();
    const m = nowBR.getUTCMonth();
    const startUTC = new Date(Date.UTC(y, m, 1, 0, 0, 0) - TZ).toISOString();
    const endUTC = new Date(Date.UTC(y, m + 1, 0, 23, 59, 59, 999) - TZ).toISOString();

    const { data: txs } = await supabase
      .from("transactions")
      .select("type, amount, category, occurred_at")
      .eq("user_id", user.id)
      .gte("occurred_at", startUTC)
      .lte("occurred_at", endUTC)
      .limit(10000);

    if (!txs || txs.length < 3) {
      return new Response(JSON.stringify({ insight: null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let income = 0, expense = 0;
    const expByCat: Record<string, number> = {};
    for (const t of txs) {
      const amt = Number(t.amount);
      if (t.type === "income") income += amt;
      else {
        expense += amt;
        const c = t.category || "Outros";
        expByCat[c] = (expByCat[c] || 0) + amt;
      }
    }
    const balance = income - expense;
    const fmt = (n: number) =>
      n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // Prioridade de insights
    let insight: { text: string; tone: "warning" | "info" | "success" } | null = null;

    // 1) Saldo negativo
    if (balance < 0) {
      insight = {
        text: `⚠️ Atenção! Seu saldo do mês está negativo em ${fmt(Math.abs(balance))}. Você gastou mais do que recebeu.`,
        tone: "warning",
      };
    }
    // 2) Categoria > 40% dos gastos
    else if (expense > 0) {
      const top = Object.entries(expByCat).sort((a, b) => b[1] - a[1])[0];
      if (top && top[1] / expense >= 0.4) {
        const pct = Math.round((top[1] / expense) * 100);
        insight = {
          text: `🚨 Você está gastando muito com ${top[0]} esse mês — já é ${pct}% das suas saídas (${fmt(top[1])}).`,
          tone: "warning",
        };
      }
    }
    // 3) Saldo bem positivo
    if (!insight && income > 0 && balance > 0 && balance / income >= 0.3) {
      insight = {
        text: `✅ Mês saudável! Você teve mais entradas que saídas. Saldo positivo em ${fmt(balance)}.`,
        tone: "success",
      };
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
