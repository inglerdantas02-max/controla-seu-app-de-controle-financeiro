// Transcribe audio (base64) using Lovable AI (Gemini multimodal) and
// post-process the text for Brazilian Portuguese financial messages.
// Input:  { audio: string (base64, no data: prefix), mimeType?: string }
// Output: { text: string }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `Você é um transcritor de áudios curtos em português do Brasil sobre finanças pessoais (gastos, ganhos, contas).

REGRAS OBRIGATÓRIAS:
1. Transcreva exatamente o que foi falado, mas corrigindo erros de português, pronúncia e gramática.
2. Primeira letra da frase SEMPRE maiúscula. Pontuação final correta (. ! ?).
3. Converta valores falados para o formato "R$ N" (sem centavos quando inteiros). Exemplos:
   - "trinta real" / "trinta reais" -> "R$ 30"
   - "duzentos" / "dusento" -> "R$ 200"
   - "cinquenta conto" -> "R$ 50"
   - "mil e quinhentos" -> "R$ 1500"
   - "vinte e cinco e cinquenta" -> "R$ 25,50"
4. Corrija palavras mal pronunciadas para o termo correto (ex: "almoco" -> "almoço", "gasolinha" -> "gasolina", "uber" mantém).
5. Mantenha o sentido original. NÃO invente informações.
6. Responda APENAS com a frase transcrita e corrigida. Sem aspas, sem explicações, sem prefixos.

Exemplos:
Áudio: "gastei trinta real no almoco"  -> Gastei R$ 30 no almoço.
Áudio: "ganhei dusento hoje"            -> Ganhei R$ 200 hoje.
Áudio: "paguei cinquenta na gasolinha"  -> Paguei R$ 50 na gasolina.`;

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

    const mt = mimeType || "audio/webm";
    const dataUrl = `data:${mt};base64,${audio}`;

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
              { type: "input_audio", input_audio: { data: dataUrl, format: mt.includes("mp4") ? "mp4" : mt.includes("ogg") ? "ogg" : mt.includes("wav") ? "wav" : "webm" } },
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
