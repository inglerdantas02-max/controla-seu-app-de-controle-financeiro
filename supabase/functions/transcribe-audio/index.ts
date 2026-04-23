// Transcribe audio (base64) using Lovable AI (Gemini multimodal) and
// post-process the text for Brazilian Portuguese financial messages.
// Input:  { audio: string (base64, no data: prefix), mimeType?: string }
// Output: { text: string }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um transcritor especialista de áudios curtos em português do Brasil sobre finanças pessoais (gastos, ganhos, contas, salário, vendas).

REGRAS OBRIGATÓRIAS:
1. Transcreva o que foi falado CORRIGINDO erros de pronúncia, gramática e português coloquial.
2. Primeira letra MAIÚSCULA. Pontuação final correta (. ! ?).
3. Converta valores falados para "R$ N" (sem centavos quando inteiros):
   - "trinta real" / "trinta reais" / "trinta conto" / "trinta pila" -> "R$ 30"
   - "duzentos" / "dusento" / "duzento" -> "R$ 200"
   - "mil e quinhentos" / "um e meio" (em contexto de mil) -> "R$ 1500"
   - "vinte e cinco e cinquenta" / "vinte e cinco com cinquenta" -> "R$ 25,50"
   - "cento e vinte" -> "R$ 120"
   - "dois mil" -> "R$ 2000"
4. Corrija palavras mal pronunciadas e gírias para o termo correto:
   - "almoco" -> "almoço"; "gasolinha" -> "gasolina"; "merca" / "mercadinho" -> "mercado"
   - "uber", "ifood", "pix" mantém em minúsculo dentro da frase mas capitalize "Uber", "iFood", "Pix" quando forem nomes próprios
   - "salario" -> "salário"; "frila" / "freela" -> "freela"
   - "rangu" / "boia" -> "comida"; "trampo" -> "trabalho"
5. Identifique a INTENÇÃO financeira e use o verbo correto:
   - Saída: "gastei", "paguei", "comprei", "torrei" -> mantenha o verbo natural
   - Entrada: "ganhei", "recebi", "vendi", "caiu", "entrou", "pingou" -> normalize para "Ganhei" ou "Recebi"
6. Mantenha o sentido original. NÃO invente valores, datas ou categorias que não foram ditas.
7. Se o áudio estiver inaudível, ininteligível ou for apenas ruído, responda exatamente: INAUDIVEL
8. Responda APENAS com a frase corrigida. SEM aspas, SEM explicações, SEM prefixos como "Transcrição:".

Exemplos:
Áudio: "gastei trinta real no almoco"          -> Gastei R$ 30 no almoço.
Áudio: "ganhei dusento hoje"                    -> Ganhei R$ 200 hoje.
Áudio: "paguei cinquenta na gasolinha"          -> Paguei R$ 50 na gasolina.
Áudio: "recebi meu salario de dois mil"         -> Recebi meu salário de R$ 2000.
Áudio: "vendi um produto por cento e cinquenta" -> Vendi um produto por R$ 150.
Áudio: "torrei vinte conto no ifood"            -> Gastei R$ 20 no iFood.
Áudio: "pinguei um pix de quinhentos"           -> Recebi um Pix de R$ 500.
Áudio: "frila de trezentos"                     -> Recebi R$ 300 de freela.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { audio, mimeType } = await req.json();
    if (!audio || typeof audio !== "string") {
      return new Response(JSON.stringify({ error: "Missing audio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(
        JSON.stringify({ error: "LOVABLE_API_KEY não configurada" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const mt = (mimeType || "audio/webm").toLowerCase();
    const format = mt.includes("mp4") || mt.includes("m4a") || mt.includes("aac")
      ? "mp4"
      : mt.includes("ogg")
      ? "ogg"
      : mt.includes("wav")
      ? "wav"
      : "webm";

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: [
              { type: "text", text: "Transcreva e corrija o áudio a seguir conforme as regras." },
              // IMPORTANT: data must be raw base64 (NO "data:...;base64," prefix)
              { type: "input_audio", input_audio: { data: audio, format } },
            ],
          },
        ],
      }),
    });

    if (!resp.ok) {
      const t = await resp.text();
      console.error("AI gateway error", resp.status, t);
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Muitas requisições. Tente novamente em instantes." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Créditos esgotados. Adicione créditos em Settings > Workspace > Usage." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "Falha na transcrição" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await resp.json();
    let text: string = data?.choices?.[0]?.message?.content?.trim?.() || "";

    // Safety post-processing: capitalize first letter, normalize "R$".
    if (text) {
      text = text.replace(/^["'`]+|["'`]+$/g, "").trim();
      text = text.replace(/\br\s*\$\s*/gi, "R$ ").replace(/R\$\s+/g, "R$ ");
      text = text.charAt(0).toUpperCase() + text.slice(1);
    }

    if (!text) {
      return new Response(JSON.stringify({ error: "Não consegui entender. Tente falar novamente." }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-audio error", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Erro desconhecido" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
