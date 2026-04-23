// Transcribe audio (base64) using Lovable AI (Gemini multimodal) and
// post-process the text for Brazilian Portuguese financial messages.
// Input:  { audio: string (base64, no data: prefix), mimeType?: string }
// Output: { text: string }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Maximum base64 audio payload size (~6MB base64 ≈ 4.5MB raw audio)
const MAX_AUDIO_BASE64_BYTES = 6_000_000;

const SYSTEM_PROMPT = `Você é um TRANSCRITOR ESPECIALISTA de áudios curtos em PORTUGUÊS DO BRASIL (pt-BR) sobre finanças pessoais. NUNCA traduza para inglês ou outro idioma.

REGRAS OBRIGATÓRIAS:
1. Transcreva o que foi falado CORRIGINDO erros de pronúncia, gramática e português coloquial.
2. Primeira letra MAIÚSCULA. Pontuação final correta (. ! ?).
3. VALORES MONETÁRIOS — PRIORIDADE MÁXIMA. Converta sempre para "R$ N" (use vírgula para centavos):
   - "trinta" / "trinta real" / "trinta reais" / "trinta conto(s)" / "trinta pila" -> "R$ 30"
   - "trinta e cinco" -> "R$ 35"
   - "cem" / "cento" -> "R$ 100"; "cento e vinte" -> "R$ 120"; "cento e vinte e cinco" -> "R$ 125"
   - "duzentos" / "dusento" / "duzento" -> "R$ 200"; "trezentos" -> "R$ 300"
   - "mil" -> "R$ 1000"; "mil e quinhentos" -> "R$ 1500"; "dois mil" -> "R$ 2000"; "dois mil e quinhentos" -> "R$ 2500"
   - "vinte e cinco e cinquenta" / "vinte e cinco com cinquenta" -> "R$ 25,50"
   - "dez e noventa" / "dez reais e noventa centavos" -> "R$ 10,90"
   - Números já ditos como dígitos ("trinta", "30") -> sempre "R$ 30"
   - NUNCA escreva valor por extenso na saída. SEMPRE como "R$ N" ou "R$ N,NN".
4. Corrija palavras mal pronunciadas, gírias e termos coloquiais:
   - "almoco" -> "almoço"; "gasolinha" -> "gasolina"; "merca"/"mercadinho" -> "mercado"
   - "salario" -> "salário"; "frila"/"freela" -> "freela"
   - "rangu"/"boia"/"janta" -> mantenha "comida"/"jantar" se for o caso
   - "trampo" -> "trabalho"; "grana"/"bufunfa" -> mantenha valor + contexto
   - Capitalize nomes próprios: Uber, iFood, Pix, Netflix, Spotify, 99, Mercado Livre, Amazon
5. Identifique a INTENÇÃO financeira e use o verbo correto:
   - Saída: "gastei", "paguei", "comprei", "torrei", "gastando" -> use "Gastei" ou "Paguei"
   - Entrada: "ganhei", "recebi", "vendi", "caiu", "entrou", "pingou" -> use "Ganhei" ou "Recebi"
6. Mantenha o SENTIDO ORIGINAL. NÃO invente valores, datas, categorias ou produtos que não foram ditos.
7. Se o áudio estiver inaudível, ininteligível, vazio, ou for apenas ruído/respiração: responda EXATAMENTE "INAUDIVEL".
8. Se a frase NÃO tiver relação com finanças (ex: "oi tudo bem", "que horas são"): transcreva normal mesmo assim — o assistente trata depois.
9. Responda APENAS com a frase corrigida. SEM aspas, SEM explicações, SEM prefixos como "Transcrição:".

EXEMPLOS:
Áudio: "gastei trinta real no almoco"           -> Gastei R$ 30 no almoço.
Áudio: "ganhei dusento hoje"                    -> Ganhei R$ 200 hoje.
Áudio: "paguei cinquenta e cinco na gasolinha"  -> Paguei R$ 55 na gasolina.
Áudio: "recebi meu salario de dois mil"         -> Recebi meu salário de R$ 2000.
Áudio: "vendi um produto por cento e cinquenta" -> Vendi um produto por R$ 150.
Áudio: "torrei vinte conto no ifood"            -> Gastei R$ 20 no iFood.
Áudio: "pinguei um pix de quinhentos"           -> Recebi um Pix de R$ 500.
Áudio: "frila de trezentos"                     -> Recebi R$ 300 de freela.
Áudio: "uber doze e oitenta"                    -> Gastei R$ 12,80 no Uber.
Áudio: "quanto eu gastei essa semana"           -> Quanto eu gastei essa semana?`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth: validate JWT before doing any work
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData, error: authErr } = await supabase.auth.getUser();
    if (authErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { audio, mimeType } = await req.json();
    if (!audio || typeof audio !== "string") {
      return new Response(JSON.stringify({ error: "Áudio inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (audio.length > MAX_AUDIO_BASE64_BYTES) {
      return new Response(JSON.stringify({ error: "Áudio muito longo. Grave um trecho menor." }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      console.error("transcribe-audio: missing AI gateway credential");
      return new Response(
        JSON.stringify({ error: "Erro interno. Tente novamente." }),
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

    if (!text || /^INAUDIVEL\.?$/i.test(text)) {
      return new Response(JSON.stringify({ error: "Não entendi muito bem, pode repetir?" }), {
        status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("transcribe-audio error", e);
    return new Response(JSON.stringify({ error: "Erro interno. Tente novamente." }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
